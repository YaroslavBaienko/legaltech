# 🔱 Marma-Crypto Protocol (`v1.3.0`)

**Cryptographic Geometric Watermarking, 256-Bit Bijective Vector Steganography, and Sovereign Document Sealing via Sri Yantra Nonlinear Concurrency and Elliptic Curves over $\mathbb{F}_{2^{257}}$ (DSTU 4145-2002)**

*Криптографічно-геометричний водяний знак, 256-бітна бієктивна векторна стеганографія та суверенне запечатування документів на основі нелінійної планіметрії Шрі Янтри та еліптичних кривих ДСТУ 4145-2002*

[![Live Verifier](https://img.shields.io/badge/🌐_Live_Online_Verifier-yaroslavbaienko.github.io-d4a843.svg)](https://yaroslavbaienko.github.io/marma-crypto-protocol/)
[![APT Repository](https://img.shields.io/badge/🐧_Debian%2FUbuntu_APT-yaroslavbaienko.github.io%2Flegaltech-2ea44f.svg)](https://yaroslavbaienko.github.io/legaltech/)
[![Product Hunt](https://img.shields.io/badge/🚀_Product_Hunt-Marma--Crypto_Protocol-da552f.svg)](https://www.producthunt.com/products/marma-crypto-protocol)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23436152.svg)](https://doi.org/10.5281/zenodo.23436152)
[![Zenodo Record](https://img.shields.io/badge/CERN_Zenodo-23436152-024289.svg)](https://zenodo.org/records/23436152)
[![X @baienko](https://img.shields.io/badge/𝕏-@baienko-000000.svg)](https://x.com/baienko)
[![License: Apache 2.0](https://img.shields.io/badge/Code_License-Apache_2.0-blue.svg)](LICENSE)
[![Whitepaper: CC BY 4.0](https://img.shields.io/badge/Whitepaper-CC_BY_4.0-DCA900.svg)](whitepaper/Marma_Crypto_Whitepaper_EN.pdf)
[![Standard: DSTU 4145-2002 | PAdES-B-LTA](https://img.shields.io/badge/Crypto-DSTU_4145--2002_%7C_256--Bit_Bijective_%7C_PAdES--LTA-1b2a4a.svg)](src/dstu4145_bridge.js)

> **🌐 [Open the Interactive Browser Verifier & Sri Yantra 9-Triangle Inspector → `https://yaroslavbaienko.github.io/marma-crypto-protocol/`](https://yaroslavbaienko.github.io/marma-crypto-protocol/)**

---

## ✨ What's New in `v1.3.0` (`MARMA-DSTU4145-V1.3`)

1. **Multi-Collision-Resistant Parallel Hash Combiner:**
   Replaces single-chain hashing with a parallel multi-standard combiner binding all three cryptographic hash families simultaneously:
   $$H_{\text{comb}}(M) = \text{SHA-256}\Big(\text{GOST 34.311-95}(M) \;\|\; \text{"::"} \;\|\; \text{DSTU 7564:2014 Kupyna-256}(M) \;\|\; \text{"::"} \;\|\; \text{SHA-256}(M)\Big)$$
   An adversary must find a simultaneous triple collision across all three independent compression functions to forge a message digest.
2. **Full 256-Bit Bijective Geometric Mantissa Encoding (Lossless Inversion):**
   Upgrades the geometric payload capacity from 24-bit per-triangle offsets to **all 256 bits** of the signature binding vector $V = \text{SHA-256}(r_{\text{hex}} \parallel \text{"::"} \parallel s_{\text{hex}})$:
   - **9-Triangle Coordinate Lattice (26 Independent Symmetric Channels):** Partitions the 256-bit digest into twenty-five 10-bit words ($w_0\dots w_{24} \in [0, 1023]$) plus one 6-bit word ($w_{25} \in [0, 63]$) mapped onto an exact integer-nanometer lattice:
     $$\delta(w) = (18w - 9207) \times 10^{-9} \in [-9.207\times 10^{-6}, +9.207\times 10^{-6}]$$
     Because every step is an exact integer multiple of $18\,\text{nm}$ ($18 \times 10^{-9}$), `recover_256bit_from_triangles()` losslessly reconstructs all 64 hex characters of $V$ directly from the 9 triangle polygons alone with zero IEEE-754 rounding drift between Python and JavaScript.
   - **24-Pair Symmetric Marma Mantissa Encoding (`encode_256bit_marma_pairs` / `decode_256bit_marma_pairs`):** Encodes 11 bits per symmetric Marma pair ($24 \times 11 = 264\text{ bits} \ge 256\text{ bits}$ + 8-bit Canary CRC) while preserving exact bilateral symmetry $\Delta_{\text{sym}} = 0.000000000000$.
3. **Forensic Canary Leak-Tracing (`--recipient-id` & `marma-watermark trace --suspects`):**
   Uses the **27th independent symmetric degree of freedom** — the vertical apex $ay_9$ (`D5.ay`) of the innermost Bindu triangle $\nabla_{\text{D5}}$ — as a dedicated 10-bit forensic Canary beacon $w_{\text{canary}} \in [1, 1023]$ coupled with zero-plaintext SHA-256/HMAC commitments. No plaintext recipient name is ever stored in the file, yet leaked copies can be deterministically attributed against a suspect pool via CLI or in the Browser Verifier.
4. **100% Backward Compatibility:**
   All `MARMA-DSTU4145-V1.2` hardware-signed PAdES-LTA / CAdES-X-Long / OpenTimestamps artifacts remain 100% verifiable with zero drift.

---

## 📄 Official Academic Whitepapers & Self-Referential Cryptographic Proofs

Both editions of the Whitepaper are sealed using the **Marma-Crypto** protocol they specify, signed with a Qualified Electronic Signature (**ETSI EN 319 142-1 PAdES-B-LTA** + **IETF RFC 3161 Time-Stamp Token** + **ISO 32000-2 `/DSS`**), and anchored in the Bitcoin blockchain via OpenTimestamps:

| Artifact | Link | Content SHA-256 / Details |
| :--- | :--- | :--- |
| **English Whitepaper (PDF · PAdES-LTA)** | [`whitepaper/Marma_Crypto_Whitepaper_EN.pdf`](whitepaper/Marma_Crypto_Whitepaper_EN.pdf) | `53bfdc2070495eaf6bcd915e012324b6bbec1289b5f76b131d402b21b04d8753` |
| **Ukrainian Whitepaper (PDF · PAdES-LTA)** | [`whitepaper/Marma_Crypto_Whitepaper_UA.pdf`](whitepaper/Marma_Crypto_Whitepaper_UA.pdf) | `4ee642f48ad9ced607a70b9ed575cecea4996b17d259be28a34c4f57d72a2c97` |
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
2. **Elliptic Curve Signature Mapping over $\mathbb{F}_{2^{257}}$ & Parallel Multi-Hash Combiner (DSTU 4145-2002 / ETSI PAdES-B-LTA):**
   Normalized document text $M$ is hashed in parallel via **GOST 34.311-95**, **DSTU 7564:2014 ("Kupyna-256")**, and **FIPS 180-4 SHA-256**, combined into $H_{\text{comb}}(M)$. A deterministic elliptic curve signature $(r, s)$ over $\mathbb{F}_{2^{257}} = \mathbb{F}_2[t]/(t^{257}+t^{12}+1)$ is computed using **IETF RFC 6979** nonce derivation and bound into a 256-bit signature vector:
   $$V = \text{SHA-256}(r_{\text{hex}} \parallel \text{"::"} \parallel s_{\text{hex}})$$
3. **256-Bit Bijective Lattice Modulation & Canary Channel (`MARMA-DSTU4145-V1.3`):**
   Each of the 9 triangles exposes 3 independent bilateral-symmetry-preserving degrees of freedom $(\delta_{lx,k}, \delta_{by,k}, \delta_{ay,k})$, yielding $9 \times 3 = 27$ orthogonal channels:
   - Channels $1\dots 26$ bijectively encode all 256 bits of $V$ via $\delta(w) = (18w - 9207)\times 10^{-9}$.
   - Channel $27$ ($\delta_{ay,9}$ on the innermost triangle $\nabla_{\text{D5}}$) encodes the 10-bit Canary Leak-Tracing beacon $w_{\text{canary}} \in [1, 1023]$ (or $0$ for public release copies).
   - For all $k \in \{1,\dots,9\}$ and scale $\lambda \in \{1, 2\}$ ($C_x = 150\lambda$):
     $$\tilde{lx}_k = \lambda lx_k + \delta_{lx,k}, \quad \tilde{rx}_k = 2 C_x - \tilde{lx}_k, \quad \tilde{by}_k = \lambda by_k + \delta_{by,k}, \quad \tilde{ay}_k = \lambda ay_k + \delta_{ay,k}$$
     identically preserving $\tilde{lx}_k + \tilde{rx}_k = 2 C_x$ ($\Delta_{\text{sym}} = 0.000000000000$).

---

## 🚀 Quick Start, Canary Leak-Tracing & Independent Verification

### 1. Verify the Signed Whitepapers Right Now
```bash
python3 src/marma_watermark.py verify whitepaper/Marma_Crypto_Whitepaper_EN.pdf
python3 src/marma_watermark.py verify whitepaper/Marma_Crypto_Whitepaper_UA.pdf
```

### 2. Stamp a Confidential Copy with Canary Leak-Tracing & Trace Suspects
```bash
# Stamp a recipient-specific copy (invisibly modulates D5.ay + zero-plaintext commitment)
python3 src/marma_watermark.py sign contract.pdf -o contract_party07.pdf --recipient-id "M&A-Party-07"

# Forensically attribute a leaked copy against a list of suspect recipients
python3 src/marma_watermark.py trace contract_party07.pdf --suspects "Investor-A,M&A-Party-07,Counsel-C"
```

### 3. Run the Full Cryptographic Self-Test & 11-Suite Cross-Runtime Verification
```bash
python3 src/marma_watermark.py selftest
python3 -m unittest discover -s tests -v
```

### 4. Build and Install the Debian Package (`.deb`) with GNOME Files (Nautilus) Integration
```bash
./build.sh --test
sudo dpkg -i dist/marma-crypto-watermark_1.3.0-1_all.deb
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
  version     = {1.3.0},
  institution = {Independent Legal Engineering \& Applied Cryptography Research},
  number      = {MARMA-DSTU4145-V1.3.0},
  doi         = {10.5281/zenodo.23436152},
  url         = {https://zenodo.org/records/23436152}
}
```

## ⚖️ License

* **Software & Source Code (`src/`, `bin/`, `nautilus-scripts/`):** Licensed under the **Apache License, Version 2.0** (including Explicit Patent Grant & Attribution Clauses).
* **Whitepapers & Mathematical Specification (`whitepaper/`):** Licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

