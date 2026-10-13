"""Reject known bundled platform key material in sources and APK/IPA archives.

Only fingerprints are stored here, never the retired key bytes. Source checks
also cover the unpacking implementation, since compilers can split constants.
This is a regression gate, not a proof against arbitrary obfuscated secrets.
"""
import argparse
import hashlib
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
KEY_HASHES = {
    "bb2253776893dc9412f2c524c1d3a8a9b628d0a698950e2c37510a65bba47f0f",
    "c36ce48c032c276a3b8fbf8bf54ee4fbaa9279b903238c1cde26076e1254d36c",
}
SYMBOLS = (b"EKEY_V2_KEY", b"tcTeaDecrypt", b"decryptEKey", b"makeSimpleKey",
           b"decryptQRCLyric", b"decryptKuwoLyric")


def findings(data):
    hits = [symbol.decode() for symbol in SYMBOLS if symbol in data]
    # Both UTF-8/ASCII and UTF-16LE literals; scan substrings because linkers
    # may concatenate literals. Each retired QMC unwrap constant is 16 bytes.
    for pattern, stride in ((rb"[\x20-\x7e]{16,}", 1),
                            (rb"(?:[\x20-\x7e]\x00){16,}", 2)):
        for match in re.finditer(pattern, data):
            value = match.group()[::stride]
            for offset in range(len(value) - 15):
                if hashlib.sha256(value[offset:offset + 16]).hexdigest() in KEY_HASHES:
                    hits.append("retired QMC unwrap constant")
                    break
    # Hex byte arrays in source files, including renamed constants.
    for match in re.finditer(rb"(?:0x[0-9a-fA-F]{2}\s*,\s*){15,}0x[0-9a-fA-F]{2}", data):
        value = bytes(int(byte, 16) for byte in re.findall(rb"0x([0-9a-fA-F]{2})", match.group()))
        for offset in range(len(value) - 15):
            if hashlib.sha256(value[offset:offset + 16]).hexdigest() in KEY_HASHES:
                hits.append("retired QMC unwrap constant")
                break
    return sorted(set(hits))


def scan_sources():
    paths = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "src", "android", "ios"],
        cwd=ROOT,
    ).decode().split("\0")
    failed = []
    for name in set(paths):
        path = ROOT / name
        if not name or not path.is_file() or ".test." in name or "__tests__/" in name:
            continue
        hits = findings(path.read_bytes())
        if hits:
            failed.append((name, hits))
    return failed


def scan_archive(path):
    failed = []
    with zipfile.ZipFile(path) as archive:
        for item in archive.infolist():
            if item.is_dir():
                continue
            hits = findings(archive.read(item))
            if hits:
                failed.append((f"{path.name}:{item.filename}", hits))
    return failed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archives", nargs="*", type=Path)
    args = parser.parse_args()
    failed = scan_sources()
    for path in args.archives:
        failed.extend(scan_archive(path))
    for path, hits in failed:
        print(f"FAIL {path}: {', '.join(hits)}")
    if failed:
        raise SystemExit(1)
    print(f"Key-material check passed: sources and {len(args.archives)} archive(s).")


if __name__ == "__main__":
    main()
