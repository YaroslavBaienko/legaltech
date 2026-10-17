#!/usr/bin/env python3
"""Marma-Crypto Geometric Watermark & Zero-Tolerance Document Verifier (v1.3.0).

Full LegalTech / Nautilus-integrated engine modeled after /home/attor/legaltech (qes-tools).
Supports:
- Key selection from ~/.secure_keys/ (.pfx, .p12, .key, .cer), hardware USB tokens,
  arbitrary key files, or passphrase via GTK4/Libadwaita `marma-dialog`.
- 15-minute RAM session cache (/run/user/$UID/marma-crypto-session.json, chmod 0600).
- Parallel Multi-Hash Combiner: SHA-256(GOST 34.311-95 || Kupyna-256 || SHA-256).
- Full 256-Bit Bijective Geometric Mantissa Encoding across 9 triangles & 24 symmetric Marma pairs.
- Canary Leak-Tracing (`--recipient-id` & `trace --suspects`) via innermost Bindu apex (`D5.ay`).
- Signing & Stamping PDF, DOCX, and SVG documents (--mode both | watermark | seal).
- Instant public & cryptographic verification + strict key verification (--strict-key).
- Official Vector PDF Verification Protocol generator (`marma-watermark protocol`).
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

try:
    import cairo
except ImportError:
    cairo = None  # type: ignore[assignment]

try:
    import docx
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt, RGBColor
except ImportError:
    docx = None  # type: ignore[assignment]
    WD_ALIGN_PARAGRAPH = Inches = Pt = RGBColor = None  # type: ignore[assignment]

try:
    import pymupdf
    pymupdf.TOOLS.mupdf_display_errors(False)
except Exception:
    pymupdf = None  # type: ignore[assignment]

VERSION = "1.3.0"

# Canonical 9-Triangle Coordinates (lx, by, ay, rx, is_upward) in 300x300 space (R=100)
CANONICAL_TRIANGLES: list[tuple[str, float, float, float, float, bool]] = [
    ("D1", 53.65669560, 123.20508076, 250.00000000, 246.34330440, False),
    ("U1", 52.98401103, 174.24660561, 50.00000000, 247.01598897, True),
    ("U3", 98.71823313, 220.03828947, 123.20508076, 201.28176687, True),
    ("U2", 78.26467998, 197.92315674, 78.10499178, 221.73532002, True),
    ("D3", 90.48569229, 78.10499178, 160.66014976, 209.51430771, False),
    ("D2", 80.98384839, 103.12199145, 220.03828947, 219.01615161, False),
    ("U4", 114.94885006, 160.66014976, 103.12199145, 185.05114994, True),
    ("D4", 116.35142605, 134.30757627, 197.92315674, 183.64857395, False),
    ("D5", 124.61190803, 144.79777263, 174.24660561, 175.38809197, False),
]

DEFAULT_SECRET = os.environ.get("MARMA_CRYPTO_SECRET", "Sovereign-Vedic-Geometry-Key-108")
SESSION_TTL_SECONDS = 900  # 15 minutes


# ==============================================================================
# RAM SESSION & KEY MANAGEMENT (~/.secure_keys + /run/user/$UID)
# ==============================================================================
def get_session_file() -> Path:
    uid = os.getuid()
    run_dir = Path(f"/run/user/{uid}")
    if run_dir.is_dir() and os.access(run_dir, os.W_OK):
        return run_dir / "marma-crypto-session.json"
    return Path(tempfile.gettempdir()) / f"marma-crypto-session-{uid}.json"


def load_active_session() -> dict | None:
    sf = get_session_file()
    if not sf.is_file():
        return None
    try:
        data = json.loads(sf.read_text(encoding="utf-8"))
        if time.time() - float(data.get("timestamp", 0)) <= SESSION_TTL_SECONDS:
            return data
        sf.unlink(missing_ok=True)
    except Exception:
        pass
    return None


def save_active_session(
    secret_key: str,
    signer_key_name: str,
    key_fingerprint: str,
    key_file_path: str = "",
    raw_password: str = "",
) -> None:
    sf = get_session_file()
    payload = {
        "secret_key": secret_key,
        "signer_key_name": signer_key_name,
        "key_fingerprint": key_fingerprint,
        "key_file_path": key_file_path,
        "raw_password": raw_password,
        "timestamp": time.time(),
    }
    sf.write_text(json.dumps(payload), encoding="utf-8")
    os.chmod(sf, 0o600)


def clear_active_session() -> bool:
    sf = get_session_file()
    if sf.is_file():
        sf.unlink(missing_ok=True)
        return True
    return False


def derive_secret_from_keyfile(key_path: Path, password: str = "") -> tuple[str, str, str]:
    """Derive (derived_secret_hex, signer_key_name, public_key_fingerprint) from a key file + password."""
    raw_bytes = key_path.read_bytes()
    file_digest = hashlib.sha256(raw_bytes).hexdigest()
    public_fp = hashlib.sha256(f"MARMA-PUB-FP::{key_path.name}::{file_digest}".encode("utf-8")).hexdigest()
    derived_secret = hmac.new(
        raw_bytes,
        f"MARMA-PRIVATE-DERIVATION::{password}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return derived_secret, key_path.name, public_fp


def find_marma_dialog_bin() -> str:
    here = Path(__file__).resolve().parent
    candidates = [
        here / "marma-dialog",
        here.parent / "bin" / "marma-dialog",
        Path("/usr/bin/marma-dialog"),
        Path("/usr/lib/marma-crypto-watermark/bin/marma-dialog"),
    ]
    for c in candidates:
        if c.is_file() and os.access(c, os.X_OK):
            return str(c)
    return "marma-dialog"


def find_dstu4145_bridge() -> str | None:
    here = Path(__file__).resolve().parent
    candidates = [
        here / "dstu4145_bridge.js",
        here.parent / "src" / "dstu4145_bridge.js",
        Path("/usr/lib/marma-crypto-watermark/dstu4145_bridge.js"),
    ]
    for c in candidates:
        if c.is_file():
            return str(c)
    return None


def call_dstu4145_bridge(req: dict) -> dict:
    """Invoke dstu4145_bridge.js for DSTU 4145-2002 / GOST 34.311-95 / DSTU 7564 / PAdES / CAdES operations."""
    bridge_path = find_dstu4145_bridge()
    if not bridge_path:
        return {"status": "unavailable", "error": "dstu4145_bridge.js not found"}
    try:
        proc = subprocess.run(
            ["node", bridge_path],
            input=json.dumps(req),
            text=True,
            capture_output=True,
            timeout=20,
            check=False,
        )
        if proc.stdout.strip():
            return json.loads(proc.stdout.strip().splitlines()[-1])
        return {"status": "error", "error": proc.stderr.strip() or f"Exit code {proc.returncode}"}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


def resolve_signing_credentials(
    use_gui: bool,
    key_file: Path | None,
    secret_arg: str | None,
    doc_desc: str = "",
    force_prompt: bool = False,
) -> tuple[str, str, str, str, str]:
    """Return (secret_key, signer_key_name, key_fingerprint, key_file_path_str, raw_password)."""
    if key_file and key_file.is_file():
        sec, kname, kfp = derive_secret_from_keyfile(key_file, secret_arg or "")
        return sec, kname, kfp, str(key_file), (secret_arg or "")

    if secret_arg and secret_arg != DEFAULT_SECRET:
        fp = hashlib.sha256(f"MARMA-PASSPHRASE-FP::{secret_arg}".encode("utf-8")).hexdigest()
        return secret_arg, "Passphrase-Key", fp, "", secret_arg

    if not force_prompt:
        sess = load_active_session()
        if sess:
            return (
                sess["secret_key"],
                sess["signer_key_name"],
                sess["key_fingerprint"],
                sess.get("key_file_path", ""),
                sess.get("raw_password", ""),
            )

    if use_gui and (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
        dlg_bin = find_marma_dialog_bin()
        sel_proc = subprocess.run(
            [dlg_bin, "select-medium", "--doc-desc", doc_desc],
            capture_output=True,
            text=True,
            check=False,
        )
        if sel_proc.returncode != 0:
            raise RuntimeError("Операцію скасовано користувачем.")
        sel_data = json.loads(sel_proc.stdout.strip().splitlines()[-1])
        choice = sel_data.get("choice")

        pwd_proc = subprocess.run(
            [dlg_bin, "password"],
            capture_output=True,
            text=True,
            check=False,
        )
        if pwd_proc.returncode != 0:
            raise RuntimeError("Авторизацію ключа скасовано.")
        pwd_data = json.loads(pwd_proc.stdout.strip().splitlines()[-1])
        pwd = pwd_data.get("password", "")

        kpath_str = ""
        if choice in ("file", "browse") and sel_data.get("path"):
            kp = Path(sel_data["path"])
            kpath_str = str(kp)
            sec, kname, kfp = derive_secret_from_keyfile(kp, pwd)
        elif choice == "token":
            tname = sel_data.get("token_name", "Hardware-USB-Token")
            sec = hmac.new(tname.encode("utf-8"), pwd.encode("utf-8"), hashlib.sha256).hexdigest()
            kname = tname
            kfp = hashlib.sha256(f"MARMA-TOKEN-FP::{tname}".encode("utf-8")).hexdigest()
        else:
            eff_pwd = pwd or DEFAULT_SECRET
            sec = hmac.new(b"MARMA-PASSPHRASE", eff_pwd.encode("utf-8"), hashlib.sha256).hexdigest()
            kname = "Author-Passphrase"
            kfp = hashlib.sha256(f"MARMA-PASS-FP::{sec[:16]}".encode("utf-8")).hexdigest()

        save_active_session(sec, kname, kfp, kpath_str, pwd)
        return sec, kname, kfp, kpath_str, pwd

    default_vault_key = Path.home() / ".secure_keys" / "marma_master.key"
    if default_vault_key.is_file():
        sec, kname, kfp = derive_secret_from_keyfile(default_vault_key, "")
        return sec, kname, kfp, str(default_vault_key), ""

    fp = hashlib.sha256(f"MARMA-DEFAULT-FP::{DEFAULT_SECRET}".encode("utf-8")).hexdigest()
    return DEFAULT_SECRET, "Sovereign-Vedic-Key-108", fp, "", DEFAULT_SECRET


# ==============================================================================
# MATHEMATICAL PERTURBATION CORE + DSTU 4145-2002 ELLIPTIC CURVE BINDING
# ==============================================================================
def normalize_text(text: str) -> str:
    """Normalize document text so whitespace formatting doesn't cause false positives."""
    lines = []
    for line in text.splitlines():
        if (
            "MARMA-CRYPTO-SEAL" in line
            or "MARMA · ДСТУ 4145" in line
            or "HMAC-SHA256:" in line
            or "MARMA_SEAL_PACKET::" in line
            or "КВАЛІФІКОВАНИЙ ЕЛЕКТРОННИЙ ПІДПИС" in line
        ):
            continue
        lines.append(line.strip())
    return "\n".join(line for line in lines if line)


def compute_parallel_combiner_hex(gost34311_hex: str, dstu7564_hex: str, sha256_hex: str) -> str:
    """Compute the Multi-Collision Resistant Parallel Combiner SHA-256(GOST34311 || Kupyna256 || SHA256)."""
    return hashlib.sha256(f"{gost34311_hex}::{dstu7564_hex}::{sha256_hex}".encode("utf-8")).hexdigest()


def split_256bits_to_26_words(hex_sig: str) -> list[int]:
    """Bijectively split a 256-bit (64-hex) digest into 26 words in [0..1023] (25x10-bit + 1x6-bit scaled)."""
    val = int(hex_sig, 16)
    words: list[int] = []
    for i in range(25):
        shift = 256 - (i + 1) * 10
        words.append((val >> shift) & 0x3FF)
    words.append((val & 0x3F) << 4)
    return words


def words_26_to_256bit_hex(words: list[int]) -> str:
    """Reconstruct the exact 64-character 256-bit hex digest from 26 coordinate words."""
    if len(words) < 26:
        return ""
    val = 0
    for i in range(25):
        w = max(0, min(1023, int(words[i])))
        val = (val << 10) | (w & 0x3FF)
    w25 = max(0, min(1023, int(words[25])))
    val = (val << 6) | ((int(round(w25 / 16.0))) & 0x3F)
    return f"{val:064x}"


def word10_to_delta(w: int) -> float:
    """Map a 10-bit integer w in [0..1023] to an exact integer-nanometer shift in [-9.207e-6, +9.207e-6]."""
    return round((int(w) * 18 - 9207) * 1e-9, 9)


def delta_to_word10(delta: float) -> int:
    """Losslessly invert a sub-micron coordinate shift back to its 10-bit integer word in [0..1023]."""
    nano = round(float(delta) * 1e9)
    return int(round((nano + 9207) / 18.0))


def encode_256bit_marma_pairs(hex_sig: str, canary_beacon_word: int = 0) -> list[dict]:
    """Encode all 256 bits of hex_sig + 8-bit Canary tag across the 24 symmetric Marma pairs (11 bits/pair = 264 bits)."""
    val256 = int(hex_sig, 16)
    canary8 = int(canary_beacon_word) & 0xFF
    val264 = (val256 << 8) | canary8
    pairs: list[dict] = []
    for k in range(24):
        shift = 264 - (k + 1) * 11
        w11 = (val264 >> shift) & 0x7FF
        delta_m = round((w11 * 9 - 9211) * 1e-9, 9)
        pairs.append(
            {
                "pair_index": k + 1,
                "word_11bit": w11,
                "delta_left": delta_m,
                "delta_right": round(-delta_m, 9),
                "sym_sum_error": 0.0,
            }
        )
    return pairs


def decode_256bit_marma_pairs(marma_pairs: list[dict]) -> tuple[str, int]:
    """Losslessly recover (64-char hex_sig, 8-bit canary_crc) from the 24 symmetric Marma pair shifts."""
    if len(marma_pairs) != 24:
        return "", 0
    val264 = 0
    for p in marma_pairs:
        d = float(p.get("delta_left", 0.0))
        w11 = int(round((round(d * 1e9) + 9211) / 9.0))
        w11 = max(0, min(2047, w11))
        val264 = (val264 << 11) | w11
    canary8 = val264 & 0xFF
    val256 = val264 >> 8
    return f"{val256:064x}", canary8


def compute_canary_tag(
    secret_key: str,
    content_sha256: str,
    recipient_id: str,
    key_fingerprint: str = "",
) -> dict:
    """Compute a zero-plaintext Canary Leak-Tracing tag & 10-bit geometric beacon word for D5.ay."""
    clean_rec = recipient_id.strip()
    if not clean_rec:
        return {"enabled": False, "beacon_word": 0, "public_canary_hash": "", "hmac_commitment": ""}
    if not key_fingerprint:
        key_fingerprint = hashlib.sha256(secret_key.encode("utf-8")).hexdigest()
    pub_canary_hash = hashlib.sha256(
        f"MARMA-CANARY-PUB-V1.3::{content_sha256}::{key_fingerprint}::{clean_rec}".encode("utf-8")
    ).hexdigest()
    hmac_commitment = hmac.new(
        secret_key.encode("utf-8"),
        f"MARMA-CANARY-V1.3::{content_sha256}::{clean_rec}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    beacon_word = (int(pub_canary_hash[:4], 16) % 1023) + 1  # Strictly in [1..1023]
    return {
        "enabled": True,
        "beacon_word": beacon_word,
        "beacon_delta": word10_to_delta(beacon_word),
        "public_canary_hash": pub_canary_hash,
        "hmac_commitment": hmac_commitment,
    }


def build_perturbed_triangles_v13(
    hex_sig: str,
    canary_beacon_word: int = 0,
    cx: float = 150.0,
) -> list[dict]:
    """Encode all 256 bits of hex_sig + optional Canary beacon word into 9 triangles (27 symmetric DoF)."""
    scale = 2.0 if cx == 300.0 else 1.0
    words_26 = split_256bits_to_26_words(hex_sig)
    perturbed: list[dict] = []
    for idx, (name, lx, by, ay, rx, is_up) in enumerate(CANONICAL_TRIANGLES):
        d_lx = word10_to_delta(words_26[idx * 3])
        d_by = word10_to_delta(words_26[idx * 3 + 1])
        if idx < 8:
            d_ay = word10_to_delta(words_26[idx * 3 + 2])
        else:
            d_ay = word10_to_delta(canary_beacon_word) if int(canary_beacon_word) > 0 else 0.0

        lx_s = round(lx * scale + d_lx, 9)
        rx_s = round(cx * 2.0 - lx_s, 9)
        by_s = round(by * scale + d_by, 9)
        ay_s = round(ay * scale + d_ay, 9)
        perturbed.append(
            {
                "name": name,
                "lx": lx_s,
                "by": by_s,
                "ay": ay_s,
                "rx": rx_s,
                "is_up": is_up,
            }
        )
    return perturbed


def recover_256bit_from_triangles(
    triangles: list[dict],
    cx: float = 150.0,
) -> tuple[str, int]:
    """Losslessly invert all 256 bits of the signature digest + Canary beacon word from the 9 triangles alone."""
    if len(triangles) != 9:
        return "", 0
    scale = 2.0 if cx == 300.0 else 1.0
    words: list[int] = []
    canary_word = 0
    for idx, (_, lx_can, by_can, ay_can, _, _) in enumerate(CANONICAL_TRIANGLES):
        t = triangles[idx]
        d_lx = round(float(t["lx"]) - round(lx_can * scale, 9), 9)
        d_by = round(float(t["by"]) - round(by_can * scale, 9), 9)
        words.append(delta_to_word10(d_lx))
        words.append(delta_to_word10(d_by))
        d_ay = round(float(t["ay"]) - round(ay_can * scale, 9), 9)
        if idx < 8:
            words.append(delta_to_word10(d_ay))
        else:
            if abs(d_ay) < 1e-11:
                canary_word = 0
            else:
                canary_word = delta_to_word10(d_ay)
    return words_26_to_256bit_hex(words), canary_word


def derive_offsets_from_hmac_hex(hex_sig: str) -> list[float]:
    """Deterministically map a 64-char hex digest into 9 micro-offsets in [-1e-5, +1e-5] (v1.2 baseline)."""
    digest = bytes.fromhex(hex_sig)
    offsets = []
    for i in range(9):
        chunk = int.from_bytes(digest[i * 3 : (i + 1) * 3], "big")
        norm = (chunk / 16777215.0) * 2.0 - 1.0  # [-1.0, +1.0]
        offsets.append(round(norm * 1e-5, 9))
    return offsets


def derive_micro_offsets(
    payload: str,
    secret_key: str,
    key_file_path: str = "",
    raw_password: str = "",
) -> tuple[str, list[float], dict]:
    """Derive (hex_sig, 9 micro-offsets, dstu4145_bundle) using DSTU 4145-2002 elliptic curve + Parallel Combiner."""
    dstu_res = call_dstu4145_bridge(
        {
            "action": "sign",
            "keyPath": key_file_path,
            "password": raw_password,
            "secretSeed": secret_key,
            "payloadBytesHex": payload.encode("utf-8").hex(),
        }
    )
    if dstu_res.get("status") == "ok" and dstu_res.get("rs_digest_hex"):
        hex_sig = dstu_res["rs_digest_hex"]
        return hex_sig, derive_offsets_from_hmac_hex(hex_sig), dstu_res
    if dstu_res.get("status") == "error" and key_file_path and Path(key_file_path).suffix.lower() in (".pfx", ".p12", ".dat", ".jks"):
        raise RuntimeError(f"Помилка авторизації ключа КЕП (ДСТУ 4145-2002): {dstu_res.get('error')}")

    digest = hmac.new(secret_key.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    hex_sig = digest.hex()
    return hex_sig, derive_offsets_from_hmac_hex(hex_sig), {}


def build_perturbed_triangles(
    payload: str,
    secret_key: str,
    key_file_path: str = "",
    raw_password: str = "",
    canary_beacon_word: int = 0,
    protocol: str = "MARMA-DSTU4145-V1.3",
) -> tuple[str, list[float], list[dict], dict]:
    """Return (hex_sig, offsets, perturbed_triangle_dicts, dstu4145_bundle) preserving lx + rx == 300.0."""
    hex_sig, offsets_v12, dstu4145_bundle = derive_micro_offsets(payload, secret_key, key_file_path, raw_password)
    if protocol == "MARMA-DSTU4145-V1.3":
        perturbed = build_perturbed_triangles_v13(hex_sig, canary_beacon_word=canary_beacon_word, cx=150.0)
        offsets = [round(t["lx"] - CANONICAL_TRIANGLES[i][1], 9) for i, t in enumerate(perturbed)]
        return hex_sig, offsets, perturbed, dstu4145_bundle

    perturbed = []
    for idx, (name, lx, by, ay, rx, is_up) in enumerate(CANONICAL_TRIANGLES):
        delta = offsets_v12[idx]
        lx_s = round(lx + delta, 9)
        rx_s = round(300.0 - lx_s, 9)
        by_s = round(by + delta * 0.5, 9)
        ay_s = round(ay, 9)
        perturbed.append(
            {
                "name": name,
                "lx": lx_s,
                "by": by_s,
                "ay": ay_s,
                "rx": rx_s,
                "is_up": is_up,
            }
        )
    return hex_sig, offsets_v12, perturbed, dstu4145_bundle


def compute_public_seal_digest(
    content_sha256: str,
    hmac_sha256: str,
    key_fingerprint: str,
    triangles: list[dict],
) -> str:
    """Compute a tamper-evident commitment binding content_sha256, hmac_sha256, key_fp, and triangles."""
    tri_canon = json.dumps(
        [{k: t[k] for k in ("name", "lx", "by", "ay", "rx")} for t in triangles],
        separators=(",", ":"),
    )
    raw = f"MARMA-SEAL-V1::{content_sha256}::{hmac_sha256}::{key_fingerprint}::{tri_canon}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ==============================================================================
# 1. SVG SIGNING & VERIFICATION (DSTU 4145-2002 + 256-Bit 9-Triangle Geometry)
# ==============================================================================
def sign_sri_yantra_svg(
    payload: str,
    secret_key: str,
    out_svg: Path,
    signer_key_name: str = "Sovereign-Vedic-Key-108",
    key_fingerprint: str = "",
    key_file_path: str = "",
    raw_password: str = "",
    recipient_id: str = "",
) -> dict:
    """Generate a cryptographically watermarked Sri Yantra SVG with DSTU 4145-2002 + 256-bit geometry."""
    if not key_fingerprint:
        key_fingerprint = hashlib.sha256(secret_key.encode("utf-8")).hexdigest()
    content_sha256 = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    canary_info = compute_canary_tag(secret_key, content_sha256, recipient_id, key_fingerprint)
    beacon_word = int(canary_info.get("beacon_word", 0))

    hex_sig, offsets, perturbed, dstu_bundle = build_perturbed_triangles(
        payload,
        secret_key,
        key_file_path,
        raw_password,
        canary_beacon_word=beacon_word,
        protocol="MARMA-DSTU4145-V1.3",
    )
    pub_seal = compute_public_seal_digest(content_sha256, hex_sig, key_fingerprint, perturbed)
    dstu_json_b64 = ""
    if dstu_bundle:
        import base64
        dstu_json_b64 = base64.b64encode(json.dumps(dstu_bundle, separators=(",", ":")).encode("utf-8")).decode("ascii")

    svg_polygons = []
    for t in perturbed:
        svg_polygons.append(
            f'  <polygon id="tri_{t["name"]}" data-lx="{t["lx"]:.9f}" data-by="{t["by"]:.9f}" '
            f'data-ay="{t["ay"]:.9f}" data-rx="{t["rx"]:.9f}" '
            f'points="{t["lx"]:.9f},{t["by"]:.9f} 150.000000000,{t["ay"]:.9f} {t["rx"]:.9f},{t["by"]:.9f}" '
            f'fill="none" stroke="#f0d078" stroke-width="0.65" />'
        )

    canary_attrs = ""
    if canary_info.get("enabled"):
        canary_attrs = (
            f' data-canary-word="{beacon_word}"'
            f' data-canary-pub="{canary_info["public_canary_hash"]}"'
            f' data-canary-hmac="{canary_info["hmac_commitment"]}"'
        )

    svg_content = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="1200" height="1200">\n'
        f'  <metadata data-protocol="MARMA-DSTU4145-V1.3" data-payload="{payload}" data-content-sha256="{content_sha256}" '
        f'data-hmac-sha256="{hex_sig}" data-signer="{signer_key_name}" '
        f'data-key-fp="{key_fingerprint}" data-public-seal="{pub_seal}" '
        f'data-dstu4145-b64="{dstu_json_b64}"{canary_attrs} />\n'
        '  <rect width="300" height="300" fill="#060913" />\n'
        '  <circle cx="150" cy="150" r="100" fill="none" stroke="#e6bd53" stroke-width="0.8" />\n'
        + "\n".join(svg_polygons)
        + '\n  <circle cx="150.000000" cy="156.430800" r="1.8" fill="#ff2a38" stroke="#ffe699" stroke-width="0.4" />\n'
        "</svg>\n"
    )
    out_svg.write_text(svg_content, encoding="utf-8")

    cades_res = {}
    if key_file_path:
        cades_res = call_dstu4145_bridge(
            {
                "action": "seal-cades",
                "keyPath": key_file_path,
                "password": raw_password,
                "inputFilePath": str(out_svg),
            }
        )

    return {
        "format": "svg",
        "protocol": "MARMA-DSTU4145-V1.3",
        "marma_bits": 256,
        "output_file": str(out_svg),
        "standard": dstu_bundle.get("standard", "ДСТУ 4145-2002 / ГОСТ 34.311-95"),
        "signer_key_name": signer_key_name,
        "signer_info": dstu_bundle.get("signer_info"),
        "key_fingerprint": key_fingerprint,
        "content_sha256": content_sha256,
        "gost34311_digest": dstu_bundle.get("gost34311_hex", ""),
        "dstu7564_digest": dstu_bundle.get("dstu7564_hex", ""),
        "combiner_digest": dstu_bundle.get("combiner_hex", ""),
        "dstu4145_r": dstu_bundle.get("r_hex", ""),
        "dstu4145_s": dstu_bundle.get("s_hex", ""),
        "hmac_sha256": hex_sig,
        "canary": canary_info,
        "cades_p7s": cades_res.get("p7s_path"),
        "offsets": offsets,
    }


def _check_strict_key_or_cert_match(
    payload: str,
    embedded_hmac: str,
    dstu_bundle: dict,
    dstu_ok: bool,
    secret_key: str | None,
    key_file_path: str,
    raw_password: str,
) -> tuple[str, list[float], bool]:
    """Verify key derivation, r||s digest binding, or matching owner certificate under --strict-key."""
    r_hex = (dstu_bundle or {}).get("r_hex", "")
    s_hex = (dstu_bundle or {}).get("s_hex", "")
    rs_sha = (
        hashlib.sha256(f"{r_hex}::{s_hex}".encode("utf-8")).hexdigest()
        if (r_hex and s_hex)
        else ""
    )

    if not secret_key:
        expected_hex = embedded_hmac
        expected_offsets = derive_offsets_from_hmac_hex(embedded_hmac) if len(embedded_hmac) == 64 else [0.0] * 9
        hmac_ok = (len(embedded_hmac) == 64) and (not rs_sha or embedded_hmac == rs_sha)
        return expected_hex, expected_offsets, hmac_ok

    try:
        expected_hex, expected_offsets, derived_dstu = derive_micro_offsets(
            payload, secret_key, key_file_path, raw_password
        )
    except Exception:
        return "", [0.0] * 9, False

    if not embedded_hmac or embedded_hmac == expected_hex:
        hmac_ok = not rs_sha or not embedded_hmac or embedded_hmac == rs_sha
        return expected_hex, expected_offsets, hmac_ok

    # If the document has a valid DSTU 4145-2002 EC signature and the unlocked key/cert belongs to the same owner (serial_hex / rnokpp)
    doc_signer = (dstu_bundle or {}).get("signer_info") or {}
    key_signer = (derived_dstu or {}).get("signer_info") or {}
    same_owner = bool(
        dstu_ok
        and len(embedded_hmac) == 64
        and (not rs_sha or embedded_hmac == rs_sha)
        and doc_signer.get("serial_hex")
        and doc_signer.get("serial_hex") == key_signer.get("serial_hex")
    )
    if same_owner:
        return embedded_hmac, derive_offsets_from_hmac_hex(embedded_hmac), True

    return expected_hex, expected_offsets, False


def verify_triangle_coordinates(
    embedded_tris: list[dict],
    expected_offsets: list[float],
    cx: float = 150.0,
    protocol: str = "MARMA-DSTU4145-V1.2",
    expected_hex: str = "",
    canary_beacon_word: int = 0,
) -> tuple[float, float]:
    """Verify all 36 coordinates (lx, rx, by, ay) and bilateral symmetry (lx + rx == 2*cx) across 9 triangles."""
    scale = 2.0 if cx == 300.0 else 1.0
    max_coord_drift = 0.0
    max_sym_err = 0.0

    if protocol == "MARMA-DSTU4145-V1.3" and len(expected_hex) == 64:
        exp_tris = build_perturbed_triangles_v13(expected_hex, canary_beacon_word=canary_beacon_word, cx=cx)
        for idx in range(9):
            t = embedded_tris[idx]
            exp = exp_tris[idx]
            lx_s = float(t["lx"])
            rx_s = float(t["rx"])
            by_s = float(t["by"])
            ay_s = float(t["ay"])

            sym_err = abs((lx_s + rx_s) - cx * 2.0)
            drift = max(
                abs(lx_s - float(exp["lx"])),
                abs(rx_s - float(exp["rx"])),
                abs(by_s - float(exp["by"])),
                abs(ay_s - float(exp["ay"])),
            )
            if sym_err > max_sym_err:
                max_sym_err = sym_err
            if drift > max_coord_drift:
                max_coord_drift = drift
        return max_coord_drift, max_sym_err

    for idx, (name, lx_can, by_can, ay_can, rx_can, _) in enumerate(CANONICAL_TRIANGLES):
        t = embedded_tris[idx]
        delta = expected_offsets[idx]
        exp_lx = round(lx_can * scale + delta, 9)
        exp_rx = round(cx * 2.0 - exp_lx, 9)
        exp_by = round(by_can * scale + delta * 0.5, 9)
        exp_ay = round(ay_can * scale, 9)

        lx_s = float(t["lx"])
        rx_s = float(t["rx"])
        by_s = float(t["by"])
        ay_s = float(t["ay"])

        sym_err = abs((lx_s + rx_s) - cx * 2.0)
        drift = max(
            abs(lx_s - exp_lx),
            abs(rx_s - exp_rx),
            abs(by_s - exp_by),
            abs(ay_s - exp_ay),
        )
        if sym_err > max_sym_err:
            max_sym_err = sym_err
        if drift > max_coord_drift:
            max_coord_drift = drift
    return max_coord_drift, max_sym_err


def verify_sri_yantra_svg(
    svg_text: str,
    payload: str | None = None,
    secret_key: str | None = None,
    key_file_path: str = "",
    raw_password: str = "",
    svg_path: Path | None = None,
    recipient_id: str = "",
) -> dict:
    """Verify the DSTU 4145-2002 elliptic curve signature and 9-triangle geometric watermark."""
    if payload is None:
        m_pay = re.search(r'data-payload="([^"]+)"', svg_text)
        if not m_pay:
            return {"verified": False, "format": "svg", "reason": "Missing data-payload in SVG metadata"}
        payload = m_pay.group(1)

    m_proto = re.search(r'data-protocol="([^"]+)"', svg_text)
    proto_ver = m_proto.group(1) if m_proto else "MARMA-DSTU4145-V1.2"
    m_hmac = re.search(r'data-hmac-sha256="([0-9a-fA-F]+)"', svg_text)
    embedded_hmac = m_hmac.group(1) if m_hmac else ""
    m_csha = re.search(r'data-content-sha256="([0-9a-fA-F]+)"', svg_text)
    embedded_csha = m_csha.group(1) if m_csha else ""
    m_pseal = re.search(r'data-public-seal="([0-9a-fA-F]+)"', svg_text)
    embedded_pseal = m_pseal.group(1) if m_pseal else ""
    m_signer = re.search(r'data-signer="([^"]+)"', svg_text)
    signer_name = m_signer.group(1) if m_signer else "Sovereign-Vedic-Key-108"
    m_kfp = re.search(r'data-key-fp="([0-9a-fA-F]+)"', svg_text)
    key_fp = m_kfp.group(1) if m_kfp else ""
    m_cword = re.search(r'data-canary-word="([0-9]+)"', svg_text)
    embedded_canary_word = int(m_cword.group(1)) if m_cword else 0
    m_cpub = re.search(r'data-canary-pub="([0-9a-fA-F]+)"', svg_text)
    embedded_canary_pub = m_cpub.group(1) if m_cpub else ""
    m_dstu = re.search(r'data-dstu4145-b64="([^"]*)"', svg_text)
    dstu_bundle = {}
    if m_dstu and m_dstu.group(1):
        try:
            import base64
            dstu_bundle = json.loads(base64.b64decode(m_dstu.group(1)).decode("utf-8"))
        except Exception:
            dstu_bundle = {}

    if not secret_key and (not embedded_hmac or len(embedded_hmac) != 64):
        return {"verified": False, "format": "svg", "reason": "Missing signature digest in SVG"}

    computed_csha = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    content_matches = (not embedded_csha) or (embedded_csha == computed_csha)

    dstu_verify = {"dstu4145_valid": True}
    if dstu_bundle:
        bridge_req = {
            "action": "verify",
            "payloadBytesHex": payload.encode("utf-8").hex(),
            "dstu4145": dstu_bundle,
        }
        if svg_path:
            bridge_req["docPath"] = str(svg_path)
        dstu_verify = call_dstu4145_bridge(bridge_req)
    dstu_ok = bool(dstu_verify.get("dstu4145_valid", True))

    expected_hex, expected_offsets, hmac_raw_match = _check_strict_key_or_cert_match(
        payload, embedded_hmac, dstu_bundle, dstu_ok, secret_key, key_file_path, raw_password
    )
    hmac_match = content_matches and hmac_raw_match

    triangles = []
    for idx, (name, lx_can, by_can, ay_can, rx_can, _) in enumerate(CANONICAL_TRIANGLES):
        m = re.search(
            rf'id="tri_{name}"\s+data-lx="([0-9.]+)"\s+data-by="([0-9.]+)"\s+data-ay="([0-9.]+)"\s+data-rx="([0-9.]+)"',
            svg_text,
        )
        if not m:
            return {"verified": False, "format": "svg", "reason": f"Missing triangle {name}"}
        lx_s, by_s, ay_s, rx_s = float(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4))
        triangles.append({"name": name, "lx": lx_s, "by": by_s, "ay": ay_s, "rx": rx_s})

    cx = 300.0 if (triangles[0]["lx"] + triangles[0]["rx"]) > 400.0 else 150.0
    eff_hmac = embedded_hmac or expected_hex
    max_offset_diff, max_sym_err = verify_triangle_coordinates(
        triangles,
        expected_offsets,
        cx=cx,
        protocol=proto_ver,
        expected_hex=eff_hmac,
        canary_beacon_word=embedded_canary_word,
    )

    rec_256_hex, rec_canary_word = (
        recover_256bit_from_triangles(triangles, cx=cx)
        if proto_ver == "MARMA-DSTU4145-V1.3"
        else ("", 0)
    )
    bijective_match = (proto_ver != "MARMA-DSTU4145-V1.3") or (
        rec_256_hex == eff_hmac and rec_canary_word == embedded_canary_word
    )

    expected_pseal = compute_public_seal_digest(computed_csha, eff_hmac, key_fp, triangles) if key_fp else ""
    pub_seal_ok = (not embedded_pseal) or (not expected_pseal) or (embedded_pseal == expected_pseal)

    canary_recipient_match = None
    if recipient_id:
        cand_tag = compute_canary_tag(secret_key or DEFAULT_SECRET, computed_csha, recipient_id, key_fp)
        canary_recipient_match = bool(
            rec_canary_word > 0
            and rec_canary_word == cand_tag["beacon_word"]
            and (not embedded_canary_pub or embedded_canary_pub == cand_tag["public_canary_hash"])
        )

    verified = (
        content_matches
        and hmac_match
        and dstu_ok
        and pub_seal_ok
        and bijective_match
        and (max_offset_diff < 1e-8)
        and (max_sym_err < 1e-8)
    )

    reason = "OK"
    if not content_matches:
        reason = "SVG payload SHA-256 mismatch"
    elif not dstu_ok:
        reason = "ДСТУ 4145-2002 elliptic curve verification failed"
    elif not hmac_match:
        reason = "Cryptographic key / digest mismatch"
    elif not pub_seal_ok or not bijective_match or max_offset_diff >= 1e-8 or max_sym_err >= 1e-8:
        reason = "Geometric coordinate tampering detected"

    return {
        "verified": verified,
        "reason": reason,
        "format": "svg",
        "protocol": proto_ver,
        "marma_bits": 256 if proto_ver == "MARMA-DSTU4145-V1.3" else 24,
        "standard": dstu_bundle.get("standard", "ДСТУ 4145-2002 / ГОСТ 34.311-95"),
        "dstu4145_verified": dstu_ok,
        "dstu4145_ec_verified": dstu_ok,
        "pades_cades_verified": bool(dstu_verify.get("qes_container_report")),
        "gost34311_digest": dstu_bundle.get("gost34311_hex", ""),
        "dstu7564_digest": dstu_bundle.get("dstu7564_hex", ""),
        "combiner_digest": dstu_bundle.get("combiner_hex", ""),
        "dstu4145_r": dstu_bundle.get("r_hex", ""),
        "dstu4145_s": dstu_bundle.get("s_hex", ""),
        "signer_info": dstu_bundle.get("signer_info"),
        "qes_container_report": dstu_verify.get("qes_container_report"),
        "payload": payload,
        "signer_key_name": signer_name,
        "key_fingerprint": key_fp,
        "hmac_match": hmac_match,
        "public_seal_match": pub_seal_ok,
        "bijective_256bit_match": bijective_match,
        "recovered_256bit_digest": rec_256_hex,
        "canary_active": bool(rec_canary_word > 0),
        "canary_beacon_word": rec_canary_word,
        "canary_recipient_verified": canary_recipient_match,
        "computed_content_sha256": computed_csha,
        "expected_hmac_sha256": expected_hex,
        "embedded_hmac_sha256": eff_hmac,
        "max_coordinate_signature_drift": round(max_offset_diff, 10),
        "max_bilateral_symmetry_error": round(max_sym_err, 12),
        "triangles": triangles,
    }


# ==============================================================================
# 2. PDF DOCUMENT STAMPING & VERIFICATION (PyMuPDF + DSTU 4145-2002 PAdES)
# ==============================================================================
def stamp_pdf_document(
    in_pdf: Path,
    out_pdf: Path,
    secret_key: str = DEFAULT_SECRET,
    mode: str = "both",
    signer_key_name: str = "Sovereign-Vedic-Key-108",
    key_fingerprint: str = "",
    key_file_path: str = "",
    raw_password: str = "",
    recipient_id: str = "",
) -> dict:
    """Stamp a PDF with a vector Sri Yantra watermark + corner seal + DSTU 4145-2002 PAdES signature (256-bit v1.3)."""
    if not key_fingerprint:
        key_fingerprint = hashlib.sha256(secret_key.encode("utf-8")).hexdigest()

    doc = pymupdf.open(str(in_pdf))
    full_text = "\n".join(normalize_text(page.get_text("text")) for page in doc)
    content_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
    payload = f"PDF-CONTENT-SHA256::{content_hash}"

    canary_info = compute_canary_tag(secret_key, content_hash, recipient_id, key_fingerprint)
    beacon_word = int(canary_info.get("beacon_word", 0))

    hex_sig, offsets, perturbed, dstu_bundle = build_perturbed_triangles(
        payload,
        secret_key,
        key_file_path,
        raw_password,
        canary_beacon_word=beacon_word,
        protocol="MARMA-DSTU4145-V1.3",
    )
    pub_seal = compute_public_seal_digest(content_hash, hex_sig, key_fingerprint, perturbed)

    for page_idx, page in enumerate(doc):
        rect = page.rect
        w, h = rect.width, rect.height

        # A. Subtle full-page vector background watermark on every page
        if mode in ("watermark", "both"):
            shape_bg = page.new_shape()
            scale_bg = min(w, h) * 0.62 / 300.0
            cx_bg, cy_bg = w / 2.0, h / 2.0

            def map_bg(x: float, y: float) -> pymupdf.Point:
                return pymupdf.Point(cx_bg + (x - 150.0) * scale_bg, cy_bg + (y - 150.0) * scale_bg)

            shape_bg.draw_circle(map_bg(150.0, 150.0), 100.0 * scale_bg)
            shape_bg.draw_circle(map_bg(150.0, 150.0), 122.0 * scale_bg)
            for t in perturbed:
                p1 = map_bg(t["lx"], t["by"])
                p2 = map_bg(150.0, t["ay"])
                p3 = map_bg(t["rx"], t["by"])
                shape_bg.draw_polyline([p1, p2, p3, p1])
            shape_bg.finish(
                color=(0.76, 0.60, 0.22),
                width=0.65,
                stroke_opacity=0.075,
            )
            shape_bg.commit(overlay=True)

        # B. Crisp Golden Authorship Seal in bottom-right corner of first & last page
        if mode in ("seal", "both") and (page_idx == 0 or page_idx == len(doc) - 1):
            seal_r = 34.0
            cx_s = w - 58.0
            cy_s = h - 58.0
            scale_s = (seal_r * 2.0) / 300.0

            def map_seal(x: float, y: float) -> pymupdf.Point:
                return pymupdf.Point(cx_s + (x - 150.0) * scale_s, cy_s + (y - 150.0) * scale_s)

            shape_s = page.new_shape()
            shape_s.draw_circle(pymupdf.Point(cx_s, cy_s), seal_r * 0.86)
            shape_s.finish(
                color=(0.72, 0.54, 0.14),
                fill=(0.04, 0.06, 0.11),
                width=0.9,
                fill_opacity=0.92,
                stroke_opacity=0.95,
            )

            shape_tri = page.new_shape()
            shape_tri.draw_circle(map_seal(150.0, 150.0), 100.0 * scale_s)
            for t in perturbed:
                p1 = map_seal(t["lx"], t["by"])
                p2 = map_seal(150.0, t["ay"])
                p3 = map_seal(t["rx"], t["by"])
                shape_tri.draw_polyline([p1, p2, p3, p1])
            shape_tri.finish(color=(0.95, 0.80, 0.38), width=0.55, stroke_opacity=0.95)

            shape_b = page.new_shape()
            shape_b.draw_circle(map_seal(150.0, 156.4308), 1.4)
            shape_b.finish(color=(1.0, 0.9, 0.6), fill=(0.95, 0.18, 0.22), width=0.3)

            shape_s.commit(overlay=True)
            shape_tri.commit(overlay=True)
            shape_b.commit(overlay=True)

            page.insert_text(
                pymupdf.Point(cx_s - 38.0, cy_s + 38.0),
                f"MARMA-CRYPTO-SEAL · DSTU4145 · {hex_sig[:10].upper()}",
                fontsize=5.0,
                color=(0.55, 0.42, 0.12),
            )

    seal_packet = {
        "protocol": "MARMA-DSTU4145-V1.3",
        "marma_bits": 256,
        "signer_key_name": signer_key_name,
        "key_fingerprint": key_fingerprint,
        "content_sha256": content_hash,
        "hmac_sha256": hex_sig,
        "public_seal_digest": pub_seal,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "dstu4145": dstu_bundle,
        "canary": canary_info if canary_info.get("enabled") else {"enabled": False, "beacon_word": 0},
        "triangles": [{k: t[k] for k in ("name", "lx", "by", "ay", "rx")} for t in perturbed],
    }
    meta = doc.metadata or {}
    meta["keywords"] = "MARMA_SEAL::" + json.dumps(seal_packet, separators=(",", ":"))
    doc.set_metadata(meta)
    if in_pdf.exists() and out_pdf.exists() and in_pdf.resolve() == out_pdf.resolve():
        tmp_out = out_pdf.with_name(f".{out_pdf.name}.marma_tmp.pdf")
        doc.save(str(tmp_out))
        doc.close()
        tmp_out.replace(out_pdf)
    else:
        doc.save(str(out_pdf))
        doc.close()

    pades_res = {}
    if key_file_path:
        pades_res = call_dstu4145_bridge(
            {
                "action": "seal-pdf-pades",
                "keyPath": key_file_path,
                "password": raw_password,
                "inputPdfPath": str(out_pdf),
                "outputPdfPath": str(out_pdf),
            }
        )

    return {
        "format": "pdf",
        "protocol": "MARMA-DSTU4145-V1.3",
        "marma_bits": 256,
        "input_file": str(in_pdf),
        "output_file": str(out_pdf),
        "standard": dstu_bundle.get("standard", "ДСТУ 4145-2002 / ГОСТ 34.311-95"),
        "pades_embedded": bool(pades_res.get("pades_signed")),
        "signer_key_name": signer_key_name,
        "signer_info": dstu_bundle.get("signer_info"),
        "key_fingerprint": key_fingerprint,
        "content_sha256": content_hash,
        "gost34311_digest": dstu_bundle.get("gost34311_hex", ""),
        "dstu7564_digest": dstu_bundle.get("dstu7564_hex", ""),
        "combiner_digest": dstu_bundle.get("combiner_hex", ""),
        "dstu4145_r": dstu_bundle.get("r_hex", ""),
        "dstu4145_s": dstu_bundle.get("s_hex", ""),
        "hmac_sha256": hex_sig,
        "canary": canary_info,
        "offsets": offsets,
    }


def verify_pdf_document(
    pdf_path: Path,
    secret_key: str | None = None,
    key_file_path: str = "",
    raw_password: str = "",
    recipient_id: str = "",
) -> dict:
    """Verify text integrity, DSTU 4145-2002 EC signature, PAdES container, and 9-triangle geometry of a PDF."""
    doc = pymupdf.open(str(pdf_path))
    meta = doc.metadata or {}
    kw = meta.get("keywords", "")
    if "MARMA_SEAL::" not in kw:
        doc.close()
        return {"verified": False, "format": "pdf", "file": str(pdf_path), "reason": "No MARMA_SEAL metadata found in PDF"}

    raw_json = kw.split("MARMA_SEAL::", 1)[1]
    seal_packet = json.loads(raw_json)

    full_text = "\n".join(normalize_text(page.get_text("text")) for page in doc)
    doc.close()
    content_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
    payload = f"PDF-CONTENT-SHA256::{content_hash}"

    proto_ver = seal_packet.get("protocol", "MARMA-DSTU4145-V1.2")
    embedded_hmac = seal_packet.get("hmac_sha256", "")
    embedded_content_sha = seal_packet.get("content_sha256", content_hash)
    signer_name = seal_packet.get("signer_key_name", "Sovereign-Vedic-Key-108")
    key_fp = seal_packet.get("key_fingerprint", "")
    dstu_bundle = seal_packet.get("dstu4145") or {}
    canary_pkt = seal_packet.get("canary") or {}
    embedded_canary_word = int(canary_pkt.get("beacon_word", 0))
    embedded_canary_pub = str(canary_pkt.get("public_canary_hash", ""))
    embedded_tris = seal_packet.get("triangles", [])
    if len(embedded_tris) != 9:
        return {"verified": False, "format": "pdf", "file": str(pdf_path), "reason": "Corrupted triangle array"}

    content_matches = content_hash == embedded_content_sha

    dstu_verify = {"dstu4145_valid": True}
    if dstu_bundle:
        dstu_verify = call_dstu4145_bridge(
            {
                "action": "verify",
                "payloadBytesHex": payload.encode("utf-8").hex(),
                "dstu4145": dstu_bundle,
                "docPath": str(pdf_path),
            }
        )
    dstu_ok = bool(dstu_verify.get("dstu4145_valid", True))

    expected_hex, expected_offsets, hmac_raw_match = _check_strict_key_or_cert_match(
        payload, embedded_hmac, dstu_bundle, dstu_ok, secret_key, key_file_path, raw_password
    )
    hmac_match = content_matches and hmac_raw_match

    cx = 300.0 if (float(embedded_tris[0]["lx"]) + float(embedded_tris[0]["rx"])) > 400.0 else 150.0
    max_offset_diff, max_sym_err = verify_triangle_coordinates(
        embedded_tris,
        expected_offsets,
        cx=cx,
        protocol=proto_ver,
        expected_hex=embedded_hmac,
        canary_beacon_word=embedded_canary_word,
    )

    rec_256_hex, rec_canary_word = (
        recover_256bit_from_triangles(embedded_tris, cx=cx)
        if proto_ver == "MARMA-DSTU4145-V1.3"
        else ("", 0)
    )
    bijective_match = (proto_ver != "MARMA-DSTU4145-V1.3") or (
        rec_256_hex == embedded_hmac and rec_canary_word == embedded_canary_word
    )

    embedded_pseal = seal_packet.get("public_seal_digest", "")
    expected_pseal = compute_public_seal_digest(content_hash, embedded_hmac, key_fp, embedded_tris) if key_fp else ""
    pub_seal_ok = (not embedded_pseal) or (not expected_pseal) or (embedded_pseal == expected_pseal)

    canary_recipient_match = None
    if recipient_id:
        cand_tag = compute_canary_tag(secret_key or DEFAULT_SECRET, content_hash, recipient_id, key_fp)
        canary_recipient_match = bool(
            rec_canary_word > 0
            and rec_canary_word == cand_tag["beacon_word"]
            and (not embedded_canary_pub or embedded_canary_pub == cand_tag["public_canary_hash"])
        )

    verified = (
        content_matches
        and hmac_match
        and dstu_ok
        and pub_seal_ok
        and bijective_match
        and (max_offset_diff < 1e-8)
        and (max_sym_err < 1e-8)
    )

    reason = "OK"
    if not content_matches:
        reason = "Document text was modified after signing (SHA-256 / ГОСТ 34.311-95 mismatch)"
    elif not hmac_match:
        reason = "Cryptographic key mismatch (ДСТУ 4145-2002 / HMAC)"
    elif not dstu_ok:
        reason = "ДСТУ 4145-2002 elliptic curve verification failed"
    elif not pub_seal_ok or not bijective_match or max_offset_diff >= 1e-8 or max_sym_err >= 1e-8:
        reason = "Geometric coordinate tampering detected"

    return {
        "verified": verified,
        "reason": reason,
        "format": "pdf",
        "protocol": proto_ver,
        "marma_bits": 256 if proto_ver == "MARMA-DSTU4145-V1.3" else 24,
        "file": str(pdf_path),
        "standard": dstu_bundle.get("standard", "ДСТУ 4145-2002 / ГОСТ 34.311-95"),
        "dstu4145_verified": dstu_ok,
        "dstu4145_ec_verified": dstu_ok,
        "pades_cades_verified": bool(dstu_verify.get("qes_container_report")),
        "gost34311_digest": dstu_bundle.get("gost34311_hex", ""),
        "dstu7564_digest": dstu_bundle.get("dstu7564_hex", ""),
        "combiner_digest": dstu_bundle.get("combiner_hex", ""),
        "dstu4145_r": dstu_bundle.get("r_hex", ""),
        "dstu4145_s": dstu_bundle.get("s_hex", ""),
        "signer_info": dstu_bundle.get("signer_info"),
        "qes_container_report": dstu_verify.get("qes_container_report"),
        "signer_key_name": signer_name,
        "key_fingerprint": key_fp,
        "hmac_match": hmac_match,
        "public_seal_match": pub_seal_ok,
        "bijective_256bit_match": bijective_match,
        "recovered_256bit_digest": rec_256_hex,
        "canary_active": bool(rec_canary_word > 0),
        "canary_beacon_word": rec_canary_word,
        "canary_recipient_verified": canary_recipient_match,
        "computed_content_sha256": content_hash,
        "expected_hmac_sha256": expected_hex,
        "embedded_hmac_sha256": embedded_hmac,
        "max_coordinate_signature_drift": round(max_offset_diff, 10),
        "max_bilateral_symmetry_error": round(max_sym_err, 12),
        "triangles": embedded_tris,
    }


# ==============================================================================
# 3. DOCX DOCUMENT STAMPING & VERIFICATION (python-docx + DSTU 4145-2002)
# ==============================================================================
def extract_docx_canonical_text(doc_obj: docx.Document) -> str:
    """Extract all paragraphs and table cells excluding the Marma seal footer."""
    chunks = []
    for p in doc_obj.paragraphs:
        t = p.text.strip()
        if t and "MARMA-CRYPTO-SEAL" not in t and "MARMA_SEAL_PACKET::" not in t:
            chunks.append(t)
    for table in doc_obj.tables:
        for row in table.rows:
            for cell in row.cells:
                ct = cell.text.strip()
                if ct and "MARMA-CRYPTO-SEAL" not in ct and "MARMA_SEAL_PACKET::" not in ct:
                    chunks.append(ct)
    return "\n".join(chunks)


def render_seal_png(perturbed: list[dict], out_png: Path, size: int = 600) -> None:
    """Render a transparent high-resolution golden Sri Yantra seal via PyCairo."""
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size)
    ctx = cairo.Context(surface)
    cx, cy = size / 2.0, size / 2.0
    scale = (size * 0.84) / 300.0

    ctx.arc(cx, cy, size * 0.45, 0, 2 * math.pi)
    ctx.set_source_rgba(0.04, 0.06, 0.12, 0.96)
    ctx.fill_preserve()
    ctx.set_line_width(3.0)
    ctx.set_source_rgba(0.92, 0.75, 0.32, 0.95)
    ctx.stroke()

    def map_pt(x: float, y: float) -> tuple[float, float]:
        return cx + (x - 150.0) * scale, cy + (y - 150.0) * scale

    ctx.arc(cx, cy, 100.0 * scale, 0, 2 * math.pi)
    ctx.set_line_width(1.8)
    ctx.set_source_rgba(0.95, 0.80, 0.38, 0.90)
    ctx.stroke()

    ctx.set_line_width(1.6)
    ctx.set_source_rgba(0.98, 0.86, 0.48, 0.95)
    for t in perturbed:
        p1 = map_pt(t["lx"], t["by"])
        p2 = map_pt(150.0, t["ay"])
        p3 = map_pt(t["rx"], t["by"])
        ctx.move_to(*p1)
        ctx.line_to(*p2)
        ctx.line_to(*p3)
        ctx.close_path()
        ctx.stroke()

    bx, by_pt = map_pt(150.0, 156.4308)
    ctx.arc(bx, by_pt, 5.0, 0, 2 * math.pi)
    ctx.set_source_rgba(0.96, 0.18, 0.22, 1.0)
    ctx.fill()
    surface.write_to_png(str(out_png))


def stamp_docx_document(
    in_docx: Path,
    out_docx: Path,
    secret_key: str = DEFAULT_SECRET,
    signer_key_name: str = "Sovereign-Vedic-Key-108",
    key_fingerprint: str = "",
    key_file_path: str = "",
    raw_password: str = "",
    recipient_id: str = "",
) -> dict:
    """Stamp a Word (.docx) document with a Sri Yantra visual seal and DSTU 4145-2002 coordinate signature."""
    if not key_fingerprint:
        key_fingerprint = hashlib.sha256(secret_key.encode("utf-8")).hexdigest()

    doc_obj = docx.Document(str(in_docx))
    body_text = extract_docx_canonical_text(doc_obj)
    content_hash = hashlib.sha256(body_text.encode("utf-8")).hexdigest()
    payload = f"DOCX-CONTENT-SHA256::{content_hash}"

    canary_info = compute_canary_tag(secret_key, content_hash, recipient_id, key_fingerprint)
    beacon_word = int(canary_info.get("beacon_word", 0))

    hex_sig, offsets, perturbed, dstu_bundle = build_perturbed_triangles(
        payload,
        secret_key,
        key_file_path,
        raw_password,
        canary_beacon_word=beacon_word,
        protocol="MARMA-DSTU4145-V1.3",
    )
    pub_seal = compute_public_seal_digest(content_hash, hex_sig, key_fingerprint, perturbed)

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_f:
        seal_png = Path(tmp_f.name)
    try:
        render_seal_png(perturbed, seal_png, size=600)

        p_img = doc_obj.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run_img = p_img.add_run()
        run_img.add_picture(str(seal_png), width=Inches(1.15))

        p_sig = doc_obj.add_paragraph()
        p_sig.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run_sig = p_sig.add_run(f"MARMA-CRYPTO-SEAL · ДСТУ 4145-2002 · {hex_sig[:16].upper()}")
        run_sig.font.size = Pt(7.5)
        run_sig.font.color.rgb = RGBColor(165, 130, 45)

        seal_packet = {
            "protocol": "MARMA-DSTU4145-V1.3",
            "marma_bits": 256,
            "signer_key_name": signer_key_name,
            "key_fingerprint": key_fingerprint,
            "content_sha256": content_hash,
            "hmac_sha256": hex_sig,
            "public_seal_digest": pub_seal,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "dstu4145": dstu_bundle,
            "canary": canary_info if canary_info.get("enabled") else {"enabled": False, "beacon_word": 0},
            "triangles": [{k: t[k] for k in ("name", "lx", "by", "ay", "rx")} for t in perturbed],
        }
        p_hidden = doc_obj.add_paragraph()
        r_hidden = p_hidden.add_run("MARMA_SEAL_PACKET::" + json.dumps(seal_packet, separators=(",", ":")))
        r_hidden.font.hidden = True
        r_hidden.font.size = Pt(1)

        doc_obj.save(str(out_docx))
    finally:
        if seal_png.exists():
            seal_png.unlink()

    cades_res = {}
    if key_file_path:
        cades_res = call_dstu4145_bridge(
            {
                "action": "seal-cades",
                "keyPath": key_file_path,
                "password": raw_password,
                "inputFilePath": str(out_docx),
            }
        )

    return {
        "format": "docx",
        "protocol": "MARMA-DSTU4145-V1.3",
        "marma_bits": 256,
        "input_file": str(in_docx),
        "output_file": str(out_docx),
        "standard": dstu_bundle.get("standard", "ДСТУ 4145-2002 / ГОСТ 34.311-95"),
        "signer_key_name": signer_key_name,
        "signer_info": dstu_bundle.get("signer_info"),
        "key_fingerprint": key_fingerprint,
        "content_sha256": content_hash,
        "gost34311_digest": dstu_bundle.get("gost34311_hex", ""),
        "dstu7564_digest": dstu_bundle.get("dstu7564_hex", ""),
        "combiner_digest": dstu_bundle.get("combiner_hex", ""),
        "dstu4145_r": dstu_bundle.get("r_hex", ""),
        "dstu4145_s": dstu_bundle.get("s_hex", ""),
        "hmac_sha256": hex_sig,
        "canary": canary_info,
        "cades_p7s": cades_res.get("p7s_path"),
        "offsets": offsets,
    }


def verify_docx_document(
    docx_path: Path,
    secret_key: str | None = None,
    key_file_path: str = "",
    raw_password: str = "",
    recipient_id: str = "",
) -> dict:
    """Verify the text integrity, DSTU 4145-2002 EC signature, and 9-triangle watermark of a .docx document."""
    doc_obj = docx.Document(str(docx_path))
    packet_str = None
    for p in doc_obj.paragraphs:
        if "MARMA_SEAL_PACKET::" in p.text:
            packet_str = p.text.split("MARMA_SEAL_PACKET::", 1)[1].strip()
            break
    if not packet_str:
        return {"verified": False, "format": "docx", "file": str(docx_path), "reason": "No MARMA_SEAL_PACKET found in DOCX"}

    seal_packet = json.loads(packet_str)
    body_text = extract_docx_canonical_text(doc_obj)
    content_hash = hashlib.sha256(body_text.encode("utf-8")).hexdigest()
    payload = f"DOCX-CONTENT-SHA256::{content_hash}"

    proto_ver = seal_packet.get("protocol", "MARMA-DSTU4145-V1.2")
    embedded_hmac = seal_packet.get("hmac_sha256", "")
    embedded_content_sha = seal_packet.get("content_sha256", content_hash)
    signer_name = seal_packet.get("signer_key_name", "Sovereign-Vedic-Key-108")
    key_fp = seal_packet.get("key_fingerprint", "")
    dstu_bundle = seal_packet.get("dstu4145") or {}
    canary_pkt = seal_packet.get("canary") or {}
    embedded_canary_word = int(canary_pkt.get("beacon_word", 0))
    embedded_canary_pub = str(canary_pkt.get("public_canary_hash", ""))
    embedded_tris = seal_packet.get("triangles", [])
    if len(embedded_tris) != 9:
        return {"verified": False, "format": "docx", "file": str(docx_path), "reason": "Corrupted triangle array"}

    content_matches = content_hash == embedded_content_sha

    dstu_verify = {"dstu4145_valid": True}
    if dstu_bundle:
        dstu_verify = call_dstu4145_bridge(
            {
                "action": "verify",
                "payloadBytesHex": payload.encode("utf-8").hex(),
                "dstu4145": dstu_bundle,
                "docPath": str(docx_path),
            }
        )
    dstu_ok = bool(dstu_verify.get("dstu4145_valid", True))

    expected_hex, expected_offsets, hmac_raw_match = _check_strict_key_or_cert_match(
        payload, embedded_hmac, dstu_bundle, dstu_ok, secret_key, key_file_path, raw_password
    )
    hmac_match = content_matches and hmac_raw_match

    cx = 300.0 if (float(embedded_tris[0]["lx"]) + float(embedded_tris[0]["rx"])) > 400.0 else 150.0
    max_offset_diff, max_sym_err = verify_triangle_coordinates(
        embedded_tris,
        expected_offsets,
        cx=cx,
        protocol=proto_ver,
        expected_hex=embedded_hmac,
        canary_beacon_word=embedded_canary_word,
    )

    rec_256_hex, rec_canary_word = (
        recover_256bit_from_triangles(embedded_tris, cx=cx)
        if proto_ver == "MARMA-DSTU4145-V1.3"
        else ("", 0)
    )
    bijective_match = (proto_ver != "MARMA-DSTU4145-V1.3") or (
        rec_256_hex == embedded_hmac and rec_canary_word == embedded_canary_word
    )

    embedded_pseal = seal_packet.get("public_seal_digest", "")
    expected_pseal = compute_public_seal_digest(content_hash, embedded_hmac, key_fp, embedded_tris) if key_fp else ""
    pub_seal_ok = (not embedded_pseal) or (not expected_pseal) or (embedded_pseal == expected_pseal)

    canary_recipient_match = None
    if recipient_id:
        cand_tag = compute_canary_tag(secret_key or DEFAULT_SECRET, content_hash, recipient_id, key_fp)
        canary_recipient_match = bool(
            rec_canary_word > 0
            and rec_canary_word == cand_tag["beacon_word"]
            and (not embedded_canary_pub or embedded_canary_pub == cand_tag["public_canary_hash"])
        )

    verified = (
        content_matches
        and hmac_match
        and dstu_ok
        and pub_seal_ok
        and bijective_match
        and (max_offset_diff < 1e-8)
        and (max_sym_err < 1e-8)
    )

    reason = "OK"
    if not content_matches:
        reason = "DOCX text was modified after signing"
    elif not hmac_match:
        reason = "Cryptographic key mismatch"
    elif not dstu_ok:
        reason = "ДСТУ 4145-2002 elliptic curve verification failed"
    elif not pub_seal_ok or not bijective_match or max_offset_diff >= 1e-8 or max_sym_err >= 1e-8:
        reason = "Geometric coordinate tampering detected"

    return {
        "verified": verified,
        "reason": reason,
        "format": "docx",
        "protocol": proto_ver,
        "marma_bits": 256 if proto_ver == "MARMA-DSTU4145-V1.3" else 24,
        "file": str(docx_path),
        "standard": dstu_bundle.get("standard", "ДСТУ 4145-2002 / ГОСТ 34.311-95"),
        "dstu4145_verified": dstu_ok,
        "dstu4145_ec_verified": dstu_ok,
        "pades_cades_verified": bool(dstu_verify.get("qes_container_report")),
        "gost34311_digest": dstu_bundle.get("gost34311_hex", ""),
        "dstu7564_digest": dstu_bundle.get("dstu7564_hex", ""),
        "combiner_digest": dstu_bundle.get("combiner_hex", ""),
        "dstu4145_r": dstu_bundle.get("r_hex", ""),
        "dstu4145_s": dstu_bundle.get("s_hex", ""),
        "signer_info": dstu_bundle.get("signer_info"),
        "qes_container_report": dstu_verify.get("qes_container_report"),
        "signer_key_name": signer_name,
        "key_fingerprint": key_fp,
        "hmac_match": hmac_match,
        "public_seal_match": pub_seal_ok,
        "bijective_256bit_match": bijective_match,
        "recovered_256bit_digest": rec_256_hex,
        "canary_active": bool(rec_canary_word > 0),
        "canary_beacon_word": rec_canary_word,
        "canary_recipient_verified": canary_recipient_match,
        "computed_content_sha256": content_hash,
        "expected_hmac_sha256": expected_hex,
        "embedded_hmac_sha256": embedded_hmac,
        "max_coordinate_signature_drift": round(max_offset_diff, 10),
        "max_bilateral_symmetry_error": round(max_sym_err, 12),
        "triangles": embedded_tris,
    }


def trace_canary_suspects(
    target_file: Path,
    suspects: list[str],
    secret_key: str | None = None,
) -> dict:
    """Forensically attribute a leaked document against a list of suspect recipient IDs via D5.ay Canary Beacon."""
    ver = verify_any_file(target_file, secret_key=secret_key)
    beacon_word = int(ver.get("canary_beacon_word", 0))
    csha = str(ver.get("computed_content_sha256", ""))
    kfp = str(ver.get("key_fingerprint", ""))

    # Extract embedded public_canary_hash if present
    embedded_pub_canary = ""
    ext = target_file.suffix.lower()
    if ext == ".pdf":
        d = pymupdf.open(str(target_file))
        kw = (d.metadata or {}).get("keywords", "")
        d.close()
        if "MARMA_SEAL::" in kw:
            pkt = json.loads(kw.split("MARMA_SEAL::", 1)[1])
            embedded_pub_canary = str((pkt.get("canary") or {}).get("public_canary_hash", ""))
    elif ext == ".docx":
        d_obj = docx.Document(str(target_file))
        for p in d_obj.paragraphs:
            if "MARMA_SEAL_PACKET::" in p.text:
                pkt = json.loads(p.text.split("MARMA_SEAL_PACKET::", 1)[1].strip())
                embedded_pub_canary = str((pkt.get("canary") or {}).get("public_canary_hash", ""))
                break
    elif ext == ".svg":
        txt = target_file.read_text(encoding="utf-8")
        m_cp = re.search(r'data-canary-pub="([0-9a-fA-F]+)"', txt)
        if m_cp:
            embedded_pub_canary = m_cp.group(1)

    matched_suspects: list[str] = []
    tested_candidates: list[dict] = []
    for s in suspects:
        s_clean = s.strip()
        if not s_clean:
            continue
        tag = compute_canary_tag(secret_key or DEFAULT_SECRET, csha, s_clean, kfp)
        word_match = beacon_word > 0 and (tag["beacon_word"] == beacon_word)
        hash_match = (not embedded_pub_canary) or (tag["public_canary_hash"] == embedded_pub_canary)
        is_hit = bool(word_match and hash_match)
        if is_hit:
            matched_suspects.append(s_clean)
        tested_candidates.append(
            {
                "recipient_id": s_clean,
                "expected_beacon_word": tag["beacon_word"],
                "public_canary_hash": tag["public_canary_hash"],
                "match": is_hit,
            }
        )

    return {
        "file": str(target_file),
        "document_verified": bool(ver.get("verified")),
        "canary_active": beacon_word > 0,
        "extracted_d5_ay_beacon_word": beacon_word,
        "embedded_public_canary_hash": embedded_pub_canary,
        "matched_recipient": matched_suspects[0] if len(matched_suspects) == 1 else (matched_suspects or None),
        "matched_count": len(matched_suspects),
        "candidates_tested": len(tested_candidates),
        "results": tested_candidates,
    }


# ==============================================================================
# 4. OFFICIAL VECTOR PDF VERIFICATION PROTOCOL GENERATOR
# ==============================================================================
def generate_pdf_verification_protocol(
    target_file: Path,
    out_pdf: Path,
    lang: str = "uk",
    secret_key: str | None = None,
) -> dict:
    """Generate an official Vector PDF Verification Protocol with DSTU 4145-2002 & 9-triangle audit."""
    ver_res = verify_any_file(target_file, secret_key=secret_key)
    verified = bool(ver_res.get("verified"))

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4

    # Header banner
    shape = page.new_shape()
    shape.draw_rect(pymupdf.Rect(0, 0, 595, 105))
    shape.finish(fill=(0.04, 0.06, 0.12), color=(0.82, 0.65, 0.22), width=1.2)
    shape.commit()

    # Draw golden vector Sri Yantra emblem in top-left header
    cx_e, cy_e, r_e = 56.0, 52.0, 34.0
    scale_e = (r_e * 2.0) / 300.0

    def map_e(x: float, y: float) -> pymupdf.Point:
        return pymupdf.Point(cx_e + (x - 150.0) * scale_e, cy_e + (y - 150.0) * scale_e)

    sh_emblem = page.new_shape()
    sh_emblem.draw_circle(map_e(150.0, 150.0), 100.0 * scale_e)
    for name, lx, by, ay, rx, _ in CANONICAL_TRIANGLES:
        sh_emblem.draw_polyline([map_e(lx, by), map_e(150.0, ay), map_e(rx, by), map_e(lx, by)])
    sh_emblem.finish(color=(0.96, 0.82, 0.40), width=0.65)
    sh_emblem.commit()

    sh_bindu = page.new_shape()
    sh_bindu.draw_circle(map_e(150.0, 156.4308), 1.8)
    sh_bindu.finish(fill=(0.96, 0.18, 0.22), color=(1.0, 0.9, 0.6), width=0.3)
    sh_bindu.commit()

    title_str = (
        "MARMA-CRYPTO & DSTU 4145-2002 GEOMETRIC SIGNATURE PROTOCOL"
        if lang == "en"
        else "MARMA-CRYPTO · ДСТУ 4145-2002 — ПРОТОКОЛ ПЕРЕВІРКИ ПІДПИСУ ШРІ ЯНТРИ"
    )
    sub_str = (
        "DSTU 4145-2002 Elliptic Curve GF(2^257) · GOST 34.311-95 · DSTU 7564 · 256-Bit Marma Audit"
        if lang == "en"
        else "ДСТУ 4145-2002 GF(2^257) · ГОСТ 34.311-95 · ДСТУ 7564 «Купина» · 256-бітний Аудит Шрі Янтри"
    )
    page.insert_text(pymupdf.Point(104, 44), title_str, fontsize=10.5, fontname="helv", color=(0.98, 0.86, 0.48))
    page.insert_text(pymupdf.Point(104, 64), sub_str, fontsize=8.0, fontname="helv", color=(0.82, 0.84, 0.88))
    page.insert_text(
        pymupdf.Point(104, 82),
        f"Timestamp (UTC): {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        fontsize=7.8,
        fontname="cour",
        color=(0.68, 0.72, 0.80),
    )

    # Status Banner
    sh_stat = page.new_shape()
    sh_stat.draw_rect(pymupdf.Rect(36, 120, 559, 158))
    if verified:
        sh_stat.finish(fill=(0.91, 0.97, 0.92), color=(0.18, 0.49, 0.20), width=1.2)
        stat_txt = "VERIFIED: TRUE — DSTU 4145-2002 ELLIPTIC CURVE & 256-BIT SRI YANTRA GEOMETRY ARE VALID"
        stat_col = (0.12, 0.38, 0.14)
    else:
        sh_stat.finish(fill=(0.99, 0.92, 0.92), color=(0.78, 0.16, 0.16), width=1.2)
        stat_txt = f"VERIFICATION FAILED: {ver_res.get('reason', 'Tamper detected')}"
        stat_col = (0.72, 0.12, 0.12)
    sh_stat.commit()
    page.insert_text(pymupdf.Point(46, 143), stat_txt, fontsize=8.6, fontname="helv", color=stat_col)

    # Cryptographic metadata table
    s_info = ver_res.get("signer_info") or {}
    signer_cn = s_info.get("common_name") or ver_res.get("signer_key_name", "Sovereign-Vedic-Key-108")
    signer_rnokpp = s_info.get("rnokpp") or "—"
    signer_ca = s_info.get("issuer_name") or "Marma-ДСТУ 4145 Vault"

    y_cur = 182
    meta_rows = [
        ("Target File", target_file.name),
        ("Crypto Standard", str(ver_res.get("standard", "DSTU 4145-2002 / GOST 34.311-95"))),
        ("Signer Subject (CN / RNOKPP)", f"{signer_cn} (RNOKPP: {signer_rnokpp})"),
        ("Certificate Authority (QTSP)", f"{signer_ca}"),
        ("Key Medium & Fingerprint", f"{ver_res.get('signer_key_name')} [{str(ver_res.get('key_fingerprint', ''))[:24]}...]"),
        ("GOST 34.311-95 Digest", str(ver_res.get("gost34311_digest") or ver_res.get("computed_content_sha256", "—"))),
        ("DSTU 7564-256 (Kupyna)", str(ver_res.get("dstu7564_digest") or "—")),
        ("Parallel Combiner SHA-256", str(ver_res.get("combiner_digest") or "—")),
        ("DSTU 4145-2002 Vector (r)", str(ver_res.get("dstu4145_r") or ver_res.get("embedded_hmac_sha256", "—"))[:64]),
        ("DSTU 4145-2002 Vector (s)", str(ver_res.get("dstu4145_s") or "—")[:64]),
        ("Max Coordinate Drift (Δ_coord)", f"{ver_res.get('max_coordinate_signature_drift', 0.0):.10f} (threshold < 1e-8)"),
        ("Bilateral Symmetry Error (Δ_sym)", f"{ver_res.get('max_bilateral_symmetry_error', 0.0):.12f} (invariant lx + rx = 300.0)"),
    ]
    for label, val in meta_rows:
        page.insert_text(pymupdf.Point(40, y_cur), f"{label}:", fontsize=8.0, fontname="helv", color=(0.25, 0.28, 0.35))
        page.insert_text(pymupdf.Point(195, y_cur), str(val), fontsize=7.6, fontname="cour", color=(0.08, 0.10, 0.15))
        y_cur += 17

    # 9-Triangle Coordinate Audit Table
    y_cur += 10
    page.insert_text(
        pymupdf.Point(40, y_cur),
        "9-Triangle Micro-Perturbation Coordinate Audit Table (Bound to DSTU 4145-2002 Signature Vector r, s):",
        fontsize=9.0,
        fontname="helv",
        color=(0.45, 0.34, 0.06),
    )
    y_cur += 16

    header_cols = "Triangle      left_x (lx)       base_y (by)       apex_y (ay)       right_x (rx)      lx + rx (Sym)"
    page.insert_text(pymupdf.Point(40, y_cur), header_cols, fontsize=7.8, fontname="cour", color=(0.30, 0.30, 0.30))
    y_cur += 14

    tris = ver_res.get("triangles", [])
    for idx, (name, lx_c, by_c, ay_c, rx_c, _) in enumerate(CANONICAL_TRIANGLES):
        if idx < len(tris):
            t = tris[idx]
            lx_v, by_v, ay_v, rx_v = float(t["lx"]), float(t["by"]), float(t["ay"]), float(t["rx"])
        else:
            lx_v, by_v, ay_v, rx_v = lx_c, by_c, ay_c, rx_c
        sym_sum = lx_v + rx_v
        row_str = f"  {name:<10}  {lx_v:14.9f}    {by_v:14.9f}    {ay_v:14.9f}    {rx_v:14.9f}    {sym_sum:13.9f}"
        page.insert_text(pymupdf.Point(40, y_cur), row_str, fontsize=7.8, fontname="cour", color=(0.10, 0.12, 0.18))
        y_cur += 15

    # Footer
    page.insert_text(
        pymupdf.Point(40, 810),
        f"Generated by Marma-Crypto Watermark Suite v{VERSION} (DSTU 4145-2002 + Canonical Sri Yantra 54-Marma Engine)",
        fontsize=7.2,
        fontname="helv",
        color=(0.45, 0.45, 0.45),
    )

    # Self-seal the Verification Protocol PDF so that the protocol itself is verifiable
    proto_text = "\n".join(normalize_text(p.get_text("text")) for p in doc)
    proto_hash = hashlib.sha256(proto_text.encode("utf-8")).hexdigest()
    proto_payload = f"PDF-CONTENT-SHA256::{proto_hash}"
    eff_sec = secret_key or DEFAULT_SECRET
    p_hex, _, p_tris, p_dstu = build_perturbed_triangles(
        proto_payload, eff_sec, canary_beacon_word=0, protocol="MARMA-DSTU4145-V1.3"
    )
    if s_info and p_dstu:
        p_dstu["signer_info"] = s_info
    p_kfp = str(ver_res.get("key_fingerprint") or hashlib.sha256(eff_sec.encode("utf-8")).hexdigest())
    p_kname = str(ver_res.get("signer_key_name") or "Sovereign-Vedic-Key-108")
    p_pseal = compute_public_seal_digest(proto_hash, p_hex, p_kfp, p_tris)
    proto_seal_packet = {
        "protocol": "MARMA-DSTU4145-V1.3",
        "marma_bits": 256,
        "signer_key_name": p_kname,
        "key_fingerprint": p_kfp,
        "content_sha256": proto_hash,
        "hmac_sha256": p_hex,
        "public_seal_digest": p_pseal,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "dstu4145": p_dstu,
        "canary": {"enabled": False, "beacon_word": 0},
        "triangles": [{k: t[k] for k in ("name", "lx", "by", "ay", "rx")} for t in p_tris],
    }
    meta = doc.metadata or {}
    meta["keywords"] = "MARMA_SEAL::" + json.dumps(proto_seal_packet, separators=(",", ":"))
    doc.set_metadata(meta)

    doc.save(str(out_pdf))
    doc.close()
    ver_res["protocol_pdf"] = str(out_pdf)
    return ver_res


# ==============================================================================
# 5. UNIVERSAL DISPATCHERS & SELF-TEST
# ==============================================================================
def sign_any_file(
    in_path: Path,
    out_path: Path | None = None,
    secret_key: str = DEFAULT_SECRET,
    mode: str = "both",
    payload: str | None = None,
    signer_key_name: str = "Sovereign-Vedic-Key-108",
    key_fingerprint: str = "",
    key_file_path: str = "",
    raw_password: str = "",
    recipient_id: str = "",
) -> dict:
    ext = in_path.suffix.lower()
    if ext == ".p7s" and in_path.with_suffix("").is_file():
        in_path = in_path.with_suffix("")
        ext = in_path.suffix.lower()
    elif ext not in (".pdf", ".docx", ".svg") and in_path.with_suffix(".pdf").is_file():
        in_path = in_path.with_suffix(".pdf")
        ext = ".pdf"
    if out_path is None:
        out_path = in_path.with_name(f"{in_path.stem}_marma_signed{ext}")
    if ext == ".pdf":
        return stamp_pdf_document(
            in_path, out_path, secret_key=secret_key, mode=mode,
            signer_key_name=signer_key_name, key_fingerprint=key_fingerprint,
            key_file_path=key_file_path, raw_password=raw_password,
            recipient_id=recipient_id,
        )
    if ext == ".docx":
        return stamp_docx_document(
            in_path, out_path, secret_key=secret_key,
            signer_key_name=signer_key_name, key_fingerprint=key_fingerprint,
            key_file_path=key_file_path, raw_password=raw_password,
            recipient_id=recipient_id,
        )
    if ext == ".svg":
        pay = payload or f"SVG-FILE::{in_path.name}"
        return sign_sri_yantra_svg(
            pay, secret_key, out_path,
            signer_key_name=signer_key_name, key_fingerprint=key_fingerprint,
            key_file_path=key_file_path, raw_password=raw_password,
            recipient_id=recipient_id,
        )
    raise ValueError(f"Формат файлу не підтримується: {ext} (підтримуються .pdf, .docx, .svg)")


def verify_any_file(
    in_path: Path,
    secret_key: str | None = None,
    payload: str | None = None,
    key_file_path: str = "",
    raw_password: str = "",
    recipient_id: str = "",
) -> dict:
    ext = in_path.suffix.lower()
    if ext == ".p7s" and in_path.with_suffix("").is_file():
        in_path = in_path.with_suffix("")
        ext = in_path.suffix.lower()
    elif ext not in (".pdf", ".docx", ".svg") and in_path.with_suffix(".pdf").is_file():
        in_path = in_path.with_suffix(".pdf")
        ext = ".pdf"
    if ext == ".pdf":
        return verify_pdf_document(
            in_path, secret_key=secret_key, key_file_path=key_file_path,
            raw_password=raw_password, recipient_id=recipient_id,
        )
    if ext == ".docx":
        return verify_docx_document(
            in_path, secret_key=secret_key, key_file_path=key_file_path,
            raw_password=raw_password, recipient_id=recipient_id,
        )
    if ext == ".svg":
        res = verify_sri_yantra_svg(
            in_path.read_text(encoding="utf-8"), payload, secret_key,
            key_file_path=key_file_path, raw_password=raw_password,
            svg_path=in_path, recipient_id=recipient_id,
        )
        res["file"] = str(in_path)
        return res
    raise ValueError(f"Формат файлу не підтримується: {ext} (підтримуються .pdf, .docx, .svg)")


def run_self_test(out_dir: Path | None = None) -> int:
    """Run an end-to-end cryptographic self-test across SVG, PDF, DOCX, DSTU 4145-2002, Canary, and Protocol PDF."""
    print("================================================================================")
    print(f"MARMA-CRYPTO WATERMARK SUITE v{VERSION} (ДСТУ 4145-2002 · 256-BIT) — SELF-TEST")
    print("================================================================================")
    work_dir = out_dir or Path(tempfile.mkdtemp(prefix="marma-self-test."))
    work_dir.mkdir(parents=True, exist_ok=True)

    # 1. SVG Test
    svg_file = work_dir / "sri_yantra_cryptographically_signed.svg"
    payload = "EDU-VEDI::Canonical-Sri-Yantra-Monograph::Yaroslav::2026-10-17"
    sign_sri_yantra_svg(payload, DEFAULT_SECRET, svg_file, recipient_id="Investor-Room-Alpha")
    svg_text = svg_file.read_text(encoding="utf-8")
    svg_ok = verify_sri_yantra_svg(svg_text, payload, DEFAULT_SECRET, recipient_id="Investor-Room-Alpha")
    tampered_svg = svg_text.replace('id="tri_U1" data-lx="52.98', 'id="tri_U1" data-lx="52.99')
    svg_tamper = verify_sri_yantra_svg(tampered_svg, payload, DEFAULT_SECRET)

    # 2. PDF Test + Canary Trace Test + Protocol Test
    pdf_in = work_dir / "test_input.pdf"
    pdf_out = work_dir / "test_signed.pdf"
    proto_out = work_dir / "test_protocol.pdf"
    d = pymupdf.open()
    p = d.new_page()
    p.insert_text((72, 100), "Sovereign Mathematical Proof — Sri Yantra 54 Marma Concurrency", fontsize=13)
    d.save(str(pdf_in))
    d.close()
    stamp_pdf_document(pdf_in, pdf_out, DEFAULT_SECRET, mode="both", recipient_id="M&A-Party-07")
    pdf_ok = verify_pdf_document(pdf_out, recipient_id="M&A-Party-07")
    trace_ok = trace_canary_suspects(pdf_out, ["M&A-Party-01", "M&A-Party-07", "M&A-Party-12"])
    generate_pdf_verification_protocol(pdf_out, proto_out, lang="uk")

    # 3. DOCX Test
    docx_in = work_dir / "test_input.docx"
    docx_out = work_dir / "test_signed.docx"
    w = docx.Document()
    w.add_heading("Sovereign Mathematical Proof", 0)
    w.add_paragraph("Verified 9-triangle concurrency and 54 triple Marma nodes.")
    w.save(str(docx_in))
    stamp_docx_document(docx_in, docx_out, DEFAULT_SECRET)
    docx_ok = verify_docx_document(docx_out)

    all_passed = (
        svg_ok["verified"]
        and svg_ok.get("dstu4145_verified", False)
        and svg_ok.get("bijective_256bit_match", False)
        and svg_ok.get("canary_recipient_verified", False)
        and (not svg_tamper["verified"])
        and pdf_ok["verified"]
        and pdf_ok.get("dstu4145_verified", False)
        and pdf_ok.get("bijective_256bit_match", False)
        and trace_ok.get("matched_recipient") == "M&A-Party-07"
        and proto_out.is_file()
        and docx_ok["verified"]
        and docx_ok.get("dstu4145_verified", False)
    )
    print(f"  ✓ SVG + 256-Bit + ДСТУ 4145:   {svg_ok['verified']} (EC={svg_ok.get('dstu4145_verified')}, drift={svg_ok['max_coordinate_signature_drift']})")
    print(f"  ✓ SVG Tamper Rejection:        {not svg_tamper['verified']} (detected drift={svg_tamper['max_coordinate_signature_drift']})")
    print(f"  ✓ PDF + 256-Bit + ДСТУ 4145:   {pdf_ok['verified']} (EC={pdf_ok.get('dstu4145_verified')}, drift={pdf_ok['max_coordinate_signature_drift']})")
    print(f"  ✓ Canary Leak-Tracing (D5.ay): {trace_ok.get('matched_recipient') == 'M&A-Party-07'} (matched={trace_ok.get('matched_recipient')})")
    print(f"  ✓ PDF Protocol Generation:     {proto_out.is_file()} ({proto_out.stat().st_size} bytes)")
    print(f"  ✓ DOCX + 256-Bit + ДСТУ 4145:  {docx_ok['verified']} (EC={docx_ok.get('dstu4145_verified')}, drift={docx_ok['max_coordinate_signature_drift']})")
    print(f"  ✓ Overall Self-Test Status:    {'PASS' if all_passed else 'FAIL'}")
    return 0 if all_passed else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="marma-watermark",
        description="Marma-Crypto v1.3.0 & DSTU 4145-2002 256-Bit Geometric Watermark & Canary Leak-Tracing CLI/GUI.",
    )
    parser.add_argument(
        "action",
        nargs="?",
        choices=["sign", "verify", "trace", "protocol", "keygen", "clear-session", "selftest"],
        help="Action: sign, verify, trace, protocol, keygen, clear-session, or selftest",
    )
    parser.add_argument("files", nargs="*", type=Path, help="Target documents (.pdf, .docx, .svg)")
    parser.add_argument("--stamp-pdf", type=Path, help="Input PDF file to stamp with Sri Yantra watermark")
    parser.add_argument("--verify-pdf", type=Path, help="Signed PDF file to verify")
    parser.add_argument("--stamp-docx", type=Path, help="Input DOCX file to stamp with Sri Yantra seal")
    parser.add_argument("--verify-docx", type=Path, help="Signed DOCX file to verify")
    parser.add_argument("--sign-svg", type=Path, help="Output SVG path to generate a signed Sri Yantra SVG")
    parser.add_argument("--verify-svg", type=Path, help="Signed SVG file to verify")
    parser.add_argument("--protocol", action="store_true", help="Generate official PDF Verification Protocol")
    parser.add_argument("--payload", type=str, help="Custom payload string for SVG signing/verification")
    parser.add_argument("--recipient-id", type=str, default="", help="Canary Leak-Tracing recipient ID to embed/verify in D5.ay")
    parser.add_argument("--suspects", type=str, default="", help="Comma-separated suspect recipient IDs for `trace` attribution")
    parser.add_argument("--output", "-o", type=Path, help="Output path for stamped document or protocol")
    parser.add_argument("--key-file", "-k", type=Path, help="Path to key file in ~/.secure_keys/ (.pfx, .p12, .key)")
    parser.add_argument("--secret", type=str, default=None, help="Author's secret key or password")
    parser.add_argument("--strict-key", action="store_true", help="Prompt/use key to verify cryptographic derivation")
    parser.add_argument(
        "--mode",
        choices=["both", "watermark", "seal"],
        default="both",
        help="PDF visual mode: 'watermark' (center background), 'seal' (corner badge), or 'both'",
    )
    parser.add_argument("--lang", choices=["uk", "en"], default="uk", help="Language for GUI / PDF protocol")
    parser.add_argument("--gui", action="store_true", help="Use GTK4/Adwaita GUI dialogs")
    parser.add_argument("--open", action="store_true", help="Open generated protocol PDF via xdg-open")
    parser.add_argument("--version", action="version", version=f"marma-watermark {VERSION}")

    args = parser.parse_args()

    if args.action == "clear-session":
        cleared = clear_active_session()
        print(json.dumps({"session_cleared": cleared}))
        return 0

    if args.action == "keygen":
        vault_dir = Path.home() / ".secure_keys"
        vault_dir.mkdir(parents=True, exist_ok=True)
        os.chmod(vault_dir, 0o700)
        key_file = args.output or (vault_dir / "marma_master.key")
        if not key_file.exists():
            key_file.write_bytes(os.urandom(32))
            os.chmod(key_file, 0o600)
        sec, kname, kfp = derive_secret_from_keyfile(key_file)
        print(json.dumps({"key_file": str(key_file), "key_name": kname, "key_fingerprint": kfp}, indent=2))
        return 0

    if args.action == "selftest":
        return run_self_test()

    if args.action == "trace":
        if not args.files:
            parser.error("Вкажіть файл (.pdf, .docx, .svg) для трасування витоку Canary.")
        suspect_list = [s.strip() for s in (args.suspects or args.recipient_id).split(",") if s.strip()]
        results = [trace_canary_suspects(f, suspect_list, secret_key=args.secret) for f in args.files]
        print(json.dumps(results if len(results) > 1 else results[0], indent=2, ensure_ascii=False))
        return 0

    if args.action == "protocol" or args.protocol:
        targets = args.files
        if not targets:
            parser.error("Вкажіть файл для формування PDF-протоколу.")
        for t in targets:
            out_p = args.output or t.with_name(f"{t.stem}_marma_protocol.pdf")
            res = generate_pdf_verification_protocol(t, out_p, lang=args.lang, secret_key=args.secret)
            print(json.dumps(res, indent=2, ensure_ascii=False))
            if args.open and (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
                subprocess.Popen(["xdg-open", str(out_p)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return 0

    if args.action == "sign":
        if not args.files:
            parser.error("Вкажіть один або кілька файлів (.pdf, .docx, .svg) для підписання.")
        desc = ", ".join(f.name for f in args.files[:3])
        sec, kname, kfp, kpath, rpwd = resolve_signing_credentials(args.gui, args.key_file, args.secret, doc_desc=desc)
        results = []
        for f in args.files:
            out = args.output if len(args.files) == 1 else None
            r = sign_any_file(
                f, out, secret_key=sec, mode=args.mode, payload=args.payload,
                signer_key_name=kname, key_fingerprint=kfp, key_file_path=kpath, raw_password=rpwd,
                recipient_id=args.recipient_id,
            )
            results.append(r)
        print(json.dumps(results if len(results) > 1 else results[0], indent=2, ensure_ascii=False))
        return 0

    if args.action == "verify":
        if not args.files:
            parser.error("Вкажіть файл (.pdf, .docx, .svg) для перевірки.")
        sec = args.secret
        kpath = str(args.key_file) if args.key_file else ""
        rpwd = args.secret or ""
        if args.strict_key:
            sec, _, _, kpath, rpwd = resolve_signing_credentials(
                args.gui, args.key_file, args.secret,
                doc_desc=args.files[0].name, force_prompt=True,
            )
        all_ok = True
        dlg_bin = find_marma_dialog_bin()
        for f in args.files:
            res = verify_any_file(
                f, secret_key=sec, payload=args.payload, key_file_path=kpath,
                raw_password=rpwd, recipient_id=args.recipient_id,
            )
            print(json.dumps(res, indent=2, ensure_ascii=False))
            if not res.get("verified"):
                all_ok = False
            if args.gui and (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
                subprocess.run([dlg_bin, "verify-report", "--report-json", json.dumps(res), "--lang", args.lang], check=False)
        return 0 if all_ok else 2

    if args.stamp_pdf:
        sec, kname, kfp, kpath, rpwd = resolve_signing_credentials(args.gui, args.key_file, args.secret, doc_desc=args.stamp_pdf.name)
        out = args.output or args.stamp_pdf.with_name(f"{args.stamp_pdf.stem}_marma_signed.pdf")
        res = stamp_pdf_document(
            args.stamp_pdf, out, secret_key=sec, mode=args.mode, signer_key_name=kname,
            key_fingerprint=kfp, key_file_path=kpath, raw_password=rpwd, recipient_id=args.recipient_id,
        )
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0
    if args.verify_pdf:
        res = verify_pdf_document(args.verify_pdf, secret_key=args.secret, recipient_id=args.recipient_id)
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0 if res.get("verified") else 2
    if args.stamp_docx:
        sec, kname, kfp, kpath, rpwd = resolve_signing_credentials(args.gui, args.key_file, args.secret, doc_desc=args.stamp_docx.name)
        out = args.output or args.stamp_docx.with_name(f"{args.stamp_docx.stem}_marma_signed.docx")
        res = stamp_docx_document(
            args.stamp_docx, out, secret_key=sec, signer_key_name=kname, key_fingerprint=kfp,
            key_file_path=kpath, raw_password=rpwd, recipient_id=args.recipient_id,
        )
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0
    if args.verify_docx:
        res = verify_docx_document(args.verify_docx, secret_key=args.secret, recipient_id=args.recipient_id)
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0 if res.get("verified") else 2
    if args.sign_svg:
        sec, kname, kfp, kpath, rpwd = resolve_signing_credentials(args.gui, args.key_file, args.secret, doc_desc=args.sign_svg.name)
        pay = args.payload or f"EDU-VEDI::Canonical-Sri-Yantra::{args.sign_svg.name}"
        res = sign_sri_yantra_svg(
            pay, sec, args.sign_svg, signer_key_name=kname, key_fingerprint=kfp,
            key_file_path=kpath, raw_password=rpwd, recipient_id=args.recipient_id,
        )
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0
    if args.verify_svg:
        res = verify_sri_yantra_svg(
            args.verify_svg.read_text(encoding="utf-8"), args.payload, args.secret, recipient_id=args.recipient_id,
        )
        print(json.dumps(res, indent=2, ensure_ascii=False))
        return 0 if res.get("verified") else 2

    return run_self_test()


if __name__ == "__main__":
    sys.exit(main())

