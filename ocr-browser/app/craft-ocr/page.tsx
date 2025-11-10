"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface OCRDetail {
  text: string;
  confidence: number;
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

interface OCRResponse {
  success: boolean;
  text: string;
  total_regions: number;
  recognized_regions: number;
  details: OCRDetail[];
}

export default function CraftOCRPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState(false);
  const [languages, setLanguages] = useState<string[]>(["th", "en"]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type.includes("image")) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], "pasted-image.png", { type: blob.type });
            setSelectedFile(file);

            const reader = new FileReader();
            reader.onload = (readerEvent) => {
              setSelectedImage(readerEvent.target?.result as string);
              setOcrResult(null);
              setError(null);
              setPasteHint(true);
              setTimeout(() => setPasteHint(false), 2000);
            };
            reader.readAsDataURL(blob);
          }
          event.preventDefault();
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      setSelectedImage(readerEvent.target?.result as string);
      setOcrResult(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleOCR = async () => {
    if (!selectedFile) {
      alert("กรุณาเลือกรูปภาพก่อน");
      return;
    }

    setLoading(true);
    setError(null);
    setOcrResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("languages", JSON.stringify(languages));

      const response = await fetch("/api/craft-ocr", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "OCR processing failed");
      }

      setOcrResult(data);
    } catch (err) {
      console.error("OCR Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "เกิดข้อผิดพลาด กรุณาตรวจสอบว่า Python backend กำลังทำงานอยู่"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setOcrResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("คัดลอกข้อความแล้ว!");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700 transition">
          POBIMOCR
        </Link>
        <span>/</span>
        <span className="text-gray-700">CRAFT Engine</span>
      </div>

      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-800">CRAFT Engine</h1>
        <p className="text-sm text-gray-600">
          ใช้ CRAFT Text Detector และ EasyOCR ผ่าน Python backend
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-5">
            <h2 className="text-sm font-semibold text-gray-800">ตั้งค่าภาษา</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={languages.includes("th")}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setLanguages([...languages, "th"]);
                    } else {
                      setLanguages(languages.filter((language) => language !== "th"));
                    }
                  }}
                  className="h-4 w-4 rounded border-purple-300 text-purple-600"
                />
                ภาษาไทย
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={languages.includes("en")}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setLanguages([...languages, "en"]);
                    } else {
                      setLanguages(languages.filter((language) => language !== "en"));
                    }
                  }}
                  className="h-4 w-4 rounded border-purple-300 text-purple-600"
                />
                English
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-800">อัปโหลดรูปภาพ</h2>

            {pasteHint && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
                วางรูปภาพสำเร็จ
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500">
              กด Ctrl+V หรือ Cmd+V เพื่อวางรูปจาก clipboard
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="mt-4 block w-full text-sm text-gray-600 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-purple-100 file:px-4 file:py-2 file:text-sm file:text-purple-700 hover:file:bg-purple-200 transition"
            />

            {selectedImage && (
              <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
                <img src={selectedImage} alt="Selected" className="w-full" />
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleOCR}
                disabled={!selectedFile || loading}
                className="flex-1 rounded-full bg-purple-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {loading ? "ประมวลผล..." : "เริ่มประมวลผล"}
              </button>
              <button
                onClick={handleClear}
                disabled={loading}
                className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                ล้าง
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">เกิดข้อผิดพลาด:</p>
                <p className="mt-1">{error}</p>
              </div>
            )}

            {loading && (
              <div className="mt-4 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-purple-600" />
                <p className="mt-2 text-xs text-gray-500">กำลังประมวลผล...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">ผลลัพธ์</h2>
              {ocrResult?.text && (
                <button
                  onClick={() => copyToClipboard(ocrResult.text)}
                  className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100"
                >
                  คัดลอก
                </button>
              )}
            </div>

            {ocrResult ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-purple-100 bg-purple-50/50 p-4 text-sm">
                  <div>
                    <p className="text-gray-600 text-xs">พื้นที่ที่ตรวจพบ</p>
                    <p className="text-2xl font-semibold text-purple-700">{ocrResult.total_regions}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs">อ่านสำเร็จ</p>
                    <p className="text-2xl font-semibold text-green-600">{ocrResult.recognized_regions}</p>
                  </div>
                </div>

                <textarea
                  value={ocrResult.text}
                  readOnly
                  className="h-36 w-full rounded-lg border border-gray-200 bg-gray-50/50 p-4 font-mono text-sm text-gray-800"
                />

                <div>
                  <h3 className="text-sm font-semibold text-gray-800">รายละเอียด</h3>
                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                    {ocrResult.details.map((detail, index) => (
                      <div key={`${detail.text}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm">
                        <p className="font-medium text-gray-800">{detail.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(detail.confidence * 100).toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50/30 p-8 text-center text-gray-400">
                <p className="text-sm">อัปโหลดภาพและกดประมวลผลเพื่อดูผลลัพธ์</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
