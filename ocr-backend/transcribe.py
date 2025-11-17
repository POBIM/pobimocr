"""
Speech-to-Text Module using faster-whisper
Supports CUDA, MPS (Apple Silicon), and CPU
"""

from faster_whisper import WhisperModel
import sys
import os
import logging
from typing import Optional, Dict, Any, Generator
import threading
import time

logger = logging.getLogger(__name__)

# Global model cache to avoid reloading
_model_cache = {}

# Default device configuration
_device_config = None

# Runtime flag to permanently disable CUDA for speech-to-text when it's unusable
_force_cpu_mode = False
_cuda_disable_reason = None

CUDA_LARGE_MODELS = {"large", "large-v1", "large-v2", "large-v3"}
DEFAULT_CUDA_COMPUTE_TYPE = os.getenv("TRANSCRIBE_CUDA_COMPUTE_TYPE", "float16")
DEFAULT_LARGE_COMPUTE_TYPE = os.getenv("TRANSCRIBE_LARGE_COMPUTE_TYPE", "int8")
MIN_GPU_GB_FOR_LARGE = float(os.getenv("TRANSCRIBE_MIN_GPU_GB_FOR_LARGE", "6"))


def _env_force_cpu_enabled() -> bool:
    value = os.getenv("TRANSCRIBE_FORCE_CPU")
    if value is None:
        return False
    return value.strip().lower() in ("1", "true", "yes", "on")


def _short_error_message(message: Optional[str]) -> str:
    """Return a concise single-line error description."""
    if not message:
        return "unknown error"
    return message.strip().splitlines()[0]


def _disable_cuda_for_transcribe(reason: Optional[str]):
    """
    Disable CUDA usage within this module when the environment misses
    required libraries (e.g. cuDNN) so we can fall back to CPU safely.
    """
    global _force_cpu_mode, _cuda_disable_reason
    if _force_cpu_mode:
        return
    _force_cpu_mode = True
    _cuda_disable_reason = _short_error_message(reason)
    logger.warning(
        "Disabling CUDA for speech-to-text: %s",
        _cuda_disable_reason,
    )


def _cuda_dependencies_available():
    """
    Check if required CUDA/CuDNN shared objects exist on disk.
    We avoid fully loading them because some deployments (WSL, mixed CUDA installs)
    can surface transient symbol resolution warnings even though the files are present.
    """
    required_libs = [
        "libcudnn_cnn.so.9",
        "libcudnn_ops.so.9",
        "libcudnn.so.9",
    ]

    search_paths = []
    search_paths.extend([
        "/usr/lib/x86_64-linux-gnu",
        "/usr/lib64",
        "/usr/lib",
        "/lib/x86_64-linux-gnu",
        "/lib",
        "/usr/local/lib",
        "/usr/local/cuda/lib64",
        "/usr/local/cuda-12.6/lib64",
    ])

    ld_paths = os.environ.get("LD_LIBRARY_PATH", "")
    if ld_paths:
        search_paths.extend([p for p in ld_paths.split(":") if p])

    for lib in required_libs:
        found = False
        for directory in search_paths:
            candidate = os.path.join(directory, lib)
            if os.path.exists(candidate):
                found = True
                break

        if not found:
            reason = f"required CUDA library missing ({lib})"
            return False, reason

    return True, None


def _cache_key(model_size: str, device: str, compute_type: str) -> str:
    return f"{model_size}_{device}_{compute_type}"


def _create_model_instance(model_size: str, device: str, compute_type: str):
    """
    Create a WhisperModel instance for the requested device.
    Raises the underlying exception if creation fails.
    """
    if device == "cuda":
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        logger.info(
            "Creating WhisperModel (%s) on CUDA with compute_type=%s",
            model_size,
            compute_type,
        )
        return WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            num_workers=1,  # ลดเหลือ 1 worker เพื่อหลีกเลี่ยงปัญหา threading
        )

    logger.info(
        "Creating WhisperModel (%s) on CPU with compute_type=%s",
        model_size,
        compute_type,
    )
    return WhisperModel(
        model_size,
        device=device,
        compute_type=compute_type,
        cpu_threads=8,
        num_workers=1,  # ลดเหลือ 1 worker
    )


def _get_or_create_model(model_size: str, device: str, compute_type: str):
    """
    Return a cached WhisperModel or create a new one for the requested device.
    """
    key = _cache_key(model_size, device, compute_type)
    if key in _model_cache:
        logger.info("Using cached WhisperModel: %s", key)
        return _model_cache[key]

    model = _create_model_instance(model_size, device, compute_type)
    _model_cache[key] = model
    return model


def set_device_config(config: Dict[str, Any]):
    """Set device configuration from main.py"""
    global _device_config
    _device_config = config
    logger.info(f"Transcribe module device config set: {config}")

    if _env_force_cpu_enabled():
        _disable_cuda_for_transcribe("TRANSCRIBE_FORCE_CPU is enabled")
        return

    if config.get('type') == 'cuda':
        ready, reason = _cuda_dependencies_available()
        if not ready:
            _disable_cuda_for_transcribe(reason or "missing CUDA dependencies")


def _select_cuda_compute_type(model_size: Optional[str]) -> str:
    """Choose CUDA compute_type based on requested model size."""
    normalized = (model_size or "").lower()
    if normalized in CUDA_LARGE_MODELS:
        return DEFAULT_LARGE_COMPUTE_TYPE
    return DEFAULT_CUDA_COMPUTE_TYPE


def _has_enough_gpu_memory_for_large() -> bool:
    try:
        import torch
        props = torch.cuda.get_device_properties(0)
        total_gb = props.total_memory / (1024 ** 3)
        return total_gb >= MIN_GPU_GB_FOR_LARGE
    except Exception:
        return False


def get_device_and_compute_type(model_size: Optional[str] = None):
    """
    Get device and compute_type based on device_config and requested model.
    Returns: (device, compute_type)
    """
    if _force_cpu_mode:
        return "cpu", "int8"

    if _device_config is None:
        # Fallback: auto-detect
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda", _select_cuda_compute_type(model_size)
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return "cpu", "int8"
            else:
                return "cpu", "int8"
        except Exception:
            return "cpu", "int8"

    device_type = _device_config.get('type', 'cpu')

    if device_type == 'cuda':
        return "cuda", _select_cuda_compute_type(model_size)
    elif device_type == 'mps':
        return "cpu", "int8"
    else:
        return "cpu", "int8"


def _run_whisper_transcription(model, file_path, transcribe_params):
    """
    Execute Whisper transcription - simple approach.
    """
    # ลด memory usage สำหรับ large models
    if not transcribe_params.get('beam_size'):
        # Beam=16 ทำให้ CUDA crash บน large model ใน WSL; ลดลงเพื่อความเสถียร
        transcribe_params['beam_size'] = 4
    if not transcribe_params.get('best_of'):
        transcribe_params['best_of'] = 4

    logger.info(f"Calling model.transcribe with params: {transcribe_params}")
    segments, info = model.transcribe(file_path, **transcribe_params)

    logger.info("Processing segments...")
    text_parts = []
    segment_objs = []

    for seg in segments:
        text_parts.append(seg.text)
        segment_objs.append({
            'start': seg.start,
            'end': seg.end,
            'text': seg.text
        })

    full_text = ' '.join(text_parts)
    language = getattr(info, "language", "unknown")

    logger.info(f"Result ready: {len(full_text)} chars, {len(segment_objs)} segments, lang={language}")

    return {
        'text': full_text,
        'language': language,
        'segments': segment_objs
    }


def transcribe_audio(
    file_path: str,
    model_size: str = "base",
    language: str = "th",
    initial_prompt: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Transcribe audio/video file to text - ไม่ใช้ cache, สร้าง model ใหม่ทุกครั้ง

    Args:
        file_path: Path to audio/video file
        model_size: Model size (tiny, base, small, medium, large)
        language: Language code (th, en, auto for auto-detect)
        initial_prompt: Optional prompt to guide transcription

    Returns:
        Dict with 'text', 'language', and 'segments'
    """

    # Check if file exists
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return None

    device, compute_type = get_device_and_compute_type(model_size)
    logger.info(f"Loading faster-whisper model ({model_size}) on {device} with {compute_type}")

    current_device = device

    # สร้าง model ใหม่ทุกครั้ง ไม่ใช้ cache เพื่อหลีกเลี่ยงปัญหา CUDA context
    try:
        model = _create_model_instance(model_size, device, compute_type)
    except Exception as e:
        logger.error(f"Failed to load model on {device}: {str(e)}")
        if device == "cuda":
            short_reason = _short_error_message(str(e))
            logger.warning(f"Falling back to CPU: {short_reason}")
            _disable_cuda_for_transcribe(short_reason)
            current_device = "cpu"
            compute_type = "int8"
            try:
                model = _create_model_instance(model_size, current_device, compute_type)
            except Exception as cpu_error:
                logger.error(f"Failed to load CPU model: {cpu_error}")
                return None
        else:
            return None

    logger.info(f"Transcribing file: {file_path} using {current_device}")

    # Prepare transcribe parameters
    transcribe_params = {}
    if language != "auto":
        transcribe_params["language"] = language
    if initial_prompt:
        transcribe_params["initial_prompt"] = initial_prompt

    try:
        result = _run_whisper_transcription(model, file_path, transcribe_params)
        # ลบ model ทันทีหลังใช้งาน
        del model
        if current_device == "cuda":
            import torch
            torch.cuda.empty_cache()
        return result
    except Exception as e:
        logger.error(f"Transcription failed on {current_device}: {str(e)}")
        del model
        if current_device == "cuda":
            import torch
            torch.cuda.empty_cache()

            short_reason = _short_error_message(str(e))
            logger.warning(f"Retrying on CPU: {short_reason}")
            _disable_cuda_for_transcribe(short_reason)
            try:
                cpu_model = _create_model_instance(model_size, "cpu", "int8")
                result = _run_whisper_transcription(cpu_model, file_path, transcribe_params)
                del cpu_model
                return result
            except Exception as cpu_error:
                logger.error(f"CPU fallback failed: {cpu_error}")
                return None
        return None


def transcribe_audio_stream(
    file_path: str,
    model_size: str = "base",
    language: str = "th",
    chunk_duration: int = 0,
    initial_prompt: Optional[str] = None
) -> Generator[str, None, None]:
    """
    Generator that yields progress strings and transcript segments
    Format:
      - "STATUS: ...\n" for status updates
      - "LANG: <code>\n" for detected language
      - "SEG: <text>\n" for each transcript segment
      - "DONE\n" when finished

    Args:
        file_path: Path to audio/video file
        model_size: Model size (tiny, base, small, medium, large)
        language: Language code (th, en, auto)
        chunk_duration: Duration of each chunk in seconds (0 = disabled)
        initial_prompt: Optional prompt to guide transcription
    """
    logger.info(f"transcribe_audio_stream called: file={file_path}, model={model_size}, lang={language}")
    try:
        if not os.path.exists(file_path):
            yield f"STATUS: ไฟล์ไม่พบ: {file_path}\n"
            yield "DONE\n"
            return

        device, compute_type = get_device_and_compute_type(model_size)
        current_device = device
        fallback_notice = None

        yield "STATUS: อัพโหลดไฟล์สำเร็จ\n"

        if current_device == "cuda":
            try:
                import torch
                if torch.cuda.is_available():
                    gpu_name = torch.cuda.get_device_name(0)
                    yield f"STATUS: ใช้ GPU: {gpu_name}\n"
                    torch.cuda.empty_cache()
                else:
                    yield "STATUS: ตรวจไม่พบ GPU ใน PyTorch จะใช้ CPU แทน\n"
                    current_device = "cpu"
                    compute_type = "int8"
            except Exception as torch_error:
                logger.warning(f"Unable to query CUDA device: {torch_error}")
                yield "STATUS: ตรวจสอบ GPU ไม่สำเร็จ จะลองใช้งานต่อไป\n"
        else:
            if _force_cpu_mode and _cuda_disable_reason:
                yield f"STATUS: ใช้ CPU (GPU ไม่พร้อมใช้งาน: {_cuda_disable_reason})\n"
            elif _device_config and _device_config.get('type') == 'mps':
                yield "STATUS: ใช้ Apple Silicon (CPU mode สำหรับ Whisper)\n"
            else:
                yield "STATUS: ใช้ CPU\n"

        transcribe_params = {}
        if language != "auto":
            transcribe_params["language"] = language
        if initial_prompt:
            transcribe_params["initial_prompt"] = initial_prompt

        model = None

        while True:
            cache_key = _cache_key(model_size, current_device, compute_type)
            if cache_key in _model_cache:
                model = _model_cache[cache_key]
                yield f"STATUS: ใช้โมเดลที่แคชไว้ ({model_size}) บน {current_device}\n"
                break

            yield f"STATUS: กำลังดาวน์โหลดและโหลดโมเดล Whisper ({model_size})...\n"
            yield "STATUS: โปรดรอสักครู่ (โมเดลขนาดใหญ่อาจใช้เวลานาน)\n"
            sys.stdout.flush()

            # Clear GPU memory aggressively before loading large models
            if current_device == "cuda" and model_size.lower() in CUDA_LARGE_MODELS:
                yield "STATUS: กำลังเตรียม GPU memory สำหรับ large model...\n"
                yield "STATUS: กำลังปล่อย GPU memory จาก OCR models...\n"
                try:
                    import torch
                    import gc

                    # ลบ OCR model caches ชั่วคราว
                    try:
                        import main
                        if hasattr(main, 'craft_detectors'):
                            main.craft_detectors.clear()
                            logger.info("Cleared CRAFT detector cache")
                        if hasattr(main, 'ocr_readers'):
                            main.ocr_readers.clear()
                            logger.info("Cleared OCR reader cache")
                    except Exception as e:
                        logger.warning(f"Could not clear OCR caches: {e}")

                    # Force garbage collection และ clear CUDA cache
                    gc.collect()
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()

                    # แสดง memory ที่เหลือ
                    try:
                        mem_free = torch.cuda.mem_get_info()[0] / (1024**3)
                        logger.info(f"GPU memory freed. Available: {mem_free:.2f} GB")
                        yield f"STATUS: GPU memory พร้อมใช้งาน: {mem_free:.1f} GB\n"
                    except:
                        pass
                except Exception as e:
                    logger.warning(f"Failed to clear GPU memory: {e}")

            try:
                model = _create_model_instance(model_size, current_device, compute_type)
                _model_cache[cache_key] = model
                if current_device == "cuda":
                    yield "STATUS: โหลดโมเดลสำเร็จ - ใช้ GPU INT8 quantization\n"
                else:
                    yield "STATUS: โหลดโมเดลสำเร็จ - ใช้ CPU INT8 quantization (8 threads)\n"
                break
            except Exception as load_error:
                short_reason = _short_error_message(str(load_error))
                logger.error(f"Failed to load Whisper model on {current_device}: {short_reason}")
                if current_device == "cuda":
                    _disable_cuda_for_transcribe(short_reason)
                    yield f"STATUS: ไม่สามารถใช้ GPU ได้ ({short_reason}) กำลังสลับไปใช้ CPU\n"
                    current_device = "cpu"
                    compute_type = "int8"
                    continue
                else:
                    yield f"STATUS: ไม่สามารถโหลดโมเดลได้: {short_reason}\n"
                    yield "DONE\n"
                    return

        yield "STATUS: เริ่มถอดเสียง...\n"
        yield "STATUS: กำลังประมวลผลไฟล์เสียง...\n"

        result = None
        error_occurred = False

        def transcribe_with_progress():
            nonlocal result, error_occurred, fallback_notice, current_device, model
            try:
                logger.info(f"Starting transcription in thread: {file_path} on {current_device}")
                result = _run_whisper_transcription(model, file_path, transcribe_params)
            except Exception as err:
                short_reason = _short_error_message(str(err))
                logger.error(f"Error in transcribe_with_progress on {current_device}: {short_reason}")
                if current_device == "cuda":
                    _disable_cuda_for_transcribe(short_reason)
                    fallback_notice = f"STATUS: พบปัญหากับ GPU ({short_reason}) กำลังใช้ CPU แทน\n"
                    try:
                        model = _get_or_create_model(model_size, "cpu", "int8")
                        current_device = "cpu"
                        result = _run_whisper_transcription(model, file_path, transcribe_params)
                    except Exception as cpu_retry_error:
                        error_occurred = f"{short_reason} (CPU retry failed: {cpu_retry_error})"
                else:
                    error_occurred = short_reason

        thread = threading.Thread(target=transcribe_with_progress)
        thread.start()

        progress_messages = [
            "กำลังวิเคราะห์ไฟล์เสียง...",
            "กำลังแปลงคลื่นเสียง...",
            "กำลังประมวลผลด้วย AI...",
            "เกือบเสร็จแล้ว...",
            "กำลังจัดเรียงข้อความ..."
        ]

        progress_idx = 0
        while thread.is_alive():
            if progress_idx < len(progress_messages):
                yield f"STATUS: {progress_messages[progress_idx]}\n"
                progress_idx += 1
            time.sleep(2)

        thread.join()

        logger.info(f"Thread completed. error_occurred: {error_occurred}, result: {result is not None}")

        if error_occurred:
            yield f"STATUS: ข้อผิดพลาดในการถอดเสียง: {error_occurred}\n"
            yield "DONE\n"
            return

        if not result:
            logger.error("Result is None after thread completion!")
            yield "STATUS: ไม่ได้รับผลลัพธ์จากการถอดเสียง\n"
            yield "DONE\n"
            return

        if fallback_notice:
            yield fallback_notice

        lang = result.get("language", "unknown")
        logger.info(f"Sending LANG: {lang}")
        yield f"LANG: {lang}\n"

        segments = result.get("segments", [])
        logger.info(f"Processing {len(segments)} segments")
        sys.stdout.flush()

        if segments:
            yield f"STATUS: ส่งผลลัพธ์ทีละช่วงประโยค ({len(segments)} ช่วง)...\n"
            sys.stdout.flush()
            for seg in segments:
                text = seg.get("text", "").strip()
                if text:
                    logger.info(f"Yielding segment: {text[:50]}...")
                    yield f"SEG: {text}\n"
                    sys.stdout.flush()
        else:
            full = (result.get("text") or "").strip()
            if full:
                logger.info(f"No segments, yielding full text: {full[:50]}...")
                yield f"SEG: {full}\n"
                sys.stdout.flush()

        logger.info("Yielding DONE")
        yield "DONE\n"
        sys.stdout.flush()

    except Exception as e:
        logger.error(f"transcribe_audio_stream exception: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        yield f"STATUS: เกิดข้อผิดพลาด: {str(e)}\n"
        yield "DONE\n"


def get_available_models():
    """Get list of available Whisper models"""
    return [
        {'value': 'tiny', 'label': 'Tiny - เร็ว (39MB)', 'size': '39MB'},
        {'value': 'base', 'label': 'Base - แนะนำ (139MB)', 'size': '139MB'},
        {'value': 'small', 'label': 'Small - ดีขึ้น (244MB)', 'size': '244MB'},
        {'value': 'medium', 'label': 'Medium - ดีมาก (769MB)', 'size': '769MB'},
        {'value': 'large', 'label': 'Large - ดีที่สุด (2.9GB)', 'size': '2.9GB'},
    ]


def get_available_languages():
    """Get list of available languages"""
    return [
        {'value': 'auto', 'label': 'ตรวจจับอัตโนมัติ'},
        {'value': 'th', 'label': 'ไทย'},
        {'value': 'en', 'label': 'English'},
        {'value': 'zh', 'label': '中文'},
        {'value': 'ja', 'label': '日本語'},
        {'value': 'ko', 'label': '한국어'},
    ]
