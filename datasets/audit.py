"""Audit a local dataset source into an aggregate JSON manifest. No extraction or networking."""

import argparse
import csv
import gzip
import io
import json
import ntpath
import re
import stat
import unicodedata
from collections import Counter
from hashlib import blake2b, file_digest
from pathlib import Path, PureWindowsPath
from urllib.parse import urlsplit, urlunsplit
from zipfile import BadZipFile, ZipFile

MIB = 1024 * 1024
MAX_SOURCE = 2 * 1024 * MIB
MAX_CENTRAL_READ = 16 * MIB
MAX_ARCHIVE = 2 * 1024 * MIB
MAX_ENTRIES = 10_000
MAX_TABLE = 384 * MIB
MAX_ROW = MIB
MAX_ROWS = 3_000_000
MAX_KEYS = 250_000
IMAGES = {".png", ".jpg", ".jpeg", ".webp"}
VIDEOS = {".mp4", ".webm", ".avi", ".mov", ".mkv"}
TOKEN = re.compile(r"[a-zA-Z0-9_ -]{1,48}\Z")
HEADER = re.compile(r"[a-zA-Z][a-zA-Z0-9_ .-]{0,79}\Z")
SMS_LABELS = {"0": "normal", "1": "fraud", "2": "promotion"}
LANGUAGES = {"id", "en", "english", "hindi", "hinglish", "fr", "de", "es", "pt", "it", "ru", "zh", "ar",
             "hi", "ja", "ko", "vi", "th", "ms", "tl", "nl", "tr", "pl", "uk", "unknown"}
GENERATORS = {"real", "sdv4", "sdv5", "stable diffusion", "imagenet", "adm", "biggan", "glide", "midjourney",
              "vqdm", "wukong", "stable_diffusion_v_1_4", "stable_diffusion_v_1_5"}
SOURCE_GROUPS = {"synthetic", "original", "unknown", "smishing_dataset", "uci_sms_spam", "synthetic_tier_c",
                 "kaggle_hindi_merged", "indian_telecom_sms", "benchmark_ground_truth"}


class AuditLimit(ValueError):
    pass


class BoundedArchive(io.BufferedReader):
    def read(self, size=-1):
        if size > MAX_CENTRAL_READ:
            raise AuditLimit("archive metadata read exceeds cap")
        data = super().read(MAX_CENTRAL_READ + 1 if size < 0 else size)
        if len(data) > MAX_CENTRAL_READ:
            raise AuditLimit("archive metadata read exceeds cap")
        return data


def safe_member(name):
    path = PureWindowsPath(name)
    parts = name.rstrip("/").split("/")
    return (
        not path.drive and not path.root and "\\" not in name
        and all(part not in {"", ".", ".."} and part == part.rstrip(" .")
                and not (ntpath.isreserved(part) if hasattr(ntpath, "isreserved") else PureWindowsPath(part).is_reserved())
                and not any(c in ':<>|?*"\0' or ord(c) < 32 for c in part) for part in parts)
    )


def archive_entries(archive):
    entries = archive.infolist()
    if len(entries) > MAX_ENTRIES or sum(i.file_size for i in entries) > MAX_ARCHIVE:
        raise AuditLimit("archive entry or expanded size exceeds cap")
    names = set()
    for item in entries:
        name = item.filename.rstrip("/").casefold()
        kind = stat.S_IFMT(item.external_attr >> 16)
        if (
            not safe_member(item.orig_filename) or name in names
            or kind not in {0, stat.S_IFREG, stat.S_IFDIR}
            or bool(item.flag_bits & 1) or item.file_size > MAX_ARCHIVE
            or item.file_size > 500 * max(1, item.compress_size)
        ):
            raise AuditLimit("unsafe path, member type, encryption, collision or compression ratio")
        names.add(name)
    return [item for item in entries if not item.is_dir()]


class BoundedLines:
    def __init__(self, source):
        self.source, self.total, self.record = source, 0, 0

    def __iter__(self):
        return self

    def __next__(self):
        data = self.source.readline(MAX_ROW + 1)
        if not data:
            raise StopIteration
        self.total += len(data)
        self.record += len(data)
        if self.total > MAX_TABLE or self.record > MAX_ROW:
            raise AuditLimit("table byte or record cap reached")
        return data.decode("utf-8-sig" if self.total == len(data) else "utf-8")


def csv_rows(lines, *, format):
    csv.field_size_limit(MAX_ROW)
    if format == "arff":
        headers = []
        for line in lines:
            lines.record = 0
            stripped = line.strip()
            if stripped.lower().startswith("@attribute "):
                headers.append(stripped.split()[1].strip("'\""))
                if len(headers) > 128:
                    raise AuditLimit("too many attributes")
            if stripped.lower() == "@data":
                break
        else:
            raise ValueError("missing ARFF data section")
    reader = csv.reader(lines, strict=True)
    if format == "ranking":
        headers = ["rank", "domain"]
    elif format != "arff":
        headers = next(reader, [])
    if not headers or len(headers) > 128 or len(set(headers)) != len(headers) or not all(HEADER.fullmatch(h) for h in headers):
        raise ValueError("invalid or unsupported table header")
    while True:
        lines.record = 0
        row = next(reader, None)
        if row is None:
            return
        if row:
            yield dict(zip(headers, row)) if len(row) == len(headers) else None


def jsonl_rows(lines):
    for line in lines:
        lines.record = 0
        try:
            row = json.loads(line)
        except (ValueError, RecursionError):
            row = None
        if isinstance(row, dict) and len(row) <= 128 and all(HEADER.fullmatch(key) for key in row):
            yield row
        else:
            yield None


def url_key(value):
    # Equality key only. Never resolve, connect, or treat normalized strings as evidence of safety.
    value = value.strip()
    try:
        parts = urlsplit(value)
        host = parts.hostname
        if parts.scheme in {"http", "https"} and host and not parts.username and not parts.password:
            host = host.encode("idna").decode("ascii").lower().rstrip(".")
            host = "[" + host + "]" if ":" in host else host
            port = parts.port
            if port and (parts.scheme, port) not in {("http", 80), ("https", 443)}:
                host += ":" + str(port)
            return urlunsplit((parts.scheme, host, parts.path or "/", parts.query, ""))
    except (ValueError, UnicodeError):
        pass
    return value


def digest(value):
    return blake2b(value.encode("utf-8", errors="surrogatepass"), digest_size=16).digest()


def label_value(value):
    if isinstance(value, (str, bool, int)) and TOKEN.fullmatch(str(value)):
        candidate = str(value).strip()
        if candidate.casefold() in {
            "-1", "0", "1", "2", "true", "false", "yes", "no", "ham", "spam", "legitimate", "phishing",
            "normal", "scam", "fraud", "promo", "promotion", "promosi", "penipuan", "benign", "malicious", "safe", "real", "fake",
            "ai", "human", "synthetic", "generated", "loan", "gambling", "evil-service", "lottery",
        }:
            return candidate
    return "<other>"


def table(source, *, format="csv", media_names=frozenset(), row_stream=None):
    rows = row_stream if row_stream is not None else (
        jsonl_rows(BoundedLines(source)) if format == "jsonl" else csv_rows(BoundedLines(source), format=format)
    )
    columns, missing, labels, languages, generators, sources = set(), Counter(), {}, Counter(), Counter(), Counter()
    numeric_classes = Counter()
    duplicates, capped = Counter(), set()
    seen = {"row": set(), "content": set(), "identifier": set()}
    count = malformed = matched_media = expected_media = 0
    partial = None
    key_type = None

    def register(kind, value):
        key = digest(value)
        if key in seen[kind]:
            duplicates[kind] += 1
        elif len(seen[kind]) < MAX_KEYS:
            seen[kind].add(key)
        else:
            capped.add(kind)

    try:
        for row in rows:
            if count + malformed >= MAX_ROWS:
                raise AuditLimit("row cap reached")
            if row is None:
                malformed += 1
                continue
            count += 1
            columns.update(row)
            if len(columns) > 128:
                raise AuditLimit("too many distinct columns")
            register("row", json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
            keys = {key.casefold(): key for key in row}
            for key, value in row.items():
                if value is None or (isinstance(value, str) and value.strip() in {"", "?"}):
                    missing[key] += 1
            for field in ("label", "kategori", "result", "class", "is_scam", "verified", "online",
                          "head1_social_engineering", "head2_scam_intent"):
                if field in keys:
                    counter = labels.setdefault(field, Counter())
                    value = row[keys[field]]
                    if field == "class" and isinstance(value, str) and re.fullmatch(r"[0-9]{1,4}", value):
                        numeric_classes[value] += 1
                        counter["<numeric class>"] += 1
                    else:
                        counter["<object>" if isinstance(value, dict) else label_value(value)] += 1
            for field, counter, allowed in (
                ("language", languages, LANGUAGES),
                ("generator", generators, GENERATORS),
                ("source_dataset", sources, SOURCE_GROUPS),
            ):
                if field in keys:
                    value = str(row[keys[field]]).casefold()
                    counter[value if value in allowed else "<other>"] += 1
            for field in ("id", "phish_id", "filename", "images_id", "path", "rank"):
                if field in keys and row[keys[field]] not in ("", None):
                    register("identifier", str(row[keys[field]]))
                    break
            for field in ("url", "teks", "pesan", "text", "domain"):
                if field in keys and isinstance(row[keys[field]], str) and row[keys[field]].strip():
                    value = row[keys[field]]
                    key_type = "url" if field == "url" else "domain" if field == "domain" else "message"
                    normalized = url_key(value) if field == "url" else value.strip().lower().rstrip(".") if field == "domain" else " ".join(unicodedata.normalize("NFC", value).casefold().split())
                    register("content", normalized)
                    break
            if "path" in keys or "images_id" in keys:
                media_field = keys.get("path", keys.get("images_id"))
                expected_media += 1
                name = PureWindowsPath(str(row[media_field])).name.casefold()
                matched_media += int(name in media_names)
    except (AuditLimit, csv.Error, UnicodeError, ValueError, RecursionError, OSError, EOFError) as exc:
        malformed += not isinstance(exc, AuditLimit)
        partial = str(exc) if isinstance(exc, AuditLimit) else "malformed or unreadable input"
    return {
        "rows": count, "columns": sorted(columns), "malformed": malformed, "missing": dict(missing),
        "label_counts": labels, "numeric_class_distribution": numeric_classes,
        "languages": languages, "generators": generators, "source_groups": sources,
        "duplicates": dict.fromkeys(seen, 0) | duplicates, "duplicate_counts_lower_bound": sorted(capped),
        "expected_media_rows": expected_media, "matched_media_rows": matched_media, "partial": partial,
    }, key_type, seen["content"]


SOURCES = {
    "phishing_features.csv": ("url", "unknown", None, "unknown", {}, "label_semantics_unverified"),
    "phiusiil+phishing+url+dataset.zip": ("url", "UCI / Prasad & Chandra", "https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+website+dataset", "CC BY 4.0", {"0": "phishing", "1": "legitimate"}, "offline_evaluation_candidate"),
    "phishing+websites.zip": ("url", "UCI Phishing Websites", "https://archive.ics.uci.edu/dataset/327/phishing+websites", "CC BY 4.0", {"-1": "phishing", "1": "legitimate"}, "tabular_features_only"),
    "verified_online.csv.gz": ("url", "PhishTank-compatible snapshot", "https://www.phishtank.org/developer_info.php", "unknown", {"verified=yes": "community verified phishing"}, "historical_positive_only"),
    "tranco_y895g-1m.csv.zip": ("url", "Tranco candidate", None, "unknown", {}, "popularity_reference_only"),
    "phishing dataset.zip": ("url", "unknown", None, "unknown", {}, "website_screenshots_provenance_unverified"),
    "dataset_sms_spam_v1.csv": ("message", "Rahmi & Wibisono (bundled attribution)", None, "unknown", SMS_LABELS, "deduplicate_and_review_privacy"),
    "fraudsense-main.zip": ("message", "FraudSense archive", None, "unknown", {}, "review_privacy_and_label_semantics"),
    "phishing_email_multilingual.csv": ("message", "unknown", None, "unknown", {}, "review_provenance_and_label_semantics"),
    "train.jsonl": ("message", "unknown", None, "unknown", {}, "review_label_and_split_provenance"),
    "indonesia-sms-spam-dataset-main.zip": ("message", "archive attribution unverified", None, "CC0 1.0 (bundled notice)", {}, "small_category_corpus"),
    "sentiment-analysis-on-indonesian-sms-dataset-main.zip": ("message", "archive attribution unverified", None, "unknown", SMS_LABELS, "duplicate_sms_reference"),
    "quishing-scanner-empirical-study-dataset-main.zip": ("qr", "Hyphen-14", "https://github.com/Hyphen-14/quishing-scanner-empirical-study-dataset", "CC0 1.0", {"phishing": "study positive", "safe": "study negative"}, "url_benchmark_candidate_no_qr_images"),
    "genimage_metadata.csv": ("image", "unknown local derivative", None, "unknown", {}, "metadata_only"),
    "data.csv": ("image", "unknown", None, "unknown", {}, "metadata_only"),
}


def text_members(archive, entries):
    for entry in entries:
        if Path(entry.filename).suffix.lower() != ".txt" or len(entry.filename.split("/")) < 3:
            continue
        if entry.file_size > MAX_ROW:
            yield None
            continue
        with archive.open(entry) as file:
            yield {"text": file.read(MAX_ROW + 1).decode("utf-8-sig"), "label": entry.filename.split("/")[-2]}


def audit(source):
    if not source.is_dir():
        raise FileNotFoundError("dataset source folder not found")
    entries = sorted(source.iterdir(), key=lambda item: item.name.casefold())
    if len(entries) > MAX_ENTRIES:
        raise AuditLimit("too many source entries")
    names = {f.name.casefold() for f in entries if not f.is_symlink() and f.is_file() and f.suffix.lower() in IMAGES}
    results, content_sets = [], []
    for file in entries:
        kind, publisher, url, license, mapping, readiness = SOURCES.get(
            file.name.casefold(), ("excluded", "unknown", None, "unknown", {}, "unclassified")
        )
        item = {
            "id": file.name, "source_path": str(file), "logical_location": f"raw/{kind}/{file.name}",
            "file_type": "".join(file.suffixes).lower(), "publisher": publisher, "source_url": url,
            "license": license, "label_mapping": mapping, "readiness": readiness,
            "size_bytes": None, "sha256": None, "tables": {}, "media": {}, "actions": [],
        }
        results.append(item)
        if file.is_symlink() or not file.is_file() or kind == "excluded":
            item["actions"].append("ignored; no bytes read")
            continue
        item["size_bytes"] = file.stat().st_size
        if item["size_bytes"] > MAX_SOURCE:
            item["readiness"] = "blocked_by_size_limit"
            continue

        def record(name, stream, format="csv", rows=None):
            stats, key_type, keys = table(stream, format=format, media_names=names, row_stream=rows)
            item["tables"][name] = stats
            if key_type in {"url", "message"}:
                content_sets.append((file.name + "::" + name, key_type, keys, "content" in stats["duplicate_counts_lower_bound"] or bool(stats["partial"])))

        try:
            with file.open("rb") as raw:
                item["sha256"] = file_digest(raw, "sha256").hexdigest()
            if file.suffix.lower() == ".zip":
                with BoundedArchive(file.open("rb", buffering=0)) as raw, ZipFile(raw) as archive:
                    members = archive_entries(archive)
                    item["archive_entries"] = len(members)
                    media = [m for m in members if Path(m.filename).suffix.lower() in IMAGES | VIDEOS]
                    item["media"] = dict(Counter(Path(m.filename).suffix.lower() for m in media))
                    classes = Counter()
                    crc_splits = {}
                    for m in media:
                        parts = m.filename.lower().split("/")
                        if len(parts) >= 4 and parts[-3] in {"train", "test", "val"} and parts[-2] in {"phishing", "legitimate"}:
                            classes[parts[-3] + "/" + parts[-2]] += 1
                            crc_splits.setdefault((m.CRC, m.file_size), set()).add(parts[-3])
                    if classes:
                        item["media_path_label_counts"] = classes
                        item["media_cross_split_crc_size_candidates"] = sum(len(s) > 1 for s in crc_splits.values())
                    item["member_types"] = dict(Counter(Path(m.filename).suffix.lower() or "<none>" for m in members))
                    for m in members:
                        suffix = Path(m.filename).suffix.lower()
                        if suffix in {".csv", ".arff"}:
                            format = "arff" if suffix == ".arff" else "ranking" if m.filename == "top-1m.csv" else "csv"
                            with archive.open(m) as stream:
                                record(m.filename, stream, format)
                    if file.name.casefold() == "indonesia-sms-spam-dataset-main.zip":
                        record("category_text_members", None, rows=text_members(archive, members))
                item["actions"].append("inventory metadata and stream selected tables; no extraction")
            else:
                opener = gzip.open if file.suffix.lower() == ".gz" else open
                with opener(file, "rb") as stream:
                    record(file.name, stream, "jsonl" if file.suffix.lower() == ".jsonl" else "csv")
                item["actions"].append("stream aggregate statistics; no raw copy")
        except (AuditLimit, BadZipFile, OSError, EOFError, ValueError):
            item["readiness"] = "blocked_unsafe_or_unreadable"
            item["actions"].append("stopped on archive or source validation")
    overlaps = []
    for index, (name, kind, keys, partial) in enumerate(content_sets):
        for other, other_kind, other_keys, other_partial in content_sets[index + 1:]:
            if kind == other_kind:
                common = len(keys & other_keys)
                if common:
                    overlaps.append({"left": name, "right": other, "kind": kind, "unique_common": common,
                                     "lower_bound": partial or other_partial})
    return {"manifest_version": 1, "source_root": str(source), "datasets": results, "content_overlaps": overlaps,
            "limits": {"archive_entries": MAX_ENTRIES, "archive_bytes": MAX_ARCHIVE, "table_bytes": MAX_TABLE,
                       "rows_per_table": MAX_ROWS, "distinct_keys_per_kind": MAX_KEYS}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    manifest = args.manifest.resolve()
    if manifest.is_relative_to(source):
        parser.error("manifest must be outside the immutable dataset source")
    try:
        result = audit(source)
    except (FileNotFoundError, AuditLimit) as exc:
        parser.error(str(exc))
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Audited {len(result['datasets'])} entries; {len(result['content_overlaps'])} overlapping table pairs.")


if __name__ == "__main__":
    main()
