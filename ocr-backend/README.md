# Thai OCR Backend - CRAFT + EasyOCR

Python FastAPI backend สำหรับ OCR ภาษาไทยความแม่นยำสูง ด้วย CRAFT Text Detection และ EasyOCR

## 🚀 Quick Start

### ติดตั้ง

```bash
# สร้าง virtual environment
python -m venv venv

# เปิดใช้งาน
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# ติดตั้ง dependencies
pip install -r requirements.txt
```

### รัน Server

```bash
python main.py
```

Server จะรันที่: http://localhost:8005

API Documentation: http://localhost:8005/docs (Swagger UI)

## 📡 API Endpoints

### GET /
Health check พื้นฐาน

```bash
curl http://localhost:8005/
```

### GET /health
ตรวจสอบว่า models โหลดเรียบร้อยหรือไม่

```bash
curl http://localhost:8005/health
```

### POST /ocr
OCR ด้วย CRAFT + EasyOCR (ความแม่นยำสูง)

```bash
curl -X POST \
  http://localhost:8005/ocr \
  -F "file=@/path/to/image.jpg"
```

**Response:**
```json
{
  "success": true,
  "text": "ข้อความที่อ่านได้ทั้งหมด",
  "total_regions": 10,
  "recognized_regions": 8,
  "details": [
    {
      "text": "สวัสดี",
      "confidence": 0.95,
      "box": {
        "x1": 10,
        "y1": 20,
        "x2": 100,
        "y2": 50
      }
    }
  ]
}
```

### POST /ocr-simple
OCR ด้วย EasyOCR เท่านั้น (เร็วกว่าแต่อาจแม่นยำน้อยกว่า)

```bash
curl -X POST \
  http://localhost:8005/ocr-simple \
  -F "file=@/path/to/image.jpg"
```

## ⚙️ Configuration

### เปิดใช้งาน GPU

แก้ไขใน `main.py`:

```python
# Line 29
craft_detector = Craft(
    output_dir=None,
    crop_type="poly",
    cuda=True,  # เปลี่ยนเป็น True
    long_size=1280
)

# Line 33
ocr_reader = easyocr.Reader(['th', 'en'], gpu=True)  # เปลี่ยนเป็น True
```

### ปรับขนาดรูปภาพ

```python
# Line 30
long_size=1280  # ลดลงถ้าต้องการความเร็ว เพิ่มถ้าต้องการความแม่นยำ
```

### เพิ่มภาษาอื่นๆ

```python
# Line 33
ocr_reader = easyocr.Reader(['th', 'en', 'zh', 'ja'], gpu=False)
```

รายการภาษาที่ EasyOCR รองรับ: https://www.jaided.ai/easyocr/

## 🔧 Requirements

### Python Version
- Python 3.8 - 3.11 (แนะนำ 3.10)

### Dependencies
```
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6
craft-text-detector==0.4.3
easyocr==1.7.1
opencv-python==4.8.1.78
numpy==1.24.3
Pillow==10.1.0
torch==2.1.0
torchvision==0.16.0
```

### System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 4 GB
- Storage: 2 GB (สำหรับ models)

**Recommended:**
- CPU: 8+ cores หรือ GPU (CUDA-compatible)
- RAM: 8+ GB
- Storage: 5 GB

## 🚦 Production Deployment

### ใช้ Uvicorn กับ workers

```bash
uvicorn main:app --host 0.0.0.0 --port 8005 --workers 4
```

### ใช้ Gunicorn + Uvicorn

```bash
pip install gunicorn

gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8005
```

### Docker

สร้างไฟล์ `Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8005

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8005"]
```

Build และ run:

```bash
docker build -t thai-ocr-backend .
docker run -p 8005:8005 thai-ocr-backend
```

## 🔍 How It Works

### CRAFT Text Detection
1. รับภาพเข้ามา
2. ใช้ CRAFT neural network หาตำแหน่งของตัวอักษรแต่ละตัว
3. คำนวณ "affinity" (ความสัมพันธ์) ระหว่างตัวอักษร
4. จัดกลุ่มตัวอักษรที่อยู่ใกล้กันเป็น text regions
5. สร้าง bounding boxes รอบ text regions

### EasyOCR Recognition
1. รับ cropped images จาก CRAFT
2. ใช้ deep learning model อ่านข้อความ
3. คืนค่าข้อความพร้อม confidence score

### ทำไมถึงแม่นยำกับภาษาไทย?
- CRAFT ตรวจจับในระดับตัวอักษร → เหมาะกับสระ/วรรณยุกต์ไทย
- EasyOCR trained กับข้อมูลภาษาไทยเยอะ
- การรวม 2 models ให้ผลลัพธ์ดีกว่าใช้อย่างใดอย่างหนึ่ง

## 📊 Performance

### Benchmarks (CPU - Intel i7)
- Image size: 1280x720
- CRAFT detection: ~1.5 seconds
- EasyOCR recognition: ~2-3 seconds per region
- Total: ~5-10 seconds (ขึ้นกับจำนวน text regions)

### With GPU (NVIDIA RTX 3080)
- CRAFT detection: ~0.3 seconds
- EasyOCR recognition: ~0.5 seconds per region
- Total: ~1-3 seconds

## ⚠️ Troubleshooting

### Error: "No module named 'craft_text_detector'"
```bash
pip install craft-text-detector
```

### Error: "CUDA out of memory"
ลด `long_size` หรือปิดการใช้ GPU:
```python
craft_detector = Craft(..., cuda=False)
ocr_reader = easyocr.Reader(['th', 'en'], gpu=False)
```

### Models ดาวน์โหลดช้า
Models จะถูกดาวน์โหลดครั้งแรกที่รัน:
- CRAFT: ~20 MB
- EasyOCR: ~100 MB per language

เก็บไว้ใน:
- Linux/Mac: `~/.EasyOCR/`
- Windows: `C:\Users\<username>\.EasyOCR\`

### Port 8005 ถูกใช้งาน
เปลี่ยน port ใน `main.py` บรรทัดสุดท้าย:
```python
uvicorn.run(app, host="0.0.0.0", port=8006)
```

## 📚 References

- CRAFT Paper: https://arxiv.org/abs/1904.01941
- CRAFT GitHub: https://github.com/clovaai/CRAFT-pytorch
- EasyOCR: https://github.com/JaidedAI/EasyOCR
- FastAPI: https://fastapi.tiangolo.com/

## 📄 License

MIT License - ใช้งานได้ฟรีทั้งส่วนตัวและเชิงพาณิชย์
