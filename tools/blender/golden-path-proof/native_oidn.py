"""Use Blender's bundled OpenImageDenoise when the Python wheel is unavailable.

Set GP_OIDN_LIBRARY to libOpenImageDenoise.dylib/.so. Uses the same CPU RT
filter, HDR flag and float RGB buffers as render_review's Python binding.
API: https://www.openimagedenoise.org/documentation.html
"""
import ctypes as ct
import functools
import os

import numpy as np


@functools.lru_cache(maxsize=1)
def library():
    lib = ct.CDLL(os.environ["GP_OIDN_LIBRARY"])
    signatures = {
        "oidnNewDevice": ([ct.c_int], ct.c_void_p),
        "oidnCommitDevice": ([ct.c_void_p], None),
        "oidnReleaseDevice": ([ct.c_void_p], None),
        "oidnGetDeviceError": ([ct.c_void_p, ct.POINTER(ct.c_char_p)], ct.c_int),
        "oidnNewFilter": ([ct.c_void_p, ct.c_char_p], ct.c_void_p),
        "oidnSetSharedFilterImage": ([ct.c_void_p, ct.c_char_p, ct.c_void_p, ct.c_int] + [ct.c_size_t] * 5, None),
        "oidnSetFilterBool": ([ct.c_void_p, ct.c_char_p, ct.c_bool], None),
        "oidnCommitFilter": ([ct.c_void_p], None),
        "oidnExecuteFilter": ([ct.c_void_p], None),
        "oidnReleaseFilter": ([ct.c_void_p], None),
    }
    for name, (args, result) in signatures.items():
        fn = getattr(lib, name)
        fn.argtypes, fn.restype = args, result
    return lib


def denoise(rgb):
    lib = library()
    src = np.ascontiguousarray(rgb[..., :3], dtype=np.float32)
    h, w, _ = src.shape
    out = np.empty_like(src)
    device = lib.oidnNewDevice(1)  # OIDN_DEVICE_TYPE_CPU
    filt = None

    def check():
        message = ct.c_char_p()
        if lib.oidnGetDeviceError(device, ct.byref(message)):
            raise RuntimeError(message.value.decode() if message.value else "OIDN failure")

    try:
        lib.oidnCommitDevice(device)
        check()
        filt = lib.oidnNewFilter(device, b"RT")
        for name, buf in ((b"color", src), (b"output", out)):
            lib.oidnSetSharedFilterImage(filt, name, buf.ctypes.data, 3, w, h, 0, 0, 0)
        lib.oidnSetFilterBool(filt, b"hdr", True)
        lib.oidnCommitFilter(filt)
        lib.oidnExecuteFilter(filt)
        check()
        return out
    finally:
        if filt:
            lib.oidnReleaseFilter(filt)
        lib.oidnReleaseDevice(device)
