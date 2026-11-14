"""Run from backend with a separate Python environment containing SetFit.

All messages are synthetic. Each family stays in a single split.
"""

FAMILIES = {
    "train": {
        "store_promo": ("low", [
            "Diskon minuman 20 persen akhir pekan ini di seluruh gerai. Cek katalog di example.org/menu.",
            "Beli dua roti gratis satu, khusus member. Syarat promo berlaku.",
            "Voucher belanja berlaku sampai Jumat. Tunjukkan kartu anggota saat membayar.",
        ]),
        "transaction_notice": ("low", [
            "Transaksi kartu debit berhasil di merchant. Hubungi bank lewat aplikasi jika tidak mengenal transaksi.",
            "Pembayaran tagihan bulan ini telah kami terima. Terima kasih.",
            "Dana pengembalian sudah masuk ke saldo Anda. Detail tersedia di aplikasi resmi.",
        ]),
        "account_claim": ("high", [
            "Saya petugas bank. Kirim OTP dan PIN untuk mencegah pemblokiran rekening.",
            "Balas SMS dengan kode verifikasi. Jika tidak, akun akan kami bekukan.",
            "Berikan kata sandi sekarang agar akun Anda tidak ditutup.",
        ]),
        "hiring_fee": ("high", [
            "Anda lolos seleksi kerja. Transfer biaya rekrutmen ke rekening pribadi.",
            "Diterima bekerja tanpa wawancara. Bayar biaya pendaftaran agar kontrak diproses.",
            "Lowongan mendesak. Wajib transfer deposit ke admin supaya dapat jadwal kerja.",
        ]),
        "investment_pitch": ("medium", [
            "Investasi dengan profit tetap 10 persen setiap hari. Hubungi admin untuk informasi.",
            "Keuntungan dijamin setiap minggu dari program crypto terbaru.",
            "Dijamin cuan harian, cek paket investasi kami kalau tertarik.",
        ]),
        "unverified_request": ("medium", [
            "Tolong kirimkan foto KTP untuk melengkapi profil Anda.",
            "Mohon berikan OTP Anda agar verifikasi selesai.",
            "Masukkan PIN pada formulir yang sudah disediakan.",
        ]),
        "fragment": ("unknown", [
            "Soal yang tadi nanti saya jelaskan.",
            "Periksa yang kemarin, terima kasih.",
            "Nomornya yang sebelah kanan itu.",
        ]),
        "redacted_note": ("unknown", [
            "[potongan] hari ini. Untuk bagian tersebut hubungi ...",
            "[teks terpotong] akun ... nanti ...",
            "Bagian selanjutnya ada di gambar lain.",
        ]),
    },
    "test": {
        "member_benefit": ("low", [
            "Khusus pemegang kartu: cashback akhir pekan. Klik example.com/syarat untuk membaca ketentuan.",
            "Promo harga khusus pelanggan. Bayar dengan kartu yang terdaftar saat checkout.",
            "Tukar poin untuk hadiah di gerai. Voucher hanya berlaku sampai pukul 18.00.",
        ]),
        "security_education": ("low", [
            "Peringatan keamanan: jangan pernah bagikan PIN atau OTP meski diancam rekening diblokir.",
            "Contoh penipuan: 'Kirim OTP atau akun diblokir'. Jangan ikuti instruksi tersebut.",
            "Jika diminta transfer uang oleh pengirim yang mengaku petugas, lapor lewat aplikasi resmi.",
        ]),
        "prize_hosting": ("high", [
            "Selamat! Anda memenangkan mobil. Klaim hadiah di hadiah-fixture.blogspot.com/ambil.",
            "Anda sudah memenangkan hadiah ponsel. Kunjungi hadiah-fixture.wordpress.com untuk klaim.",
            "Pemberitahuan dari admin: kamu menang hadiah motor. Klaim hadiah melalui hadiah-fixture.weebly.com.",
        ]),
        "marketplace_diversion": ("high", [
            "Pesanan tidak bisa dibayar di marketplace. Transfer ke rekening pribadi penjual di luar aplikasi.",
            "Agar refund marketplace cair, bayar biaya ke rekening pribadi di luar platform.",
            "Pembeli diminta transfer ke rekening pribadi di luar marketplace agar pesanan tidak dibatalkan.",
        ]),
        "claim_without_mechanism": ("medium", [
            "Selamat, Anda menang undian ponsel. Hubungi saya untuk informasi hadiah.",
            "Kamu telah terpilih sebagai pemenang hadiah. Nantikan kabar berikutnya.",
            "Anda memenangkan hadiah dari undian pelanggan. Balas pesan untuk informasi lebih lanjut.",
        ]),
        "ambiguous_payment_request": ("medium", [
            "Bayar biaya administrasi agar kami dapat memproses permintaan Anda.",
            "Mohon transfer ke rekening yang dikirimkan petugas kemarin.",
            "Silakan bayar biaya dokumen sebelum pengajuan diperiksa.",
        ]),
        "incomplete_notification": ("unknown", [
            "[potongan pesan] ... hadiah ...",
            "[teks tidak terbaca] status pengajuan ...",
            "Perihal rekening yang dimaksud ... [bagian akhir hilang]",
        ]),
        "no_action_context": ("unknown", [
            "Yang itu bisa diteruskan nanti.",
            "Statusnya masih seperti kemarin.",
            "Nominalnya belum kelihatan di sini.",
        ]),
    },
}


def examples(split):
    return [(family, label, text) for family, (label, messages) in FAMILIES[split].items() for text in messages]


def evaluate_setfit():
    import json
    import os

    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    from datasets import Dataset
    from setfit import SetFitModel, Trainer, TrainingArguments
    from sklearn.dummy import DummyClassifier
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import classification_report
    from sklearn.pipeline import make_pipeline
    from transformers import set_seed
    import torch

    set_seed(42)
    torch.set_num_threads(4)
    train = examples("train")
    test = examples("test")
    assert {family for family, *_ in train}.isdisjoint(family for family, *_ in test)
    labels = ["low", "medium", "high", "unknown"]
    texts = [text for _, _, text in test]
    actual = [label for _, label, _ in test]
    train_texts = [text for _, _, text in train]
    train_labels = [label for _, label, _ in train]
    baseline = DummyClassifier(strategy="most_frequent").fit(train_texts, train_labels)
    simple = make_pipeline(TfidfVectorizer(analyzer="char", ngram_range=(2, 5)), LogisticRegression(random_state=42))
    simple.fit(train_texts, train_labels)
    model = SetFitModel.from_pretrained(
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        labels=labels, device="cpu", trust_remote_code=False,
    )
    training = Dataset.from_dict({"text": train_texts, "label": [labels.index(label) for label in train_labels]})
    Trainer(
        model=model, train_dataset=training,
        args=TrainingArguments(batch_size=8, num_epochs=1, max_steps=30, max_length=128,
                               report_to=[], save_strategy="no", seed=42),
    ).train()
    for name, predictions in (
        ("most_frequent", baseline.predict(texts)),
        ("tfidf", simple.predict(texts)),
        ("setfit", model.predict(texts, use_labels=True)),
    ):
        report = classification_report(actual, predictions, labels=labels, output_dict=True, zero_division=0)
        print(json.dumps({
            "model": name,
            "accuracy": round(report["accuracy"], 3),
            "macro_f1": round(report["macro avg"]["f1-score"], 3),
            "high_as_low": sum(a == "high" and p == "low" for a, p in zip(actual, predictions)),
            "low_as_elevated": sum(a == "low" and p in {"medium", "high"} for a, p in zip(actual, predictions)),
            "by_family": {family: [p for (f, _, _), p in zip(test, predictions) if f == family]
                          for family in FAMILIES["test"]},
        }, ensure_ascii=False))


if __name__ == "__main__":
    evaluate_setfit()
