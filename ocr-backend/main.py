from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import cv2
import numpy as np
from craft_text_detector import Craft
import easyocr
import io
from PIL import Image
import logging
import json
import os
import tempfile
from typing import Optional
import subprocess
import sys
from qwen_corrector import get_corrector, release_corrector, RELEASE_AFTER_USE
from device_info import get_device_info
import transcribe

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Thai OCR API with CRAFT",
    description="High-accuracy OCR API using CRAFT text detection and EasyOCR",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Next.js domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models (initialized on startup)
craft_detectors = {}  # Cache CRAFT detectors by (long_size, refiner)
ocr_readers = {}  # Cache of OCR readers by language combination
device_config = None


def _env_bool(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        logger.warning(f"Invalid integer for {name}: {value!r}, using {default}")
        return default


CRAFT_LONG_SIZE_MIN = 480
CRAFT_LONG_SIZE_MAX = 2560


def apply_craft_numpy_patch():
    """
    Patch craft_text_detector so it keeps working after NumPy 2.0 tightened
    ragged-array handling (which would otherwise raise ValueError).
    """
    try:
        import craft_text_detector.craft_utils as craft_utils
        import craft_text_detector.predict as craft_predict
        import craft_text_detector.file_utils as craft_file_utils
        import craft_text_detector.image_utils as craft_image_utils
    except ImportError:
        return

    class _NumpyCompatHelper:
        def __init__(self, base_np):
            self._base = base_np

        def array(self, *args, **kwargs):
            try:
                return self._base.array(*args, **kwargs)
            except ValueError as exc:
                message = str(exc)
                if (
                    "inhomogeneous shape" in message
                    or "setting an array element with a sequence" in message
                ) and "dtype" not in kwargs:
                    return self._base.array(*args, dtype=object, **kwargs)
                raise

        def __getattr__(self, name):
            return getattr(self._base, name)

    def _patch_module(module):
        if not hasattr(module, "np"):
            return
        if getattr(module, "_pobimocr_np_patched", False):
            return
        module.np = _NumpyCompatHelper(module.np)
        module._pobimocr_np_patched = True

    for mod in (
        craft_utils,
        craft_predict,
        craft_file_utils,
        craft_image_utils,
    ):
        _patch_module(mod)


apply_craft_numpy_patch()


def _parse_craft_request_settings(long_size_param, refiner_param):
    """Resolve requested CRAFT settings with validation and defaults."""
    global device_config
    if device_config is None:
        base_long = 1280
        base_refiner = True
    else:
        base_long = device_config.get("craft_long_size", 1280)
        base_refiner = device_config.get("craft_refiner", True)

    selected_long = base_long
    selected_refiner = base_refiner

    if long_size_param:
        try:
            parsed = int(long_size_param)
            if parsed < CRAFT_LONG_SIZE_MIN or parsed > CRAFT_LONG_SIZE_MAX:
                logger.warning(
                    f"CRAFT long_size {parsed} outside allowed range "
                    f"({CRAFT_LONG_SIZE_MIN}-{CRAFT_LONG_SIZE_MAX}), using {base_long}"
                )
            else:
                selected_long = parsed
        except ValueError:
            logger.warning(f"Invalid craft_long_size value {long_size_param!r}, using {base_long}")

    if refiner_param:
        selected_refiner = refiner_param.strip().lower() in ("1", "true", "yes", "on")

    return selected_long, selected_refiner


def get_craft_detector(long_size=None, refiner=None):
    """Return a cached CRAFT detector for requested settings."""
    global craft_detectors, device_config
    if device_config is None:
        device_config = get_device_info()

    target_long = long_size if long_size is not None else device_config.get("craft_long_size", 1280)
    target_refiner = refiner if refiner is not None else device_config.get("craft_refiner", True)

    key = (target_long, target_refiner)
    if key not in craft_detectors:
        logger.info(
            f"Initializing CRAFT detector (long_size={target_long}, refiner={target_refiner})"
        )
        craft_detectors[key] = Craft(
            output_dir=None,
            crop_type="poly",
            cuda=device_config.get("craft_supports_cuda", False),
            long_size=target_long,
            refiner=target_refiner,
        )
    return craft_detectors[key]


@app.on_event("startup")
async def startup_event():
    """Initialize models on startup"""
    global ocr_readers, device_config

    # Detect device (CUDA, MPS, or CPU)
    device_config = get_device_info()
    use_cuda = device_config["craft_supports_cuda"]
    easyocr_gpu = device_config["easyocr_gpu"]
    default_long_size = 1280
    default_refiner = True

    # CPU-only mode benefits from smaller input + no refiner for big speedups
    if not use_cuda:
        default_long_size = 960
        default_refiner = False

    craft_long_size = _env_int("CRAFT_LONG_SIZE", default_long_size)
    craft_use_refiner = _env_bool("CRAFT_USE_REFINER", default_refiner)
    device_config["craft_long_size"] = craft_long_size
    device_config["craft_refiner"] = craft_use_refiner

    logger.info(
        f"CRAFT settings -> cuda={use_cuda}, long_size={craft_long_size}, refiner={craft_use_refiner}"
    )

    logger.info("Initializing CRAFT text detector cache...")
    craft_detectors.clear()
    get_craft_detector(long_size=craft_long_size, refiner=craft_use_refiner)
    logger.info("Default CRAFT detector initialized successfully")

    logger.info("Pre-loading default EasyOCR reader for Thai and English...")
    ocr_readers['th,en'] = easyocr.Reader(['th', 'en'], gpu=easyocr_gpu)
    logger.info("Default EasyOCR reader initialized successfully")

    # Set device config for transcribe module
    logger.info("Initializing speech-to-text module...")
    transcribe.set_device_config(device_config)
    logger.info("Speech-to-text module initialized")


def get_ocr_reader(languages):
    """Get or create OCR reader for specified languages"""
    global ocr_readers, device_config
    import torch

    # Sort languages to ensure consistent cache key
    lang_key = ','.join(sorted(languages))

    if lang_key not in ocr_readers:
        logger.info(f"Creating new EasyOCR reader for languages: {languages}")
        # Fall back to torch.cuda availability if device_config is not set
        gpu_enabled = False
        if device_config:
            gpu_enabled = device_config["easyocr_gpu"]
        else:
            gpu_enabled = torch.cuda.is_available()
        ocr_readers[lang_key] = easyocr.Reader(languages, gpu=gpu_enabled)
        logger.info(f"EasyOCR reader for {languages} created successfully")

    return ocr_readers[lang_key]


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "message": "Thai OCR API with CRAFT is running",
        "endpoints": {
            "/ocr": "POST - Upload image for OCR processing",
            "/health": "GET - Check API health status"
        }
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "craft_loaded": len(craft_detectors) > 0,
        "craft_cached_configs": [{"long_size": key[0], "refiner": key[1]} for key in craft_detectors.keys()],
        "default_craft_settings": {
            "long_size": device_config.get("craft_long_size") if device_config else None,
            "refiner": device_config.get("craft_refiner") if device_config else None,
        },
        "ocr_readers_loaded": len(ocr_readers),
        "available_language_combinations": list(ocr_readers.keys())
    }


@app.post("/ocr")
async def process_ocr(
    file: UploadFile = File(...),
    languages: Optional[str] = Form(None),
    ai_correct: Optional[str] = Form("false"),
    craft_long_size: Optional[str] = Form(None),
    craft_use_refiner: Optional[str] = Form(None),
):
    """
    Process uploaded image with CRAFT + EasyOCR

    Args:
        file: Image file (jpg, png, etc.)
        languages: JSON string of language codes (e.g., '["th", "en"]')
        ai_correct: Enable AI correction with Qwen model ("true" or "false")

    Returns:
        JSON with detected text and bounding boxes
    """
    try:
        # Parse languages
        lang_list = ['th', 'en']  # default
        if languages:
            try:
                lang_list = json.loads(languages)
                if not isinstance(lang_list, list) or len(lang_list) == 0:
                    lang_list = ['th', 'en']
            except json.JSONDecodeError:
                logger.warning(f"Invalid languages format: {languages}, using default")
                lang_list = ['th', 'en']

        logger.info(f"Using languages: {lang_list}")

        # Determine requested CRAFT settings
        requested_long_size, requested_refiner = _parse_craft_request_settings(
            craft_long_size, craft_use_refiner
        )
        craft_settings = {
            "long_size": requested_long_size,
            "refiner": requested_refiner
        }

        # Get OCR reader for specified languages
        ocr_reader = get_ocr_reader(lang_list)
        detector = get_craft_detector(requested_long_size, requested_refiner)

        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        logger.info(f"Processing file: {file.filename}")

        # Read image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Step 1: Use CRAFT to detect text regions
        logger.info(
            f"Running CRAFT text detection (long_size={requested_long_size}, refiner={requested_refiner})..."
        )
        try:
            prediction_result = detector.detect_text(img)
        except Exception as e:
            logger.error(f"CRAFT detection failed: {str(e)}")
            # Fallback to simple OCR if CRAFT fails
            logger.info("Falling back to simple OCR mode...")
            results = ocr_reader.readtext(img, detail=1)
            
            all_text = []
            detailed_results = []
            
            for detection in results:
                bbox, text, confidence = detection
                if text.strip():
                    all_text.append(text)
                    # Convert bbox to simple coordinates
                    x_coords = [point[0] for point in bbox]
                    y_coords = [point[1] for point in bbox]
                    detailed_results.append({
                        "text": text,
                        "confidence": float(confidence),
                        "box": {
                            "x1": int(min(x_coords)),
                            "y1": int(min(y_coords)),
                            "x2": int(max(x_coords)),
                            "y2": int(max(y_coords))
                        }
                    })
            
            combined_text = " ".join(all_text)

            # Apply AI correction if requested (fallback mode)
            ai_corrected_fallback = False
            if ai_correct and ai_correct.lower() == "true":
                try:
                    logger.info("Applying AI correction with Qwen (fallback mode)...")
                    corrector = get_corrector()
                    primary_lang = "thai" if "th" in lang_list else "english"
                    correction_result = corrector.correct(combined_text, language=primary_lang)

                    if correction_result["success"]:
                        combined_text = correction_result["corrected_text"]
                        ai_corrected_fallback = True
                except Exception as e:
                    logger.error(f"AI correction error (fallback): {str(e)}")
                finally:
                    if RELEASE_AFTER_USE:
                        release_corrector()

            return JSONResponse({
                "success": True,
                "text": combined_text,
                "total_regions": len(detailed_results),
                "recognized_regions": len(detailed_results),
                "details": detailed_results,
                "mode": "fallback_easyocr_only",
                "ai_corrected": ai_corrected_fallback,
                "craft_settings": craft_settings
            })
        
        boxes = prediction_result["boxes"]

        logger.info(f"CRAFT detected {len(boxes)} text regions")

        # Step 2: Use EasyOCR to recognize text in each box
        all_text = []
        detailed_results = []

        for idx, box in enumerate(boxes):
            try:
                # Convert box to list if it's not already
                if isinstance(box, np.ndarray):
                    box = box.tolist()
                
                # Ensure box is a list of coordinate pairs
                if not isinstance(box, list):
                    logger.warning(f"Box {idx} has unexpected type: {type(box)}")
                    continue
                
                # Flatten and extract coordinates more safely
                coords = []
                for point in box:
                    if isinstance(point, (list, tuple, np.ndarray)):
                        if len(point) >= 2:
                            coords.append([float(point[0]), float(point[1])])
                    else:
                        logger.warning(f"Box {idx} point has unexpected format: {point}")
                        continue
                
                if len(coords) < 3:
                    logger.warning(f"Box {idx} has insufficient points: {len(coords)}")
                    continue
                
                # Extract x and y coordinates
                x_coords = [c[0] for c in coords]
                y_coords = [c[1] for c in coords]

                x1, y1 = int(min(x_coords)), int(min(y_coords))
                x2, y2 = int(max(x_coords)), int(max(y_coords))

                # Add padding
                padding = 5
                x1 = max(0, x1 - padding)
                y1 = max(0, y1 - padding)
                x2 = min(img.shape[1], x2 + padding)
                y2 = min(img.shape[0], y2 + padding)

                # Crop the region
                cropped = img[y1:y2, x1:x2]

                if cropped.size == 0:
                    continue

                # Run OCR on cropped region
                result = ocr_reader.readtext(cropped, detail=1)

                for detection in result:
                    bbox, text, confidence = detection
                    if text.strip():  # Only include non-empty text
                        all_text.append(text)
                        detailed_results.append({
                            "text": text,
                            "confidence": float(confidence),
                            "box": {
                                "x1": x1,
                                "y1": y1,
                                "x2": x2,
                                "y2": y2
                            }
                        })
                        logger.info(f"Box {idx}: '{text}' (confidence: {confidence:.2f})")

            except Exception as e:
                logger.error(f"Error processing box {idx}: {str(e)}")
                continue

        # Combine all text
        combined_text = " ".join(all_text)

        logger.info(f"OCR completed. Total text blocks: {len(detailed_results)}")

        # Apply AI correction if requested
        ai_corrected = False
        if ai_correct and ai_correct.lower() == "true":
            try:
                logger.info("Applying AI correction with Qwen...")
                corrector = get_corrector()

                # Determine primary language
                primary_lang = "thai" if "th" in lang_list else "english"

                # Correct the combined text
                correction_result = corrector.correct(
                    combined_text,
                    language=primary_lang
                )

                if correction_result["success"]:
                    combined_text = correction_result["corrected_text"]
                    ai_corrected = True
                    logger.info("AI correction completed successfully")
                else:
                    logger.warning(f"AI correction failed: {correction_result.get('error', 'Unknown error')}")

            except Exception as e:
                logger.error(f"AI correction error: {str(e)}")
                # Continue with uncorrected text
            finally:
                if RELEASE_AFTER_USE:
                    release_corrector()

        return JSONResponse({
            "success": True,
            "text": combined_text,
            "total_regions": len(boxes),
            "recognized_regions": len(detailed_results),
            "details": detailed_results,
            "ai_corrected": ai_corrected,
            "craft_settings": craft_settings
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@app.post("/ocr-simple")
async def process_ocr_simple(
    file: UploadFile = File(...),
    languages: Optional[str] = Form(None)
):
    """
    Simpler OCR endpoint using only EasyOCR (without CRAFT)
    Faster but may be less accurate for complex layouts
    """
    try:
        # Parse languages
        lang_list = ['th', 'en']  # default
        if languages:
            try:
                lang_list = json.loads(languages)
                if not isinstance(lang_list, list) or len(lang_list) == 0:
                    lang_list = ['th', 'en']
            except json.JSONDecodeError:
                logger.warning(f"Invalid languages format: {languages}, using default")
                lang_list = ['th', 'en']

        logger.info(f"Using languages (simple mode): {lang_list}")

        # Get OCR reader for specified languages
        ocr_reader = get_ocr_reader(lang_list)

        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")

        logger.info(f"Processing file (simple mode): {file.filename}")

        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Run EasyOCR directly
        logger.info("Running EasyOCR...")
        results = ocr_reader.readtext(img, detail=1)

        all_text = []
        detailed_results = []

        for detection in results:
            bbox, text, confidence = detection
            if text.strip():
                all_text.append(text)
                detailed_results.append({
                    "text": text,
                    "confidence": float(confidence),
                    "box": bbox
                })

        combined_text = " ".join(all_text)

        logger.info(f"OCR completed. Total text blocks: {len(detailed_results)}")

        return JSONResponse({
            "success": True,
            "text": combined_text,
            "total_regions": len(detailed_results),
            "details": detailed_results
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


# =====================================================================
# Speech-to-Text Endpoints
# =====================================================================

ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'm4a', 'flac', 'mp4', 'avi', 'mov', 'mkv'}
TRANSCRIBE_WORKER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcribe_worker.py")


def _build_worker_cmd(mode, file_path, model_size, language, initial_prompt=None, chunk_duration=0):
    cmd = [
        sys.executable,
        TRANSCRIBE_WORKER_PATH,
        "--mode",
        mode,
        "--file",
        file_path,
        "--model-size",
        model_size,
        "--language",
        language,
    ]
    if initial_prompt:
        cmd.extend(["--initial-prompt", initial_prompt])
    if chunk_duration:
        cmd.extend(["--chunk-duration", str(chunk_duration)])
    return cmd


def _run_worker_json(file_path, model_size, language, initial_prompt=None):
    cmd = _build_worker_cmd("json", file_path, model_size, language, initial_prompt=initial_prompt)
    logger.info(f"Launching transcription worker: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "transcription worker failed"
        raise RuntimeError(detail)

    stdout = result.stdout.strip()
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        raise RuntimeError("Invalid JSON payload from transcription worker")

    if not payload.get("success"):
        raise RuntimeError(payload.get("error") or "transcription worker returned failure")

    return payload


def _stream_worker_output(file_path, model_size, language, chunk_duration=0, initial_prompt=None):
    cmd = _build_worker_cmd(
        "stream",
        file_path,
        model_size,
        language,
        initial_prompt=initial_prompt,
        chunk_duration=chunk_duration,
    )
    logger.info(f"Launching streaming transcription worker: {' '.join(cmd)}")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    def iterator():
        try:
            assert proc.stdout is not None
            for line in iter(proc.stdout.readline, ""):
                yield line

            proc.wait()
            if proc.returncode != 0:
                stderr_data = proc.stderr.read().strip() if proc.stderr else ""
                message = stderr_data or "transcription worker exited with error"
                logger.error(f"Transcription worker failed: {message}")
                yield f"STATUS: เกิดข้อผิดพลาด: {message}\n"
                yield "DONE\n"
        finally:
            if proc.stdout:
                proc.stdout.close()
            if proc.stderr:
                proc.stderr.close()
            if proc.poll() is None:
                proc.terminate()

    return iterator()


def allowed_audio_file(filename: str) -> bool:
    """Check if the file extension is allowed for audio/video"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_AUDIO_EXTENSIONS


@app.post("/transcribe")
async def transcribe_audio_endpoint(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    language: str = Form("th"),
    initial_prompt: Optional[str] = Form(None)
):
    """
    Transcribe audio/video file to text

    Args:
        file: Audio/Video file (mp3, wav, m4a, flac, mp4, avi, mov, mkv)
        model_size: Whisper model size (tiny, base, small, medium, large)
        language: Language code (th, en, auto for auto-detect)
        initial_prompt: Optional prompt to guide transcription

    Returns:
        JSON with transcribed text, language, and segments
    """
    try:
        # Validate file type
        if not allowed_audio_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Supported: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}"
            )

        logger.info(f"Transcribing file: {file.filename} (model: {model_size}, lang: {language})")

        # Save uploaded file temporarily
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            contents = await file.read()
            temp_file.write(contents)
            temp_file_path = temp_file.name

        try:
            result = _run_worker_json(
                temp_file_path,
                model_size=model_size,
                language=language,
                initial_prompt=initial_prompt,
            )
            return JSONResponse(result)
        except RuntimeError as worker_error:
            logger.error(f"Transcription worker error: {worker_error}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {worker_error}")
        finally:
            # Clean up temporary file
            try:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/transcribe/stream")
async def transcribe_stream_endpoint(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    language: str = Form("th"),
    chunk_duration: int = Form(0),
    initial_prompt: Optional[str] = Form(None)
):
    """
    Stream transcription progress and segments for better UX

    Args:
        file: Audio/Video file
        model_size: Whisper model size
        language: Language code
        chunk_duration: Duration of each chunk in seconds (0 = disabled)
        initial_prompt: Optional prompt to guide transcription

    Returns:
        Stream of progress updates and transcript segments
    """
    try:
        # Validate file type
        if not allowed_audio_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Supported: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}"
            )

        logger.info(f"Streaming transcription: {file.filename} (model: {model_size}, lang: {language})")

        # Save uploaded file temporarily
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            contents = await file.read()
            temp_file.write(contents)
            temp_file_path = temp_file.name

        def generate():
            try:
                # Stream transcription
                worker_stream = _stream_worker_output(
                    temp_file_path,
                    model_size=model_size,
                    language=language,
                    chunk_duration=chunk_duration,
                    initial_prompt=initial_prompt,
                )
                for chunk in worker_stream:
                    yield chunk

            finally:
                # Clean up temp file
                try:
                    if os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete temp file: {e}")

        return StreamingResponse(
            generate(),
            media_type='text/plain; charset=utf-8',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive',
                'Transfer-Encoding': 'chunked'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stream transcription error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Stream transcription failed: {str(e)}")


@app.get("/transcribe/models")
async def get_transcribe_models():
    """Get available Whisper models"""
    return JSONResponse({
        'models': transcribe.get_available_models()
    })


@app.get("/transcribe/languages")
async def get_transcribe_languages():
    """Get available languages for transcription"""
    return JSONResponse({
        'languages': transcribe.get_available_languages()
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
