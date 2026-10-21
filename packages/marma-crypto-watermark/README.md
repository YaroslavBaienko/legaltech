# 🔱 Marma-Crypto Protocol (`v2.1.0` — `Marma-256` · `Universal` · `Deal-Room API` · `Optical ECC`)

**Sub-Micron Keyed Dithered QIM Vector Watermarking, 256-Bit Bijective Vector Commitments, Universal 27-DOF Emblem Modulation (`Sri Yantra` / `Tryzub` / `Corporate` / `CAD`), and Optical Screen-Photo Traitor Tracing (`DSTU 4145-2002` / `PAdES-B-LTA`)**

*Криптографічно-геометричний водяний знак, 256-бітна бієктивна векторна стеганографія, універсальний 27-DOF модулятор векторних емблем (Шрі Янтра / Тризуб / Корпоративний щит / CAD-креслення) та оптичний розшук витоків по фото екрана на основі еліптичних кривих ДСТУ 4145-2002*

[![Live Verifier](https://img.shields.io/badge/🌐_Live_Online_Verifier-yaroslavbaienko.github.io-d4a843.svg)](https://yaroslavbaienko.github.io/marma-crypto-protocol/)
[![APT Repository](https://img.shields.io/badge/🐧_Signed_APT_Repo-v2.1.0--1_signed--by_GPG-2ea44f.svg)](https://yaroslavbaienko.github.io/legaltech/)
[![Standard: DSTU 4145-2002 | PAdES-B-LTA](https://img.shields.io/badge/Crypto-DSTU_4145--2002_%7C_256--Bit_Bijective_%7C_PAdES--LTA-1b2a4a.svg)](src/dstu4145_bridge.js)
[![Patent Pending UA](https://img.shields.io/badge/⚖️_Patent_Pending_(UKRNOIVI)-a_2026_06266-0057b7.svg)](patent_ukrnoivi/05_Zajava_ta_Instruktsija_SEV_ZES.md)
[![Peer Review SIGPRO](https://img.shields.io/badge/📄_Elsevier_Signal_Processing-SIGPRO--D--26--04464-ff6c00.svg)](PUBLICATIONS.md)
[![Preprint Archive DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23510005.svg)](https://doi.org/10.5281/zenodo.23510005)
[![SWHID](https://img.shields.io/badge/Software_Heritage-swh%3A1%3Asnp%3Adcae02ea-e2231a.svg)](https://archive.softwareheritage.org/swh:1:snp:dcae02ea5d13bb6aa6a72b2624184c961e44c3a1;origin=https://github.com/YaroslavBaienko/marma-crypto-protocol)
[![License: Apache 2.0](https://img.shields.io/badge/Code_License-Apache_2.0-blue.svg)](LICENSE)
[![Whitepaper: CC BY 4.0](https://img.shields.io/badge/Specification-CC_BY_4.0-DCA900.svg)](whitepaper/Marma_Crypto_Whitepaper_EN.pdf)

> **🌐 [Open the Interactive Browser Sealer, Deal-Room Canary Studio & 9-Triangle Verifier → `https://yaroslavbaienko.github.io/marma-crypto-protocol/`](https://yaroslavbaienko.github.io/marma-crypto-protocol/)** · **🇺🇦 [Українська сторінка та Інженерний FAQ → `ua.html`](https://yaroslavbaienko.github.io/marma-crypto-protocol/ua.html)**
> **📚 [Registry of Versions, Preprint Archives & Submissions (`PUBLICATIONS.md`)](PUBLICATIONS.md) · 🛠️ [DOU Community Engineering Feedback Log (`docs/DOU_COMMUNITY_FEEDBACK.md`)](docs/DOU_COMMUNITY_FEEDBACK.md) · 🇪🇺 [EU NGI0 Grant & R&D Roadmap (`ROADMAP.md`)](ROADMAP.md)**

> **⚡ Engineering `TL;DR` (What `Marma-256 v2.1.0` Is — and What It Is Not):**
> - **What it is:** A **dual-layer vector & optical forensic watermarking suite** for PDF (`ISO 32000-2`), DOCX, and SVG/CAD drawings:
>   1. **Layer 1 (`Marma-256` & `Marma-Universal` Vector Lattice):** A bijective vector-graphic encoding layer ($\mathcal{E}_{10}$) with **Chen–Wornell Keyed Dithered QIM** ($\mathbf{d}_K \in \mathbb{Z}_{1024}^{27}$) and **Fisher–Yates Channel Permutation** ($\pi_K \in S_{27}$) that embeds all **256 bits** of a cryptographic signature digest $V = \text{SHA-256}(r \parallel s)$ plus an orthogonal **10-bit recipient Canary beacon** into exact $18\text{ npt}$ ($1.8\times 10^{-8}\text{ pt}$) coordinate perturbations of **any 2D vector emblem with $\ge 27$ degrees of freedom** — including the **9-triangle Sri Yantra** (`sri-yantra`), the **Ukrainian State Trident — Тризуб** (`tryzub`), a **Corporate B2B/LegalTech Heraldic Shield** (`corporate-shield`), or **arbitrary engineering CAD/SVG/GIS polygons** (`cad-polygon`).
>   2. **Layer 2 (`Marma-Optical` Screen-Photo ECC Ring):** A surrounding **32-Sector Ceremonial Lotus Ring (`32-Petal Padma Dial`)** encoded with a systematic **$[32, 16, d_{\min}=8]$ error-correcting code** and decoded via **Soft-Decision Maximum-Likelihood (ML) Pearson Correlation**. Even when a traitor **photographs the monitor with a smartphone** or takes a blurry, noisy `JPEG`/`PNG` screenshot (destroying all PDF floating-point vector coordinates), `marma-watermark trace` extracts the 10-bit `canary_word` directly from the raster image and identifies the leaker.
> - **What it is NOT:** It does **not** invent a custom signature primitive, replace asymmetric QES validation, or compete with standard PAdES `/ByteRange` when a signed PDF remains intact. Instead, it bridges the gap when **(1)** signatures are detached (`.p7s` / CAdES) and the PDF carries only a "dumb" visual stamp, **(2)** enterprise DMS / archival gateways flatten PDFs (`print-to-PDF`) and strip `/Contents`, **(3)** civil servants reject valid PAdES files that lack a visible stamp on the page, or **(4)** M&A deal rooms and defense contractors need zero-crosstalk recipient leak attribution across both vector files and smartphone screen photos.
> - **100% Post-Quantum (NIST PQC) Agile:** Because $\mathcal{E}_{10}$ encodes any 256-bit signature digest $V \in \{0,1\}^{256}$, replacing classical elliptic curves (`DSTU 4145-2002` / `ECDSA`, vulnerable to Shor's algorithm) with **NIST FIPS 204 (`ML-DSA` / Dilithium)** or **NIST FIPS 205 (`SLH-DSA` / SPHINCS+)** requires **zero changes** to the geometric lattice.

---

## 🖼️ Visual Architecture & Geometric Lattice Showcase

<p align="center">
  <img src="whitepaper/sri_yantra_whitepaper_diagram.svg" alt="Signed Reference Sri Yantra Vector Seal (9 Triangles, 54 Marmas, 27 Orthogonal Channels)" width="360" />
</p>

<p align="center">
  <img src="whitepaper/figures/fig1_architecture.svg" alt="End-to-End Marma-256 Cryptographic & Bijective Vector Pipeline" width="840" />
</p>

| Overdetermined Planar Incidence Lattice $\mathcal{C}_{9,54}$ | Comparative Payload & Robustness Benchmark |
| :---: | :---: |
| <img src="whitepaper/figures/fig2_c954_geometry.svg" alt="C9,54 Planar Incidence Lattice & 27-DOF Allocation" width="410" /> | <img src="whitepaper/figures/fig5_comparative_benchmarks.svg" alt="Comparative Analysis vs QIM, Spread-Spectrum, and Font-Manifold" width="410" /> |

---

## 🚀 What's New in `v2.1.0` (`Marma-Universal` · `Deal-Room Batch API` · `Marma-Optical` · `Theorem 5`)

1. **`Marma-Universal` (`src/marma_crypto/universal_qim.py`) — Generalized 27-DOF Vector Emblem & CAD Modulator:**
   - Extends the $s_0 = 18\text{ npt}$ Keyed Dithered QIM modulator beyond the 9 triangles of Sri Yantra (`--emblem sri-yantra`) to three new production vector geometries:
     - **`--emblem tryzub` (Малий Державний Герб України — Тризуб):** 9 bilaterally symmetric heraldic contours ($x_L + x_R = 300.0$, $\Delta_{\text{sym}} < 10^{-12}\text{ pt}$) for ministries, courts, state registries, and defense agencies.
     - **`--emblem corporate-shield` (B2B / LegalTech / Banking Heraldic Shield):** 9 bilaterally symmetric geometric chevrons and pillars for law firms, investment banks, and corporate boards.
     - **`--emblem cad-polygon` & `modulate_arbitrary_2d_vertices()`:** Directly embeds all 266 bits (`256-bit signature + 10-bit Canary word`) into the first 27 scalar coordinates of **any arbitrary 2D CAD/SVG/DXF/GIS polygon or polyline** with $\ge 14$ vertices while leaving all remaining geometry untouched (`0.0 npt` quantization residual).
2. **`Marma-Optical` (`src/marma_crypto/optical_ecc.py`) — Screen-Photo & Print-Cam Resilient Leak Tracing:**
   - Adds a second physical modulation ring (`--optical-ring`) around the vector seal: a **32-Sector Ceremonial Lotus Ring (`32-Petal Padma Dial`)** encoding the 10-bit `canary_beacon_word` and a 6-bit document binding tag (`doc_tag6`) via a **systematic $[32, 16, d_{\min}=8]$ linear block code**.
   - **Soft-Decision Maximum-Likelihood (ML) Pearson Correlation Decoder (`extract_canary_from_raster_image`):** Automatically locates the dark-navy & gold seal disc in any cropped or full-page raster image (`.png`, `.jpg`, `.jpeg`, `.webp`), samples radial sector luminance across a multi-scale grid, corrects up to 4 hard sector bit-flips (specular screen glare), and identifies the exact leaking recipient even after `216 DPI` rasterization, `GaussianBlur(radius=0.85)`, additive camera sensor noise ($\sigma = 7.5$), and lossy `JPEG(quality=72)` compression.
3. **Python SDK (`pyproject.toml`) + Deal-Room Batch Engine & REST Microservice (`src/marma_crypto/api_server.py`):**
   - **Installable Python Package (`pip install -e .`):** Clean modular SDK (`from marma_crypto import batch_seal_dealroom, trace_leak_any_medium, MarmaDealRoomServer, ...`).
   - **$O(1)$-Amortized Deal-Room Batch Stamping (`marma-watermark batch-seal`):** Precomputes the document SHA-256 and `DSTU 4145-2002` signature once and generates $N$ individualized recipient-tracked PDF copies with unique vector + optical Canary beacons in $< 0.15\text{ s}$ per batch.
   - **Embedded HTTP REST Microservice (`marma-watermark serve-api --port 8765`):** Zero-dependency HTTP server exposing `GET /v1/health`, `POST /v1/seal-batch`, `POST /v1/verify`, and `POST /v1/trace-leak` for turnkey integration with Nextcloud, SharePoint, Intralinks, Datasite, and M.E.Doc/Вчасно gateways.
4. **Theorem 5 — Chen–Wornell Keyed Dithered QIM ($\mathbf{d}_K \in \mathbb{Z}_{1024}^{27}$) & Active-TraitorPermutation ($\pi_K \in S_{27}$):**
   - Formalized in our **Elsevier *Signal Processing* (`SIGPRO-D-26-04464`)** submission (`Release v2.0-SIGPRO`, `21 pp.`): applies a keyed uniform dither vector $\mathbf{d}_K$ (rendering physical coordinate offsets statistically uniform over $\mathbb{Z}_{1024}^{27}$ with Kullback–Leibler divergence $D_{\text{KL}} = 0\text{ bits}$ against cover distributions) and a Fisher–Yates channel permutation $\pi_K \in S_{27}$ so an unkeyed traitor attempting to erase the Canary channel hits the 26 signature commitments with probability $26/27 \approx 96.30\%$ (`99.72%` for 2 guesses).
5. **Expanded GNOME Files (`Nautilus`) Right-Click Suite (`11 Scripts` + `40/40` Automated Tests):**
   - Adds 4 new localized (UA/EN) right-click actions in `🔱 Шрі Янтра · Marma-Crypto`: **Ukrainian Trident / Corporate Shield Stamping**, **CAD-SVG 27-DOF Protection**, **Deal-Room Batch Stamping ($N$ Recipients)**, and **Unified Vector + Screen-Photo Optical Leak Tracing**, backed by a **40-test cross-verification suite** (`tests/test_marma_v21_universal_optical_api.py`).

---

## ✨ Core Features Introduced in `v1.3.0` (`MARMA-DSTU4145-V1.3` / `Marma-256`)

1. **Multi-Collision-Resistant Parallel Hash Combiner (Explicit 256-Bit Digest Standards):**
   Replaces single-chain hashing with a parallel multi-standard combiner binding three distinct 256-bit cryptographic hash functions simultaneously:
   - **`GOST 34.311-95`** — strictly **256-bit** message digest (legacy Ukrainian/CIS EDS hash standard);
   - **`DSTU 7564:2014 ("Kupyna-256")`** — **256-bit** national Ukrainian hash standard operating over a **512-bit internal state matrix** (note: `DSTU 7564:2014` also defines `Kupyna-512` with a 512-bit output, whereas `GOST 34.311-95` is strictly 256-bit);
   - **`FIPS 180-4 SHA-256`** — **256-bit** international standard digest:
   $$H_{\text{comb}}(M) = \text{SHA-256}\Big(\text{GOST 34.311-95}_{256}(M) \;\|\; \text{"::"} \;\|\; \text{DSTU 7564:2014 Kupyna-256}(M) \;\|\; \text{"::"} \;\|\; \text{SHA-256}(M)\Big) \in \{0,1\}^{256}$$
   An adversary must find a simultaneous collision across all three compression functions to forge $H_{\text{comb}}(M)$.
2. **Full 256-Bit Bijective Geometric Mantissa Encoding (`Marma-256`, Lossless Inversion):**
   Replaces the legacy `v1.2` 24-bit visual quantizer $K=(k_0,k_1,k_2,k_3)$ (which provided only $2^{24}$ visual states and a $2^{12}=4,096$ birthday bound) with a **full 256-bit bijective coordinate lattice** encoding all 256 bits of the binding vector $V = \text{SHA-256}(r_{\text{hex}} \parallel \text{"::"} \parallel s_{\text{hex}})$:
   - **9-Triangle Coordinate Lattice (26 Independent Symmetric Channels):** Partitions the 256-bit digest into twenty-five 10-bit words ($w_0\dots w_{24} \in [0, 1023]$) plus one 6-bit word ($w_{25} \in [0, 63]$) mapped onto an exact integer-nanometer lattice:
     $$\delta(w) = (18w - 9207) \times 10^{-9} \in [-9.207\times 10^{-6}, +9.207\times 10^{-6}]$$
     Because every step is an exact integer multiple of $18\,\text{nm}$ ($18 \times 10^{-9}$), `recover_256bit_from_triangles()` losslessly reconstructs all 64 hex characters of $V$ directly from the 9 triangle polygons alone with zero IEEE-754 rounding drift between Python and JavaScript.
   - **24-Pair Symmetric Marma Mantissa Encoding (`encode_256bit_marma_pairs` / `decode_256bit_marma_pairs`):** Encodes 11 bits per symmetric Marma pair ($24 \times 11 = 264\text{ bits} \ge 256\text{ bits}$ + 8-bit Canary CRC) while preserving exact bilateral symmetry $\Delta_{\text{sym}} = 0.000000000000$.
3. **Forensic Canary Leak-Tracing (`--recipient-id` & `marma-watermark trace --suspects`):**
   Uses the **27th independent symmetric degree of freedom** — the vertical apex $ay_9$ (`D5.ay`) of the innermost Bindu triangle $\nabla_{\text{D5}}$ — as a dedicated 10-bit forensic Canary beacon $w_{\text{canary}} \in [1, 1023]$ coupled with zero-plaintext SHA-256/HMAC commitments. No plaintext recipient name is ever stored in the file, yet leaked copies can be deterministically attributed against a suspect pool via CLI or in the Browser Verifier.
4. **Client-Side Document Sealer & Deal-Room Canary Studio (`100% Client-Side · Bidirectional CLI Parity`):**
   - **Zero-Upload Browser Sealing (`.pdf` & `.svg`):** Visitors on desktop or mobile can seal any local `.pdf` or `.svg` (or run the **1-Click Deal-Room Leak Simulation** on the built-in Confidential M&A Term Sheet) directly in the browser across multiple Deal-Room recipients (`Investor-Alpha, M&A-Party-07, Legal-Counsel-B`).
   - **100% Bidirectional CLI Compatibility:** Any `.pdf` or `.svg` sealed in the browser passes `marma-watermark verify` and `marma-watermark trace --suspects` in the Python CLI with zero coordinate drift ($\Delta_{\text{coord}} = 0.000000000000$), and any `.pdf`, `.docx`, or `.svg` sealed in the Python CLI passes verification and Canary leak-tracing in the browser.
5. **Dual-Mode QES / Direct PB-257 Vault Fallback & GNOME Files (Nautilus) Companion Resolution:**
   - **Resilient Vault Signing (`DSTU4145_PB257_DIRECT` Fallback):** When signing with a `.pfx`/`.p12`/`.zs2` container from `~/.secure_keys/`, `dstu4145_bridge.js` automatically attempts full PKCS#12 unlock (including automatic `UA ↔ EN` keyboard-layout swap recovery) and seamlessly falls back to deterministic `DSTU4145_PB257_DIRECT` signing over $\mathbb{F}_{2^{257}}$ with certificate metadata attachment if an empty password (file-digest mode) or custom vault passphrase is provided.
   - **Companion `.pdf` Auto-Resolution:** Selecting a companion `.txt`, `.typ`, or `.p7s` file in GNOME Files (Nautilus) or CLI (`marma-watermark sign` / `verify`) automatically resolves and processes the corresponding `.pdf` document in the same directory.
6. **100% Backward Compatibility (`12/12` Cross-Runtime Test Suite):**
   All `MARMA-DSTU4145-V1.2` hardware-signed PAdES-LTA / CAdES-X-Long / OpenTimestamps artifacts remain 100% verifiable with zero drift.

---

## 🛡️ Threat Model, Operating Modes & Security Boundaries

To prevent any ambiguity between cryptographic non-repudiation, symmetric deal-room tagging, and unkeyed integrity checksums, **Marma-Crypto** strictly separates three operating modes:

| Operating Mode | Cryptographic Secret / Anchor | What It Guarantees | What It Does NOT Guarantee (Limitations) |
| :--- | :--- | :--- | :--- |
| **Mode 1: Asymmetric QES-Bound** (`PAdES-B-LTA` / `CAdES-X-Long` via hardware token ЗНОК or `.pfx`/`.zs2` private key over `DSTU 4145-2002`) | Signer's private elliptic-curve key $d \in \mathbb{F}_{2^{257}}$ + Qualified X.509 Certificate $Q_{\text{signer}}$ + RFC 3161 TSP | **Full cryptographic authenticity & non-repudiation.** The 256-bit vector lattice encodes $V = \text{SHA-256}(r \parallel s)$. An attacker without private key $d$ cannot forge $(r, s)$ for modified text. If the PKCS#7 container is stripped, the recovered 256-bit vector $V$ still binds the document to the original $(r, s)$ signature record. | **Visual geometry does not replace QES validation.** Verifiers must still validate the underlying signature $(r, s)$ against the signer's public key $Q_{\text{signer}}$ (or a previously recorded signature transcript). |
| **Mode 2: Symmetric Deal-Room Keyed** (`--secret <key>` in CLI or Master Secret in Browser Sealer + Canary `D5.ay`) | Shared secret key $K_{\text{sec}}$ (`HMAC-SHA256` commitment + key-derived elliptic-curve scalar) | **Tamper detection & recipient leak attribution (`Canary`) against external parties.** Recipients who do not know $K_{\text{sec}}$ cannot forge a valid seal for a modified document or impersonate another recipient's Canary tag (`--strict-key`). | **Not asymmetric non-repudiation.** Any party who possesses the shared secret $K_{\text{sec}}$ can re-seal a modified document. For public/default demo keys in the browser, treat output as Mode 3 unless a private secret is set. |
| **Mode 3: Unkeyed / Public Digest** (Empty secret / legacy `--hash auto` / public demo defaults) | **None** (computed deterministically from public document hash $H_{\text{comb}}(M)$) | **Deterministic visual-vector checksum (integrity fingerprint).** Detects accidental corruption or post-hoc alteration *only* if the original digest/seal was previously recorded in an external registry, email trail, or timestamp proof (`.ots`). | **Does NOT protect against intentional forgery on its own.** Because no secret key is involved, an adversary who modifies a document can recompute a new unkeyed seal and redraw the geometry to match the altered text. |

### ⚠️ Optical Inspection (`24-bit` Legacy `v1.2`) vs. Vector Stream Parsing (`256-bit` `v1.3 Marma-256`)
* **Never rely on naked-eye visual comparison alone:** Human vision cannot resolve $18\,\text{nm}$ ($1.8 \times 10^{-8}\text{ pt}$) vertex micro-perturbations. Furthermore, the legacy `v1.2` discrete visual quantizer $K = (k_0, k_1, k_2, k_3) \in \{0,1\}^{24}$ ($\approx 1.67 \times 10^7$ macroscopic configurations) has a birthday-paradox collision bound of only $2^{12} = 4,096$ trials and serves strictly as a macroscopic visual cue.
* **Mandatory programmatic verification (`256-bit`):** Cryptographic collision resistance ($2^{128}$ security level) holds **only** when the verifier parses the exact floating-point vector coordinates (`q ... m l h S Q` in PDF or `<polygon points="...">` in SVG) across all 26 symmetric channels of `Marma-256` and verifies the cryptographic binding.

---

## 🔍 Architectural FAQ: Standard PAdES `/ByteRange` vs. `Marma-256` & Post-Quantum (NIST PQC) Agility

### Q1. In standard embedded PAdES (`ISO 32000-2`), doesn't the `/ByteRange` array already cover the entire PDF (including the visual sticker coordinates) except `/Contents`? Why is `Marma-256` needed?
**Yes — when an embedded PAdES file remains completely untouched, `/ByteRange` covers all byte offsets outside `/Contents`.** However, in real-world legal, banking, and government document workflows, four structural gaps arise where `/ByteRange` alone is either absent, destroyed, or bypassed:

1. **Detached Signatures (`.p7s` / CAdES Detached) & "Dumb" Visual Stickers:** Across Ukrainian (`Вчасно`, `M.E.Doc`, `Дія`, courts) and EU workflows, a massive volume of PDFs are signed via a **detached `.p7s` container**, while a decorative visual stamp ("Signed with QES") is stamped onto the PDF page. In that PDF, there is **no `/ByteRange` at all**, and the visual stamp carries **0 bits** of cryptographic data (meanwhile, state agencies often reject valid electronically signed PDFs if they lack a visible stamp on the page). `Marma-256` turns the visible vector stamp itself into a lossless 256-bit carrier of $V = \text{SHA-256}(r \parallel s)$.
2. **DMS Flattening & Archival Re-Serialization (`Print-to-PDF`):** Corporate Document Management Systems (DMS) and court registries frequently flatten incoming PDFs for archival storage or public extracts — stripping the binary `/Contents` PKCS#7 dictionary and `/ByteRange` while preserving page vector paths (`q ... m l h S Q`). Because `Marma-256` lives inside the page content stream with a $9.207\,\mu\text{pt}$ safety margin (surviving 5-decimal PDF coordinate truncation with $0\%$ bit error rate), the 256-bit signature commitment $V$ survives flattening and can still be verified against the original signature log.
3. **Incremental Saving / Post-Signature "Shadow" Appends:** A classic PDF vulnerability highlighted in academic literature (Mladenov et al., ACM CCS 2019) occurs when an attacker appends an incremental PDF revision (`%%EOF`) after signing that alters the visible text rendered to the user without breaking the byte range of the earlier revision. `Marma-256` canonicalizes the **entire visible text stream** of the document and binds it bijectively to the 9-triangle vector coordinates.
4. **Zero-Crosstalk Recipient Leak Tracing (`Canary` on `D5.ay`):** Standard PAdES `/ByteRange` cannot embed per-recipient forensic watermarks without re-signing the document for every recipient or leaking plaintext metadata. `Marma-256` isolates the 27th symmetric degree of freedom ($\delta_{ay,9}$ of the innermost triangle $\nabla_{\text{D5}}$) as a 10-bit Canary beacon ($w_c \in [1, 1023]$) with strictly zero mutual information leakage regarding the signature vector ($I(V; w_c) = 0$).

### Q2. Does `Marma-Crypto` invent a custom signature algorithm, and what happens when quantum computers break classical elliptic curves (`DSTU 4145-2002` / `ECDSA`) in favor of NIST PQC?
1. **Zero custom signature cryptography:** `Marma-Crypto` does **not** invent a new public-key primitive or attempt to replace standard signature schemes outside PDF/SVG. Cryptographic non-repudiation relies 100% on standard algorithms (`DSTU 4145-2002` over $\mathbb{F}_{2^{257}}$, `ECDSA`, `Ed25519`) and standard hashes (`GOST 34.311-95`, `DSTU 7564:2014 Kupyna-256`, `SHA-256`).
2. **100% Post-Quantum Cryptographic Agility (NIST FIPS 204 `ML-DSA` & FIPS 205 `SLH-DSA`):** While classical elliptic curves (`DSTU 4145-2002` and `ECDSA`) are vulnerable to Shor's quantum algorithm for the discrete logarithm problem, the 27-channel bijective geometric encoder $\mathcal{E}_{10}: \{0,1\}^{256} \times \{0,\dots,1023\} \to \mathbb{R}^{9\times 4}$ is **completely signature-agnostic**. Whether the underlying signature $\sigma$ is a 64-byte `DSTU 4145-2002` pair $(r,s)$, a 2,420-byte **NIST FIPS 204 (`ML-DSA-44` / CRYSTALS-Dilithium)** lattice signature, or a **NIST FIPS 205 (`SLH-DSA` / SPHINCS+)** hash-based signature, `Marma-256` simply encodes the 256-bit commitment $V = \text{SHA3-256}(\sigma_{\text{PQC}}) \in \{0,1\}^{256}$ into the exact same 9 triangles without changing a single formula. Under Grover's quantum search algorithm, a 256-bit hash commitment retains a 128-qubit collision resistance bound.

---

## 📄 Official Whitepapers & Self-Referential Cryptographic Proofs

Both editions of the Whitepaper are sealed using the **Marma-Crypto** protocol they specify, signed with a Qualified Electronic Signature (**ETSI EN 319 142-1 PAdES-B-LTA** + **IETF RFC 3161 Time-Stamp Token** + **ISO 32000-2 `/DSS`**), and anchored in the Bitcoin blockchain via OpenTimestamps:

| Artifact | Link | Content SHA-256 / Details |
| :--- | :--- | :--- |
| **English Whitepaper (PDF · PAdES-LTA)** | [`whitepaper/Marma_Crypto_Whitepaper_EN.pdf`](whitepaper/Marma_Crypto_Whitepaper_EN.pdf) | `53bfdc2070495eaf6bcd915e012324b6bbec1289b5f76b131d402b21b04d8753` |
| **Ukrainian Whitepaper (PDF · PAdES-LTA)** | [`whitepaper/Marma_Crypto_Whitepaper_UA.pdf`](whitepaper/Marma_Crypto_Whitepaper_UA.pdf) | `4ee642f48ad9ced607a70b9ed575cecea4996b17d259be28a34c4f57d72a2c97` |
| **Springer LNCS / Elsevier JISA Manuscript (14 pp.)** | [`whitepaper/Marma_Crypto_IACR_LNCS_Edition.pdf`](whitepaper/Marma_Crypto_IACR_LNCS_Edition.pdf) | Formal Bellare–Rogaway reductions (Theorems 1–5) |
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
   Normalized document text $M$ is hashed in parallel via **GOST 34.311-95 (256-bit)**, **DSTU 7564:2014 ("Kupyna-256", 256-bit output / 512-bit state)**, and **FIPS 180-4 SHA-256 (256-bit)**, combined into the 256-bit digest $H_{\text{comb}}(M)$. A deterministic elliptic curve signature $(r, s)$ over $\mathbb{F}_{2^{257}} = \mathbb{F}_2[t]/(t^{257}+t^{12}+1)$ is computed using **IETF RFC 6979** nonce derivation and bound into a 256-bit signature vector:
   $$V = \text{SHA-256}(r_{\text{hex}} \parallel \text{"::"} \parallel s_{\text{hex}})$$
3. **256-Bit Bijective Lattice Modulation & Canary Channel (`MARMA-DSTU4145-V1.3`):**
   Each of the 9 triangles exposes 3 independent bilateral-symmetry-preserving degrees of freedom $(\delta_{lx,k}, \delta_{by,k}, \delta_{ay,k})$, yielding $9 \times 3 = 27$ orthogonal channels:
   - Channels $1\dots 26$ bijectively encode all 256 bits of $V$ via $\delta(w) = (18w - 9207)\times 10^{-9}$.
   - Channel $27$ ($\delta_{ay,9}$ on the innermost triangle $\nabla_{\text{D5}}$) encodes the 10-bit Canary Leak-Tracing beacon $w_{\text{canary}} \in [1, 1023]$ (or $0$ for public release copies).
   - For all $k \in \{1,\dots,9\}$ and scale $\lambda \in \{1, 2\}$ ($C_x = 150\lambda$):
     $$\tilde{lx}_k = \lambda lx_k + \delta_{lx,k}, \quad \tilde{rx}_k = 2 C_x - \tilde{lx}_k, \quad \tilde{by}_k = \lambda by_k + \delta_{by,k}, \quad \tilde{ay}_k = \lambda ay_k + \delta_{ay,k}$$
     identically preserving $\tilde{lx}_k + \tilde{rx}_k = 2 C_x$ ($\Delta_{\text{sym}} = 0.000000000000$).

---

## 🚀 Installation (Signed APT Repository), Quick Start & Independent Verification

### 1. Install on Debian / Ubuntu via GPG-Signed APT Repository (`signed-by`)
We do **not** recommend `curl | sudo bash` pipes for cryptographic tooling. Instead, add the dedicated GPG keyring (`/etc/apt/keyrings/legaltech.gpg`, RSA-4096 fingerprint `3D5A ACFD E32C 98FE 8819 9D47 D2A2 C1C4 9164 673B`) using standard Debian `signed-by` verification:
```bash
# 1. Fetch and dearmor the repository public GPG key into /etc/apt/keyrings/
curl -fsSL https://yaroslavbaienko.github.io/legaltech/public.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/legaltech.gpg

# 2. Register the signed APT source
echo "deb [signed-by=/etc/apt/keyrings/legaltech.gpg] https://yaroslavbaienko.github.io/legaltech stable main" | sudo tee /etc/apt/sources.list.d/legaltech.list

# 3. Install marma-crypto-watermark and qes-tools
sudo apt update
sudo apt install marma-crypto-watermark qes-tools
```
Or build and inspect the `.deb` package locally from source:
```bash
./build.sh --test
sha256sum dist/marma-crypto-watermark_2.1.0-1_all.deb
sudo dpkg -i dist/marma-crypto-watermark_2.1.0-1_all.deb
```

### 2. Verify the Signed Whitepapers Right Now
```bash
python3 src/marma_watermark.py verify whitepaper/Marma_Crypto_Whitepaper_EN.pdf
python3 src/marma_watermark.py verify whitepaper/Marma_Crypto_Whitepaper_UA.pdf
```

### 3. Stamp with Universal Emblems (`Tryzub` / `Corporate Shield` / `CAD`), Deal-Room Batch & Optical Leak-Tracing
```bash
# 1. Stamp a PDF with the Ukrainian State Trident (Тризуб) + 32-Sector Optical Lotus ECC Ring
python3 src/marma_watermark.py sign contract.pdf -o contract_tryzub.pdf --emblem tryzub --optical-ring --recipient-id "M&A-Party-07"

# 2. Batch-seal an M&A Deal-Room document for N recipients in a single pass (< 0.15 s)
python3 src/marma_watermark.py batch-seal master_nda.pdf --recipients "Investor_Alpha,Investor_Beta,M&A-Party-07" --emblem corporate-shield --optical-ring

# 3. Forensically trace a leak from EITHER a vector file (.pdf/.svg/.docx) OR a smartphone photo of the screen (.jpg/.png)
python3 src/marma_watermark.py trace contract_tryzub.pdf --suspects "Investor_Alpha,M&A-Party-07,Counsel_C"
python3 src/marma_watermark.py trace leaked_screen_photo.jpg --suspects "Investor_Alpha,M&A-Party-07,Counsel_C" --content-sha256 <doc_sha256>

# 4. Launch the local Deal-Room REST API Microservice (/v1/health, /v1/seal-batch, /v1/verify, /v1/trace-leak)
python3 src/marma_watermark.py serve-api --port 8765
```

### 4. Run the Full Cryptographic Self-Test & 40-Test Cross-Runtime Verification Suite
```bash
python3 src/marma_watermark.py selftest
python3 -m unittest discover -s tests -p "test_*.py" -v
```

---

## 📜 Author, Peer-Review Status & Citation

* **Author:** **Yaroslav V. Baienko** (*Баєнко Ярослав Володимирович*) — Attorney-at-Law, Legal Engineer & Applied Cryptography Researcher (Ukraine) · **ORCID:** [`0009-0006-7498-2133`](https://orcid.org/0009-0006-7498-2133)
* **Formal Peer-Review & Patent Examination Status:**
  * **Elsevier *Signal Processing* (`SIGPRO`, EURASIP Q1, IF 4.0) Submission:** Active peer-review manuscript **`SIGPRO-D-26-04464`** (*"Marma-256 (Marma-Crypto): Sub-Micron Dithered Quantization Index Modulation and Orthogonal Subspace Multiplexing on Overdetermined Planar Incidence Manifolds for Bijective 2D Vector Graphics Watermarking and Fragile Authentication"*, `Release v2.0-SIGPRO`, `21 pp.`, Theorems 1–5, 5 vector figures, 6 SOTA tables, 100,000 Monte Carlo trials; archived on CERN Zenodo [`10.5281/zenodo.23510005`](https://doi.org/10.5281/zenodo.23510005) and published in Elsevier SSRN *Cybersecurity & Data Privacy Law & Policy* `Vol. 11, No. 189` [`10.2139/ssrn.7631458`](https://ssrn.com/abstract=7631458)).
  * **Patent Examination (Patent Pending):** Ukrainian 20-year Invention Patent Application No. **`a 2026 06266`** filed with the National IP Office of Ukraine (UKRNOIVI, `Вх-72320/2026` on `2026-10-19`; filing fee receipt registered under `Вх-72403/2026` on `2026-10-20`).
* **Open Preprint Mirrors & Timestamp Archives (Non-Peer-Reviewed Prior Art):**
  * **CERN Zenodo (`v3` / `Release v2.0`, 2026-10-20):** [`10.5281/zenodo.23510005`](https://doi.org/10.5281/zenodo.23510005) (Concept DOI: [`10.5281/zenodo.23429017`](https://doi.org/10.5281/zenodo.23429017) · Prior `v2`: [`10.5281/zenodo.23436152`](https://doi.org/10.5281/zenodo.23436152)) · **Elsevier SSRN:** [`10.2139/ssrn.7631458`](https://ssrn.com/abstract=7631458) · **Software Heritage SWHID:** [`swh:1:snp:dcae02ea...`](https://archive.softwareheritage.org/swh:1:snp:dcae02ea5d13bb6aa6a72b2624184c961e44c3a1;origin=https://github.com/YaroslavBaienko/marma-crypto-protocol) *(Note: Preprint DOIs and SWHIDs serve solely as immutable timestamped prior-art mirrors, not peer review; independent cryptographic code audits and GitHub issues are warmly welcomed).*
* **GPG Fingerprint (RSA-4096):** `3D5A ACFD E32C 98FE 8819 9D47 D2A2 C1C4 9164 673B`
* **Qualified Certificate Serial (КНЕДП):** `10FF6F932221FA00CB4407000000000130616768`

```bibtex
@techreport{baienko2026marmacrypto,
  author      = {Baienko, Yaroslav V.},
  title       = {Marma-256 (Marma-Crypto): Sub-Micron Dithered Quantization Index Modulation and Orthogonal Subspace Multiplexing on Overdetermined Planar Incidence Manifolds for Bijective 2D Vector Graphics Watermarking and Fragile Authentication},
  year        = {2026},
  version     = {v2.1.0 (Release v2.0-SIGPRO)},
  institution = {Elsevier Signal Processing (SIGPRO-D-26-04464) / CERN Zenodo / Elsevier SSRN},
  number      = {SIGPRO-D-26-04464; UKRNOIVI Patent Appl. a 2026 06266},
  doi         = {10.5281/zenodo.23510005},
  url         = {https://doi.org/10.5281/zenodo.23510005}
}
```

## ⚖️ License

* **Software & Source Code (`src/`, `bin/`, `nautilus-scripts/`):** Licensed under the **Apache License, Version 2.0** (including Explicit Patent Grant & Attribution Clauses).
* **Whitepapers & Mathematical Specification (`whitepaper/`):** Licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.


