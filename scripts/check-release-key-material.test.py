"""Regression tests for the release gate, using synthetic key material."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location(
    "release_gate", Path(__file__).with_name("check-release-key-material.py"),
)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class ReleaseGateTests(unittest.TestCase):
    def test_symbols_are_detected(self):
        self.assertIn("decryptEKey", gate.findings(b"void decryptEKey() {}"))

    def test_synthetic_material_in_ascii_utf16_and_hex_arrays(self):
        value = b"synthetic-key-12"
        with patch.object(gate, "KEY_HASHES", {hashlib.sha256(value).hexdigest()}):
            for encoded in (
                b"prefix" + value + b"suffix",
                ("prefix" + value.decode() + "suffix").encode("utf-16le"),
                ", ".join(f"0x{byte:02x}" for byte in value).encode(),
            ):
                with self.subTest(encoded=encoded):
                    self.assertIn("retired QMC unwrap constant", gate.findings(encoded))

    def test_external_key_contract_is_allowed(self):
        self.assertEqual([], gate.findings(b"decodeProvidedSongKey base64: qmcRawKey"))

    def test_archive_contents_are_checked_after_decompression(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "test.apk"
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as output:
                output.writestr("classes.dex", b"test tcTeaDecrypt marker")
            self.assertEqual([(f"{archive.name}:classes.dex", ["tcTeaDecrypt"])], gate.scan_archive(archive))

    def test_empty_or_clean_archive_has_no_findings(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / "test.ipa"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("Payload/app", b"ordinary application data")
            self.assertEqual([], gate.scan_archive(archive))


if __name__ == "__main__":
    unittest.main()
