#!/usr/bin/env python3
"""
Marma-Universal (v2.1): Generalized Sub-Micron Keyed Dithered QIM Modulator
===========================================================================
Extends the 266-bit bijective vector commitment & constant-rate traitor-tracing
modulator (s_0 = 18 npt, d_K in Z_1024^27, pi_K in S_27) beyond the 9 triangles
of Sri Yantra (C_{9,54}) to ANY 2D vector emblem or CAD/SVG drawing with >= 27 DOFs:

1. `sri-yantra`       : Canonical 9-triangle Sri Yantra (C_{9,54}, 27 symmetric DOFs).
2. `tryzub`           : Ukrainian State Trident (Малий Державний Герб України — Тризуб),
                        modeled as 9 bilaterally symmetric heraldic contours (x_L + x_R = 2*cx,
                        27 symmetric DOFs).
3. `corporate-shield` : B2B / LegalTech / Banking Heraldic Shield (9 symmetric chevrons/facets,
                        27 symmetric DOFs).
4. `cad-polygon`      : Arbitrary 2D CAD / SVG / GIS polygon or polyline with >= 14 vertices
                        (>= 27 scalar coordinate channels).
"""

from __future__ import annotations

import hashlib
import hmac
import html
import json
import re
from pathlib import Path
from typing import Any

from marma_watermark import (
    CANONICAL_TRIANGLES,
    DEFAULT_SECRET,
    compute_canary_tag,
    delta_to_word10,
    derive_keyed_qim_schedule,
    derive_micro_offsets,
    split_256bits_to_26_words,
    word10_to_delta,
    words_26_to_256bit_hex,
)

SUPPORTED_EMBLEMS = ("sri-yantra", "tryzub", "corporate-shield", "cad-polygon")

# ==============================================================================
# 1. CANONICAL BILATERALLY SYMMETRIC HERALDIC CONTOURS (9 x 3 = 27 DOFs)
# ==============================================================================
# Format: (name, lx, by, ay, rx, is_up) on [0, 300]^2 with lx + rx == 300.0
CANONICAL_TRYZUB_CONTOURS: list[tuple[str, float, float, float, float, bool]] = [
    # 1. Central Sword-Spire (Меч-Спис по осі симетрії)
    ("T1_Spire",     138.000000000, 195.000000000,  42.000000000, 162.000000000, True),
    # 2. Outer Trident Prongs (Зовнішні бокові зуби Тризуба)
    ("T2_OuterProng", 66.000000000, 210.000000000,  58.000000000, 234.000000000, True),
    # 3. Inner Trident Volutes (Внутрішні дуги-волюти)
    ("T3_InnerArch",  88.000000000,  96.000000000, 188.000000000, 212.000000000, False),
    # 4. Upper Falcon Crown (Верхнє перехрестя меча)
    ("T4_Crown",     116.000000000,  92.000000000,  64.000000000, 184.000000000, True),
    # 5. Middle Crossbar (Середня перекладина Тризуба)
    ("T5_Crossbar",   78.000000000, 152.000000000, 174.000000000, 222.000000000, False),
    # 6. Lower VoluteLoops (Нижні симетричні петлі основи)
    ("T6_BaseLoop",   96.000000000, 224.000000000, 182.000000000, 204.000000000, True),
    # 7. Heraldic Base Wedge (Клиноподібна основа Тризуба)
    ("T7_BaseWedge", 122.000000000, 218.000000000, 262.000000000, 178.000000000, False),
    # 8. Outer Heraldic Shield Border (Геральдичний щит-обрамлення)
    ("T8_ShieldTop",  54.000000000,  46.000000000, 248.000000000, 246.000000000, False),
    # 9. Sovereign Inner Seal Frame (Внутрішній контур державної печатки)
    ("T9_SealCore",  106.000000000, 128.000000000, 236.000000000, 194.000000000, False),
]

CANONICAL_CORPORATE_SHIELD_CONTOURS: list[tuple[str, float, float, float, float, bool]] = [
    ("S1_OuterCrest",  56.000000000,  54.000000000, 256.000000000, 244.000000000, False),
    ("S2_InnerCrest",  68.000000000,  66.000000000, 242.000000000, 232.000000000, False),
    ("S3_ChevronTop",  82.000000000, 118.000000000,  68.000000000, 218.000000000, True),
    ("S4_ChevronMid",  90.000000000, 156.000000000, 102.000000000, 210.000000000, True),
    ("S5_ChevronLow",  98.000000000, 194.000000000, 138.000000000, 202.000000000, True),
    ("S6_PillarWing",  74.000000000,  88.000000000, 208.000000000, 226.000000000, False),
    ("S7_ScalesBeam",  86.000000000, 132.000000000, 168.000000000, 214.000000000, False),
    ("S8_DiamondUp",  118.000000000, 150.000000000,  94.000000000, 182.000000000, True),
    ("S9_DiamondDn",  118.000000000, 150.000000000, 206.000000000, 182.000000000, False),
]

CANONICAL_CAD_POLYGON_CONTOURS: list[tuple[str, float, float, float, float, bool]] = [
    ("C1_FlangeOuter", 50.000000000,  50.000000000, 250.000000000, 250.000000000, True),
    ("C2_FlangeInner", 72.000000000, 232.000000000,  68.000000000, 228.000000000, False),
    ("C3_StatorRibA",  84.000000000,  84.000000000, 216.000000000, 216.000000000, True),
    ("C4_StatorRibB",  96.000000000, 204.000000000,  96.000000000, 204.000000000, False),
    ("C5_RotorMount", 108.000000000, 108.000000000, 192.000000000, 192.000000000, True),
    ("C6_BearingCap", 120.000000000, 180.000000000, 120.000000000, 180.000000000, False),
    ("C7_CrossStrut",  62.000000000, 150.000000000,  58.000000000, 238.000000000, True),
    ("C8_BaseGusset",  62.000000000, 150.000000000, 242.000000000, 238.000000000, False),
    ("C9_DatumCore",  132.000000000, 164.000000000, 136.000000000, 168.000000000, True),
]


def get_canonical_emblem_contours(emblem_type: str = "sri-yantra") -> list[tuple[str, float, float, float, float, bool]]:
    """Return the canonical 9 bilaterally symmetric contours (27 DOFs) for the requested emblem."""
    norm = (emblem_type or "sri-yantra").strip().lower()
    if norm == "tryzub":
        return list(CANONICAL_TRYZUB_CONTOURS)
    if norm == "corporate-shield":
        return list(CANONICAL_CORPORATE_SHIELD_CONTOURS)
    if norm == "cad-polygon":
        return list(CANONICAL_CAD_POLYGON_CONTOURS)
    if norm == "sri-yantra":
        return list(CANONICAL_TRIANGLES)
    raise ValueError(f"Unknown emblem_type '{emblem_type}'. Supported: {SUPPORTED_EMBLEMS}")


# ==============================================================================
# 2. BILATERALLY SYMMETRIC 27-DOF EMBLEM MODULATION & RECOVERY
# ==============================================================================
def build_perturbed_emblem_v21(
    hex_sig: str,
    emblem_type: str = "sri-yantra",
    canary_beacon_word: int = 0,
    cx: float = 150.0,
    qim_key: str = "",
    doc_nonce: str = "",
) -> list[dict[str, Any]]:
    """Encode 256-bit hex_sig + 10-bit canary_beacon_word into any 9-contour symmetric emblem."""
    base_contours = get_canonical_emblem_contours(emblem_type)
    scale = 2.0 if cx == 300.0 else 1.0
    words_26 = split_256bits_to_26_words(hex_sig)
    logical_words = list(words_26) + [int(canary_beacon_word) & 0x3FF]

    if qim_key:
        perm, dither = derive_keyed_qim_schedule(qim_key, doc_nonce)
        physical_deltas = [0.0] * 27
        for k in range(27):
            dithered_w = (logical_words[k] + dither[k]) & 0x3FF
            physical_deltas[perm[k]] = word10_to_delta(dithered_w)
    else:
        physical_deltas = [word10_to_delta(w) for w in words_26]
        physical_deltas.append(
            word10_to_delta(canary_beacon_word) if int(canary_beacon_word) > 0 else 0.0
        )

    perturbed: list[dict[str, Any]] = []
    for idx, (name, lx, by, ay, rx, is_up) in enumerate(base_contours):
        d_lx = physical_deltas[idx * 3]
        d_by = physical_deltas[idx * 3 + 1]
        d_ay = physical_deltas[idx * 3 + 2]

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


def recover_256bit_from_emblem_v21(
    contours: list[dict[str, Any]],
    emblem_type: str = "sri-yantra",
    cx: float = 150.0,
    qim_key: str = "",
    doc_nonce: str = "",
) -> tuple[str, int]:
    """Losslessly invert all 256 bits + 10-bit Canary beacon word from any 9-contour symmetric emblem."""
    if len(contours) != 9:
        return "", 0
    base_contours = get_canonical_emblem_contours(emblem_type)
    scale = 2.0 if cx == 300.0 else 1.0
    physical_deltas: list[float] = []
    for idx, (_, lx_can, by_can, ay_can, _, _) in enumerate(base_contours):
        c = contours[idx]
        d_lx = round(float(c["lx"]) - round(lx_can * scale, 9), 9)
        d_by = round(float(c["by"]) - round(by_can * scale, 9), 9)
        d_ay = round(float(c["ay"]) - round(ay_can * scale, 9), 9)
        physical_deltas.extend([d_lx, d_by, d_ay])

    if qim_key:
        perm, dither = derive_keyed_qim_schedule(qim_key, doc_nonce)
        logical_words: list[int] = [0] * 27
        for k in range(27):
            w_phys = delta_to_word10(physical_deltas[perm[k]])
            logical_words[k] = (w_phys - dither[k]) & 0x3FF
        return words_26_to_256bit_hex(logical_words[:26]), logical_words[26]

    words = [delta_to_word10(d) for d in physical_deltas[:26]]
    d_ay_last = physical_deltas[26]
    canary_word = 0 if abs(d_ay_last) < 1e-11 else delta_to_word10(d_ay_last)
    return words_26_to_256bit_hex(words), canary_word


def verify_emblem_coordinates_v21(
    embedded_contours: list[dict[str, Any]],
    emblem_type: str = "sri-yantra",
    cx: float = 150.0,
    expected_hex: str = "",
    canary_beacon_word: int = 0,
    qim_key: str = "",
    doc_nonce: str = "",
) -> tuple[float, float]:
    """Verify all 36 coordinates and bilateral symmetry (lx + rx == 2*cx) for any 9-contour emblem."""
    if len(embedded_contours) != 9 or len(expected_hex) != 64:
        return 1.0, 1.0
    exp_contours = build_perturbed_emblem_v21(
        expected_hex,
        emblem_type=emblem_type,
        canary_beacon_word=canary_beacon_word,
        cx=cx,
        qim_key=qim_key,
        doc_nonce=doc_nonce,
    )
    max_coord_drift = 0.0
    max_sym_err = 0.0
    for idx in range(9):
        t = embedded_contours[idx]
        exp = exp_contours[idx]
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


# ==============================================================================
# 3. ARBITRARY 2D POLYGON / CAD / SVG / GIS VECTOR CONTOUR ADAPTER (>= 27 DOFs)
# ==============================================================================
def modulate_arbitrary_2d_vertices(
    canonical_vertices: list[tuple[float, float]],
    hex_sig: str,
    canary_beacon_word: int = 0,
    qim_key: str = "",
    doc_nonce: str = "",
) -> list[tuple[float, float]]:
    """
    Embed 266 bits (256-bit signature + 10-bit canary_beacon_word) into the first 27
    scalar coordinates of ANY arbitrary 2D vertex list [(x_0, y_0), ..., (x_{M-1}, y_{M-1})]
    where 2 * M >= 27 (i.e. M >= 14 vertices).
    Preserves all remaining coordinates untouched.
    """
    if len(canonical_vertices) * 2 < 27:
        raise ValueError(
            f"CAD/SVG contour requires at least 14 2D vertices (>= 27 scalar coordinates), got {len(canonical_vertices)}"
        )
    words_26 = split_256bits_to_26_words(hex_sig)
    logical_words = list(words_26) + [int(canary_beacon_word) & 0x3FF]

    if qim_key:
        perm, dither = derive_keyed_qim_schedule(qim_key, doc_nonce)
        physical_deltas = [0.0] * 27
        for k in range(27):
            dithered_w = (logical_words[k] + dither[k]) & 0x3FF
            physical_deltas[perm[k]] = word10_to_delta(dithered_w)
    else:
        physical_deltas = [word10_to_delta(w) for w in words_26]
        physical_deltas.append(
            word10_to_delta(canary_beacon_word) if int(canary_beacon_word) > 0 else 0.0
        )

    flat_coords: list[float] = []
    for x, y in canonical_vertices:
        flat_coords.append(round(float(x), 9))
        flat_coords.append(round(float(y), 9))

    for ch in range(27):
        flat_coords[ch] = round(flat_coords[ch] + physical_deltas[ch], 9)

    modulated: list[tuple[float, float]] = []
    for i in range(0, len(flat_coords), 2):
        modulated.append((flat_coords[i], flat_coords[i + 1]))
    return modulated


def demodulate_arbitrary_2d_vertices(
    modulated_vertices: list[tuple[float, float]],
    canonical_vertices: list[tuple[float, float]],
    qim_key: str = "",
    doc_nonce: str = "",
) -> tuple[str, int, float]:
    """
    Losslessly recover (hex_sig_256, canary_beacon_word_10bit, max_quantization_residual)
    by comparing a modulated 2D CAD/SVG vertex sequence against its canonical reference.
    """
    if len(modulated_vertices) * 2 < 27 or len(canonical_vertices) * 2 < 27:
        return "", 0, 1.0

    mod_flat: list[float] = []
    for x, y in modulated_vertices:
        mod_flat.extend([float(x), float(y)])

    can_flat: list[float] = []
    for x, y in canonical_vertices:
        can_flat.extend([round(float(x), 9), round(float(y), 9)])

    physical_deltas: list[float] = []
    max_residual = 0.0
    for ch in range(27):
        d = round(mod_flat[ch] - can_flat[ch], 9)
        physical_deltas.append(d)
        w_rec = delta_to_word10(d)
        d_reconstructed = word10_to_delta(w_rec) if (w_rec > 0 or abs(d) > 1e-11) else 0.0
        res = abs(d - d_reconstructed)
        if res > max_residual:
            max_residual = res

    if qim_key:
        perm, dither = derive_keyed_qim_schedule(qim_key, doc_nonce)
        logical_words: list[int] = [0] * 27
        for k in range(27):
            w_phys = delta_to_word10(physical_deltas[perm[k]])
            logical_words[k] = (w_phys - dither[k]) & 0x3FF
        return words_26_to_256bit_hex(logical_words[:26]), logical_words[26], max_residual

    words = [delta_to_word10(d) for d in physical_deltas[:26]]
    d_last = physical_deltas[26]
    canary_word = 0 if abs(d_last) < 1e-11 else delta_to_word10(d_last)
    return words_26_to_256bit_hex(words), canary_word, max_residual


# ==============================================================================
# 4. UNIVERSAL SVG / CAD DRAWING WATERMARKING (EXISTING OR GENERATED SVG)
# ==============================================================================
def stamp_universal_svg_drawing(
    in_svg: Path,
    out_svg: Path,
    secret_key: str = DEFAULT_SECRET,
    emblem_type: str = "tryzub",
    recipient_id: str = "",
    signer_key_name: str = "Sovereign-Vedic-Key-108",
) -> dict[str, Any]:
    """
    Embed a 266-bit Marma-Universal watermark into ANY existing SVG/CAD vector file
    (or generate a new sovereign emblem SVG if `in_svg` does not exist).
    """
    key_fingerprint = hashlib.sha256(secret_key.encode("utf-8")).hexdigest()
    raw_svg = in_svg.read_text(encoding="utf-8") if in_svg.is_file() else ""
    clean_svg_body = re.sub(r"\s*<g id=\"marma_universal_seal\"[\s\S]*?</g>\s*", "", raw_svg)
    payload = f"UNIVERSAL-SVG::{emblem_type}::{hashlib.sha256(clean_svg_body.encode('utf-8')).hexdigest()}"
    content_sha256 = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    canary_info = compute_canary_tag(secret_key, content_sha256, recipient_id, key_fingerprint)
    beacon_word = int(canary_info.get("beacon_word", 0))
    hex_sig, _, dstu_bundle = derive_micro_offsets(payload, secret_key)

    perturbed = build_perturbed_emblem_v21(
        hex_sig,
        emblem_type=emblem_type,
        canary_beacon_word=beacon_word,
        cx=150.0,
        qim_key=secret_key,
        doc_nonce=content_sha256,
    )

    poly_lines = []
    for c in perturbed:
        poly_lines.append(
            f'    <polygon id="emb_{c["name"]}" data-lx="{c["lx"]:.9f}" data-by="{c["by"]:.9f}" '
            f'data-ay="{c["ay"]:.9f}" data-rx="{c["rx"]:.9f}" '
            f'points="{c["lx"]:.9f},{c["by"]:.9f} 150.000000000,{c["ay"]:.9f} {c["rx"]:.9f},{c["by"]:.9f}" '
            f'fill="none" stroke="#f0d078" stroke-width="0.85" />'
        )

    seal_group = (
        f'  <g id="marma_universal_seal" data-protocol="MARMA-UNIVERSAL-V2.1" '
        f'data-emblem="{html.escape(emblem_type, quote=True)}" '
        f'data-content-sha256="{content_sha256}" '
        f'data-hmac-sha256="{hex_sig}" '
        f'data-key-fp="{key_fingerprint}" '
        f'data-signer="{html.escape(signer_key_name, quote=True)}" '
        f'data-canary-word="{beacon_word}" '
        f'data-canary-pub="{canary_info.get("public_canary_hash", "")}">\n'
        + "\n".join(poly_lines)
        + "\n  </g>\n"
    )

    if "</svg>" in clean_svg_body:
        out_text = clean_svg_body.replace("</svg>", seal_group + "</svg>", 1)
    else:
        out_text = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="1200" height="1200">\n'
            '  <rect width="300" height="300" fill="#060913" />\n'
            '  <circle cx="150" cy="150" r="108" fill="none" stroke="#e6bd53" stroke-width="0.9" />\n'
            + seal_group
            + "</svg>\n"
        )
    out_svg.write_text(out_text, encoding="utf-8")
    return {
        "verified": True,
        "protocol": "MARMA-UNIVERSAL-V2.1",
        "emblem_type": emblem_type,
        "output_file": str(out_svg),
        "content_sha256": content_sha256,
        "hmac_sha256": hex_sig,
        "canary_beacon_word": beacon_word,
        "recipient_id": recipient_id,
        "contours": perturbed,
        "dstu4145": dstu_bundle,
    }


def verify_universal_svg_drawing(
    svg_path: Path,
    secret_key: str = DEFAULT_SECRET,
    recipient_id: str = "",
) -> dict[str, Any]:
    """Verify a Marma-Universal watermarked SVG/CAD drawing and recover the 256-bit digest + Canary word."""
    raw_svg = svg_path.read_text(encoding="utf-8")
    m_grp = re.search(r'<g id="marma_universal_seal"([^>]*)>([\s\S]*?)</g>', raw_svg)
    if not m_grp:
        return {"verified": False, "reason": "No marma_universal_seal group found in SVG"}

    attrs = m_grp.group(1)
    inner = m_grp.group(2)

    def _attr(name: str, default: str = "") -> str:
        m = re.search(rf'{name}="([^"]*)"', attrs)
        return m.group(1) if m else default

    emblem_type = _attr("data-emblem", "tryzub")
    embedded_csha = _attr("data-content-sha256")
    embedded_hmac = _attr("data-hmac-sha256")
    key_fp = _attr("data-key-fp")
    embedded_canary = int(_attr("data-canary-word", "0") or 0)

    contours: list[dict[str, Any]] = []
    for m_poly in re.finditer(
        r'<polygon id="emb_([^"]+)"\s+data-lx="([^"]+)"\s+data-by="([^"]+)"\s+data-ay="([^"]+)"\s+data-rx="([^"]+)"',
        inner,
    ):
        contours.append(
            {
                "name": m_poly.group(1),
                "lx": float(m_poly.group(2)),
                "by": float(m_poly.group(3)),
                "ay": float(m_poly.group(4)),
                "rx": float(m_poly.group(5)),
            }
        )

    rec_hex, rec_canary = recover_256bit_from_emblem_v21(
        contours,
        emblem_type=emblem_type,
        cx=150.0,
        qim_key=secret_key,
        doc_nonce=embedded_csha,
    )
    max_drift, max_sym = verify_emblem_coordinates_v21(
        contours,
        emblem_type=emblem_type,
        cx=150.0,
        expected_hex=embedded_hmac,
        canary_beacon_word=embedded_canary,
        qim_key=secret_key,
        doc_nonce=embedded_csha,
    )
    verified = (
        len(contours) == 9
        and rec_hex == embedded_hmac
        and rec_canary == embedded_canary
        and max_drift < 1e-8
        and max_sym < 1e-8
    )
    canary_match = None
    if recipient_id:
        cand = compute_canary_tag(secret_key, embedded_csha, recipient_id, key_fp)
        canary_match = bool(rec_canary > 0 and rec_canary == cand["beacon_word"])

    return {
        "verified": verified,
        "protocol": "MARMA-UNIVERSAL-V2.1",
        "emblem_type": emblem_type,
        "file": str(svg_path),
        "recovered_256bit_digest": rec_hex,
        "embedded_hmac_sha256": embedded_hmac,
        "canary_beacon_word": rec_canary,
        "canary_recipient_verified": canary_match,
        "max_coordinate_signature_drift": round(max_drift, 10),
        "max_bilateral_symmetry_error": round(max_sym, 12),
    }
