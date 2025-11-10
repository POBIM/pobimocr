from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
from craft_text_detector import Craft
import easyocr
import io
from PIL import Image
import logging
import json
from typing import Optional
from qwen_corrector import get_corrector, release_corrector, RELEASE_AFTER_USE

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
craft_detector = None
ocr_readers = {}  # Cache of OCR readers by language combination


@app.on_event("startup")
async def startup_event():
    """Initialize models on startup"""
    global craft_detector, ocr_readers

    # Check CUDA availability
    import torch
    cuda_available = torch.cuda.is_available()
    logger.info(f"CUDA available: {cuda_available}")
    if cuda_available:
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"CUDA version: {torch.version.cuda}")

    logger.info("Initializing CRAFT text detector...")
    craft_detector = Craft(
        output_dir=None,
        crop_type="poly",
        cuda=cuda_available,  # Enable CUDA if available
        long_size=1280
    )
    logger.info("CRAFT initialized successfully")

    logger.info("Pre-loading default EasyOCR reader for Thai and English...")
    ocr_readers['th,en'] = easyocr.Reader(['th', 'en'], gpu=cuda_available)  # Enable GPU if available
    logger.info("Default EasyOCR reader initialized successfully")


def get_ocr_reader(languages):
    """Get or create OCR reader for specified languages"""
    global ocr_readers
    import torch

    # Sort languages to ensure consistent cache key
    lang_key = ','.join(sorted(languages))

    if lang_key not in ocr_readers:
        logger.info(f"Creating new EasyOCR reader for languages: {languages}")
        cuda_available = torch.cuda.is_available()
        ocr_readers[lang_key] = easyocr.Reader(languages, gpu=cuda_available)
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
        "craft_loaded": craft_detector is not None,
        "ocr_readers_loaded": len(ocr_readers),
        "available_language_combinations": list(ocr_readers.keys())
    }


@app.post("/ocr")
async def process_ocr(
    file: UploadFile = File(...),
    languages: Optional[str] = Form(None),
    ai_correct: Optional[str] = Form("false")
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

        # Get OCR reader for specified languages
        ocr_reader = get_ocr_reader(lang_list)

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
        logger.info("Running CRAFT text detection...")
        try:
            prediction_result = craft_detector.detect_text(img)
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
                "ai_corrected": ai_corrected_fallback
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
            "ai_corrected": ai_corrected
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
