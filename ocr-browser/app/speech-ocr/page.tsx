"use client";

import Link from "next/link";
import { useRef, useState } from "react";

interface TranscribeSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscribeResponse {
  success: boolean;
  text: string;
  language: string;
  segments: TranscribeSegment[];
  total_segments: number;
}

const resolveApiEndpoint = (path: string) => {
  const base = process.env.NEXT_PUBLIC_PYTHON_API_URL?.replace(/\/?$/, "");
  if (base) {
    return `${base}${path}`;
  }
  return `/api${path}`;
};

export default function SpeechOCRPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcribeResult, setTranscribeResult] = useState<TranscribeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelSize, setModelSize] = useState<string>("base");
  const [language, setLanguage] = useState<string>("th");
  const [progress, setProgress] = useState<string[]>([]);
  const [streamMode, setStreamMode] = useState<boolean>(true); // เปิด stream mode เพื่อ memory optimization
  const fileInputRef = useRef<HTMLInputElement>(null);

  const models = [
    { value: "tiny", label: "Tiny - เร็ว (39MB)" },
    { value: "base", label: "Base - แนะนำ (139MB)" },
    { value: "small", label: "Small - ดีขึ้น (244MB)" },
    { value: "medium", label: "Medium - ดีมาก (769MB)" },
    { value: "large", label: "Large - ดีที่สุด (2.9GB)" },
  ];

  const languages = [
    { value: "auto", label: "ตรวจจับอัตโนมัติ" },
    { value: "th", label: "ไทย" },
    { value: "en", label: "English" },
    { value: "zh", label: "中文" },
    { value: "ja", label: "日本語" },
    { value: "ko", label: "한국어" },
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setTranscribeResult(null);
    setError(null);
    setProgress([]);
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setProgress([]);
    setTranscribeResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("model_size", modelSize);
      formData.append("language", language);

      if (streamMode) {
        // Stream mode - แสดงความคืบหน้า
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout

        try {
          const response = await fetch(resolveApiEndpoint("/transcribe/stream"), {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("Stream not available");
          }

          const decoder = new TextDecoder();
          let buffer = "";
          const segments: string[] = [];
          let detectedLang = "unknown";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("STATUS:")) {
                const status = line.substring(7).trim();
                setProgress((prev) => [...prev, status]);
              } else if (line.startsWith("LANG:")) {
                detectedLang = line.substring(5).trim();
              } else if (line.startsWith("SEG:")) {
                const seg = line.substring(4).trim();
                segments.push(seg);
              } else if (line === "DONE") {
                const fullText = segments.join(" ");
                setTranscribeResult({
                  success: true,
                  text: fullText,
                  language: detectedLang,
                  segments: segments.map((text, idx) => ({
                    start: idx,
                    end: idx + 1,
                    text,
                  })),
                  total_segments: segments.length,
                });
              }
            }
          }

          // If we got here but no result, check if we have segments
          if (!transcribeResult && segments.length > 0) {
            const fullText = segments.join(" ");
            setTranscribeResult({
              success: true,
              text: fullText,
              language: detectedLang,
              segments: segments.map((text, idx) => ({
                start: idx,
                end: idx + 1,
                text,
              })),
              total_segments: segments.length,
            });
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } else {
        // Non-stream mode - รอจนเสร็จ
        setProgress(["กำลังประมวลผล..."]);
        const response = await fetch(resolveApiEndpoint("/transcribe"), {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setTranscribeResult(data);
      }
    } catch (err) {
      console.error("Transcription error:", err);
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการถอดเสียง");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!transcribeResult) return;

    const blob = new Blob([transcribeResult.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setTranscribeResult(null);
    setError(null);
    setProgress([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <section className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 transition hover:bg-gray-200"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-800">Speech-to-Text</h1>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            แปลงเสียงและวิดีโอเป็นข้อความด้วย OpenAI Whisper
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Upload & Settings */}
        <div className="space-y-6">
          {/* File Upload Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">เลือกไฟล์</h2>

            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.flac,.mp4,.avi,.mov,.mkv"
              onChange={handleFileSelect}
              className="hidden"
              id="audio-upload"
            />
            <label
              htmlFor="audio-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition hover:border-blue-400 hover:bg-blue-50"
            >
              <svg className="mb-3 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <p className="mb-1 text-sm font-medium text-gray-700">คลิกเพื่อเลือกไฟล์</p>
              <p className="text-xs text-gray-500">รองรับ MP3, WAV, M4A, FLAC, MP4, AVI, MOV, MKV</p>
            </label>

            {selectedFile && (
              <div className="mt-4 rounded-lg bg-green-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClear}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Settings Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">ตั้งค่า</h2>

            <div className="space-y-4">
              {/* Model Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  โมเดล Whisper
                </label>
                <select
                  value={modelSize}
                  onChange={(e) => setModelSize(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {models.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  ภาษา
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {languages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stream Mode Toggle */}
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <label className="text-sm font-medium text-gray-700">
                  แสดงความคืบหน้า
                </label>
                <button
                  onClick={() => setStreamMode(!streamMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    streamMode ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      streamMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Transcribe Button */}
            <button
              onClick={handleTranscribe}
              disabled={!selectedFile || loading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-medium text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "กำลังถอดเสียง..." : "ถอดเสียงเป็นข้อความ"}
            </button>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Progress Card */}
          {loading && progress.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-blue-900">ความคืบหน้า</h2>
              <div className="space-y-2">
                {progress.slice(-5).map((msg, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-blue-700">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Card */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <h2 className="mb-2 text-lg font-semibold text-red-900">เกิดข้อผิดพลาด</h2>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Result Card */}
          {transcribeResult && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">ผลลัพธ์</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                  >
                    ดาวน์โหลด .txt
                  </button>
                </div>
              </div>

              {/* Language Info */}
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
                <span>ภาษา: {transcribeResult.language}</span>
                <span className="mx-2">•</span>
                <span>ส่วน: {transcribeResult.total_segments}</span>
              </div>

              {/* Transcribed Text */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                  {transcribeResult.text}
                </p>
              </div>

              {/* Segments */}
              {transcribeResult.segments && transcribeResult.segments.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    แสดงทั้งหมด {transcribeResult.segments.length} ส่วน
                  </summary>
                  <div className="mt-3 space-y-2">
                    {transcribeResult.segments.map((seg, idx) => (
                      <div key={idx} className="rounded-lg bg-gray-100 p-3">
                        <p className="text-xs text-gray-500">ส่วนที่ {idx + 1}</p>
                        <p className="mt-1 text-sm text-gray-800">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Empty State */}
          {!loading && !transcribeResult && !error && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <svg className="mb-4 h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <p className="text-sm text-gray-500">อัพโหลดไฟล์เสียงหรือวิดีโอเพื่อเริ่มต้น</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
