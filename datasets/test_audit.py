from io import BytesIO
from stat import S_IFLNK
from zipfile import ZipFile, ZipInfo

import pytest

import audit


def test_csv_statistics_and_normalized_duplicate():
    data = BytesIO(
        b"url,label,id\nhttps://EXAMPLE.com:443/a#one,0,1\n"
        b"https://example.com/a,1,1\nhttps://example.org,,2\n"
    )
    stats, kind, keys = audit.table(data)
    assert (stats["rows"], kind, len(keys)) == (3, "url", 2)
    assert stats["label_counts"]["label"] == {"0": 1, "1": 1, "<other>": 1}
    assert stats["missing"] == {"label": 1}
    assert stats["duplicates"] == {"row": 0, "identifier": 1, "content": 1}


@pytest.mark.parametrize("data", [b"a,a\n1,2\n", b'a,b\n"unterminated\n', b'a,b\n1,2,3\n'])
def test_invalid_csv(data):
    stats, _, _ = audit.table(BytesIO(data))
    assert stats["malformed"] == 1


def test_jsonl_keeps_valid_rows_and_counts_invalid():
    data = BytesIO(b'{"id":"a","text":"synthetic fixture","is_scam":0}\n{}\n[]\nnot json\n')
    stats, kind, _ = audit.table(data, format="jsonl")
    assert (stats["rows"], stats["malformed"], kind) == (2, 2, "message")
    assert stats["label_counts"]["is_scam"] == {"0": 1}


@pytest.mark.parametrize("name", ["../outside.csv", "/absolute.csv", "C:/absolute.csv", "x\\..\\y.csv", "ok/CON.csv", "ok/a.csv:stream"])
def test_archive_rejects_unsafe_paths(name):
    data = BytesIO()
    with ZipFile(data, "w") as archive:
        archive.writestr(name, "synthetic")
    with ZipFile(data) as archive, pytest.raises(audit.AuditLimit):
        audit.archive_entries(archive)


def test_archive_rejects_symlink_and_expanded_size(monkeypatch):
    data = BytesIO()
    info = ZipInfo("alias.csv")
    info.create_system = 3
    info.external_attr = S_IFLNK << 16
    with ZipFile(data, "w") as archive:
        archive.writestr(info, "fixture.csv")
    with ZipFile(data) as archive, pytest.raises(audit.AuditLimit):
        audit.archive_entries(archive)

    data = BytesIO()
    with ZipFile(data, "w") as archive:
        archive.writestr("fixture.csv", "long")
    monkeypatch.setattr(audit, "MAX_ARCHIVE", 2)
    with ZipFile(data) as archive, pytest.raises(audit.AuditLimit):
        audit.archive_entries(archive)


def test_media_absence_and_no_raw_content(tmp_path):
    source = tmp_path / "dataset"
    source.mkdir()
    raw = b"images_id,label\nprivate-fixture.png,real\n"
    (source / "data.csv").write_bytes(raw)
    result = audit.audit(source)
    stats = result["datasets"][0]["tables"]["data.csv"]
    assert stats["expected_media_rows"] == 1
    assert stats["matched_media_rows"] == 0
    assert "private-fixture.png" not in repr(result)
    assert (source / "data.csv").read_bytes() == raw
    assert audit.SOURCES["phiusiil+phishing+url+dataset.zip"][4] == {"0": "phishing", "1": "legitimate"}


def test_missing_source(tmp_path):
    with pytest.raises(FileNotFoundError, match="dataset source folder not found"):
        audit.audit(tmp_path / "missing")


def test_distinct_key_cap_marks_lower_bound(monkeypatch):
    monkeypatch.setattr(audit, "MAX_KEYS", 1)
    stats, _, _ = audit.table(BytesIO(b"text,label\na,0\nb,1\nb,1\n"))
    assert stats["rows"] == 3
    assert stats["duplicate_counts_lower_bound"] == ["content", "row"]
