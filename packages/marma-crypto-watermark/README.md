# 🔱 Marma-Crypto Protocol (`v1.2.1`)

**Cryptographic Geometric Watermarking and Sovereign Document Sealing via Sri Yantra Nonlinear Concurrency and Elliptic Curves over $\mathbb{F}_{2^{257}}$ (DSTU 4145-2002)**

*Криптографічно-геометричний водяний знак та суверенне запечатування документів на основі нелінійної планіметрії Шрі Янтри та еліптичних кривих ДСТУ 4145-2002*

[![Live Verifier](https://img.shields.io/badge/🌐_Live_Online_Verifier-yaroslavbaienko.github.io-d4a843.svg)](https://yaroslavbaienko.github.io/marma-crypto-protocol/)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23436152.svg)](https://doi.org/10.5281/zenodo.23436152)
[![Zenodo Record](https://img.shields.io/badge/CERN_Zenodo-23436152-024289.svg)](https://zenodo.org/records/23436152)
[![License: Apache 2.0](https://img.shields.io/badge/Code_License-Apache_2.0-blue.svg)](LICENSE)
[![Whitepaper: CC BY 4.0](https://img.shields.io/badge/Whitepaper-CC_BY_4.0-DCA900.svg)](whitepaper/Marma_Crypto_Whitepaper_EN.pdf)
[![Standard: DSTU 4145-2002 | PAdES-B-LTA](https://img.shields.io/badge/Crypto-DSTU_4145--2002_%7C_PAdES--B--LTA_%7C_RFC_3161-1b2a4a.svg)](src/dstu4145_bridge.js)

> **🌐 [Open the Interactive Browser Verifier & Sri Yantra 9-Triangle Inspector → `https://yaroslavbaienko.github.io/marma-crypto-protocol/`](https://yaroslavbaienko.github.io/marma-crypto-protocol/)**

---

## 📄 Official Academic Whitepapers & Self-Referential Cryptographic Proofs

Both editions of the Whitepaper are sealed using the **Marma-Crypto v1.2.1** protocol they specify, signed with a Qualified Electronic Signature (**ETSI EN 319 142-1 PAdES-B-LTA** + **IETF RFC 3161 Time-Stamp Token** + **ISO 32000-2 `/DSS`**), and anchored in the Bitcoin blockchain via OpenTimestamps:

| Artifact | Link | Content SHA-256 |
| :--- | :--- | :--- |
| **English Whitepaper (PDF)** | [`whitepaper/Marma_Crypto_Whitepaper_EN.pdf`](whitepaper/Marma_Crypto_Whitepaper_EN.pdf) | `53bfdc2070495eaf6bcd915e012324b6bbec1289b5f76b131d402b21b04d8753` |
| **Ukrainian Whitepaper (PDF)** | [`whitepaper/Marma_Crypto_Whitepaper_UA.pdf`](whitepaper/Marma_Crypto_Whitepaper_UA.pdf) | `4ee642f48ad9ced607a70b9ed575cecea4996b17d259be28a34c4f57d72a2c97` |
| **EN Verification Protocol (PDF)** | [`whitepaper/Marma_Crypto_Whitepaper_EN_PROTOCOL.pdf`](whitepaper/Marma_Crypto_Whitepaper_EN_PROTOCOL.pdf) | Zero-tolerance 9-triangle audit report |
| **UA Verification Protocol (PDF)** | [`whitepaper/Marma_Crypto_Whitepaper_UA_PROTOCOL.pdf`](whitepaper/Marma_Crypto_Whitepaper_UA_PROTOCOL.pdf) | Офіційний протокол перевірки 9 трикутників |
| **Signed Reference Sri Yantra (SVG)** | [`whitepaper/sri_yantra_whitepaper_diagram.svg`](whitepaper/sri_yantra_whitepaper_diagram.svg) | `1dfebfa9a7154973512e3933d6a0c7a556319c6b7b3900dcce1f0f6eef01bbce` |
| **Detached CAdES-X-Long Container (`.p7s`)** | [`whitepaper/sri_yantra_whitepaper_diagram.svg.p7s`](whitepaper/sri_yantra_whitepaper_diagram.svg.p7s) | ETSI EN 319 122-1 CMS `SignedData` + RFC 3161 TSP |
| **Authorship Manifest & OTS Proofs** | [`whitepaper/AUTHORSHIP_MANIFEST.txt`](whitepaper/AUTHORSHIP_MANIFEST.txt) | Anchored via `a.pool.opentimestamps.org` (`.ots`) |

---

## 🧮 Mathematical & Cryptographic Overview

Conventional digital signatures (IETF RFC 5652 CMS / PKCS#7) detach the binary signature container from the visual geometry of a page, whereas raster watermarks degrade under scaling and vector conversion. **Marma-Crypto** solves this by uniting two formal mathematical systems:

1. **Nonlinear 9-Triangle Concurrency of the Sri Yantra (*Nava-Cakra*, Kulaichev 1984; Huet 2002):**
   Four upward-pointing *Śiva* triangles ($\Delta_{\text{U1}}\dots\Delta_{\text{U4}}$) and five downward-pointing *Śakti* triangles ($\nabla_{\text{D1}}\dots\nabla_{\text{D5}}$) intersect to form **43 sub-triangles** and **54 triple concurrency nodes (*marmas*)** governed by $\det[A_i, B_i, C_i] = 0$.
2. **Elliptic Curve Signature Mapping over $\mathbb{F}_{2^{257}}$ (DSTU 4145-2002 / ETSI PAdES-B-LTA):**
   Normalized document text $M$ is hashed via **GOST 34.311-95**, **DSTU 7564:2014 ("Kupyna-256")**, and **FIPS 180-4 SHA-256**. A deterministic elliptic curve signature $(r, s)$ over $\mathbb{F}_{2^m}$ (polynomial-basis curve `DSTU_PB_257` over $\mathbb{F}_{2^{257}} = \mathbb{F}_2[t]/(t^{257}+t^{12}+1)$ or the signer's X.509 QES curve) is computed using **IETF RFC 6979** nonce derivation and bound into a public keyless binding vector:
   $$V = \text{SHA-256}(r_{\text{hex}} \parallel \text{"::"} \parallel s_{\text{hex}})$$
3. **24-Bit Block Quantization & Bilateral Symmetry-Preserving Modulation ($\pm 10^{-5}$):**
   The first 27 bytes (216 bits) of $V$ are partitioned into nine 24-bit unsigned big-endian integers $u_k = \text{uint24}_{\text{BE}}(V[3k : 3k+3]) \in [0, 2^{24}-1]$ ($2^{24}-1 = 16\,777\,215$) and quantized into $\vec{\delta} = (\delta_1, \dots, \delta_9) \in [-10^{-5}, +10^{-5}]^9$:
   $$\delta_{k+1} = \text{round}_9\!\left(\left(\frac{2 \cdot u_k}{16\,777\,215} - 1\right) \times 10^{-5}\right), \qquad k = 0, \dots, 8$$
   Applying the affine antisymmetric modulation operator with homogeneous scale factor $\lambda \in \{1, 2\}$ ($C_x = 150\lambda$):
   $$\tilde{lx}_k = lx_k + \lambda \delta_k, \quad \tilde{rx}_k = 2 C_x - \tilde{lx}_k = rx_k - \lambda \delta_k, \quad \tilde{by}_k = by_k + \frac{\lambda \delta_k}{2}, \quad \tilde{ay}_k = ay_k$$
   identically preserves the bilateral symmetry invariant $\tilde{lx}_k + \tilde{rx}_k = 2 C_x$ ($\Delta_{\text{sym}} < 10^{-12}$) while enabling deterministic zero-tolerance detection of any single-byte text modification or geometric displacement exceeding $\tau_{\text{coord}} = 10^{-7}$ coordinate units.

---

## 🚀 Quick Start & Independent Verification

### 1. Verify the Signed Whitepapers Right Now
```bash
python3 src/marma_watermark.py verify whitepaper/Marma_Crypto_Whitepaper_EN.pdf
python3 src/marma_watermark.py verify whitepaper/Marma_Crypto_Whitepaper_UA.pdf
```

### 2. Run the Full Cryptographic Self-Test Suite (`.svg`, `.pdf`, `.docx`, Tamper Rejection)
```bash
python3 src/marma_watermark.py selftest
```

### 3. Build and Install the Debian Package (`.deb`) with GNOME Files (Nautilus) Integration
```bash
./build.sh --test
sudo dpkg -i dist/marma-crypto-watermark_1.2.0-1_all.deb
```

---

## 📜 Author & Citation

* **Author:** **Yaroslav V. Baienko** (*Баєнко Ярослав Володимирович*)
* **Affiliation:** Attorney-at-Law, Legal Engineer & Applied Cryptography Researcher (Ukraine)
* **GPG Fingerprint (RSA-4096):** `3D5A ACFD E32C 98FE 8819 9D47 D2A2 C1C4 9164 673B`
* **Qualified Certificate Serial (КНЕДП):** `10FF6F932221FA00CB4407000000000130616768`

```bibtex
@techreport{baienko2026marmacrypto,
  author      = {Baienko, Yaroslav V.},
  title       = {Marma-Crypto: A Cryptographic Geometric Watermarking and Sovereign Document Sealing Protocol via Sri Yantra Nonlinear Concurrency and Elliptic Curves over GF(2\^{}257) (DSTU 4145-2002)},
  year        = {2026},
  institution = {Independent Legal Engineering \& Applied Cryptography Research},
  number      = {EDU-VEDI-WP-2026-01},
  doi         = {10.5281/zenodo.23436152},
  url         = {https://zenodo.org/records/23436152}
}
```

## ⚖️ License

* **Software & Source Code (`src/`, `bin/`, `nautilus-scripts/`):** Licensed under the **Apache License, Version 2.0** (including Explicit Patent Grant & Attribution Clauses).
* **Whitepapers & Mathematical Specification (`whitepaper/`):** Licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
