# Qwen3 AI OCR Correction Setup Guide

## ภาพรวม
ระบบนี้ใช้ Qwen3-4B-Instruct (รุ่นล่าสุด) เพื่อแก้ไขข้อผิดพลาดจาก OCR โดยทำงานบน GPU แบบ local ไม่ต้องเสียค่า API

## ข้อกำหนดระบบ

### Hardware
- GPU: GPU (8GB VRAM)
- RAM: อย่างน้อย 8GB
- Storage: อย่างน้อย 10GB สำหรับ model

### Software
- Python 3.10+
- CUDA 11.8+ (สำหรับ GPU support)
- PyTorch with CUDA support

## การติดตั้ง

### 1. ติดตั้ง Dependencies (ทำแล้ว)
```bash
cd ocr-backend
source venv/bin/activate
pip install transformers>=4.37.0 accelerate>=0.26.0 bitsandbytes>=0.42.0 sentencepiece>=0.1.99
```

### 2. ดาวน์โหลด Qwen Model (ครั้งแรกที่รัน)
Model จะดาวน์โหลดอัตโนมัติเมื่อใช้งานครั้งแรก (~3GB)
```python
# Model: Qwen/Qwen3-4B-Instruct-2507
# สามารถเปลี่ยนรุ่นได้ด้วยการตั้งค่า env `QWEN_MODEL_NAME`
```

### 3. ตรวจสอบ CUDA
```bash
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}')"
```

ควรได้ผลลัพธ์:
```
CUDA available: True
GPU: NVIDIA GeForce GPU
```

## การใช้งาน

### 1. เริ่มต้น Backend Server
```bash
cd ocr-backend
source venv/bin/activate
python main.py
```

Server จะรันที่: `http://localhost:8005`

### 2. เริ่มต้น Frontend
```bash
cd ocr-browser
npm run dev
```

Frontend จะรันที่: `http://localhost:3000`

### 3. ใช้งาน AI Correction
1. เปิด `http://localhost:3000/craft-ocr`
2. เลือกภาษา (ไทย/อังกฤษ)
3. **เปิดใช้งาน "AI Correction (Qwen3)"** ✅
4. อัปโหลดรูปภาพ
5. กดปุ่ม "เริ่มประมวลผล"

## ข้อมูลเทคนิค

### Model Configuration
- **Model**: Qwen/Qwen3-4B-Instruct-2507 (ค่าเริ่มต้นใหม่)
- **Quantization**: 4-bit (NF4)
- **VRAM Usage**: ~2-3GB (ลดจาก 12GB เป็น 3GB)
- **Precision**: float16
- **ปรับรุ่น**: กำหนด `export QWEN_MODEL_NAME="Qwen/<model-name>"` ก่อนรัน backend เพื่อใช้รุ่นอื่น (เช่น 7B หรือเวอร์ชัน fine-tune ของคุณ)
- **การคืน VRAM อัตโนมัติ**: ค่าเริ่มต้นตอนนี้เป็น `QWEN_RELEASE_AFTER_USE=false` เพื่อความเร็ว หากต้องการให้โมเดลถูกล้างหลังใช้งาน ให้ตั้งเป็น `true`

### VRAM Management
- `QWEN_RELEASE_AFTER_USE=false` (default) จะให้โมเดลค้างใน VRAM เพื่อลดเวลารอรอบถัดไป
- ตั้ง `export QWEN_RELEASE_AFTER_USE=true` หากต้องการคืน VRAM ทุกครั้งหลังใช้งาน
- ปรับความ “เรียบร้อย” ของผลลัพธ์ได้ด้วย `QWEN_TEMPERATURE` (ดีฟอลต์ 0.05), `QWEN_TOP_P` (ดีฟอลต์ 0.7) และจำกัดคำตอบด้วย `QWEN_MAX_NEW_TOKENS` (ดีฟอลต์ 256)

### Performance
- **การโหลด Model ครั้งแรก**: 30-60 วินาที
- **การแก้ไขข้อความ**: 2-5 วินาทีต่อครั้ง
- **VRAM Usage**: ~2-3GB (เหลือ 5-6GB สำหรับ CRAFT + EasyOCR)

### ไฟล์ที่สร้าง/แก้ไข

#### Backend (`ocr-backend/`)
1. **qwen_corrector.py** - โมดูลหลักสำหรับ AI correction
   - `QwenOCRCorrector` class
   - 4-bit quantization support
   - Thai/English language support

2. **main.py** - เพิ่ม AI correction endpoint
   - เพิ่ม parameter `ai_correct` ใน `/ocr` endpoint
   - บูรณาการกับ CRAFT + EasyOCR

3. **requirements.txt** - เพิ่ม dependencies
   - transformers>=4.37.0
   - accelerate>=0.26.0
   - bitsandbytes>=0.42.0
   - sentencepiece>=0.1.99

#### Frontend (`ocr-browser/`)
1. **app/craft-ocr/page.tsx**
   - เพิ่ม AI correction toggle
   - แสดง badge เมื่อ AI แก้ไขแล้ว
   - ส่ง `ai_correct` parameter ไปยัง API

2. **app/api/craft-ocr/route.ts**
   - รับและส่งต่อ `ai_correct` parameter

## การแก้ปัญหา

### Model ดาวน์โหลดช้า
- ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
- Model จะถูกเก็บไว้ที่ `~/.cache/huggingface/`
- หลังจากดาวน์โหลดแล้วจะใช้แบบ offline ได้

### CUDA Out of Memory
- ตรวจสอบว่ามี process อื่นใช้ GPU อยู่หรือไม่
- ปิดโปรแกรมที่ใช้ GPU อื่นๆ
- Model ใช้ 4-bit quantization ควรใช้ VRAM ไม่เกิน 3GB

### Model โหลดช้า
- การโหลดครั้งแรกจะช้า (30-60 วินาที)
- ครั้งต่อไปจะเร็วขึ้นเพราะ model อยู่ใน memory
- สามารถ pre-load model ตอน startup ได้โดยเพิ่มใน `startup_event()`

## Advanced: อัปเกรดเป็น Qwen3

เมื่อ Qwen3 พร้อมใช้งานใน HuggingFace สามารถอัปเกรดได้ง่ายๆ:

```python
# ใน qwen_corrector.py
def get_corrector() -> QwenOCRCorrector:
    global _corrector_instance

    if _corrector_instance is None:
        logger.info("Initializing Qwen corrector...")
        _corrector_instance = QwenOCRCorrector(
            model_name="Qwen/Qwen3-3B-Instruct",  # เปลี่ยนเป็น Qwen3
            quantize=True
        )

    return _corrector_instance
```

## การเพิ่มประสิทธิภาพ

### 1. Pre-load Model ตอน Startup
แก้ไข `main.py`:
```python
@app.on_event("startup")
async def startup_event():
    # ... existing code ...

    # Pre-load Qwen model
    logger.info("Pre-loading Qwen correction model...")
    from qwen_corrector import get_corrector
    get_corrector()
    logger.info("Qwen model loaded successfully")
```

### 2. Batch Processing
สำหรับประมวลผลหลายรูปพร้อมกัน สามารถใช้ batch processing ได้

### 3. Caching
เพิ่ม caching สำหรับข้อความที่เคยแก้ไขแล้ว

## ต้นทุนการใช้งาน

- **ค่า GPU**: ฟรี (ใช้ GPU ของตัวเอง)
- **ค่า API**: ฟรี (ไม่ใช้ Cloud API)
- **ค่าไฟฟ้า**: ~15-20 บาท/วัน (GPU ~100W)

เทียบกับ Gemini Flash 2.5 API:
- Gemini: ~$0.0002 ต่อครั้ง (~0.007 บาท)
- Qwen3 Local: ฟรี (หักค่าไฟฟ้าเท่านั้น)

## ข้อมูลเพิ่มเติม

- HuggingFace Model: https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507
- Qwen Documentation: https://github.com/QwenLM/Qwen
- bitsandbytes (Quantization): https://github.com/TimDettmers/bitsandbytes
