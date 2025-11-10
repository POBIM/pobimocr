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
  ai_corrected?: boolean;
}

export default function CraftOCRPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState(false);
  const [languages, setLanguages] = useState<string[]>(["th", "en"]);
  const [showDetails, setShowDetails] = useState(false);
  const [displayMode, setDisplayMode] = useState<"text" | "markdown" | "visual">("text");
  const [editedText, setEditedText] = useState<string>("");
  const [aiImproving, setAiImproving] = useState(false);
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
      formData.append("ai_correct", "false");

      const response = await fetch("/api/craft-ocr", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "OCR processing failed");
      }

      setOcrResult(data);
      // Set edited text เป็นผลลัพธ์เริ่มต้น
      if (data.details && data.details.length > 0) {
        setEditedText(formatTextWithLineBreaks(data.details));
      } else if (data.text) {
        setEditedText(data.text);
      } else {
        setEditedText("");
      }
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

  const handleAiImprove = async () => {
    if (!selectedFile) {
      alert("กรุณาเลือกรูปภาพก่อน");
      return;
    }

    if (!ocrResult) {
      alert("ยังไม่มีผลลัพธ์ให้ปรับปรุง");
      return;
    }

    setAiImproving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("languages", JSON.stringify(languages));
      formData.append("ai_correct", "true");

      const response = await fetch("/api/craft-ocr", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI correction failed");
      }

      setOcrResult(data);
      if (data.text) {
        setEditedText(data.text);
      } else if (data.details && data.details.length > 0) {
        setEditedText(formatTextWithLineBreaks(data.details));
      }
    } catch (err) {
      console.error("AI Improve Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "ปรับปรุงด้วย AI ไม่สำเร็จ กรุณาลองใหม่"
      );
    } finally {
      setAiImproving(false);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setOcrResult(null);
    setError(null);
    setEditedText("");
    setAiImproving(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("คัดลอกข้อความแล้ว!");
  };

  // จัดเรียง text ตามตำแหน่งจริงในรูป (top to bottom, left to right)
  const formatTextWithLineBreaks = (details: OCRDetail[]): string => {
    if (!details || details.length === 0) return "";

    // Sort by y-coordinate first (top to bottom)
    const sortedByY = [...details].sort((a, b) => a.box.y1 - b.box.y1);

    // Group by rows (same y-coordinate within threshold)
    const rows: OCRDetail[][] = [];
    let currentRow: OCRDetail[] = [];
    let lastY = sortedByY[0].box.y1;
    const yThreshold = 20; // pixels tolerance for same row

    sortedByY.forEach((detail) => {
      if (Math.abs(detail.box.y1 - lastY) > yThreshold) {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [detail];
        lastY = detail.box.y1;
      } else {
        currentRow.push(detail);
      }
    });
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // Sort each row by x-coordinate (left to right) and join with spaces
    return rows
      .map((row) =>
        row
          .sort((a, b) => a.box.x1 - b.box.x1)
          .map((detail) => detail.text)
          .join(" ")
      )
      .join("\n");
  };

  // จัดกลุ่มข้อมูลเป็น table data
  const parseTableData = (details: OCRDetail[]): string[][] => {
    if (!details || details.length === 0) return [];

    // จัดกลุ่มเป็นแถว
    const sortedByY = [...details].sort((a, b) => a.box.y1 - b.box.y1);
    const rows: OCRDetail[][] = [];
    let currentRow: OCRDetail[] = [];
    let lastY = sortedByY[0].box.y1;
    const yThreshold = 20;

    sortedByY.forEach((detail) => {
      if (Math.abs(detail.box.y1 - lastY) > yThreshold) {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [detail];
        lastY = detail.box.y1;
      } else {
        currentRow.push(detail);
      }
    });
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // เรียงแต่ละแถวจากซ้ายไปขวา
    const sortedRows = rows.map((row) =>
      row.sort((a, b) => a.box.x1 - b.box.x1)
    );

    // หาจำนวนคอลัมน์สูงสุด
    const maxCols = Math.max(...sortedRows.map((row) => row.length));

    // แปลงเป็น 2D array
    return sortedRows.map((row) => {
      const cells = [];
      for (let i = 0; i < maxCols; i++) {
        cells.push(row[i]?.text || "");
      }
      return cells;
    });
  };

  // แปลง edited text เป็น table data
  const parseTextToTable = (text: string): string[][] => {
    if (!text) return [];

    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // แยกด้วย space หลายๆช่องหรือ tab
      return line.split(/\s{2,}|\t/).map(cell => cell.trim()).filter(cell => cell);
    });
  };

  // แปลงข้อมูลเป็น Markdown table จาก edited text
  const formatTextAsMarkdownTable = (text: string): string => {
    const tableData = parseTextToTable(text);
    if (tableData.length === 0) return text;

    const tableRows = tableData.map((row) => {
      return `| ${row.join(" | ")} |`;
    });

    // เพิ่ม header separator หลังแถวแรก
    if (tableRows.length > 0) {
      const separator = `| ${Array(tableData[0].length).fill("---").join(" | ")} |`;
      tableRows.splice(1, 0, separator);
    }

    return tableRows.join("\n");
  };

  // แปลงข้อมูลเป็น Markdown table (เดิม - สำหรับ backward compatibility)
  const formatAsMarkdownTable = (details: OCRDetail[]): string => {
    const tableData = parseTableData(details);
    if (tableData.length === 0) return "";

    const tableRows = tableData.map((row) => {
      return `| ${row.join(" | ")} |`;
    });

    // เพิ่ม header separator หลังแถวแรก
    if (tableRows.length > 0) {
      const separator = `| ${Array(tableData[0].length).fill("---").join(" | ")} |`;
      tableRows.splice(1, 0, separator);
    }

    return tableRows.join("\n");
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">ผลลัพธ์ (แก้ไขได้)</h2>
                {ocrResult?.ai_corrected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    AI แก้ไขแล้ว
                  </span>
                )}
              </div>
              {editedText && displayMode !== "visual" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(
                      displayMode === "text"
                        ? editedText
                        : formatTextAsMarkdownTable(editedText)
                    )}
                    className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100"
                  >
                    คัดลอก
                  </button>
                  <button
                    onClick={handleAiImprove}
                    disabled={!selectedFile || aiImproving || loading}
                    className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {aiImproving ? "กำลังปรับปรุง..." : "ปรับปรุงด้วย AI"}
                  </button>
                </div>
              )}
            </div>

            {ocrResult ? (
              <div className="mt-4 space-y-4">
                {/* Toggle โหมดการแสดงผล */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">รูปแบบ:</span>
                    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                      <button
                        onClick={() => setDisplayMode("text")}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                          displayMode === "text"
                            ? "bg-purple-100 text-purple-700"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        ข้อความ
                      </button>
                      <button
                        onClick={() => setDisplayMode("markdown")}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                          displayMode === "markdown"
                            ? "bg-purple-100 text-purple-700"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Markdown
                      </button>
                      <button
                        onClick={() => setDisplayMode("visual")}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                          displayMode === "visual"
                            ? "bg-purple-100 text-purple-700"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        ตาราง
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    💡 เคล็ดลับ: ใช้ 2 spaces หรือมากกว่าเพื่อแยกคอลัมน์ในตาราง
                  </p>
                </div>

                {displayMode === "visual" ? (
                  <div className="overflow-auto rounded-lg border border-gray-200 bg-white max-h-[500px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="border-b border-gray-200 bg-purple-50/50">
                          {parseTextToTable(editedText)[0]?.map((cell, index) => (
                            <th
                              key={index}
                              className="px-4 py-3 text-left font-semibold text-gray-800"
                            >
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parseTextToTable(editedText).slice(1).map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="border-b border-gray-100 transition hover:bg-gray-50/50"
                          >
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-3 text-gray-700">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <textarea
                    value={
                      displayMode === "text"
                        ? editedText
                        : formatTextAsMarkdownTable(editedText)
                    }
                    onChange={(e) => {
                      if (displayMode === "text") {
                        setEditedText(e.target.value);
                      }
                    }}
                    placeholder="ผลลัพธ์จะแสดงที่นี่..."
                    className="h-[500px] w-full rounded-lg border border-gray-200 bg-white p-4 font-mono text-sm text-gray-800 leading-relaxed focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
                )}

                {ocrResult.details && ocrResult.details.length > 0 && (
                  <div className="rounded-lg border border-gray-200">
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="flex w-full items-center justify-between rounded-lg bg-gray-50/50 p-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100/50"
                    >
                      <span>รายละเอียดความมั่นใจ ({ocrResult.details.length} รายการ)</span>
                      <svg
                        className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showDetails && (
                      <div className="max-h-60 space-y-2 overflow-y-auto p-3">
                        {ocrResult.details.map((detail, index) => (
                          <div key={`${detail.text}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                            <p className="font-medium text-gray-800">{detail.text}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              ความมั่นใจ: {(detail.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
