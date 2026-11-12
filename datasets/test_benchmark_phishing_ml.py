from collections import Counter
import gzip
from hashlib import file_digest, sha256
from io import BytesIO
import socket
import sys

import pytest

import benchmark_phishing_ml as benchmark
from app.modules.analysis.url import parse_url


def test_cleaning_preserves_class_mapping_and_excludes_conflicts():
    rows = [
        {"URL": "https://a.example.com/a", "label": "0"},
        {"URL": "https://a.example.com/a#fragment", "label": "0"},
        {"URL": "http://a.example.com/a", "label": "0"},
        {"URL": "https://example.org", "label": "1"},
        {"URL": "https://example.net", "label": "1"},
        {"URL": "https://example.net/", "label": "0"},
        {"URL": "http://127.0.0.1", "label": "0"},
        {"URL": "https://a.unrecognizedsuffix", "label": "0"},
        {"URL": "https://example.org/unknown", "label": "maybe"},
    ]
    clean, groups, stats = benchmark.clean_phiusiil(rows)
    assert [(target.hostname, label) for target, label, _ in clean] == [("a.example.com", 1), ("example.org", 0)]
    assert groups == {"example.com", "example.org", "example.net"}
    assert stats == Counter(source_rows=9, raw_label_0=6, raw_label_1=2, duplicate_rows=3,
                            scheme_variant_rows=1, conflicting_keys_removed=1, invalid_url=1,
                            ambiguous_domain=1, invalid_label=1, cleaned_rows=2)


def test_grouped_splits_are_reproducible_without_url_or_domain_leakage():
    clean, _, _ = benchmark.clean_phiusiil([
        {"URL": f"https://{host}.fixture{i}.com/{label}", "label": str(label)}
        for i in range(120) for host in ("www", "account") for label in (0, 1)
    ])
    first = benchmark.split_rows(clean)
    second = benchmark.split_rows(list(reversed(clean)))
    partitions = []
    for name, part in first.items():
        groups = {group for _, _, group in part}
        keys = {benchmark.dedup_key(target) for target, _, _ in part}
        assert keys == {benchmark.dedup_key(target) for target, _, _ in second[name]}
        assert all(not (groups & old_groups or keys & old_keys) for old_groups, old_keys in partitions)
        partitions.append((groups, keys))


def test_lexical_parity_does_not_resolve_network(monkeypatch):
    def unexpected_network(*_):
        pytest.fail("Feature extraction attempted DNS")

    monkeypatch.setattr(socket, "getaddrinfo", unexpected_network)
    raw = parse_url("https://login.bücher.de:8443/a/%2F?q=99&otp=1")
    canonical = parse_url(raw.normalized_url)
    assert benchmark.lexical(raw) == benchmark.lexical(canonical)
    features = dict(zip(benchmark.FEATURES, benchmark.lexical(raw), strict=True))
    assert features["subdomain_count"] == 1
    assert features["path_depth"] == features["query_parameters"] == 2
    assert features["account_tokens"] == 2
    assert features["punycode"] and features["explicit_port"] and features["percent_encoded_ratio"] > 0


def test_tfidf_training_only_and_artifact_digest():
    joblib, _, *_ = benchmark.ml_modules()
    name, _, model = next(benchmark.models())
    assert name == "logistic"
    training = ["abc.com/", "xyz.com/"] * 4
    model.fit(training, [0, 1] * 4)
    unseen = ["qqqqqq.org/"]
    assert "qqq" not in model[0].vocabulary_
    assert benchmark.scores(model, unseen).shape == (1,)
    assert "qqq" not in model[0].vocabulary_
    artifact = BytesIO()
    joblib.dump(model, artifact, compress=3)
    payload = artifact.getvalue()
    assert file_digest(BytesIO(payload), "sha256").hexdigest() == sha256(payload).hexdigest()
    assert sha256(payload + b"changed").digest() != sha256(payload).digest()


def test_threshold_class_order_confusion_and_abstention():
    _, np, *_ = benchmark.ml_modules()

    class Model:
        classes_ = [1, 0]

        def predict_proba(self, _):
            return np.asarray([[.85, .15]])

    assert benchmark.scores(Model(), [None])[0] == .85
    labels = np.array([0, 0, 1, 1])
    scores = np.array([.25, .49, .51, .94])
    assert benchmark.threshold_for(labels, scores)[-1] == .51
    metrics = benchmark.evaluation(np, labels, scores, .5, abstain=True)
    assert metrics["confusion"] == {"tp": 1, "fp": 0, "tn": 1, "fn": 0}
    assert metrics["coverage"] == metrics["inconclusive"] == .5
    assert metrics["abstained_phishing"] == 1
    miss = benchmark.evaluation(np, labels, np.array([.7, .4, .3, .9]), .5)
    assert miss["confusion"] == {"tp": 1, "fp": 1, "tn": 1, "fn": 1}
    assert miss["false_positive_rate"] == miss["false_negative_rate"] == .5


def test_input_and_resource_caps(monkeypatch):
    monkeypatch.setattr(benchmark, "MAX_ROWS", 1)
    with pytest.raises(ValueError, match="row budget"):
        list(benchmark.records(BytesIO(b"URL,label\nexample,0\nother,1\n"), {"URL", "label"}))
    with pytest.raises(ValueError, match="length"):
        benchmark.target_and_group("a" * (benchmark.MAX_URL + 1))
    assert benchmark.JOBS == 2 and benchmark.VOCABULARY == 50_000 and benchmark.MAX_TRAIN_ROWS == 60_000


def test_missing_optional_dependency_has_actionable_message(monkeypatch):
    monkeypatch.setitem(sys.modules, "xgboost", None)
    with pytest.raises(RuntimeError, match="requirements-ml.txt"):
        benchmark.ml_modules()


def test_external_data_excludes_all_primary_domains_and_duplicates(tmp_path):
    path = tmp_path / "fixture.csv.gz"
    with gzip.open(path, "wb") as stream:
        stream.write(
            b"url,verified\nhttps://new.example.com/unique,yes\n"
            b"https://example.org/only,yes\nhttp://example.org/only,yes\n"
            b"https://example.net/unverified,no\n"
        )
    rows, stats = benchmark.external_rows(path, {"example.com"})
    assert [(label, group) for _, label, group in rows] == [(1, "example.org")]
    assert stats == Counter(source_rows=4, overlapping_domain_rows=1, duplicate_rows=1, unverified=1)
