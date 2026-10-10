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
import shutil
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

def init_eusign(lib):
    """
    Initializes EUSign library with a user-writable configuration directory
    and synchronized certificate store. Calling EUSetSettingsFilePath BEFORE
    EUInitialize is required to avoid read-only failures on /opt/iit/eu/sw/osplm.ini.
    """
    cfg_dir = Path.home() / ".local/share/qes-tools"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    user_ini = cfg_dir / "osplm.ini"
    stock_ini = Path("/opt/iit/eu/sw/osplm.ini")

    if not user_ini.exists():
        if stock_ini.exists():
            try:
                shutil.copy(stock_ini, user_ini)
            except Exception:
                pass
        if not user_ini.exists():
            try:
                store_dir = cfg_dir / "certificates"
                user_ini.write_text(f"""[\\SOFTWARE\\Institute of Informational Technologies\\Certificate Authority-1.3\\End User]
[\\SOFTWARE\\Institute of Informational Technologies\\Certificate Authority-1.3\\End User\\FileStore]
ExpireTime=3600
SaveLoadedCerts=1
AutoDownloadCRLs=0
FullAndDeltaCRLs=1
OnlyOwnCRLs=1
AutoRefresh=0
CheckCRLs=0
Path={store_dir}
""")
            except Exception:
                pass

    try:
        lib.EUSetSettingsFilePath(str(cfg_dir).encode("utf-8"))
    except Exception:
        pass

    lib.EUInitialize()
    ensure_filestore_initialized(lib)

def detect_tokens():
    lib = load_euscp_lib()
    devices = []
    if not lib:
        return {"detected": False, "tokens": [], "error": "Бібліотека euscp.so не знайдена"}

    init_eusign(lib)
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

def ensure_filestore_initialized(lib):
    """
    Initializes EUSign certificate store from ~/.local/share/qes-tools/certificates
    and loads all national CA bundles and user certificates.
    """
    store_dir = Path.home() / ".local/share/qes-tools/certificates"
    store_dir.mkdir(parents=True, exist_ok=True)

    # Search user certificates across ~/.secure_keys, ~/test_kep, and system locations
    search_dirs = [
        Path.home() / ".secure_keys",
        Path.home() / "test_kep",
        Path("/usr/lib/qes-tools/certs"),
        Path("/var/lib/qes-tools/certificates"),
        Path(__file__).resolve().parent.parent / "certs",
    ]

    for sdir in search_dirs:
        if sdir.is_dir():
            for cf in sdir.glob("*.cer"):
                dest = store_dir / cf.name
                if not dest.exists() or dest.stat().st_size == 0:
                    try:
                        dest.write_bytes(cf.read_bytes())
                    except Exception:
                        pass

    # If store has few certificates, unpack from ua-all-cas.p7b
    if len(list(store_dir.glob("*.cer"))) < 20:
        for p7b_cand in [
            Path("/usr/lib/qes-tools/certs/ua-all-cas.p7b"),
            Path(__file__).resolve().parent.parent / "certs" / "ua-all-cas.p7b",
        ]:
            if p7b_cand.is_file():
                try:
                    from cryptography.hazmat.primitives.serialization import pkcs7
                    from cryptography.hazmat.primitives import serialization
                    certs = pkcs7.load_der_pkcs7_certificates(p7b_cand.read_bytes())
                    for c in certs:
                        c_name = f"ca_{c.serial_number:X}.cer"
                        dest = store_dir / c_name
                        if not dest.exists():
                            dest.write_bytes(c.public_bytes(serialization.Encoding.DER))
                except Exception:
                    pass

    try:
        lib.EUSetFileStoreSettings(str(store_dir).encode("utf-8"), 0, 0, 1, 1, 0, 1, 3600)
    except Exception:
        pass

    try:
        if hasattr(lib, "EURefreshFileStore"):
            lib.EURefreshFileStore()
    except Exception:
        pass

    for cf in store_dir.glob("*.cer"):
        try:
            data = cf.read_bytes()
            buf = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
            lib.EUSaveCertificate(buf, len(data))
        except Exception:
            pass

def get_error_message(lib, rv):
    if rv in (18, 0x12):
        return "Невірний PIN-код доступу до апаратного токена (помилка 0x12)."
    if rv in (51, 0x33):
        return "Сертифікат не знайдено (код 0x33). Переконайтеся, що файл .cer завантажено у ~/.secure_keys/ або ~/.local/share/qes-tools/certificates/."
    if rv in (49, 0x31):
        return "Помилка файлового сховища сертифікатів (код 0x31)."
    try:
        lib.EUGetErrorLangDesc.restype = ctypes.c_char_p
        lib.EUGetErrorLangDesc.argtypes = [ctypes.c_uint64, ctypes.c_uint64]
        desc = lib.EUGetErrorLangDesc(rv, 1) # 1 = Ukrainian
        if desc:
            return f"{desc.decode('cp1251', 'ignore')} (код 0x{rv:02x})"
    except Exception:
        pass
    return f"Помилка взаємодії з апаратним токеном (код 0x{rv:02x})"

def verify_pin(type_index, pin, dev_index=0):
    lib = load_euscp_lib()
    if not lib:
        return {"success": False, "error": "Бібліотека euscp.so не знайдена"}

    init_eusign(lib)
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
    else:
        lib.EUFinalize()
        return {"success": False, "error": get_error_message(lib, rv), "code": rv}

def sign_file(type_index, pin, input_path, output_path, dev_index=0, is_append=False, is_internal=False):
    lib = load_euscp_lib()
    if not lib:
        return {"success": False, "error": "Бібліотека euscp.so не знайдена"}

    if not os.path.isfile(input_path):
        return {"success": False, "error": f"Вхідний файл не існує: {input_path}"}

    init_eusign(lib)
    km = EU_KEY_MEDIA()
    km.typeIndex = int(type_index)
    km.devIndex = int(dev_index)
    km.password = pin.encode("utf-8")[:255]

    rv = lib.EUReadPrivateKey(ctypes.byref(km), None)
    if rv != 0:
        lib.EUFinalize()
        return {"success": False, "error": get_error_message(lib, rv), "code": rv}

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

    init_eusign(lib)
    km = EU_KEY_MEDIA()
    km.typeIndex = int(type_index)
    km.devIndex = int(dev_index)
    km.password = pin.encode("utf-8")[:255]

    rv = lib.EUReadPrivateKey(ctypes.byref(km), None)
    if rv != 0:
        lib.EUFinalize()
        return {"success": False, "error": get_error_message(lib, rv), "code": rv}

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
