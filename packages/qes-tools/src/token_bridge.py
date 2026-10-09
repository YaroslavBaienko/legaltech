#!/usr/bin/env python3
"""
token_bridge.py — Python ctypes bridge for IIT End-User CA cryptographic library (/opt/iit/eu/sw/euscp.so).
Provides secure interaction with Ukrainian hardware tokens (ЗНОК: Алмаз-1К, Кристал-1К, SecureToken-337).
"""

import sys
import os
import json
import base64
import ctypes
from pathlib import Path

# Paths to IIT native libraries
LIB_CANDIDATES = [
    "/opt/iit/eu/sw/euscp.so",
    str(Path(__file__).resolve().parent.parent / "opt" / "iit" / "eu" / "sw" / "euscp.so"),
    "/usr/lib/pkcs11/libeuscpt.so",
]

def load_euscp_lib():
    for p in LIB_CANDIDATES:
        if os.path.isfile(p):
            try:
                # Add library directory to dlopen search path
                libdir = os.path.dirname(p)
                current_ld = os.environ.get("LD_LIBRARY_PATH", "")
                if libdir not in current_ld.split(":"):
                    os.environ["LD_LIBRARY_PATH"] = f"{libdir}:{current_ld}"
                return ctypes.CDLL(p)
            except Exception:
                continue
    return None

class EU_KEY_MEDIA(ctypes.Structure):
    _fields_ = [
        ("typeIndex", ctypes.c_uint64),
        ("devIndex", ctypes.c_uint64),
        ("password", ctypes.c_char * 256),
    ]

# Common token typeIndex mapping in IIT EUSign
TOKEN_TYPES = {
    "03eb:9324": 1,  # ІІТ Алмаз-1К (USB CCID)
    "03eb:9325": 3,  # ІІТ Кристал-1К (USB CCID)
    "0483:5740": 17, # Автор SecureToken-337 (CCID)
    "1e9a:0337": 17, # Автор SecureToken-337
    "1e9a:0338": 18, # Автор SecureToken-338
    "0529:0620": 29, # SafeNet eToken 5110
}

def detect_tokens():
    lib = load_euscp_lib()
    devices = []
    if not lib:
        return {"detected": False, "tokens": [], "error": "Бібліотека euscp.so не знайдена"}

    lib.EUInitialize()
    buf = ctypes.create_string_buffer(256)

    # Check known hardware token types
    for hw_id, type_idx in TOKEN_TYPES.items():
        for dev_idx in range(5):
            rv = lib.EUEnumKeyMediaDevices(type_idx, dev_idx, buf)
            if rv == 0:
                dev_serial = buf.value.decode("cp1251", "ignore").strip()
                type_name_buf = ctypes.create_string_buffer(256)
                lib.EUEnumKeyMediaTypes(type_idx, type_name_buf)
                type_name = type_name_buf.value.decode("cp1251", "ignore").strip()
                devices.append({
                    "hwId": hw_id,
                    "typeIndex": type_idx,
                    "devIndex": dev_idx,
                    "serial": dev_serial,
                    "name": type_name,
                })
            else:
                break

    lib.EUFinalize()
    return {
        "detected": len(devices) > 0,
        "tokens": devices,
    }

def verify_pin(type_index, pin, dev_index=0):
    lib = load_euscp_lib()
    if not lib:
        return {"success": False, "error": "Бібліотека euscp.so не знайдена"}

    lib.EUInitialize()
    km = EU_KEY_MEDIA()
    km.typeIndex = int(type_index)
    km.devIndex = int(dev_index)
    km.password = pin.encode("utf-8")[:255]

    rv = lib.EUReadPrivateKey(ctypes.byref(km), None)
    if rv == 0:
        is_read = lib.EUIsPrivateKeyReaded()
        lib.EUResetPrivateKey()
        lib.EUFinalize()
        return {"success": True, "read": bool(is_read)}
    elif rv == 18 or rv == 0x12:
        lib.EUFinalize()
        return {"success": False, "error": "Невірний PIN-код доступу до апаратного токена (помилка 0x12).", "code": 18}
    else:
        lib.EUFinalize()
        return {"success": False, "error": f"Помилка взаємодії з токеном (код 0x{rv:02x}).", "code": rv}

def sign_file(type_index, pin, input_path, output_path, dev_index=0, is_append=False, is_internal=False):
    lib = load_euscp_lib()
    if not lib:
        return {"success": False, "error": "Бібліотека euscp.so не знайдена"}

    if not os.path.isfile(input_path):
        return {"success": False, "error": f"Вхідний файл не існує: {input_path}"}

    lib.EUInitialize()
    km = EU_KEY_MEDIA()
    km.typeIndex = int(type_index)
    km.devIndex = int(dev_index)
    km.password = pin.encode("utf-8")[:255]

    rv = lib.EUReadPrivateKey(ctypes.byref(km), None)
    if rv != 0:
        lib.EUFinalize()
        err_msg = "Невірний PIN-код доступу до апаратного токена." if rv in (18, 0x12) else f"Помилка читання ключа (код 0x{rv:02x})"
        return {"success": False, "error": err_msg, "code": rv}

    append_flag = 1 if is_append else 0
    internal_flag = 1 if is_internal else 0

    sign_rv = lib.EUSignFile(
        input_path.encode("utf-8"),
        output_path.encode("utf-8"),
        append_flag,
        internal_flag,
        None
    )

    lib.EUResetPrivateKey()
    lib.EUFinalize()

    if sign_rv == 0 and os.path.isfile(output_path):
        return {
            "success": True,
            "outputPath": output_path,
            "fileSize": os.path.getsize(output_path),
        }
    else:
        return {
            "success": False,
            "error": f"Помилка створення підпису токеном (код 0x{sign_rv:02x})",
            "code": sign_rv,
        }

def sign_data(type_index, pin, data_b64, dev_index=0, is_append=False):
    lib = load_euscp_lib()
    if not lib:
        return {"success": False, "error": "Бібліотека euscp.so не знайдена"}

    data_bytes = base64.b64decode(data_b64)

    lib.EUInitialize()
    km = EU_KEY_MEDIA()
    km.typeIndex = int(type_index)
    km.devIndex = int(dev_index)
    km.password = pin.encode("utf-8")[:255]

    rv = lib.EUReadPrivateKey(ctypes.byref(km), None)
    if rv != 0:
        lib.EUFinalize()
        err_msg = "Невірний PIN-код доступу до апаратного токена." if rv in (18, 0x12) else f"Помилка читання ключа (код 0x{rv:02x})"
        return {"success": False, "error": err_msg, "code": rv}

    p_sign = ctypes.POINTER(ctypes.c_ubyte)()
    sign_len = ctypes.c_ulong(0)
    append_flag = 1 if is_append else 0

    data_buf = (ctypes.c_ubyte * len(data_bytes)).from_buffer_copy(data_bytes)

    sign_rv = lib.EUSignData(
        data_buf,
        len(data_bytes),
        append_flag,
        ctypes.byref(p_sign),
        ctypes.byref(sign_len)
    )

    sig_b64 = None
    if sign_rv == 0 and p_sign and sign_len.value > 0:
        raw_sig = bytes(p_sign[:sign_len.value])
        sig_b64 = base64.b64encode(raw_sig).decode("ascii")
        lib.EUFreeMemory(p_sign)

    lib.EUResetPrivateKey()
    lib.EUFinalize()

    if sign_rv == 0 and sig_b64:
        return {
            "success": True,
            "signature": sig_b64,
            "length": len(raw_sig),
        }
    else:
        return {
            "success": False,
            "error": f"Помилка накладання підпису (код 0x{sign_rv:02x})",
            "code": sign_rv,
        }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No action specified"}))
        sys.exit(1)

    action = sys.argv[1]

    if action == "detect":
        res = detect_tokens()
        print(json.dumps(res, ensure_ascii=False))
        sys.exit(0)

    # For other actions, read JSON config from stdin or arguments
    raw_payload = sys.stdin.read()
    if not raw_payload.strip():
        print(json.dumps({"error": "Empty payload"}))
        sys.exit(1)

    try:
        req = json.loads(raw_payload)
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    if action == "verify-pin":
        type_idx = req.get("typeIndex", 1)
        pin = req.get("pin", "")
        dev_idx = req.get("devIndex", 0)
        res = verify_pin(type_idx, pin, dev_idx)
        print(json.dumps(res, ensure_ascii=False))
        sys.exit(0 if res.get("success") else 1)

    elif action == "sign-file":
        type_idx = req.get("typeIndex", 1)
        pin = req.get("pin", "")
        dev_idx = req.get("devIndex", 0)
        input_path = req.get("inputPath", "")
        output_path = req.get("outputPath", "")
        is_append = req.get("isAppend", False)
        is_internal = req.get("isInternal", False)
        res = sign_file(type_idx, pin, input_path, output_path, dev_idx, is_append, is_internal)
        print(json.dumps(res, ensure_ascii=False))
        sys.exit(0 if res.get("success") else 1)

    elif action == "sign-data":
        type_idx = req.get("typeIndex", 1)
        pin = req.get("pin", "")
        dev_idx = req.get("devIndex", 0)
        data_b64 = req.get("dataB64", "")
        is_append = req.get("isAppend", False)
        res = sign_data(type_idx, pin, data_b64, dev_idx, is_append)
        print(json.dumps(res, ensure_ascii=False))
        sys.exit(0 if res.get("success") else 1)

    else:
        print(json.dumps({"error": f"Unknown action: {action}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
