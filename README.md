# POBIMOCR - Thai OCR System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/next.js-16-black)](https://nextjs.org/)
[![CUDA](https://img.shields.io/badge/CUDA-12.8-green.svg)](https://developer.nvidia.com/cuda-toolkit)

ระบบ OCR (Optical Character Recognition) ความแม่นยำสูงสำหรับภาษาไทย  
ใช้เทคโนโลยี **CRAFT + EasyOCR** พร้อม **GPU acceleration**

## ✨ คุณสมบัติ

- 🎯 **ความแม่นยำสูง** - CRAFT text detection + EasyOCR recognition
- 🚀 **GPU Acceleration** - รองรับ NVIDIA CUDA เร็วขึ้น 10+ เท่า
- 🌐 **Multi-language** - รองรับภาษาไทย + อังกฤษ
- 📱 **Modern UI** - Next.js 16 + React 19 + Tailwind CSS 4
- ⚡ **Real-time** - ประมวลผลแบบ real-time
- 🔌 **REST API** - FastAPI พร้อม auto-docs

## 🚀 Quick Start



```bash- 🌐 **Multi-language**: รองรับภาษาไทยและอังกฤษ (ปรับเพิ่มได้)- 🌐 **Multi-language**: รองรับภาษาไทยและอังกฤษ (ปรับเพิ่มได้)

# 1. Clone

git clone <repository-url>- 📱 **Modern UI**: สร้างด้วย Next.js 16 + React 19 + Tailwind CSS- 📱 **Modern UI**: สร้างด้วย Next.js 16 + React 19 + Tailwind CSS

cd POBIMORC

- ⚡ **Real-time Processing**: ประมวลผลและแสดงผลแบบ real-time- ⚡ **Real-time Processing**: ประมวลผลและแสดงผลแบบ real-time

# 2. Setup (ครั้งเดียว)

./pobimorc setup- 🔌 **RESTful API**: FastAPI backend พร้อม auto-generated documentation- 🔌 **RESTful API**: FastAPI backend พร้อม auto-generated documentation



# 3. Start

./pobimorc start

## 🚀 Quick Start## � Quick Start

# 4. เปิดเบราว์เซอร์

# http://localhost:3005

```

### ติดตั้งอัตโนมัติ (แนะนำ)### ติดตั้งอัตโนมัติ (แนะนำ)

## 📝 คำสั่งที่ใช้



```bash

./pobimorc setup     # ติดตั้งระบบครั้งแรก```bash```bash

./pobimorc start     # เริ่มทำงาน

./pobimorc stop      # หยุดทำงาน# 1. Clone repository# 1. Clone repository

./pobimorc restart   # รีสตาร์ท

./pobimorc status    # ดูสถานะgit clone <repository-url>git clone <repository-url>

./pobimorc logs      # ดู logs ทั้งหมด

./pobimorc logs backend   # ดู backend logscd POBIMORCcd POBIMORC

./pobimorc logs frontend  # ดู frontend logs

./pobimorc help      # ดูคำสั่งทั้งหมด

```

# 2. รัน setup script# 2. รัน setup script

## 📋 ความต้องการ

chmod +x setup.shchmod +x setup.sh

### จำเป็น

- **Python 3.12** (ห้ามใช้ 3.13!)./setup.sh./setup.sh

- **Node.js 18+**

- **npm**



### แนะนำ# 3. Start services# 3. Start services

- **NVIDIA GPU** (CUDA 12.1+)

- **8GB+ RAM**chmod +x start.sh stop.shchmod +x start.sh stop.sh

- **SSD**

./start.sh./start.sh

## 📁 โครงสร้าง

``````

```

POBIMORC/

├── pobimorc           # CLI tool หลัก

├── .gitignoreเท่านี้ก็เสร็จแล้ว! เปิดเบราว์เซอร์ที่ **http://localhost:3005**เท่านี้ก็เสร็จแล้ว! เปิดเบราว์เซอร์ที่ http://localhost:3005

│

├── ocr-backend/       # Python FastAPI

│   ├── main.py

│   ├── requirements.txt### หยุดการทำงาน### หยุดการทำงาน

│   └── venv/

│

├── ocr-browser/       # Next.js Frontend

│   ├── app/```bash```bash

│   ├── package.json

│   ├── .env.local./stop.sh./stop.sh

│   └── node_modules/

│``````

└── logs/

    ├── backend.log

    └── frontend.log

```## 📋 ความต้องการของระบบ## 📋 ความต้องการของระบบ



## 🔧 API



### Endpoints### จำเป็น### จำเป็น



- `GET /` - Health check- **Python 3.12** - สำหรับ backend (ห้ามใช้ 3.13)- **Python 3.12** - สำหรับ backend

- `GET /health` - Detailed status

- `POST /ocr` - CRAFT + EasyOCR (แม่นยำสูง)- **Node.js 18+** - สำหรับ frontend- **Node.js 18+** - สำหรับ frontend

- `POST /ocr-simple` - EasyOCR only (เร็วกว่า)

- **npm** - Package manager สำหรับ Node.js- **npm** - Package manager สำหรับ Node.js

### ตัวอย่าง



```bash

curl -X POST http://localhost:8005/ocr \### แนะนำ (สำหรับความเร็วสูง)### แนะนำ (สำหรับความเร็วสูง)

  -F "file=@image.jpg" \

  -F 'languages=["th", "en"]'- **NVIDIA GPU** - รองรับ CUDA 12.1+- **NVIDIA GPU** - รองรับ CUDA 12.1+

```

- **8GB+ RAM** - สำหรับโหลด AI models- **8GB+ RAM** - สำหรับโหลด AI models

**API Docs:** http://localhost:8005/docs

- **SSD** - สำหรับความเร็วในการโหลด models- **SSD** - สำหรับความเร็วในการโหลด models

## 📊 เปรียบเทียบ



| คุณสมบัติ | Browser OCR | CRAFT OCR |

|-----------|-------------|-----------|## 📁 โครงสร้างโปรเจกต์## 📁 โครงสร้างโปรเจกต์

| ความแม่นยำ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

| ความเร็ว (CPU) | 10-30 วิ | 3-5 วิ |

| ความเร็ว (GPU) | N/A | 0.5-2 วิ |

| Backend | ❌ | ✅ |``````

| Layout ซับซ้อน | ⭐⭐ | ⭐⭐⭐⭐⭐ |

POBIMORC/POBIMORC/

## 💡 Tips

├── setup.sh              # ติดตั้งระบบทั้งหมดอัตโนมัติ├── setup.sh              # ติดตั้งระบบทั้งหมดอัตโนมัติ

### รูปภาพที่ดี

- ✅ ความละเอียดสูง (>= 1024px)├── start.sh              # เริ่ม backend + frontend├── start.sh              # เริ่ม backend + frontend

- ✅ แสงสว่างเพียงพอ

- ✅ Contrast ชัด├── stop.sh               # หยุด services ทั้งหมด├── stop.sh               # หยุด services ทั้งหมด

- ❌ หลีกเลี่ยงภาพเบลอ/เงา

├── .gitignore            # Git ignore patterns├── .gitignore            # Git ignore patterns

### ประสิทธิภาพ

- GPU เปิดใช้อัตโนมัติ (ถ้ามี)││

- ใช้ `/ocr-simple` ถ้าต้องการเร็ว

- ลด `long_size` ถ้าต้องการเร็วกว่า├── ocr-backend/          # Python FastAPI Backend├── ocr-backend/          # Python FastAPI Backend



## 🔍 เทคโนโลยี│   ├── main.py           # FastAPI server (CRAFT + EasyOCR)│   ├── main.py           # FastAPI server (CRAFT + EasyOCR)



**Frontend:**│   ├── requirements.txt  # Python dependencies│   ├── requirements.txt  # Python dependencies

- Next.js 16, React 19, TypeScript, Tailwind CSS

- Tesseract.js (Browser OCR)│   └── venv/             # Virtual environment (สร้างโดย setup.sh)│   └── venv/             # Virtual environment (สร้างโดย setup.sh)



**Backend:**││

- FastAPI, PyTorch 2.2, CRAFT, EasyOCR 1.7

- OpenCV 4.12, Python 3.12├── ocr-browser/          # Next.js Frontend├── ocr-browser/          # Next.js Frontend



**CRAFT** - พัฒนาโดย Clova AI (NAVER/LINE)  │   ├── app/│   ├── app/

[Paper](https://arxiv.org/abs/1904.01941) | [GitHub](https://github.com/clovaai/CRAFT-pytorch)

│   │   ├── page.tsx              # หน้าแรก│   │   ├── page.tsx              # หน้าแรก

## 🐛 Troubleshooting

│   │   ├── browser-ocr/          # Prototype: Tesseract.js│   │   ├── browser-ocr/          # Prototype: Tesseract.js

### ตรวจสอบ logs

```bash│   │   ├── craft-ocr/            # Main: CRAFT OCR│   │   ├── craft-ocr/            # Main: CRAFT OCR

./pobimorc logs

```│   │   └── api/craft-ocr/        # API proxy│   │   └── api/craft-ocr/        # API proxy



### Backend ไม่ start│   ├── package.json│   ├── package.json

```bash

cat logs/backend.log│   ├── .env.local                # Environment config│   ├── .env.local                # Environment config

cd ocr-backend

source venv/bin/activate│   └── node_modules/             # (สร้างโดย setup.sh)│   └── node_modules/             # (สร้างโดย setup.sh)

pip list | grep -E "torch|fastapi|easyocr"

```││



### Frontend ไม่เชื่อมต่อ└── logs/                 # Server logs (สร้างโดย start.sh)└── logs/                 # Server logs (สร้างโดย start.sh)

```bash

cat ocr-browser/.env.local  # ควรมี: PYTHON_API_URL=http://localhost:8005    ├── backend.log    ├── backend.log

curl http://localhost:8005/health

```    └── frontend.log    └── frontend.log



### GPU ไม่ทำงาน``````

```bash

nvidia-smi  # หรือ /usr/lib/wsl/lib/nvidia-smi

cd ocr-backend

source venv/bin/activate## 🎯 การใช้งาน## 🛠️ การติดตั้งแบบ Manual

python -c "import torch; print(torch.cuda.is_available())"

```



### Port conflicts### 1. เปิดเบราว์เซอร์### 1. ติดตั้ง Python Backend

```bash

./pobimorc stop  # หยุดทุกอย่างไปที่ http://localhost:3005

lsof -i :8005    # ตรวจสอบ port

lsof -i :3005```bash

```

### 2. เลือก Prototypecd ocr-backend

## 🚀 Production

- **Prototype 1**: Browser OCR (Tesseract.js) - ไม่ต้องใช้ backend

### Checklist

- [ ] ตั้งค่า CORS ใน `main.py`- **Prototype 2**: CRAFT OCR - ความแม่นยำสูง ต้องรัน backend# สร้าง virtual environment ด้วย Python 3.12

- [ ] ใช้ Gunicorn/Uvicorn workers

- [ ] ตั้งค่า Nginx reverse proxypython3.12 -m venv venv

- [ ] เปิด GPU (ถ้ามี)

- [ ] Log rotation### 3. อัพโหลดรูปภาพ

- [ ] Health checks

- คลิก "เลือกไฟล์" หรือ# เปิดใช้งาน virtual environment

## 📄 License

- Paste รูปภาพจาก clipboard (Ctrl+V)source venv/bin/activate  # Linux/macOS

Open source technologies:

- **CRAFT** - MIT License# หรือ: venv\Scripts\activate  # Windows

- **EasyOCR** - Apache 2.0

- **Tesseract.js** - Apache 2.0### 4. รอผลลัพธ์

- **FastAPI** - MIT License

- **Next.js** - MIT License- แสดงข้อความที่อ่านได้# อัพเกรด pip



## 🤝 Contributing- แสดง confidence scorepip install --upgrade pip setuptools wheel



1. Fork repo- แสดง bounding boxes บนรูปภาพ

2. Create branch

3. Commit changes# ติดตั้ง dependencies

4. Push to branch

5. Open PR## 🔧 API Documentationpip install -r requirements.txt



---```



**Made with ❤️ for Thai OCR**  ### Backend Endpoints

Powered by CRAFT + EasyOCR + Next.js

**หมายเหตุ:** ใช้ Python 3.12 เท่านั้น เพราะ libraries บางตัวยังไม่รองรับ 3.13

#### GET /

Health check พื้นฐาน### 2. แก้ไข Compatibility Issue (สำคัญ!)



#### GET /healthcraft-text-detector ยังไม่รองรับ torchvision ใหม่ ต้องแก้ไขด้วยมือ:

```json

{```bash

  "status": "healthy",# แก้ไขไฟล์ vgg16_bn.py

  "craft_loaded": true,nano venv/lib/python3.12/site-packages/craft_text_detector/models/basenet/vgg16_bn.py

  "ocr_readers_loaded": 1,

  "available_language_combinations": ["en,th"]# เปลี่ยนบรรทัดนี้:

}from torchvision.models.vgg import model_urls

```

# เป็น:

#### POST /ocr# from torchvision.models.vgg import model_urls

CRAFT + EasyOCR (ความแม่นยำสูง)

# และเปลี่ยน:

**Request:**model_urls["vgg16_bn"] = model_urls["vgg16_bn"].replace("https://", "http://")

```bashvgg_pretrained_features = models.vgg16_bn(pretrained=pretrained).features

curl -X POST http://localhost:8005/ocr \

  -F "file=@image.jpg" \# เป็น:

  -F 'languages=["th", "en"]'if pretrained:

```    from torchvision.models import VGG16_BN_Weights

    vgg_pretrained_features = models.vgg16_bn(weights=VGG16_BN_Weights.IMAGENET1K_V1).features

**Response:**else:

```json    vgg_pretrained_features = models.vgg16_bn(weights=None).features

{```

  "success": true,

  "text": "ข้อความทั้งหมดที่อ่านได้",(หรือใช้ `setup.sh` ที่จะทำให้อัตโนมัติ)

  "total_regions": 10,

  "recognized_regions": 8,### 3. รัน Backend

  "details": [

    {```bash

      "text": "ข้อความ",python main.py

      "confidence": 0.95,```

      "box": {"x1": 10, "y1": 20, "x2": 100, "y2": 50}

    }Backend จะรันที่ http://localhost:8005

  ]

}### 4. ติดตั้ง Frontend

```

```bash

#### POST /ocr-simplecd ../ocr-browser

EasyOCR เพียงอย่างเดียว (เร็วกว่า แต่อาจแม่นยำน้อยกว่า)

# ติดตั้ง dependencies

**API Documentation:** http://localhost:8005/docsnpm install



## 📊 เปรียบเทียบ# สร้างไฟล์ .env.local

echo "PYTHON_API_URL=http://localhost:8005" > .env.local

| คุณสมบัติ | Browser OCR | CRAFT OCR |

|-----------|-------------|-----------|# รัน development server

| **ความแม่นยำ** | ⭐⭐⭐ ปานกลาง | ⭐⭐⭐⭐⭐ สูงมาก |npm run dev

| **ความเร็ว (CPU)** | ช้า (~10-30 วิ) | ปานกลาง (~3-5 วิ) |```

| **ความเร็ว (GPU)** | N/A | เร็วมาก (~0.5-2 วิ) |

| **การติดตั้ง** | ง่าย | ใช้ setup.sh |Frontend จะรันที่ http://localhost:3005

| **Backend** | ❌ ไม่ต้องการ | ✅ จำเป็น |

| **Layout ซับซ้อน** | ⭐⭐ พอใช้ | ⭐⭐⭐⭐⭐ ยอดเยี่ยม |## 🔧 API Documentation



## 💡 Tips สำหรับผลลัพธ์ที่ดี### Backend Endpoints



### รูปภาพที่ดี#### GET /

- ✅ ความละเอียดสูง (>= 1024px)Health check พื้นฐาน

- ✅ แสงสว่างเพียงพอ

- ✅ ข้อความตรง ไม่เอียงมาก#### GET /health

- ✅ Contrast ชัด (ตัวหนังสือดำ พื้นหลังขาว)```json

- ❌ หลีกเลี่ยงภาพเบลอ{

- ❌ หลีกเลี่ยงเงา/สะท้อนแสง  "status": "healthy",

  "craft_loaded": true,

### ปรับแต่งประสิทธิภาพ  "ocr_readers_loaded": 1,

- GPU จะเปิดใช้อัตโนมัติถ้าตรวจพบ NVIDIA GPU  "available_language_combinations": ["en,th"]

- ใช้ `/ocr-simple` ถ้าต้องการความเร็ว}

- ลด `long_size` ใน CRAFT config ถ้าต้องการเร็วกว่า```



## 🔍 เทคโนโลจีที่ใช้#### POST /ocr

CRAFT + EasyOCR (ความแม่นยำสูง)

### Frontend

- **Next.js 16** - React framework (App Router)**Request:**

- **React 19.2** - UI library```bash

- **TypeScript 5** - Type safetycurl -X POST http://localhost:8005/ocr \

- **Tailwind CSS 4** - Styling  -F "file=@image.jpg" \

- **Tesseract.js 5** - Browser OCR  -F 'languages=["th", "en"]'

```

### Backend

- **FastAPI 0.104** - Python web framework**Response:**

- **PyTorch 2.2** - Deep learning```json

- **CRAFT** - Text detection (MIT License){

- **EasyOCR 1.7** - Text recognition  "success": true,

- **OpenCV 4.12** - Image processing  "text": "ข้อความทั้งหมดที่อ่านได้",

- **Python 3.12** - Programming language  "total_regions": 10,

  "recognized_regions": 8,

### CRAFT (Character Region Awareness for Text)  "details": [

พัฒนาโดย Clova AI (NAVER/LINE)    {

- Paper: [CVPR 2019](https://arxiv.org/abs/1904.01941)      "text": "ข้อความ",

- GitHub: [clovaai/CRAFT-pytorch](https://github.com/clovaai/CRAFT-pytorch)      "confidence": 0.95,

- เหมาะมากสำหรับภาษาไทยที่มีสระ/วรรณยุกต์      "box": {"x1": 10, "y1": 20, "x2": 100, "y2": 50}

    }

## 🐛 Troubleshooting  ]

}

### Backend ไม่ start```

```bash

# ตรวจสอบ logs#### POST /ocr-simple

cat logs/backend.logEasyOCR เพียงอย่างเดียว (เร็วกว่า แต่อาจแม่นยำน้อยกว่า)



# ตรวจสอบว่า venv มี dependencies ครบAPI Documentation: http://localhost:8005/docs

cd ocr-backend

source venv/bin/activate## 🎯 การใช้งาน

pip list | grep -E "torch|fastapi|easyocr"

```### 1. เปิดเบราว์เซอร์

ไปที่ http://localhost:3005

### Frontend ไม่เชื่อมต่อ Backend

```bash### 2. เลือก Prototype

# ตรวจสอบ .env.local- **Prototype 1**: Browser OCR (Tesseract.js) - ไม่ต้องใช้ backend

cat ocr-browser/.env.local- **Prototype 2**: CRAFT OCR - ความแม่นยำสูง ต้องรัน backend

# ควรมี: PYTHON_API_URL=http://localhost:8005

### 3. อัพโหลดรูปภาพ

# ตรวจสอบว่า backend รันอยู่- คลิก "เลือกไฟล์" หรือ

curl http://localhost:8005/health- Paste รูปภาพจาก clipboard (Ctrl+V)

```

### 4. รอผลลัพธ์

### GPU ไม่ทำงาน- แสดงข้อความที่อ่านได้

```bash- แสดง confidence score

# ตรวจสอบ CUDA- แสดง bounding boxes บนรูปภาพ

nvidia-smi

# หรือ WSL: /usr/lib/wsl/lib/nvidia-smi## 📊 เปรียบเทียบ



# ตรวจสอบ PyTorch CUDA support| คุณสมบัติ | Browser OCR (Tesseract.js) | CRAFT OCR (Python Backend) |

cd ocr-backend|-----------|---------------------------|---------------------------|

source venv/bin/activate| **ความแม่นยำ** | ⭐⭐⭐ ปานกลาง | ⭐⭐⭐⭐⭐ สูงมาก |

python -c "import torch; print(torch.cuda.is_available())"| **ความเร็ว** | ช้ากว่า (รันใน browser) | เร็วกว่า (GPU optional) |

```| **การติดตั้ง** | ง่าย (npm install เท่านั้น) | ซับซ้อนกว่า (Python + dependencies) |

| **Backend Server** | ❌ ไม่ต้องการ | ✅ จำเป็น |

### Port conflicts| **Layout ซับซ้อน** | ⭐⭐ พอใช้ | ⭐⭐⭐⭐⭐ ยอดเยี่ยม |

```bash| **ภาษาที่รองรับ** | 100+ ภาษา | ไทย + อังกฤษ (ปรับแต่งได้) |

# หา process ที่ใช้ port| **รันแบบ Offline** | ✅ ได้ | ✅ ได้ (หลัง download models) |

lsof -i :8005  # backend

lsof -i :3005  # frontend## 🎯 เลือกใช้แบบไหนดี?



# Kill process### ใช้ Browser OCR (Tesseract.js) เมื่อ:

kill -9 <PID>- ต้องการ prototype ง่ายๆ เริ่มต้นเร็ว

- ไม่อยากจัดการ Backend Server

# หรือใช้ stop.sh- เอกสารมี layout ไม่ซับซ้อน

./stop.sh- ไม่ต้องการความแม่นยำสูงมาก

```

### ใช้ CRAFT OCR (Python Backend) เมื่อ:

## 📝 Scripts Reference- ต้องการความแม่นยำสูงสุด

- เอกสารมี layout ซับซ้อน (หลายคอลัมน์, มุมเอียง, ฯลฯ)

### setup.sh- พร้อม deploy backend server

ติดตั้งระบบทั้งหมดอัตโนมัติ:- ต้องการ production-grade OCR

- ✅ ตรวจสอบ Python 3.12, Node.js

- ✅ สร้าง virtual environment## 🛠️ เทคโนโลジีที่ใช้

- ✅ ติดตั้ง Python dependencies

- ✅ แก้ไข craft-text-detector compatibility### Frontend (Next.js)

- ✅ ติดตั้ง Node.js dependencies- **Framework:** Next.js 16 (App Router)

- ✅ สร้าง .env.local- **React:** 19.2.0

- **TypeScript:** 5.x

### start.sh- **Styling:** Tailwind CSS 4.0

เริ่ม services ทั้งหมด:- **OCR Library:** Tesseract.js 5.0.4

- Start Python backend (port 8005)

- Start Next.js frontend (port 3005)### Backend (Python)

- สร้าง PID files สำหรับ process management- **Framework:** FastAPI 0.104.1

- บันทึก logs ไปยัง `logs/` directory- **Text Detection:** CRAFT (Character Region Awareness for Text Detection)

- **Text Recognition:** EasyOCR 1.7.1

### stop.sh- **Deep Learning:** PyTorch 2.1.0

หยุด services ทั้งหมด:- **Computer Vision:** OpenCV 4.8.1

- Kill backend และ frontend processes

- ลบ PID files## 🔍 เกี่ยวกับ CRAFT

- Kill processes บน port 8005 และ 3005 (backup)

CRAFT (Character Region Awareness for Text Detection) เป็นเทคโนโลยีที่พัฒนาโดย **Clova AI** ของ NAVER (บริษัทแม่ของ LINE)

## 🚀 Deployment

**หลักการทำงาน:**

### Production Checklist- ตรวจจับข้อความในระดับ **ตัวอักษร** (character-level)

- [ ] เปลี่ยน ports ใน .env ถ้าจำเป็น- วิเคราะห์ **ความสัมพันธ์ระหว่างตัวอักษร** (character affinity)

- [ ] ตั้งค่า CORS ใน backend/main.py- เหมาะมากสำหรับภาษาไทยที่มีสระ/วรรณยุกต์รอบตัวพยัญชนะ

- [ ] ใช้ production web server (Gunicorn/Uvicorn workers)

- [ ] ตั้งค่า reverse proxy (Nginx)**Paper:** [Character Region Awareness for Text Detection (CVPR 2019)](https://arxiv.org/abs/1904.01941)

- [ ] เปิด GPU acceleration ถ้ามี

- [ ] ตั้งค่า log rotation**GitHub:** https://github.com/clovaai/CRAFT-pytorch

- [ ] Setup monitoring และ health checks

**License:** MIT License

## 📄 License

## 📝 License

Project นี้ใช้ open source technologies:

- **CRAFT**: MIT Licenseโปรเจกต์นี้ใช้เทคโนโลยีที่เป็น open source:

- **Tesseract.js**: Apache 2.0

- **EasyOCR**: Apache 2.0- **CRAFT:** MIT License

- **FastAPI**: MIT License- **Tesseract.js:** Apache License 2.0

- **Next.js**: MIT License- **EasyOCR:** Apache License 2.0

- **FastAPI:** MIT License

## 🤝 Contributing- **Next.js:** MIT License



1. Fork repository## 🤝 Contributing

2. Create feature branch

3. Commit changesหากพบปัญหาหรือต้องการปรับปรุง สามารถเปิด issue หรือส่ง pull request ได้เลยครับ

4. Push to branch

5. Open Pull Request## 💡 Tips



## 📧 Support### สำหรับผลลัพธ์ที่ดีที่สุด:

1. ใช้รูปภาพที่คมชัด ความละเอียดสูง

หากพบปัญหาหรือมีคำถาม:2. แสงสว่างเพียงพอ ไม่มืดเกินไป

- เปิด GitHub Issue3. ข้อความตรง ไม่เอียงมาก

- ดู logs ใน `logs/` directory4. พื้นหลังไม่วุ่นวาย มี contrast ที่ดี

- อ่าน Troubleshooting section5. ขนาดตัวอักษรไม่เล็กเกินไป



---### ปรับปรุงประสิทธิภาพ Python Backend:

- ใช้ GPU ถ้ามี (ตั้ง `cuda=True` ใน main.py)

**Made with ❤️ for Thai OCR**  - ลด `long_size` ถ้าต้องการประมวลผลเร็วขึ้น

Powered by CRAFT + EasyOCR + Next.js- ใช้ `/ocr-simple` endpoint ถ้าไม่ต้องการ CRAFT detection


---

Made with ❤️ using Next.js, CRAFT, and EasyOCR
