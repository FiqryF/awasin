"""Offline PhiUSIIL benchmark. Run with backend on PYTHONPATH."""

import argparse
import asyncio
import csv
from collections import Counter
from hashlib import file_digest, sha256
import json
from pathlib import Path
from zipfile import ZipFile

from audit import BoundedArchive, BoundedLines, archive_entries, url_key
from app.modules.analysis.inspect_url import UrlInspector
from app.modules.analysis.url import parse_url

SEED = "awasin-10b-v1"
MEMBER = "PhiUSIIL_Phishing_URL_Dataset.csv"
MANIFEST = Path(__file__).parent / "manifests" / "phase10a.json"


def benchmark_rows(archive_path):
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    expected = next(item["sha256"] for item in manifest["datasets"] if item["id"] == archive_path.name)
    with archive_path.open("rb") as file:
        if file_digest(file, "sha256").hexdigest() != expected:
            raise ValueError("Source archive does not match the Phase 10A manifest")
    rows, conflicts, stats = {}, set(), Counter()
    with BoundedArchive(archive_path.open("rb", buffering=0)) as file, ZipFile(file) as archive:
        members = {entry.filename: entry for entry in archive_entries(archive)}
        with archive.open(members[MEMBER]) as source:
            lines = BoundedLines(source)
            reader = csv.DictReader(lines, strict=True)
            for row in reader:
                lines.record = 0
                stats["source_rows"] += 1
                label = row["label"]
                if label not in {"0", "1"}:
                    stats["invalid_label"] += 1
                    continue
                try:
                    url = row["URL"]
                    if len(url) > 4096:
                        raise ValueError
                    target = parse_url(url)
                except (ValueError, TypeError):
                    stats["rejected_by_api_policy"] += 1
                    continue
                group = target.registered_domain or target.hostname
                if sha256((SEED + "\0" + group).encode()).digest()[0] >= 13:
                    continue
                key = url_key(target.normalized_url)
                if key in rows:
                    stats["duplicate_rows"] += 1
                    if rows[key][0] != label:
                        conflicts.add(key)
                else:
                    rows[key] = (label, target, group)
    for key in conflicts:
        rows.pop(key)
    stats["conflicting_urls_excluded"] = len(conflicts)
    stats["domain_groups"] = len({value[2] for value in rows.values()})
    return rows.values(), stats


def ratio(numerator, denominator):
    return numerator / denominator if denominator else None


def binary_metrics(matrix):
    tp, fp, tn, fn = (matrix[key] for key in ("tp", "fp", "tn", "fn"))
    recall, specificity = ratio(tp, tp + fn), ratio(tn, tn + fp)
    return {
        "accuracy": ratio(tp + tn, tp + tn + fp + fn),
        "balanced_accuracy": (recall + specificity) / 2 if recall is not None and specificity is not None else None,
        "precision": ratio(tp, tp + fp),
        "recall": recall,
        "f1": ratio(2 * tp, 2 * tp + fp + fn),
        "false_positive_rate": ratio(fp, fp + tn),
        "false_negative_rate": ratio(fn, fn + tp),
    }


async def evaluate(archive_path):
    rows, stats = benchmark_rows(archive_path)
    engine = UrlInspector()
    matrix, disposition, decided_correctly = Counter(), Counter(), Counter()
    for label, target, _ in rows:
        result = await engine.inspect(target)
        flagged = result.risk in {"medium", "high"} or result.status == "partial"
        if label == "0":
            matrix["tp" if flagged else "fn"] += 1
        else:
            matrix["fp" if flagged else "tn"] += 1
        if label == "0" and result.risk in {"medium", "high"}:
            decided_correctly["phishing"] += 1
        elif label == "1" and result.risk == "low":
            decided_correctly["legitimate"] += 1
        disposition[f"{result.status}/{result.risk}"] += 1
    count = sum(matrix.values())
    matrix = dict.fromkeys(("tp", "fp", "tn", "fn"), 0) | matrix
    class_counts = {"phishing": matrix["tp"] + matrix["fn"], "legitimate": matrix["tn"] + matrix["fp"]}
    unknown = sum(v for k, v in disposition.items() if k.endswith("/unknown"))
    per_class = {label: ratio(decided_correctly[label], total) for label, total in class_counts.items()}
    return {
        "seed": SEED, "domain_bucket": "first SHA-256 byte < 13 of 256",
        "sample": count, "class_counts": class_counts,
        "counts": stats, "indicator_confusion": matrix, "indicator_metrics": binary_metrics(matrix),
        "engine_disposition": disposition, "unknown_rate": ratio(unknown, count),
        "assigned_risk_coverage": ratio(count - unknown, count),
        "decision_correct_rate_by_class": per_class,
        "decision_balanced_accuracy": sum(per_class.values()) / len(per_class) if all(v is not None for v in per_class.values()) else None,
        "provider_lookups": 0,
    }


async def evaluate_benign(manifest_path):
    """Evaluate publisher-attributed benign URLs separately from the PhiUSIIL sample."""
    data = manifest_path.read_bytes()
    rows = json.loads(data)["rows"]
    engine = UrlInspector()
    counts, seen = Counter(), set()
    for row in rows:
        if row["review_status"] != "verified_public_publisher" or row["synthetic"] or row["label"] != 0:
            continue
        target = parse_url(row["url"])
        key = url_key(target.normalized_url)
        if key in seen:
            continue
        seen.add(key)
        result = await engine.inspect(target)
        flagged = result.status == "partial" or result.risk in {"medium", "high"}
        counts["nonroot"] += target.path != "/"
        counts["flagged"] += flagged
        counts["flagged_nonroot"] += flagged and target.path != "/"
    return {"manifest_sha256": sha256(data).hexdigest(), "total": len(seen), **counts,
            "indicator_false_positive_rate": ratio(counts["flagged"], len(seen)), "provider_lookups": 0}


async def run(archive, benign_manifest):
    result = await evaluate(archive)
    if benign_manifest:
        result["benign_pilot"] = await evaluate_benign(benign_manifest)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--benign-manifest", type=Path)
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.archive, args.benign_manifest)), indent=2))
