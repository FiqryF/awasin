"""Offline URL-only benchmark. Never fetch an input URL or load a serialized model."""

import argparse
import asyncio
from collections import Counter
import csv
import gzip
from hashlib import file_digest, sha256
from importlib.metadata import version
from io import BytesIO
import json
from math import log2
from pathlib import Path
from random import Random
import re
import sys
from time import perf_counter
from zipfile import ZipFile

from audit import BoundedArchive, BoundedLines, archive_entries, url_key
from evaluate_url_inspector import MANIFEST, MEMBER, UrlInspector, binary_metrics, parse_url

SEED = 10402
MAX_ROWS = 300_000
MAX_TRAIN_ROWS = 60_000
MAX_URL = 4096
JOBS = 2
VOCABULARY = 50_000
FPR_LIMIT = .03
ABSTENTION_MARGIN = .05
LABELS = {"0": 1, "1": 0}
FEATURES = (
    "url_length_without_scheme", "hostname_length", "registered_domain_length", "subdomain_count",
    "dots", "hyphens", "digits", "host_digit_ratio", "host_entropy", "path_length", "path_depth",
    "query_length", "query_parameters", "percent_encoded_ratio", "account_tokens", "punycode",
    "explicit_port", "ip_literal",
)
ENCODED = re.compile(r"%[0-9a-fA-F]{2}")
ACCOUNT = re.compile(r"(?<![a-z])(?:login|signin|account|verify|password|otp|verifikasi)(?![a-z])", re.I)


def verified_source(path):
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    item = next((entry for entry in manifest["datasets"] if entry["id"] == path.name), None)
    if item is None or path.stat().st_size != item["size_bytes"]:
        raise ValueError("Source name or size differs from Phase 10A manifest")
    with path.open("rb") as source:
        digest = file_digest(source, "sha256").hexdigest()
    if digest != item["sha256"]:
        raise ValueError("Source SHA-256 differs from Phase 10A manifest")
    return digest


def records(source, columns):
    lines = BoundedLines(source)
    reader = csv.DictReader(lines, strict=True)
    if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames) or not columns.issubset(reader.fieldnames):
        raise ValueError("Expected source columns missing or ambiguous")
    for index, row in enumerate(reader, 1):
        lines.record = 0
        if index > MAX_ROWS:
            raise ValueError("Source exceeds experimental row budget")
        yield row


def target_and_group(raw):
    if not isinstance(raw, str) or len(raw) > MAX_URL:
        raise ValueError("Unsupported URL length")
    target = parse_url(raw)
    if not target.registered_domain and not target.is_ip:
        return target, None
    return target, target.registered_domain or target.hostname


def dedup_key(target):
    # Treat scheme-only twins as near duplicates; features also omit the scheme.
    return url_key(target.normalized_url).split("://", 1)[1]


def clean_phiusiil(rows):
    accepted, conflicts, groups, stats = {}, set(), set(), Counter()
    for row in rows:
        stats["source_rows"] += 1
        label = LABELS.get(row.get("label"))
        if label is None:
            stats["invalid_label"] += 1
            continue
        stats[f"raw_label_{row['label']}"] += 1
        try:
            target, group = target_and_group(row.get("URL"))
        except ValueError:
            stats["invalid_url"] += 1
            continue
        if group is None:
            stats["ambiguous_domain"] += 1
            continue
        groups.add(group)
        key = dedup_key(target)
        if key in accepted:
            stats["duplicate_rows"] += 1
            if target.scheme != accepted[key][0].scheme:
                stats["scheme_variant_rows"] += 1
            if label != accepted[key][1]:
                conflicts.add(key)
        else:
            accepted[key] = (target, label, group)
    for key in conflicts:
        del accepted[key]
    stats["conflicting_keys_removed"] = len(conflicts)
    stats["cleaned_rows"] = len(accepted)
    return list(accepted.values()), groups, stats


def split_rows(rows):
    parts = {name: [] for name in ("train", "validation", "test")}
    for target, label, group in rows:
        bucket = int.from_bytes(sha256(f"{SEED}\0{group}".encode()).digest()[:4], "big") % 100
        part = "train" if bucket < 70 else "validation" if bucket < 85 else "test"
        parts[part].append((target, label, group))
    for index, (name, part) in enumerate(parts.items()):
        if {row[1] for row in part} != {0, 1}:
            raise ValueError(f"Partition {name} needs both classes")
        groups = {row[2] for row in part}
        for other in list(parts.values())[:index]:
            if groups.intersection(row[2] for row in other):
                raise ValueError("Domain leakage")
    return parts


def external_rows(path, phi_groups):
    rows, stats = {}, Counter()
    with gzip.open(path, "rb") as source:
        for row in records(source, {"url", "verified"}):
            stats["source_rows"] += 1
            if row["verified"] != "yes":
                stats["unverified"] += 1
                continue
            try:
                target, group = target_and_group(row["url"])
            except ValueError:
                stats["invalid_url"] += 1
                continue
            if group is None:
                stats["ambiguous_domain"] += 1
            elif group in phi_groups:
                stats["overlapping_domain_rows"] += 1
            elif (key := dedup_key(target)) in rows:
                stats["duplicate_rows"] += 1
            else:
                rows[key] = (target, 1, group)
    return list(rows.values()), stats


def url_text(target):
    return target.normalized_url.split("://", 1)[1]


def lexical(target):
    raw, host, domain, path, query = url_text(target), target.hostname, target.registered_domain or "", target.path, target.query
    entropy = -sum((n / len(host)) * log2(n / len(host)) for n in Counter(host).values())
    return (
        len(raw), len(host), len(domain), host.removesuffix(domain).count(".") if domain else 0,
        raw.count("."), raw.count("-"), sum(c.isascii() and c.isdigit() for c in raw),
        sum(c.isdigit() for c in host) / len(host), entropy, len(path),
        sum(bool(part) for part in path.split("/")), len(query), query.count("&") + bool(query),
        3 * len(ENCODED.findall(raw)) / len(raw), len(ACCOUNT.findall(raw)),
        any(label.startswith("xn--") for label in host.split(".")), target.port is not None, target.is_ip,
    )


def ml_modules():
    try:
        import joblib
        import numpy as np
        import psutil
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import make_pipeline
        from threadpoolctl import threadpool_limits
        from xgboost import XGBClassifier
    except ImportError as error:
        raise RuntimeError("Install isolated datasets/requirements-ml.txt dependencies first") from error
    return joblib, np, psutil, RandomForestClassifier, TfidfVectorizer, LogisticRegression, make_pipeline, threadpool_limits, XGBClassifier


def models():
    _, np, _, forest, vectorizer, logistic, pipeline, _, xgb = ml_modules()
    for ngram, c in [((3, 5), 1.0), ((2, 5), 3.0)]:
        params = {"ngram_range": ngram, "C": c, "max_features": VOCABULARY, "min_df": 3}
        yield "logistic", params, pipeline(
            vectorizer(analyzer="char", ngram_range=ngram, min_df=3, max_features=VOCABULARY,
                       dtype=np.float32, lowercase=False, sublinear_tf=True),
            logistic(C=c, solver="liblinear", max_iter=300, random_state=SEED),
        )
    for depth, rate in [(4, .10), (7, .07)]:
        params = {"max_depth": depth, "learning_rate": rate, "n_estimators": 140, "min_child_weight": 4, "reg_lambda": 2}
        yield "xgboost", params, xgb(**params, tree_method="hist", device="cpu", n_jobs=JOBS, random_state=SEED)
    for depth, leaf in [(12, 8), (20, 5)]:
        params = {"max_depth": depth, "min_samples_leaf": leaf, "n_estimators": 90}
        yield "random_forest", params, forest(**params, n_jobs=JOBS, random_state=SEED)


def scores(model, features):
    positive = list(model.classes_).index(1)
    return model.predict_proba(features)[:, positive]


def matrix(labels, flagged):
    return {
        "tp": int(((labels == 1) & flagged).sum()), "fp": int(((labels == 0) & flagged).sum()),
        "tn": int(((labels == 0) & ~flagged).sum()), "fn": int(((labels == 1) & ~flagged).sum()),
    }


def threshold_for(labels, prediction):
    choices = []
    for threshold in [value / 100 for value in range(1, 101)] + [1.01]:
        metrics = binary_metrics(matrix(labels, prediction >= threshold))
        if metrics["false_positive_rate"] <= FPR_LIMIT:
            choices.append((metrics["f1"], metrics["recall"], -metrics["false_positive_rate"], threshold))
    return max(choices)


def evaluation(np, labels, prediction, threshold, *, abstain=False):
    selected = np.abs(prediction - threshold) >= ABSTENTION_MARGIN if abstain else np.ones(len(labels), dtype=bool)
    counts = matrix(labels[selected], prediction[selected] >= threshold)
    coverage = float(selected.mean())
    return {"confusion": counts, **binary_metrics(counts), "coverage": coverage, "inconclusive": 1 - coverage,
            "abstained_phishing": int(((labels == 1) & ~selected).sum())}


def calibration(np, labels, prediction):
    bucket = np.minimum((prediction * 10).astype(int), 9)
    ece = sum(float(mask.mean() * abs(prediction[mask].mean() - labels[mask].mean()))
              for index in range(10) if (mask := bucket == index).any())
    return {"brier": float(np.mean((prediction - labels) ** 2)), "ece_10": ece}


def describe(part):
    return {"rows": len(part), "groups": len({row[2] for row in part}),
            "phishing": sum(row[1] for row in part), "legitimate": sum(row[1] == 0 for row in part)}


def source_profile(part):
    stats = Counter()
    for target, label, _ in part:
        name = "phishing" if label else "legitimate"
        stats[f"{name}/{target.scheme}"] += 1
        stats[f"{name}/{'root' if target.path == '/' else 'other_path'}"] += 1
        if target.query:
            stats[f"{name}/query"] += 1
    return stats


def path_breakdown(np, part, labels, flagged):
    root = np.asarray([row[0].path == "/" for row in part])
    return {name: binary_metrics(matrix(labels[mask], flagged[mask]))
            for name, mask in (("root", root), ("nonroot", ~root)) if mask.any()}


def error_patterns(part, flagged):
    stats = Counter()
    for (target, label, _), predicted in zip(part, flagged):
        if label == predicted:
            continue
        kind = "fn" if label else "fp"
        stats[f"{kind}/{'root' if target.path == '/' else 'nonroot'}"] += 1
        for signal, present in (
            ("query", bool(target.query)), ("account_token", bool(ACCOUNT.search(url_text(target)))),
            ("encoded", bool(ENCODED.search(url_text(target)))), ("length_gt_120", len(url_text(target)) > 120),
            ("punycode", "xn--" in target.hostname), ("subdomain", bool(target.registered_domain and target.hostname != target.registered_domain)),
        ):
            if present:
                stats[f"{kind}/{signal}"] += 1
    return stats


async def heuristic_predictions(part):
    engine = UrlInspector()
    result = []
    for target, _, _ in part:
        inspected = await engine.inspect(target)
        result.append(inspected.risk == "medium" or inspected.status == "partial")
    return result


def run(phi_path, phishtank_path, output):
    joblib, np, psutil, _, _, _, _, thread_limit, _ = ml_modules()
    proc = psutil.Process()
    memory = psutil.virtual_memory()
    if memory.available < 1280 * 1024**2 or psutil.disk_usage(str(output.resolve().anchor)).free < 256 * 1024**2:
        raise RuntimeError("Experiment requires at least 1280 MiB available RAM and 256 MiB free disk")
    output.mkdir(parents=True, exist_ok=False)
    source_hash = verified_source(phi_path)
    with BoundedArchive(phi_path.open("rb", buffering=0)) as stream, ZipFile(stream) as archive:
        member = next(item for item in archive_entries(archive) if item.filename == MEMBER)
        with archive.open(member) as source:
            rows, primary_groups, cleaning = clean_phiusiil(records(source, {"URL", "label"}))
    parts = split_rows(rows)
    del rows
    train, valid = parts["train"], parts["validation"]
    if len(train) > MAX_TRAIN_ROWS:
        train = Random(SEED).sample(train, MAX_TRAIN_ROWS)
    print(f"Prepared {sum(map(len, parts.values()))} URLs", flush=True)

    def inputs(part):
        return {"text": [url_text(row[0]) for row in part],
                "lexical": np.asarray([lexical(row[0]) for row in part], dtype=np.float32)}

    def labels(part):
        return np.asarray([row[1] for row in part], dtype=np.int8)

    train_x, valid_x = inputs(train), inputs(valid)
    train_y, valid_y = labels(train), labels(valid)
    best, trials = {}, []
    with thread_limit(limits=JOBS):
        for name, params, model in models():
            kind = "text" if name == "logistic" else "lexical"
            started = perf_counter()
            model.fit(train_x[kind], train_y)
            fit_seconds = perf_counter() - started
            prediction = scores(model, valid_x[kind])
            rank = threshold_for(valid_y, prediction)
            trial = {"model": name, "params": params, "fit_seconds": fit_seconds, "threshold": rank[-1],
                     "validation": evaluation(np, valid_y, prediction, rank[-1]),
                     "at_point_five": evaluation(np, valid_y, prediction, .5)}
            trials.append(trial)
            if name not in best or rank[:3] > best[name][0][:3]:
                best[name] = (rank, model, trial)
            print(f"{name}: fit {fit_seconds:.1f}s, validation F1 {rank[0]:.3f}", flush=True)
        champion = max(best, key=lambda name: best[name][0][:3])
        # Selection above is final. No held-out or external observation influences it.
        del train_x, valid_x
        test = parts["test"]
        test_x, test_y = inputs(test), labels(test)
        external, external_stats, external_hash = [], {}, None
        if phishtank_path:
            external_hash = verified_source(phishtank_path)
            external, external_stats = external_rows(phishtank_path, primary_groups)
        ext_x = inputs(external) if external else None
        heuristic = np.asarray(asyncio.run(heuristic_predictions(test)), dtype=bool)
        results = {"heuristics": {"test": evaluation(np, test_y, heuristic.astype(float), .5),
                                  "errors": error_patterns(test, heuristic)}}
        if external:
            results["heuristics"]["external_recall"] = sum(asyncio.run(heuristic_predictions(external))) / len(external)
        for name, (rank, model, trial) in best.items():
            kind = "text" if name == "logistic" else "lexical"
            prediction = scores(model, test_x[kind])
            threshold = rank[-1]
            times = []
            for target, _, _ in test[::max(1, len(test) // 200)][:200]:
                started = perf_counter()
                parsed = parse_url(target.normalized_url)
                item = [url_text(parsed)] if kind == "text" else np.asarray([lexical(parsed)], dtype=np.float32)
                scores(model, item)
                times.append(1000 * (perf_counter() - started))
            payload = BytesIO()
            joblib.dump(model, payload, compress=3)
            size = payload.tell()
            resource = proc.memory_info()
            result = {
                "selected_trial": trial, "test": evaluation(np, test_y, prediction, threshold),
                "abstention": evaluation(np, test_y, prediction, threshold, abstain=True),
                "score_calibration": calibration(np, test_y, prediction),
                "errors": error_patterns(test, prediction >= threshold),
                "path_breakdown": path_breakdown(np, test, test_y, prediction >= threshold),
                "model_bytes": size, "mean_ms": float(np.mean(times)), "p95_ms": float(np.percentile(times, 95)),
                "latency_samples": len(times), "process_rss_bytes": resource.rss,
                "process_peak_rss_bytes": getattr(resource, "peak_wset", None),
                "features": len(model[0].vocabulary_) if kind == "text" else len(FEATURES),
            }
            if ext_x is not None:
                result["external_recall"] = float((scores(model, ext_x[kind]) >= threshold).mean())
            if name == champion:
                path = output / "validation-champion.joblib"
                with path.open("xb") as stream:
                    stream.write(payload.getbuffer())
                with path.open("rb") as stream:
                    result["artifact_sha256"] = file_digest(stream, "sha256").hexdigest()
            results[name] = result

    report = {
        "python": sys.version.split()[0],
        "dependencies": {name: version(name) for name in ("numpy", "scipy", "scikit-learn", "xgboost-cpu", "joblib", "threadpoolctl", "psutil")},
        "seed": SEED, "jobs": JOBS, "max_rows": MAX_ROWS, "max_train_rows": MAX_TRAIN_ROWS, "max_vocabulary": VOCABULARY,
        "memory_available_start": memory.available, "memory_total": memory.total,
        "label_mapping": LABELS, "lexical_order": FEATURES, "primary_sha256": source_hash,
        "cleaning": cleaning, "split": {name: describe(part) for name, part in parts.items()},
        "training_sample": describe(train),
        "source_profile": {name: source_profile(part) for name, part in parts.items()}, "threshold_fpr_limit": FPR_LIMIT,
        "abstention_margin": ABSTENTION_MARGIN, "trials": trials, "validation_champion": champion,
        "external_sha256": external_hash, "external_cleaning": external_stats,
        "external": describe(external), "results": results,
    }
    with (output / "metrics.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
    print(f"Benchmark complete: {output} (validation champion: {champion})", flush=True)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("phiusiil", type=Path)
    cli.add_argument("--phishtank", type=Path)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    run(args.phiusiil, args.phishtank, args.output)
