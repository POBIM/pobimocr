"""Utility helpers to detect available compute devices."""
import logging
import platform
from typing import Dict, Any

logger = logging.getLogger(__name__)


def get_device_info() -> Dict[str, Any]:
    """Detect and return device information (CUDA, MPS, or CPU)."""
    import torch

    device_info = {
        "type": "cpu",
        "name": "CPU",
        "cuda_available": False,
        "mps_available": False,
        "use_gpu": False,
        "craft_supports_cuda": False,
        "easyocr_gpu": False,
    }

    if torch.cuda.is_available():
        device_info["type"] = "cuda"
        device_info["name"] = torch.cuda.get_device_name(0)
        device_info["cuda_available"] = True
        device_info["use_gpu"] = True
        device_info["craft_supports_cuda"] = True
        device_info["easyocr_gpu"] = True
        logger.info("✓ CUDA GPU detected: %s", device_info["name"])
        logger.info("  CUDA version: %s", torch.version.cuda)
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device_info["type"] = "mps"
        device_info["name"] = f"Apple Silicon ({platform.machine()})"
        device_info["mps_available"] = True
        device_info["use_gpu"] = True
        device_info["easyocr_gpu"] = True
        logger.info("✓ MPS (Metal) GPU detected: %s", device_info["name"])
        logger.info("  PyTorch MPS backend enabled")
        logger.info("CRAFT currently supports CUDA only, falling back to CPU for detector")
    else:
        logger.info("⚠ No GPU detected, using CPU")
        logger.info("  Platform: %s", platform.machine())

    return device_info
