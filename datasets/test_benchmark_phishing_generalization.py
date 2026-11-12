import json
from pathlib import Path

import pytest

import benchmark_phishing_generalization as evaluation
from benchmark_phishing_ml import LABELS, SEED, dedup_key, ml_modules, scores, target_and_group, url_text


def test_publisher_index_accepts_only_exact_public_links():
    source = "https://docs.example.org/index"
    html = """
      <a href="/docs/start#part">start</a>
      <a href="/docs/guide">guide</a>
      <a href="https://foreign.example.com/docs/guide">off-site</a>
      <a href="/docs/guide?token=fixture">private shape</a>
      <a href="https://user@docs.example.org/docs/guide">credentials</a>
    """
    rows = evaluation.index_rows(html, source, "documentation", r"/docs/[a-z]+", "2026-11-11")
    assert rows == evaluation.index_rows(html, source, "documentation", r"/docs/[a-z]+", "2026-11-11")
    assert {row["url"] for row in rows} == {source.replace("index", "docs/start"), source.replace("index", "docs/guide")}
    assert all(row["source"] == source and row["label_basis"] and row["date"] and row["domain"] == "example.org" for row in rows)


def test_benign_overlap_and_synthetic_are_separate():
    method = "manual_official_public_page"
    rows = [evaluation.review_row(url, url, "documentation", method, "2026-11-11") for url in (
        "https://docs.example.org/start", "https://www.example.org/guide", "https://example.net/public",
    )]
    rows += [dict(rows[-1]), dict(rows[-1], synthetic=True), dict(rows[-1], review_status="unverified")]
    twin, _ = target_and_group("http://docs.example.org/start")
    buckets = evaluation.separate_benign(rows, {dedup_key(twin)}, {"example.org"})
    assert {kind: len(part) for kind, part in buckets.items()} == {
        "exact_or_scheme_twin": 1, "domain_overlap": 1, "unseen": 1, "duplicate": 1, "excluded_unverified": 2,
    }
    rows[0]["label_basis"] = ""
    with pytest.raises(ValueError, match="provenance"):
        evaluation.separate_benign(rows, set(), set())


def test_frozen_threshold_and_positive_only_metrics():
    _, np, *_ = ml_modules()
    values = np.asarray([0, .46999, .47, .9])
    assert evaluation.THRESHOLD == .47
    assert evaluation.summarize(np, values)["fpr"] == .5
    assert evaluation.summarize(np, values, positive=True)["recall"] == .5
    assert evaluation.summarize(np, np.asarray([]))["fpr"] is None
    assert "fpr" not in evaluation.summarize(np, values, positive=None)


def test_frozen_hash_is_checked_before_deserialization(tmp_path, monkeypatch):
    joblib, *_ = ml_modules()
    expected = dict(line.split("==", 1) for line in evaluation.MODEL_LOCK.read_text().splitlines())
    (tmp_path / "metrics.json").write_text(json.dumps({
        "label_mapping": LABELS, "seed": SEED, "validation_champion": "logistic", "dependencies": expected,
        "results": {"logistic": {"selected_trial": {"threshold": .47}}},
    }))
    (tmp_path / "validation-champion.joblib").write_bytes(b"untrusted fixture")

    def must_not_load(*_):
        pytest.fail("Attempted to deserialize unverified bytes")

    monkeypatch.setattr(joblib, "load", must_not_load)
    with pytest.raises(ValueError, match="SHA-256"):
        evaluation.load_frozen(tmp_path)


def test_frozen_model_parity_and_synthetic_case_categories():
    folder = Path(__file__).parent / "processed/ml_experiments/phase10b2"
    if not (folder / "validation-champion.joblib").is_file():
        pytest.skip("Optional local frozen artifact is absent")
    model, _ = evaluation.load_frozen(folder)
    fixtures = list(evaluation.synthetic_cases())
    assert {kind for kind, _ in fixtures} == {
        "root", "documentation", "login", "account", "encoded_path", "query", "long", "subdomain", "idn_pair",
    }
    texts = [url_text(target) for kind, target in fixtures if kind == "idn_pair"]
    prediction = scores(model, texts)
    assert texts[0] == texts[1] and prediction[0] == prediction[1]


def test_path_template_ignores_numeric_ids_and_query_values():
    first, _ = target_and_group("https://example.com/item/123?q=a")
    second, _ = target_and_group("https://example.net/item/456?q=b")
    assert evaluation.template(first) == evaluation.template(second)
