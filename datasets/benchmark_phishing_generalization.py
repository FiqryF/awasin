"""Collect bounded public publisher indexes and evaluate the frozen model offline."""

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from hashlib import file_digest, sha256
from html.parser import HTMLParser
from importlib.metadata import version
import json
from pathlib import Path
import re
from time import perf_counter
from urllib.parse import urljoin, urlsplit
from zipfile import ZipFile

from benchmark_phishing_ml import (
    ACCOUNT, ENCODED, LABELS, SEED, BoundedArchive, archive_entries, clean_phiusiil, dedup_key,
    external_rows, MEMBER, ml_modules, records, scores, split_rows, target_and_group, url_text, verified_source,
)

CHAMPION_HASH = "585910e32e5f2967e941e7790d6f845a6c1c35318ea95ee533b059db18fc76f3"
THRESHOLD = .47
MODEL_LOCK = Path(__file__).with_name("requirements-ml.txt")
BODY_LIMIT = 3 * 1024 * 1024
PER_SOURCE = 55
INDEXES = (
    ("https://docs.python.org/3/contents.html", "documentation", r"/3/(library|howto|reference|tutorial)/.+\.html"),
    ("https://pkg.go.dev/std", "documentation", r"/[a-z0-9]+(/[a-z0-9]+)*"),
    ("https://doc.rust-lang.org/std/index.html", "documentation", r"/std/[a-z_]+/index\.html"),
    ("https://docs.djangoproject.com/en/5.2/contents/", "documentation", r"/en/5\.2/(ref|topics|howto|intro)/.+/"),
    ("https://www.postgresql.org/docs/current/index.html", "documentation", r"/docs/current/[a-z0-9-]+\.html"),
    ("https://docs.kernel.org/", "documentation", r"/[a-z0-9-]+/index\.html"),
    ("https://numpy.org/doc/stable/reference/index.html", "documentation", r"/doc/stable/reference/[^/]+\.html"),
    ("https://docs.scipy.org/doc/scipy/reference/index.html", "documentation", r"/doc/scipy/reference/[^/]+\.html"),
    ("https://www.sqlite.org/doclist.html", "documentation", r"/[a-z0-9_-]+\.html"),
    ("https://git-scm.com/docs", "documentation", r"/docs/git-[a-z0-9-]+"),
    ("https://docs.astral.sh/ruff/", "documentation", r"/ruff/[a-z0-9-]+/"),
    ("https://docs.pydantic.dev/latest/", "documentation", r"/latest/(api|concepts|errors)/.+/"),
    ("https://www.bi.go.id/id/publikasi/ruang-media/news-release/Pages/default.aspx", "government", r"/id/publikasi/ruang-media/news-release/Pages/[^/]+\.aspx"),
    ("https://www.bmkg.go.id/berita/", "government", r"/berita/.+"),
    ("https://www.bps.go.id/id/pressrelease", "government", r"/id/pressrelease/\d{4}/.+"),
    ("https://ugm.ac.id/id/berita/", "education", r"/id/berita/[a-z0-9-]+/"),
    ("https://itb.ac.id/berita", "education", r"/berita/[^/]+/\d+"),
    ("https://www.nasa.gov/news/", "news", r"/(news-release|general|missions)/.+"),
    ("https://www.theguardian.com/international", "news", r"/[a-z-]+/\d{4}/[a-z]{3}/\d{2}/[a-z0-9-]+"),
    ("https://www.ikea.co.id/in/produk", "product", r"/in/produk/[^?#]+-art-\d+"),
    ("https://www.adafruit.com/category/17", "product", r"/product/\d+"),
    ("https://www.gutenberg.org/ebooks/search/?query=shakespeare", "public_catalog", r"/ebooks/\d+"),
)


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.hrefs.extend(value for key, value in attrs if key == "href" and value)


def review_row(url, source, category, method, date):
    target, group = target_and_group(url)
    source_target, source_group = target_and_group(source)
    if (group is None or target.scheme != "https" or target.is_ip or source_group is None
            or source_target.scheme != "https" or not category or not date
            or (method == "publisher_index" and source_target.hostname != target.hostname)):
        raise ValueError("Expected a publicly attributed HTTPS hostname")
    return {
        "url": target.normalized_url, "source": source, "category": category,
        "method": method, "date": date, "domain": group, "indonesian": group.endswith(".id"),
        "review_status": "verified_public_publisher", "synthetic": False, "label": 0,
        "label_basis": "Exact same-host link on the publisher's public index.",
        "redistribution": "Local URL metadata only; publisher content not retained; rights vary by publisher.",
    }


def index_rows(html, source, category, path_rule, date):
    parser = Links()
    parser.feed(html)
    hostname = urlsplit(source).hostname
    found = {}
    for href in parser.hrefs:
        try:
            link = urlsplit(urljoin(source, href))
            if (link.scheme != "https" or link.hostname != hostname or link.username or link.password
                    or link.port is not None or link.query or not re.fullmatch(path_rule, link.path)):
                continue
            url = link._replace(fragment="").geturl()
            found[url] = review_row(url, source, category, "publisher_index", date)
        except ValueError:
            continue
    chosen = sorted(found, key=lambda url: sha256(f"{SEED}\0{url}".encode()).digest())[:PER_SOURCE]
    return [found[url] for url in chosen]


def collect(curated, output):
    import httpx

    def read_index(index):
        source, category, rule = index
        try:
            with httpx.stream("GET", source, timeout=8, follow_redirects=False,
                              headers={"Accept-Encoding": "identity"}) as response:
                if response.status_code != 200 or "text/html" not in response.headers.get("content-type", ""):
                    return source, [], f"http_{response.status_code}"
                if response.headers.get("content-encoding", "identity") != "identity":
                    return source, [], "encoding_rejected"
                data = bytearray()
                for chunk in response.iter_raw(chunk_size=8192):
                    data.extend(chunk)
                    if len(data) > BODY_LIMIT:
                        return source, [], "body_limit"
            return source, index_rows(data.decode("utf-8", errors="replace"), source, category, rule, date), "ok"
        except (httpx.HTTPError, ValueError):
            return source, [], "unavailable"

    date = datetime.now(UTC).date().isoformat()
    with ThreadPoolExecutor(max_workers=4) as executor:
        collected = list(executor.map(read_index, INDEXES))
    rows = []
    for source, matches, status in collected:
        print(f"{source}: {status}, {len(matches)} publisher links", flush=True)
        rows.extend(matches)
        if matches and urlsplit(source).query:
            row = review_row(source, source, "query", "publisher_index", date)
            row["label_basis"] = "Public publisher search page returned indexed catalog results."
            rows.append(row)
    for item in json.loads(curated.read_text(encoding="utf-8")):
        rows.append(review_row(item["url"], item["source"], item["category"], "manual_official_public_page", item["date"]))
        rows[-1]["label_basis"] = item["basis"]
        if item.get("indonesian"):
            rows[-1]["indonesian"] = True
    with output.open("x", encoding="utf-8") as stream:
        json.dump({"rows": rows, "sources": {source: status for source, _, status in collected}}, stream, indent=2)


def load_frozen(folder):
    joblib, *_ = ml_modules()
    expected = dict(line.split("==", 1) for line in MODEL_LOCK.read_text(encoding="utf-8").splitlines())
    if any(version(name) != pin for name, pin in expected.items()):
        raise ValueError("Dependency versions differ from the training environment")
    meta = json.loads((folder / "metrics.json").read_text(encoding="utf-8"))
    selected = meta["results"]["logistic"]["selected_trial"]
    if (meta["label_mapping"] != LABELS or meta["seed"] != SEED or meta["validation_champion"] != "logistic"
            or selected["threshold"] != THRESHOLD or meta["dependencies"] != expected):
        raise ValueError("Frozen training metadata differs from the benchmark")
    with (folder / "validation-champion.joblib").open("rb") as stream:
        if file_digest(stream, "sha256").hexdigest() != CHAMPION_HASH:
            raise ValueError("Frozen champion SHA-256 mismatch")
        stream.seek(0)
        model = joblib.load(stream)
    vectorizer, classifier = model.steps[0][1], model.steps[1][1]
    if (list(model.classes_) != [0, 1] or vectorizer.analyzer != "char" or vectorizer.ngram_range != (2, 5)
            or vectorizer.lowercase or len(vectorizer.vocabulary_) != 50_000 or classifier.C != 3):
        raise ValueError("Frozen model preprocessing differs from the recorded configuration")
    return model, meta


def separate_benign(rows, keys, groups):
    buckets = defaultdict(list)
    seen = set()
    for row in rows:
        if row["review_status"] != "verified_public_publisher" or row["synthetic"] or row["label"] != 0:
            buckets["excluded_unverified"].append(row)
            continue
        if not all(row.get(field) for field in ("source", "method", "date", "label_basis")):
            raise ValueError("Verified row is missing provenance")
        target, group = target_and_group(row["url"])
        if row["domain"] != group:
            raise ValueError("Recorded domain differs from parsed domain")
        key = dedup_key(target)
        if key in seen:
            buckets["duplicate"].append(row)
            continue
        seen.add(key)
        split = "exact_or_scheme_twin" if key in keys else "domain_overlap" if group in groups else "unseen"
        buckets[split].append((target, row))
    return buckets


def summarize(np, values, positive=False):
    n = len(values)
    flagged = int((values >= THRESHOLD).sum())
    result = {"n": n, "flagged": flagged, "unflagged": n - flagged, "coverage": 1 if n else None,
              "score_p05_median_p95": np.percentile(values, [5, 50, 95]).tolist() if n else []}
    if positive is not None:
        result["recall" if positive else "fpr"] = flagged / n if n else None
    return result


def structure(target):
    return {
        "root" if target.path == "/" else "nonroot", "short" if len(url_text(target)) <= 35 else "longer",
        *({"query"} if target.query else ()),
        *({"encoded"} if ENCODED.search(url_text(target)) else ()),
        *({"account_token"} if ACCOUNT.search(url_text(target)) else ()),
        *({"idn"} if "xn--" in target.hostname else ()),
        *({"subdomain"} if target.registered_domain and target.hostname != target.registered_domain else ()),
    }


def breakdown(np, targets, values, key, positive=False):
    parts = defaultdict(list)
    for item, score in zip(targets, values, strict=True):
        for name in key(item):
            parts[name].append(score)
    return {name: summarize(np, np.asarray(part), positive) for name, part in sorted(parts.items())}


def template(target):
    if target.path == "/":
        return None
    path = re.sub(r"\d+", "{n}", target.path.rstrip("/"))
    keys = sorted(pair.partition("=")[0] for pair in target.query.split("&") if pair)
    return path, tuple(keys)


def contribution_patterns(model, inputs):
    vectorizer, classifier = model.steps[0][1], model.steps[1][1]
    grams = vectorizer.get_feature_names_out()
    counts = Counter()
    for row in vectorizer.transform(inputs):
        effects = row.data * classifier.coef_[0, row.indices]
        top = effects.argsort()[-5:]
        for index in top:
            if effects[index] <= 0:
                continue
            gram = grams[row.indices[index]]
            kind = ("path_delimiter" if "/" in gram else "hostname_delimiter" if "." in gram
                    else "numeric" if any(c.isdigit() for c in gram) else "other")
            counts[kind] += 1
    return counts


def synthetic_cases():
    templates = {
        "root": "/", "documentation": "/reference/user-guide.html", "login": "/login",
        "account": "/account/settings", "encoded_path": "/docs/a%20guide",
        "query": "/search?q=public%20docs&page=2", "long": "/docs/" + "chapter/" * 24 + "index.html",
    }
    for host in ("example.com", "example.net", "example.org"):
        for kind, path in templates.items():
            yield kind, target_and_group(f"https://{host}{path}")[0]
        yield "subdomain", target_and_group(f"https://docs.{host}/")[0]
    for host in ("bücher.example.com", "xn--bcher-kva.example.com"):
        yield "idn_pair", target_and_group(f"https://{host}/")[0]


def evaluate(phi, phishtank, champion, manifest, output):
    _, np, psutil, _, _, _, _, thread_limit, _ = ml_modules()
    started = perf_counter()
    proc = psutil.Process()
    model, meta = load_frozen(champion)
    phi_hash = verified_source(phi)
    with BoundedArchive(phi.open("rb", buffering=0)) as stream, ZipFile(stream) as archive:
        member = next(item for item in archive_entries(archive) if item.filename == MEMBER)
        with archive.open(member) as source:
            rows, groups, _ = clean_phiusiil(records(source, {"URL", "label"}))
    keys = {dedup_key(target) for target, _, _ in rows}
    primary_templates = {item for target, _, _ in rows if (item := template(target)) is not None}
    split = {name: len(part) for name, part in split_rows(rows).items()}
    if phi_hash != meta["primary_sha256"] or split != {name: part["rows"] for name, part in meta["split"].items()}:
        raise ValueError("Original training split differs from the recorded split")
    del rows
    raw = json.loads(manifest.read_text(encoding="utf-8"))
    buckets = separate_benign(raw["rows"], keys, groups)
    phishing_hash = verified_source(phishtank)
    phishing, cleaning = external_rows(phishtank, groups)
    del keys, groups
    external_targets = [target for target, _, _ in phishing]
    synthetic = list(synthetic_cases())
    output_data = {"champion_sha256": CHAMPION_HASH, "threshold": THRESHOLD, "split": split,
                   "phiusiil_sha256": phi_hash, "phishtank_sha256": phishing_hash, "benign": {},
                   "manifest_sha256": sha256(manifest.read_bytes()).hexdigest(), "source_statuses": raw["sources"]}
    with thread_limit(limits=2):
        for name in ("unseen", "domain_overlap", "exact_or_scheme_twin"):
            items = buckets[name]
            inputs = [url_text(target) for target, _ in items]
            values = scores(model, inputs) if items else np.array([])
            domain_breakdown = breakdown(np, items, values, lambda item: [item[1]["domain"]])
            output_data["benign"][name] = {
                **summarize(np, values), "domains": len({row["domain"] for _, row in items}),
                "sources": len({row["source"] for _, row in items}),
                "by_category": breakdown(np, items, values, lambda item: [item[1]["category"]]),
                "by_domain": domain_breakdown,
                "domain_macro_fpr": float(np.mean([item["fpr"] for item in domain_breakdown.values()])) if items else None,
                "by_structure": breakdown(np, items, values, lambda item: structure(item[0])),
                "indonesian": summarize(np, values[np.asarray([row["indonesian"] for _, row in items], dtype=bool)]),
                "shared_primary_templates": sum(template(target) in primary_templates for target, _ in items),
                "positive_ngram_contributions": contribution_patterns(model, [value for value, score in zip(inputs, values, strict=True)
                                                                             if score >= THRESHOLD]) if (values >= THRESHOLD).any() else {},
            }
        values = scores(model, [url_text(target) for target in external_targets])
        output_data["phishtank"] = {
            **summarize(np, values, True), "cleaning": cleaning,
            "by_structure": breakdown(np, external_targets, values, structure, True),
        }
        values = scores(model, [url_text(target) for _, target in synthetic])
        output_data["synthetic"] = breakdown(np, synthetic, values, lambda item: [item[0]], positive=None)
        output_data["synthetic_idn_parity"] = bool(values[-1] == values[-2])
    output_data["duplicate_manifest_rows"] = len(buckets["duplicate"])
    output_data["excluded_unverified"] = len(buckets["excluded_unverified"])
    output_data["runtime_seconds"] = perf_counter() - started
    memory = proc.memory_info()
    output_data["peak_rss_bytes"] = getattr(memory, "peak_wset", memory.rss)
    with output.open("x", encoding="utf-8") as stream:
        json.dump(output_data, stream, indent=2, allow_nan=False)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    commands = cli.add_subparsers(dest="command", required=True)
    collect_cli = commands.add_parser("collect")
    collect_cli.add_argument("curated", type=Path)
    collect_cli.add_argument("output", type=Path)
    eval_cli = commands.add_parser("evaluate")
    for name in ("phi", "phishtank", "champion", "manifest", "output"):
        eval_cli.add_argument(name, type=Path)
    args = vars(cli.parse_args())
    command = args.pop("command")
    (collect if command == "collect" else evaluate)(**args)
