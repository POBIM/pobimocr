# POBIMOCR - Thai OCR System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/next.js-16-black)](https://nextjs.org/)

ระบบ OCR (Optical Character Recognition) ความแม่นยำสูงสำหรับภาษาไทย
ใช้เทคโนโลยี **CRAFT + EasyOCR** พร้อม **GPU acceleration**

## ✨ คุณสมบัติ

- 🎯 **ความแม่นยำสูง** - CRAFT text detection + EasyOCR recognition
- 🚀 **Multi-Platform GPU** - รองรับ NVIDIA CUDA, Apple Silicon (MPS), และ CPU
- 🍎 **Mac M-Series Optimized** - รองรับ M1/M2/M3/M4 ด้วย Metal Performance Shaders
- 🌐 **Multi-language** - รองรับภาษาไทย + อังกฤษ
- 📱 **Modern UI** - Next.js 16 + React 19 + Tailwind CSS 4
- ⚡ **Real-time** - ประมวลผลแบบ real-time
- 🔌 **REST API** - FastAPI พร้อม auto-docs

## 🚀 Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd pobimocr

# 2. Setup (with interactive hardware selection)
./pobimocr setup

# 3. Start services
./pobimocr start

# 4. เปิดเบราว์เซอร์
# http://localhost:3005
```

## 🎮 Hardware Support

ระบบจะตรวจจับ hardware อัตโนมัติและแนะนำการตั้งค่าที่เหมาะสม:

### 🎮 NVIDIA GPU (CUDA)
- **แนะนำสำหรับ**: RTX 3060, RTX 4090, และ NVIDIA GPU อื่นๆ
- **ประสิทธิภาพ**: ⚡⚡⚡⚡⚡ (เร็วที่สุด)
- **เวลาประมวลผล**: 0.5-2 วินาที/รูป
- **คุณสมบัติพิเศษ**: 4-bit quantization สำหรับ AI correction

### 🍎 Apple Silicon (MPS)
- **แนะนำสำหรับ**: Mac M1/M2/M3/M4
- **ประสิทธิภาพ**: ⚡⚡⚡⚡ (เร็วมาก)
- **เวลาประมวลผล**: 1-3 วินาที/รูป
- **คุณสมบัติพิเศษ**: Metal Performance Shaders + fp16 precision

### 💻 CPU Only
- **แนะนำสำหรับ**: Mac Intel, Linux ที่ไม่มี GPU
- **ประสิทธิภาพ**: ⚡⚡ (ช้ากว่า)
- **เวลาประมวลผล**: 3-10 วินาที/รูป
- **ข้อดี**: ใช้งานได้กับทุกระบบ

## 📝 คำสั่งที่ใช้

```bash
./pobimocr setup              # ติดตั้งระบบครั้งแรก (มี hardware selection)
./pobimocr setup --reconfigure # เปลี่ยน hardware configuration
./pobimocr start              # เริ่มทำงาน
./pobimocr stop               # หยุดทำงาน
./pobimocr restart            # รีสตาร์ท
./pobimocr status             # ดูสถานะ
./pobimocr test               # ทดสอบระบบ
./pobimocr logs               # ดู logs ทั้งหมด
./pobimocr logs backend       # ดู backend logs
./pobimocr logs frontend      # ดู frontend logs
./pobimocr help               # ดูคำสั่งทั้งหมด
```

หรือเรียกใช้แบบ interactive menu:
```bash
./pobimocr                    # เปิด interactive menu
```

## 📋 ความต้องการของระบบ

### จำเป็น
- **Python 3.12** - สำหรับ backend (ห้ามใช้ 3.13)
- **Node.js 18+** - สำหรับ frontend
- **npm** - Package manager สำหรับ Node.js

### แนะนำ (สำหรับความเร็วสูง)
- **NVIDIA GPU** - รองรับ CUDA 12.1+ หรือ
- **Apple Silicon** - Mac M1/M2/M3/M4 หรือ
- **8GB+ RAM** - สำหรับโหลด AI models
- **SSD** - สำหรับความเร็วในการโหลด models

## 🛠️ การติดตั้ง

### Mac (Apple Silicon)

```bash
# ติดตั้ง Python 3.12
brew install python@3.12

# ติดตั้ง Node.js
brew install node

# รัน setup (จะมีให้เลือก hardware)
./pobimocr setup
```

เลือก **Option 2: Apple Silicon (M1/M2/M3/M4)** เมื่อโปรแกรมถาม

### Mac (Intel)

```bash
# ติดตั้ง dependencies เหมือน Apple Silicon
brew install python@3.12 node

# รัน setup
./pobimocr setup
```

เลือก **Option 3: CPU Only**

### Linux/Windows (NVIDIA GPU)

```bash
# ติดตั้ง Python 3.12
sudo apt-get install python3.12 python3.12-venv python3.12-dev

# ติดตั้ง Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# รัน setup
./pobimocr setup
```

เลือก **Option 1: NVIDIA GPU (CUDA)** ถ้ามี GPU หรือ **Option 3: CPU Only**

## 📁 โครงสร้างโปรเจกต์

```
pobimocr/
├── pobimocr                  # CLI tool หลัก (NEW! with hardware selection)
├── pobimocr.sh               # Legacy CLI tool
├── .hardware_config          # Hardware configuration (auto-generated)
│
├── ocr-backend/              # Python FastAPI Backend
│   ├── main.py               # FastAPI server (รองรับ CUDA/MPS/CPU)
│   ├── qwen_corrector.py     # AI correction (รองรับ CUDA/MPS/CPU)
│   ├── requirements-base.txt # Base dependencies
│   ├── requirements-cuda.txt # NVIDIA GPU specific
│   ├── requirements-mps.txt  # Apple Silicon specific
│   ├── requirements-cpu.txt  # CPU only
│   └── venv/                 # Virtual environment
│
├── ocr-browser/              # Next.js Frontend
│   ├── app/
│   ├── package.json
│   └── .env.local
│
└── logs/
    ├── backend.log
    └── frontend.log
```

## 🎯 การใช้งาน

### 1. เปิดเบราว์เซอร์
ไปที่ http://localhost:3005

### 2. เลือก OCR Mode
- **Browser OCR**: Tesseract.js - ไม่ต้องใช้ backend
- **CRAFT OCR**: ความแม่นยำสูง - ต้องรัน backend

### 3. อัพโหลดรูปภาพ
- คลิก "เลือกไฟล์" หรือ
- Paste รูปภาพจาก clipboard (Ctrl+V)
- รองรับ PDF (เลือกหน้าที่ต้องการ OCR)

### 4. รอผลลัพธ์
- แสดงข้อความที่อ่านได้
- แสดง confidence score
- แสดง bounding boxes บนรูปภาพ
- สามารถแก้ไขข้อความได้ (Edit mode)

## 🔧 API Documentation

### Backend Endpoints

#### GET /
Health check พื้นฐาน

#### GET /health
```json
{
  "status": "healthy",
  "craft_loaded": true,
  "ocr_readers_loaded": 1,
  "available_language_combinations": ["en,th"]
}
```

#### POST /ocr
CRAFT + EasyOCR (ความแม่นยำสูง)

**Request:**
```bash
curl -X POST http://localhost:8005/ocr \
  -F "file=@image.jpg" \
  -F 'languages=["th", "en"]'
```

**Response:**
```json
{
  "success": true,
  "text": "ข้อความทั้งหมดที่อ่านได้",
  "total_regions": 10,
  "recognized_regions": 8,
  "details": [
    {
      "text": "ข้อความ",
      "confidence": 0.95,
      "box": {"x1": 10, "y1": 20, "x2": 100, "y2": 50}
    }
  ]
}
```

#### POST /ocr-simple
EasyOCR เพียงอย่างเดียว (เร็วกว่า)

**API Documentation:** http://localhost:8005/docs

## 📊 เปรียบเทียบ

| คุณสมบัติ | Browser OCR | CRAFT OCR |
|-----------|-------------|-----------|
| **ความแม่นยำ** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **ความเร็ว (CUDA)** | N/A | 0.5-2 วิ |
| **ความเร็ว (MPS)** | N/A | 1-3 วิ |
| **ความเร็ว (CPU)** | 10-30 วิ | 3-10 วิ |
| **Backend** | ❌ | ✅ |
| **Layout ซับซ้อน** | ⭐⭐ | ⭐⭐⭐⭐⭐ |

## 💡 Tips สำหรับผลลัพธ์ที่ดี

### รูปภาพที่ดี
- ✅ ความละเอียดสูง (>= 1024px)
- ✅ แสงสว่างเพียงพอ
- ✅ ข้อความตรง ไม่เอียงมาก
- ✅ Contrast ชัด
- ❌ หลีกเลี่ยงภาพเบลอ
- ❌ หลีกเลี่ยงเงา/สะท้อนแสง

### ปรับแต่งประสิทธิภาพ
- GPU จะเปิดใช้อัตโนมัติตาม hardware ที่เลือก
- Mac M-series จะใช้ MPS (Metal Performance Shaders)
- ใช้ `/ocr-simple` ถ้าต้องการความเร็ว
- ลด `long_size` ใน CRAFT config ถ้าต้องการเร็วกว่า

## 🔍 เทคโนโลยีที่ใช้

### Frontend
- **Next.js 16** - React framework (App Router)
- **React 19.2** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Styling
- **Tesseract.js 5** - Browser OCR

### Backend
- **FastAPI 0.104** - Python web framework
- **PyTorch 2.1+** - Deep learning (รองรับ CUDA/MPS/CPU)
- **CRAFT** - Text detection (MIT License)
- **EasyOCR 1.7** - Text recognition
- **OpenCV 4.8** - Image processing
- **Python 3.12** - Programming language

### CRAFT (Character Region Awareness for Text)
พัฒนาโดย Clova AI (NAVER/LINE)
- Paper: [CVPR 2019](https://arxiv.org/abs/1904.01941)
- GitHub: [clovaai/CRAFT-pytorch](https://github.com/clovaai/CRAFT-pytorch)
- เหมาะมากสำหรับภาษาไทยที่มีสระ/วรรณยุกต์

## 🐛 Troubleshooting

### Backend ไม่ start
```bash
# ตรวจสอบ logs
./pobimocr logs backend

# ตรวจสอบว่า venv มี dependencies ครบ
cd ocr-backend
source venv/bin/activate
pip list | grep -E "torch|fastapi|easyocr"
```

### Frontend ไม่เชื่อมต่อ Backend
```bash
# ตรวจสอบ .env.local
cat ocr-browser/.env.local
# ควรมี: PYTHON_API_URL=http://localhost:8005

# ตรวจสอบว่า backend รันอยู่
curl http://localhost:8005/health
```

### GPU/MPS ไม่ทำงาน
```bash
# ตรวจสอบ hardware configuration
cat .hardware_config

# เปลี่ยน configuration
./pobimocr setup --reconfigure

# สำหรับ NVIDIA GPU
nvidia-smi

# สำหรับ Mac - ตรวจสอบ PyTorch MPS
cd ocr-backend
source venv/bin/activate
python -c "import torch; print(f'MPS available: {torch.backends.mps.is_available()}')"
```

### Port conflicts
```bash
# หา process ที่ใช้ port
lsof -i :8005  # backend
lsof -i :3005  # frontend

# Kill process
kill -9 <PID>

# หรือใช้ stop script
./pobimocr stop
```

## 🚀 Deployment

### Production Checklist
- [ ] เปลี่ยน ports ใน .env ถ้าจำเป็น
- [ ] ตั้งค่า CORS ใน backend/main.py
- [ ] ใช้ production web server (Gunicorn/Uvicorn workers)
- [ ] ตั้งค่า reverse proxy (Nginx)
- [ ] เปิด GPU acceleration ตาม hardware
- [ ] ตั้งค่า log rotation
- [ ] Setup monitoring และ health checks

## 📄 License

Project นี้ใช้ open source technologies:

- **CRAFT**: MIT License
- **Tesseract.js**: Apache License 2.0
- **EasyOCR**: Apache License 2.0
- **FastAPI**: MIT License
- **Next.js**: MIT License

## 🤝 Contributing

หากพบปัญหาหรือต้องการปรับปรุง สามารถเปิด issue หรือส่ง pull request ได้เลยครับ

## 💡 สำหรับ Mac M4 Users

ระบบนี้ถูกปรับปรุงให้รองรับ Apple Silicon M4 อย่างเต็มรูปแบบ:

- ✅ Auto-detect M4 chip
- ✅ ใช้ MPS (Metal Performance Shaders) สำหรับ GPU acceleration
- ✅ ไม่ต้อง install bitsandbytes (ไม่รองรับบน Mac)
- ✅ ใช้ fp16 precision แทน int8 quantization
- ✅ Performance ใกล้เคียง CUDA GPU

เพียงแค่รัน `./pobimocr setup` และเลือก **Option 2: Apple Silicon**!

---

**Made with ❤️ for Thai OCR**
Powered by CRAFT + EasyOCR + Next.js

**NEW**: รองรับ Mac M-Series (M1/M2/M3/M4) ด้วย Metal Performance Shaders! 🍎⚡
