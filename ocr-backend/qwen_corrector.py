"""Qwen3-based OCR Correction Module"""

import gc
import logging
import os
from typing import Optional, List, Dict

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

DEFAULT_QWEN_MODEL = os.getenv("QWEN_MODEL_NAME", "Qwen/Qwen3-4B-Instruct-2507")
RELEASE_AFTER_USE = os.getenv("QWEN_RELEASE_AFTER_USE", "false").lower() in {"1", "true", "yes"}
DEFAULT_TEMPERATURE = float(os.getenv("QWEN_TEMPERATURE", "0.05"))
DEFAULT_TOP_P = float(os.getenv("QWEN_TOP_P", "0.7"))
MAX_NEW_TOKENS = int(os.getenv("QWEN_MAX_NEW_TOKENS", "32768"))

logger = logging.getLogger(__name__)


class QwenOCRCorrector:
    """OCR text correction using Qwen3 model"""

    def __init__(
        self,
        model_name: Optional[str] = None,
        quantize: bool = True,
        max_length: int = 32768
    ):
        """
        Initialize Qwen OCR corrector

        Args:
            model_name: HuggingFace model name (will use Qwen3 when available)
            quantize: Use 4-bit quantization for lower VRAM usage
            max_length: Maximum token length for generation
        """
        self.model_name = model_name or DEFAULT_QWEN_MODEL
        self.max_length = max_length
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info(f"Loading Qwen model: {self.model_name}")
        logger.info(f"Device: {self.device}")
        logger.info(f"Quantization: {quantize}")

        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            trust_remote_code=True
        )

        # Load model with optional quantization
        if quantize and torch.cuda.is_available():
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )

            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                quantization_config=quantization_config,
                device_map="auto",
                trust_remote_code=True
            )
            logger.info("Model loaded with 4-bit quantization")
        else:
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                device_map="auto",
                trust_remote_code=True
            )
            logger.info("Model loaded without quantization")

        self.model.eval()
        logger.info("Qwen model initialized successfully")

    def unload(self):
        """Free GPU memory by unloading model/tokenizer."""
        logger.info("Unloading Qwen model from memory...")
        try:
            if hasattr(self, "model") and self.model is not None:
                del self.model
        except Exception as exc:
            logger.warning(f"Failed to delete model object: {exc}")
        finally:
            self.model = None

        try:
            if hasattr(self, "tokenizer") and self.tokenizer is not None:
                del self.tokenizer
        except Exception as exc:
            logger.warning(f"Failed to delete tokenizer object: {exc}")
        finally:
            self.tokenizer = None

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        logger.info("Qwen model memory released")

    def _create_prompt(
        self,
        ocr_text: str,
        context: Optional[str] = None,
        language: str = "thai"
    ) -> str:
        """
        Create prompt for OCR correction

        Args:
            ocr_text: Raw OCR text to correct
            context: Optional context about the document
            language: Primary language (thai or english)

        Returns:
            Formatted prompt string
        """
        thai_instruction = """คุณเป็นผู้เชี่ยวชาญในการแก้ไขข้อความจาก OCR
เป้าหมายคือแก้ตัวอักษร/เลข/ช่องว่างให้ถูกต้องโดยไม่แต่งเติมความหมาย
- แก้เฉพาะสิ่งที่ผิดชัดเจน
- หากไม่แน่ใจสะกดชื่อเฉพาะ ให้คงตามเดิม
- ห้ามอธิบายเพิ่มเติม ให้ตอบเป็นข้อความที่แก้ไขแล้วเท่านั้น
- ถ้าไม่พบจุดผิด ให้ส่งข้อความเดิมกลับมา"""

        english_instruction = """You are an OCR fixer.
Correct characters and spacing without adding explanations or new facts.
- Only fix obvious typos
- Preserve proper nouns if unsure
- Respond with the corrected text only (no bullets)
- If nothing needs fixing, return the original text"""

        cleaned_text = ocr_text.strip()

        if language.lower() == "thai":
            system_msg = thai_instruction
            user_msg = f"ข้อความ OCR:\n{cleaned_text}"
            if context:
                user_msg = f"บริบท: {context}\n\n{user_msg}"
        else:
            system_msg = english_instruction
            user_msg = f"OCR text:\n{cleaned_text}"
            if context:
                user_msg = f"Context: {context}\n\n{user_msg}"

        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]

        return self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

    def correct(
        self,
        ocr_text: str,
        context: Optional[str] = None,
        language: str = "thai",
        temperature: float = DEFAULT_TEMPERATURE,
        top_p: float = DEFAULT_TOP_P
    ) -> Dict[str, any]:
        """
        Correct OCR text using Qwen model

        Args:
            ocr_text: Raw OCR text to correct
            context: Optional context about the document
            language: Primary language (thai or english)
            temperature: Sampling temperature (lower = more conservative)
            top_p: Top-p sampling parameter

        Returns:
            Dictionary with corrected_text and metadata
        """
        try:
            # Create prompt
            prompt = self._create_prompt(ocr_text, context, language)

            # Tokenize
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length
            ).to(self.device)

            # Generate
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=min(MAX_NEW_TOKENS, self.max_length),
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=temperature > 0.01,
                    pad_token_id=self.tokenizer.pad_token_id,
                    eos_token_id=self.tokenizer.eos_token_id,
                    repetition_penalty=1.05
                )

            # Decode
            generated_text = self.tokenizer.decode(
                outputs[0][inputs['input_ids'].shape[1]:],
                skip_special_tokens=True
            )

            cleaned_output = generated_text.strip()
            if not cleaned_output:
                cleaned_output = ocr_text.strip()

            return {
                "success": True,
                "corrected_text": cleaned_output,
                "original_text": ocr_text,
                "model": self.model_name,
                "language": language
            }

        except Exception as e:
            logger.error(f"Error during correction: {str(e)}")
            return {
                "success": False,
                "corrected_text": ocr_text,
                "original_text": ocr_text,
                "error": str(e)
            }

    def correct_detailed_results(
        self,
        details: List[Dict],
        context: Optional[str] = None,
        language: str = "thai"
    ) -> List[Dict]:
        """
        Correct detailed OCR results (list of text boxes)

        Args:
            details: List of OCR detail dictionaries with 'text' field
            context: Optional context
            language: Primary language

        Returns:
            List of corrected detail dictionaries
        """
        corrected_details = []

        for detail in details:
            original_text = detail.get("text", "")

            if not original_text.strip():
                corrected_details.append(detail)
                continue

            # Correct individual text box
            result = self.correct(
                original_text,
                context=context,
                language=language
            )

            # Update detail with corrected text
            corrected_detail = detail.copy()
            corrected_detail["text"] = result["corrected_text"]
            corrected_detail["original_text"] = original_text
            corrected_detail["ai_corrected"] = result["success"]

            corrected_details.append(corrected_detail)

        return corrected_details


# Global corrector instance (initialized on demand)
_corrector_instance: Optional[QwenOCRCorrector] = None


def get_corrector() -> QwenOCRCorrector:
    """Get or create global corrector instance"""
    global _corrector_instance

    if _corrector_instance is None:
        logger.info("Initializing Qwen corrector...")
        _corrector_instance = QwenOCRCorrector(
            model_name=os.getenv("QWEN_MODEL_NAME", DEFAULT_QWEN_MODEL),
            quantize=True
        )

    return _corrector_instance


def release_corrector():
    """Release global corrector to free VRAM."""
    global _corrector_instance

    if _corrector_instance is None:
        return

    try:
        _corrector_instance.unload()
    except Exception as exc:
        logger.warning(f"Failed to unload Qwen corrector: {exc}")
    finally:
        _corrector_instance = None
