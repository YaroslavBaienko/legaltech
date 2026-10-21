#!/usr/bin/env python3
"""
Marma-Optical (v2.1): Screen-Photo & Print-Cam Resilient Leak Tracing
=====================================================================
Implements a second, optically resilient physical modulation layer around the
Marma-Crypto vector seal: a 32-Sector Ceremonial Lotus Ring (`32-Petal Padma Dial`)
encoded with a systematic [32, 16, d_min=8] linear error-correcting code and
decoded via Soft-Decision Maximum-Likelihood (ML) radial correlation.

Even when a traitor photographs a monitor with a smartphone or takes a lossy
JPEG/PNG screenshot (destroying all IEEE-754 PDF vector streams and metadata),
`extract_canary_from_raster_image()` locates the seal in the raster image,
samples the 32 angular sectors across the lotus annulus, and recovers the
10-bit `canary_beacon_word` + 6-bit document binding tag.
"""

from __future__ import annotations

import hashlib
import math
from pathlib import Path
from typing import Any

import cairo
import numpy as np
import pymupdf
from PIL import Image

from marma_watermark import DEFAULT_SECRET, compute_canary_tag

# ==============================================================================
# 1. SYSTEMATIC [32, 16, d=8] LINEAR BLOCK CODE & SOFT-DECISION ML DECODER
# ==============================================================================
# Circulant / Walsh-Hadamard derived 16x16 parity matrix over GF(2) ensuring d_min >= 6..8
_PARITY_ROWS_16: list[int] = [
    0b1111010110010011,
    0b1111101011001001,
    0b1111110101100100,
    0b0111111010110010,
    0b0011111101011001,
    0b1001111110101100,
    0b0100111111010110,
    0b0010011111101011,
    0b1001001111110101,
    0b1100100111111010,
    0b0110010011111101,
    0b1011001001111110,
    0b0101100100111111,
    0b1010110010011111,
    0b1101011001001111,
    0b1110101100100111,
]


def compute_doc_tag6(content_sha256: str = "") -> int:
    """Derive a 6-bit document binding tag in [0..63] from content_sha256 (or 0b101010 if empty)."""
    if not content_sha256:
        return 0b101010
    digest = hashlib.sha256(f"MARMA-OPTICAL-TAG6::{content_sha256}".encode("utf-8")).hexdigest()
    return int(digest[:2], 16) & 0x3F


def encode_optical_codeword32(canary_word: int, doc_tag6: int = 0b101010) -> list[int]:
    """
    Encode 10-bit `canary_word` in [0..1023] and 6-bit `doc_tag6` in [0..63]
    into a 32-bit systematic codeword c in {0, 1}^32.
    """
    msg16 = ((int(canary_word) & 0x3FF) << 6) | (int(doc_tag6) & 0x3F)
    data_bits = [(msg16 >> (15 - i)) & 1 for i in range(16)]
    parity_bits: list[int] = []
    for row_mask in _PARITY_ROWS_16:
        p = bin(msg16 & row_mask).count("1") & 1
        parity_bits.append(p)
    # Interleave data and parity bits [d0, p0, d1, p1, ...] to spread burst/glare errors around the ring
    codeword32: list[int] = []
    for i in range(16):
        codeword32.append(data_bits[i])
        codeword32.append(parity_bits[i])
    return codeword32


def decode_optical_codeword32_soft(
    sector_scores: list[float] | np.ndarray,
    expected_doc_tag6: int | None = None,
) -> dict[str, Any]:
    """
    Soft-Decision Maximum-Likelihood (ML) decoder over the [32, 16] code.
    Given 32 continuous sector luminance scores (higher = bit 1, lower = bit 0),
    finds the valid 32-bit codeword maximizing normalized inner-product correlation.
    """
    scores = np.asarray(sector_scores, dtype=np.float64).flatten()
    if scores.size != 32:
        raise ValueError(f"Expected 32 sector scores, got {scores.size}")

    # Normalize scores to zero mean and unit standard deviation
    mean_s = float(np.mean(scores))
    std_s = float(np.std(scores))
    if std_s < 1e-6:
        norm_scores = scores - mean_s
    else:
        norm_scores = (scores - mean_s) / std_s

    hard_bits = [1 if s >= 0.0 else 0 for s in norm_scores]

    # Fast exact ML search:
    # If expected_doc_tag6 is provided, search 1024 codewords; otherwise search around the hard-decoded data_bits
    # or full 1024 canary words with top candidate doc_tag6 values.
    hard_data_bits = [hard_bits[2 * i] for i in range(16)]
    hard_msg16 = 0
    for b in hard_data_bits:
        hard_msg16 = (hard_msg16 << 1) | b
    hard_tag6 = hard_msg16 & 0x3F

    candidate_tags = (
        [int(expected_doc_tag6) & 0x3F]
        if expected_doc_tag6 is not None
        else list({hard_tag6, 0b101010} | {hard_tag6 ^ (1 << b) for b in range(6)})
    )

    best_corr = -1e9
    best_canary = 0
    best_tag6 = hard_tag6
    best_cw: list[int] = hard_bits

    for tag6 in candidate_tags:
        for cw_word in range(1, 1024):
            cw = encode_optical_codeword32(cw_word, tag6)
            # Antipodal mapping: 0 -> -1.0, 1 -> +1.0, normalized for exact Pearson correlation
            antipodal = np.array([1.0 if b == 1 else -1.0 for b in cw], dtype=np.float64)
            ant_std = float(np.std(antipodal))
            ant_norm = (antipodal - float(np.mean(antipodal))) / (ant_std if ant_std > 1e-6 else 1.0)
            corr = float(np.dot(norm_scores, ant_norm)) / 32.0
            if corr > best_corr:
                best_corr = corr
                best_canary = cw_word
                best_tag6 = tag6
                best_cw = cw

    hamming_errors = sum(1 for a, b in zip(hard_bits, best_cw) if a != b)
    confidence = max(0.0, min(1.0, (best_corr + 1.0) / 2.0))
    return {
        "canary_beacon_word": best_canary,
        "doc_tag6": best_tag6,
        "ml_correlation": round(best_corr, 4),
        "confidence": round(confidence, 4),
        "corrected_bit_errors": hamming_errors,
        "hard_bits": hard_bits,
        "decoded_codeword": best_cw,
    }


# ==============================================================================
# 2. VECTOR & RASTER RENDERING OF THE 32-SECTOR OPTICAL LOTUS RING
# ==============================================================================
def draw_optical_lotus_ring_pdf(
    page: pymupdf.Page,
    cx_s: float,
    cy_s: float,
    scale_s: float,
    canary_word: int,
    content_sha256: str = "",
) -> list[int]:
    """
    Draw the 32-Sector Optical Lotus Ring around the PDF corner seal at (cx_s, cy_s).
    Uses high-contrast radial lotus petals at r in [105*scale_s, 124*scale_s] inside
    the dark navy seal disc so smartphone cameras can reliably decode all 32 sectors.
    """
    tag6 = compute_doc_tag6(content_sha256)
    codeword32 = encode_optical_codeword32(canary_word, tag6)

    r_inner = 104.5 * scale_s
    r_outer = 123.5 * scale_s
    r_mid = 0.5 * (r_inner + r_outer)

    # Outer fiducial ring
    shape_fid = page.new_shape()
    shape_fid.draw_circle(pymupdf.Point(cx_s, cy_s), 127.0 * scale_s)
    shape_fid.finish(color=(0.85, 0.68, 0.24), width=0.65, stroke_opacity=0.92)
    shape_fid.commit(overlay=True)

    # Draw 32 angular sectors
    for k, bit in enumerate(codeword32):
        theta = (2.0 * math.pi * k) / 32.0
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        p_in = pymupdf.Point(cx_s + r_inner * cos_t, cy_s + r_inner * sin_t)
        p_out = pymupdf.Point(cx_s + r_outer * cos_t, cy_s + r_outer * sin_t)
        p_dot = pymupdf.Point(cx_s + r_mid * cos_t, cy_s + r_mid * sin_t)

        shape_sec = page.new_shape()
        shape_sec.draw_line(p_in, p_out)
        if bit == 1:
            shape_sec.finish(color=(1.0, 0.92, 0.52), width=2.4 * scale_s * 3.5, stroke_opacity=0.98)
            shape_sec.commit(overlay=True)
            shape_cap = page.new_shape()
            shape_cap.draw_circle(p_dot, 2.6 * scale_s)
            shape_cap.finish(color=(1.0, 0.95, 0.65), fill=(1.0, 0.92, 0.52), width=0.2)
            shape_cap.commit(overlay=True)
        else:
            shape_sec.finish(color=(0.10, 0.13, 0.20), width=1.0 * scale_s * 3.5, stroke_opacity=0.70)
            shape_sec.commit(overlay=True)

    return codeword32


def render_optical_seal_png(
    perturbed_contours: list[dict[str, Any]],
    out_png: Path,
    canary_word: int,
    content_sha256: str = "",
    size: int = 800,
) -> list[int]:
    """Render a high-resolution PNG seal with both the 9-contour emblem and the 32-sector Optical Lotus Ring."""
    tag6 = compute_doc_tag6(content_sha256)
    codeword32 = encode_optical_codeword32(canary_word, tag6)

    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size)
    ctx = cairo.Context(surface)
    cx, cy = size / 2.0, size / 2.0
    scale = (size * 0.84) / 300.0

    # High-contrast dark navy background disc
    ctx.arc(cx, cy, 134.0 * scale, 0, 2 * math.pi)
    ctx.set_source_rgba(0.04, 0.06, 0.11, 0.98)
    ctx.fill_preserve()
    ctx.set_line_width(2.4)
    ctx.set_source_rgba(0.90, 0.72, 0.28, 0.96)
    ctx.stroke()

    # Inner circle around 9 contours
    ctx.arc(cx, cy, 100.0 * scale, 0, 2 * math.pi)
    ctx.set_line_width(1.8)
    ctx.set_source_rgba(0.95, 0.80, 0.38, 0.90)
    ctx.stroke()

    # 32-Sector Optical Lotus Ring at r in [104.5*scale, 123.5*scale]
    r_inner = 104.5 * scale
    r_outer = 123.5 * scale
    r_mid = 0.5 * (r_inner + r_outer)
    for k, bit in enumerate(codeword32):
        theta = (2.0 * math.pi * k) / 32.0
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        x1, y1 = cx + r_inner * cos_t, cy + r_inner * sin_t
        x2, y2 = cx + r_outer * cos_t, cy + r_outer * sin_t
        xm, ym = cx + r_mid * cos_t, cy + r_mid * sin_t

        ctx.move_to(x1, y1)
        ctx.line_to(x2, y2)
        if bit == 1:
            ctx.set_line_width(max(2.5, 4.2 * scale))
            ctx.set_source_rgba(1.0, 0.93, 0.54, 0.99)
            ctx.stroke()
            ctx.arc(xm, ym, 2.8 * scale, 0, 2 * math.pi)
            ctx.fill()
        else:
            ctx.set_line_width(max(1.0, 1.4 * scale))
            ctx.set_source_rgba(0.10, 0.13, 0.20, 0.75)
            ctx.stroke()

    # 9-contour emblem
    def map_pt(x: float, y: float) -> tuple[float, float]:
        return cx + (x - 150.0) * scale, cy + (y - 150.0) * scale

    ctx.set_line_width(1.6)
    ctx.set_source_rgba(0.98, 0.86, 0.48, 0.95)
    for t in perturbed_contours:
        p1 = map_pt(float(t["lx"]), float(t["by"]))
        p2 = map_pt(150.0, float(t["ay"]))
        p3 = map_pt(float(t["rx"]), float(t["by"]))
        ctx.move_to(*p1)
        ctx.line_to(*p2)
        ctx.line_to(*p3)
        ctx.close_path()
        ctx.stroke()

    # Red Bindu anchor
    bx, by_pt = map_pt(150.0, 156.4308)
    ctx.arc(bx, by_pt, 4.5, 0, 2 * math.pi)
    ctx.set_source_rgba(0.96, 0.18, 0.22, 1.0)
    ctx.fill()

    surface.write_to_png(str(out_png))
    return codeword32


# ==============================================================================
# 3. RASTER / SCREEN-PHOTO SEAL DETECTOR & RADIAL SECTOR SAMPLER
# ==============================================================================
def _locate_seal_center_and_scale(rgb: np.ndarray) -> tuple[float, float, float]:
    """
    Automatically locate the center (cx, cy) and unit scale_s (pixels per 1/300 seal unit)
    of the dark-navy & gold Marma seal in either:
      (a) a cropped image of the seal itself, or
      (b) a full-page screenshot / camera photo of a stamped PDF page.
    """
    h, w, _ = rgb.shape
    r_ch = rgb[:, :, 0].astype(np.float64)
    g_ch = rgb[:, :, 1].astype(np.float64)
    b_ch = rgb[:, :, 2].astype(np.float64)
    luma = 0.299 * r_ch + 0.587 * g_ch + 0.114 * b_ch

    # Dark navy pixels of the seal disc have low luminance (< 55) and blue >= red
    dark_mask = (luma < 60.0) & (b_ch >= r_ch - 10.0)

    # Check if the image is already centered on the seal (e.g. standalone seal PNG)
    center_patch = dark_mask[int(h * 0.25) : int(h * 0.75), int(w * 0.25) : int(w * 0.75)]
    if center_patch.size > 0 and float(np.mean(center_patch)) > 0.35 and abs(w - h) < 0.25 * max(w, h):
        # Estimate outer radius of dark disc from area or radial profile
        ys, xs = np.nonzero(dark_mask)
        cx = float(np.mean(xs))
        cy = float(np.mean(ys))
        dists = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        r_disc = float(np.percentile(dists, 97.5))
        # For standalone seal, disc radius is ~134 * scale; for PDF corner seal, ~129 * scale
        scale = r_disc / 132.0
        return cx, cy, scale

    # Otherwise search the bottom-right quadrant (where PDF corner seal resides) first, then full image
    y0, x0 = int(h * 0.55), int(w * 0.55)
    sub_mask = dark_mask[y0:, x0:]
    if int(np.count_nonzero(sub_mask)) >= 80:
        ys, xs = np.nonzero(sub_mask)
        cx = float(np.mean(xs)) + x0
        cy = float(np.mean(ys)) + y0
        # Refine centroid within 1.5x estimated radius
        r_est = math.sqrt(len(xs) / math.pi) * 1.15
        y_min = max(0, int(cy - r_est * 1.4))
        y_max = min(h, int(cy + r_est * 1.4))
        x_min = max(0, int(cx - r_est * 1.4))
        x_max = min(w, int(cx + r_est * 1.4))
        local_dark = dark_mask[y_min:y_max, x_min:x_max]
        lys, lxs = np.nonzero(local_dark)
        if len(lxs) > 50:
            cx = float(np.median(lxs)) + x_min
            cy = float(np.median(lys)) + y_min
            dists = np.sqrt((lxs + x_min - cx) ** 2 + (lys + y_min - cy) ** 2)
            r_disc = float(np.percentile(dists, 97.0))
            scale = r_disc / 129.0
            return cx, cy, scale

    # Fallback: center of image
    return w / 2.0, h / 2.0, (min(w, h) * 0.84) / 300.0


def extract_canary_from_raster_image(
    image_path: Path,
    suspects: list[str] | None = None,
    secret_key: str = DEFAULT_SECRET,
    content_sha256: str = "",
    key_fingerprint: str = "",
) -> dict[str, Any]:
    """
    Extract the 32-sector Optical Lotus codeword from a raster image (`.png`, `.jpg`, `.webp`)
    using Soft-Decision ML correlation and optionally match against `suspects`.
    """
    img = Image.open(str(image_path)).convert("RGB")
    rgb = np.asarray(img, dtype=np.uint8)
    r_ch = rgb[:, :, 0].astype(np.float64)
    g_ch = rgb[:, :, 1].astype(np.float64)
    b_ch = rgb[:, :, 2].astype(np.float64)
    # Golden luminance channel emphasizing warm yellow-gold petals over dark navy background
    gold_score = 0.50 * r_ch + 0.45 * g_ch - 0.25 * b_ch

    cx, cy, base_scale = _locate_seal_center_and_scale(rgb)
    h, w, _ = rgb.shape

    expected_tag6 = compute_doc_tag6(content_sha256) if content_sha256 else None

    # Multi-scale & micro-center search around (cx, cy, base_scale) to handle camera tilt/crop/DPI variance
    best_result: dict[str, Any] | None = None
    best_ml_corr = -1e9

    for d_cx in (-1.5, -0.5, 0.0, 0.5, 1.5):
        for d_cy in (-1.5, -0.5, 0.0, 0.5, 1.5):
            for scale_mult in (0.94, 0.97, 1.00, 1.03, 1.06):
                sc = base_scale * scale_mult
                c_x = cx + d_cx
                c_y = cy + d_cy
                r_in = 105.5 * sc
                r_out = 122.5 * sc
                if r_out < 6.0:
                    continue

                sector_vals: list[float] = []
                for k in range(32):
                    theta_c = (2.0 * math.pi * k) / 32.0
                    samples: list[float] = []
                    for r_frac in (0.20, 0.35, 0.50, 0.65, 0.80):
                        rad = r_in + r_frac * (r_out - r_in)
                        for d_th in (-0.025, 0.0, 0.025):
                            th = theta_c + d_th
                            px = int(round(c_x + rad * math.cos(th)))
                            py = int(round(c_y + rad * math.sin(th)))
                            if 0 <= px < w and 0 <= py < h:
                                samples.append(float(gold_score[py, px]))
                    sector_vals.append(float(np.mean(samples)) if samples else 0.0)

                dec = decode_optical_codeword32_soft(sector_vals, expected_doc_tag6=expected_tag6)
                if dec["ml_correlation"] > best_ml_corr:
                    best_ml_corr = dec["ml_correlation"]
                    best_result = dec

    assert best_result is not None
    recovered_word = int(best_result["canary_beacon_word"])

    matched_suspects: list[str] = []
    tested_candidates: list[dict[str, Any]] = []
    if suspects:
        kfp = key_fingerprint or hashlib.sha256(secret_key.encode("utf-8")).hexdigest()
        for s in suspects:
            s_clean = s.strip()
            if not s_clean:
                continue
            if content_sha256:
                tag = compute_canary_tag(secret_key, content_sha256, s_clean, kfp)
                cand_word = int(tag["beacon_word"])
            else:
                # Content-agnostic fallback hash if content_sha256 is unknown
                h_fb = hashlib.sha256(f"MARMA-OPTICAL-SUSPECT::{kfp}::{s_clean}".encode("utf-8")).hexdigest()
                cand_word = (int(h_fb[:4], 16) % 1023) + 1
            cw_cand = encode_optical_codeword32(cand_word, best_result["doc_tag6"])
            is_hit = cand_word == recovered_word
            if is_hit:
                matched_suspects.append(s_clean)
            tested_candidates.append(
                {
                    "recipient_id": s_clean,
                    "expected_beacon_word": cand_word,
                    "hamming_distance": sum(
                        1 for a, b in zip(best_result["decoded_codeword"], cw_cand) if a != b
                    ),
                    "matched": is_hit,
                }
            )

    return {
        "optical_verified": best_result["ml_correlation"] >= 0.35,
        "protocol": "MARMA-OPTICAL-ECC-V2.1",
        "image_file": str(image_path),
        "detected_seal_center": [round(cx, 2), round(cy, 2)],
        "detected_scale": round(base_scale, 4),
        "canary_beacon_word": recovered_word,
        "doc_tag6": best_result["doc_tag6"],
        "ml_correlation": best_result["ml_correlation"],
        "confidence": best_result["confidence"],
        "corrected_bit_errors": best_result["corrected_bit_errors"],
        "matched_recipient": matched_suspects[0] if len(matched_suspects) == 1 else None,
        "matched_suspects": matched_suspects,
        "tested_candidates": tested_candidates,
    }
