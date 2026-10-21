"""
Marma-Crypto v2.1 Python SDK (`marma_crypto`)
=============================================
Unified public SDK exposing:
- Step 1 (`Marma-Universal`): `build_perturbed_emblem_v21`, `recover_256bit_from_emblem_v21`,
  `modulate_arbitrary_2d_vertices`, `demodulate_arbitrary_2d_vertices`,
  `stamp_universal_svg_drawing`, `verify_universal_svg_drawing`
- Step 2 (`Deal-Room Batch & REST API`): `stamp_pdf_universal_v21`, `verify_pdf_universal_v21`,
  `batch_seal_dealroom`, `trace_leak_any_medium`, `MarmaDealRoomServer`, `dispatch_api_request`
- Step 3 (`Marma-Optical`): `encode_optical_codeword32`, `decode_optical_codeword32_soft`,
  `draw_optical_lotus_ring_pdf`, `render_optical_seal_png`, `extract_canary_from_raster_image`
"""

from .api_server import (
    API_VERSION,
    MarmaDealRoomServer,
    batch_seal_dealroom,
    dispatch_api_request,
    stamp_pdf_universal_v21,
    trace_leak_any_medium,
    verify_pdf_universal_v21,
)
from .optical_ecc import (
    compute_doc_tag6,
    decode_optical_codeword32_soft,
    draw_optical_lotus_ring_pdf,
    encode_optical_codeword32,
    extract_canary_from_raster_image,
    render_optical_seal_png,
)
from .universal_qim import (
    CANONICAL_CAD_POLYGON_CONTOURS,
    CANONICAL_CORPORATE_SHIELD_CONTOURS,
    CANONICAL_TRYZUB_CONTOURS,
    SUPPORTED_EMBLEMS,
    build_perturbed_emblem_v21,
    demodulate_arbitrary_2d_vertices,
    get_canonical_emblem_contours,
    modulate_arbitrary_2d_vertices,
    recover_256bit_from_emblem_v21,
    stamp_universal_svg_drawing,
    verify_emblem_coordinates_v21,
    verify_universal_svg_drawing,
)

__version__ = API_VERSION

__all__ = [
    "API_VERSION",
    "__version__",
    "SUPPORTED_EMBLEMS",
    "CANONICAL_TRYZUB_CONTOURS",
    "CANONICAL_CORPORATE_SHIELD_CONTOURS",
    "CANONICAL_CAD_POLYGON_CONTOURS",
    "get_canonical_emblem_contours",
    "build_perturbed_emblem_v21",
    "recover_256bit_from_emblem_v21",
    "verify_emblem_coordinates_v21",
    "modulate_arbitrary_2d_vertices",
    "demodulate_arbitrary_2d_vertices",
    "stamp_universal_svg_drawing",
    "verify_universal_svg_drawing",
    "compute_doc_tag6",
    "encode_optical_codeword32",
    "decode_optical_codeword32_soft",
    "draw_optical_lotus_ring_pdf",
    "render_optical_seal_png",
    "extract_canary_from_raster_image",
    "stamp_pdf_universal_v21",
    "verify_pdf_universal_v21",
    "batch_seal_dealroom",
    "trace_leak_any_medium",
    "dispatch_api_request",
    "MarmaDealRoomServer",
]
