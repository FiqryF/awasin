import asyncio
from hashlib import sha256
import json
from zipfile import ZipFile

import evaluate_url_inspector as benchmark


def test_benchmark_deduplicates_conflicts_and_keeps_unknown_separate(tmp_path, monkeypatch):
    def domain(index):
        return f"fixture-{index}.org"

    groups = [
        domain(i) for i in range(400)
        if sha256((benchmark.SEED + "\0" + domain(i)).encode()).digest()[0] < 13
    ]
    phishing, legitimate = groups[:2]
    archive = tmp_path / "synthetic.zip"
    flagged_url = f"https://{phishing}/login?next=https%3A%2F%2Fexample.net"
    with ZipFile(archive, "w") as file:
        file.writestr(
            benchmark.MEMBER,
            f"URL,label\n{flagged_url},0\n{flagged_url}#duplicate,0\n"
            f"https://{legitimate}/,1\nhttps://{phishing}/conflict,0\nhttps://{phishing}/conflict,1\n",
        )
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"datasets": [{"id": archive.name, "sha256": sha256(archive.read_bytes()).hexdigest()}]}))
    monkeypatch.setattr(benchmark, "MANIFEST", manifest)
    result = asyncio.run(benchmark.evaluate(archive))
    assert result["sample"] == 2
    assert result["counts"]["conflicting_urls_excluded"] == 1
    assert result["counts"]["duplicate_rows"] == 2
    assert result["indicator_confusion"] == {"tp": 1, "fp": 0, "tn": 1, "fn": 0}
    assert result["unknown_rate"] == 0.5 and result["assigned_risk_coverage"] == 0.5
    assert result["decision_correct_rate_by_class"] == {"phishing": 1, "legitimate": 0}
    assert result["decision_balanced_accuracy"] == 0.5
    assert result["provider_lookups"] == 0
