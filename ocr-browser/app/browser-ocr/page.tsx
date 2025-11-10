"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";

export default function BrowserOCRPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [languages, setLanguages] = useState<string[]>(["tha", "eng"]);
  const [pasteHint, setPasteHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type.includes("image")) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
              setSelectedImage(readerEvent.target?.result as string);
              setOcrText("");
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setOcrText("");
    };
    reader.readAsDataURL(file);
  };

  const handleOCR = async () => {
    if (!selectedImage) {
      alert("กรุณาเลือกรูปภาพก่อน");
      return;
    }

    if (languages.length === 0) {
      alert("กรุณาเลือกภาษาอย่างน้อย 1 ภาษา");
      return;
    }

    setLoading(true);
    setOcrText("");
    setProgress(0);

    try {
      const langString = languages.join("+");
      const worker = await createWorker(langString, 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(Math.round(message.progress * 100));
          }
        },
      });

      const { data } = await worker.recognize(selectedImage);
      setOcrText(data.text);
      await worker.terminate();
    } catch (error) {
      console.error("OCR Error:", error);
      alert("เกิดข้อผิดพลาดในการประมวลผล OCR");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setOcrText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700 transition">
          POBIMOCR
        </Link>
        <span>/</span>
        <span className="text-gray-700">Browser Engine</span>
      </div>

      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-800">Browser Engine</h1>
        <p className="text-sm text-gray-600">
          ประมวลผล OCR บนเบราว์เซอร์ด้วย Tesseract.js
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5">
            <h2 className="text-sm font-semibold text-gray-800">ตั้งค่าภาษา</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={languages.includes("tha")}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setLanguages([...languages, "tha"]);
                    } else {
                      setLanguages(languages.filter((language) => language !== "tha"));
                    }
                  }}
                  className="h-4 w-4 rounded border-blue-300 text-blue-600"
                />
                ภาษาไทย
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={languages.includes("eng")}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setLanguages([...languages, "eng"]);
                    } else {
                      setLanguages(languages.filter((language) => language !== "eng"));
                    }
                  }}
                  className="h-4 w-4 rounded border-blue-300 text-blue-600"
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
              className="mt-4 block w-full text-sm text-gray-600 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:text-sm file:text-blue-700 hover:file:bg-blue-200 transition"
            />

            {selectedImage && (
              <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
                <img src={selectedImage} alt="Selected" className="w-full" />
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleOCR}
                disabled={!selectedImage || loading}
                className="flex-1 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {loading ? `ประมวลผล ${progress}%` : "เริ่มประมวลผล"}
              </button>
              <button
                onClick={handleClear}
                disabled={loading}
                className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                ล้าง
              </button>
            </div>

            {loading && (
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">ผลลัพธ์</h2>
              {ocrText && (
                <button
                  onClick={() => navigator.clipboard.writeText(ocrText)}
                  className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100"
                >
                  คัดลอก
                </button>
              )}
            </div>
            <textarea
              value={ocrText}
              onChange={(event) => setOcrText(event.target.value)}
              placeholder="ผลลัพธ์จะแสดงที่นี่"
              className="mt-4 h-[360px] w-full rounded-lg border border-gray-200 bg-gray-50/50 p-4 font-mono text-sm text-gray-800 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
