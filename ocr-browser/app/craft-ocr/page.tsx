"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";

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

interface PDFPageContent {
  pageNumber: number;
  previewText: string;
  imageBlob: Blob | null;
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
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [pdfPages, setPdfPages] = useState<PDFPageContent[]>([]);
  const [selectedPdfPages, setSelectedPdfPages] = useState<number[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pageSeparatorTemplate, setPageSeparatorTemplate] = useState<string>("----- หน้า {{page}} -----");

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

  const handlePdfSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPdfLoading(true);
    setPdfError(null);
    setPdfPages([]);
    setSelectedPdfPages([]);
    setPdfFileName(file.name);
    setSelectedFile(null);
    setSelectedImage(null);
    setOcrResult(null);
    setEditedText("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      const workerSrc = await import("pdfjs-dist/build/pdf.worker?url");

      if (pdfjsLib.GlobalWorkerOptions && workerSrc?.default) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default;
      }

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: PDFPageContent[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const items = textContent.items as Array<TextItem | TextMarkedContent>;
        const pageText = items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("ไม่สามารถสร้าง canvas สำหรับเรนเดอร์ PDF ได้");
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;

        const imageBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/png");
        });

        pages.push({
          pageNumber,
          previewText: pageText || "",
          imageBlob,
        });
      }

      setPdfPages(pages);
      setSelectedPdfPages(pages.map((page) => page.pageNumber));
    } catch (err) {
      console.error("PDF parsing error:", err);
      setPdfError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถอ่านไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง"
      );
      setPdfFileName("");
      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const togglePdfPageSelection = (pageNumber: number) => {
    setSelectedPdfPages((prev) => {
      if (prev.includes(pageNumber)) {
        return prev.filter((page) => page !== pageNumber);
      }
      return [...prev, pageNumber].sort((a, b) => a - b);
    });
  };

  const handleToggleAllPdfPages = () => {
    if (selectedPdfPages.length === pdfPages.length) {
      setSelectedPdfPages([]);
      return;
    }
    setSelectedPdfPages(pdfPages.map((page) => page.pageNumber));
  };

  const handleClearPdf = () => {
    setPdfPages([]);
    setSelectedPdfPages([]);
    setPdfError(null);
    setPdfFileName("");
    if (pdfInputRef.current) {
      pdfInputRef.current.value = "";
    }
  };

  const runOcrRequest = async (file: File, aiCorrectValue: boolean) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("languages", JSON.stringify(languages));
    formData.append("ai_correct", aiCorrectValue ? "true" : "false");

    const response = await fetch("/api/craft-ocr", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "OCR processing failed");
    }

    return data as OCRResponse;
  };

  const applyResultToEditor = (data: OCRResponse) => {
    setOcrResult(data);
    if (data.details && data.details.length > 0) {
      setEditedText(formatTextWithLineBreaks(data.details));
    } else if (data.text) {
      setEditedText(data.text);
    } else {
      setEditedText("");
    }
  };

  const handleOCR = async () => {
    const hasPdfDocument = pdfPages.length > 0;

    if (hasPdfDocument) {
      if (selectedPdfPages.length === 0) {
        alert("กรุณาเลือกหน้าจาก PDF ที่ต้องการประมวลผล");
        return;
      }
      await processPdfDocument(false);
      return;
    }

    if (!selectedFile) {
      alert("กรุณาเลือกรูปภาพก่อน");
      return;
    }

    setLoading(true);
    setError(null);
    setOcrResult(null);

    try {
      const data = await runOcrRequest(selectedFile, false);
      applyResultToEditor(data);
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
    const hasPdfDocument = pdfPages.length > 0;

    if (hasPdfDocument) {
      if (selectedPdfPages.length === 0) {
        alert("กรุณาเลือกหน้าจาก PDF ที่ต้องการประมวลผล");
        return;
      }
      setError(null);
      setAiImproving(true);
      try {
        await processPdfDocument(true);
      } finally {
        setAiImproving(false);
      }
      return;
    }

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
      const data = await runOcrRequest(selectedFile, true);
      applyResultToEditor(data);
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
    handleClearPdf();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("คัดลอกข้อความแล้ว!");
  };

  const processPdfDocument = async (aiCorrectValue: boolean) => {
    setLoading(true);
    setError(null);
    setOcrResult(null);

    try {
      const selectedSet = new Set(selectedPdfPages);
      const sortedPages = pdfPages
        .filter((page) => selectedSet.has(page.pageNumber))
        .sort((a, b) => a.pageNumber - b.pageNumber);

      if (sortedPages.length === 0) {
        throw new Error("กรุณาเลือกหน้า PDF อย่างน้อยหนึ่งหน้า");
      }

      const combinedSegments: string[] = [];
      let totalRegions = 0;
      let recognizedRegions = 0;
      let aggregatedDetails: OCRDetail[] = [];
      let aiCorrected = false;
      let processedPages = 0;
      const baseName = pdfFileName ? pdfFileName.replace(/\.pdf$/i, "") : "pdf-page";

      for (const page of sortedPages) {
        if (!page.imageBlob) {
          console.warn(`Page ${page.pageNumber} ไม่มีข้อมูลภาพสำหรับประมวลผล`);
          continue;
        }

        const file = new File(
          [page.imageBlob],
          `${baseName}-page-${page.pageNumber}.png`,
          { type: "image/png" }
        );
        const result = await runOcrRequest(file, aiCorrectValue);

        const pageText =
          result.text && result.text.trim().length > 0
            ? result.text
            : result.details && result.details.length > 0
              ? formatTextWithLineBreaks(result.details)
              : "";

        const separator = pageSeparatorTemplate.replace(
          "{{page}}",
          page.pageNumber.toString()
        );
        combinedSegments.push(`${separator}\n${pageText}`.trim());

        totalRegions += result.total_regions || 0;
        recognizedRegions += result.recognized_regions || 0;
        if (result.details) {
          aggregatedDetails = aggregatedDetails.concat(result.details);
        }
        aiCorrected = aiCorrected || Boolean(result.ai_corrected);
        processedPages += 1;
      }

      if (processedPages === 0) {
        throw new Error("ไม่สามารถประมวลผลหน้า PDF ที่เลือกได้");
      }

      const combinedText = combinedSegments.join("\n\n");
      const aggregateResponse: OCRResponse = {
        success: true,
        text: combinedText,
        total_regions: totalRegions,
        recognized_regions: recognizedRegions,
        details: aggregatedDetails,
        ai_corrected: aiCorrected,
      };

      setOcrResult(aggregateResponse);
      setEditedText(combinedText);
    } catch (err) {
      console.error("PDF OCR Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "ประมวลผล PDF ไม่สำเร็จ กรุณาลองใหม่"
      );
    } finally {
      setLoading(false);
    }
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
                disabled={
                  loading ||
                  (!selectedFile && pdfPages.length === 0)
                }
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

          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">แปลงข้อความจาก PDF</h2>
              <p className="mt-1 text-xs text-gray-500">
                เลือกไฟล์หลายหน้า เลือกหน้าที่ต้องการ แล้วค่อยกด &quot;เริ่มประมวลผล&quot;
              </p>
            </div>

            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              onChange={handlePdfSelect}
              className="mt-4 block w-full text-sm text-gray-600 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:text-sm file:text-blue-700 hover:file:bg-blue-200 transition"
            />

            {pdfFileName && (
              <p className="mt-2 text-xs text-gray-500">ไฟล์: {pdfFileName}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleToggleAllPdfPages}
                disabled={pdfPages.length === 0}
                className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {selectedPdfPages.length === pdfPages.length && pdfPages.length > 0
                  ? "ยกเลิกการเลือกทั้งหมด"
                  : "เลือกทุกหน้า"}
              </button>
              <button
                onClick={handleClearPdf}
                disabled={pdfPages.length === 0}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ล้าง PDF
              </button>
            </div>

            {pdfLoading && (
              <div className="mt-4 text-center text-xs text-gray-500">
                <div className="mx-auto mb-2 inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500" />
                กำลังอ่านไฟล์ PDF...
              </div>
            )}

            {pdfError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {pdfError}
              </div>
            )}

            {pdfPages.length > 0 && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    เลือก {selectedPdfPages.length} / {pdfPages.length} หน้า
                  </span>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {pdfPages.map((page) => (
                    <label
                      key={page.pageNumber}
                      className={`flex cursor-pointer gap-3 rounded-lg border bg-white p-3 text-sm transition ${
                        selectedPdfPages.includes(page.pageNumber)
                          ? "border-blue-300 shadow-sm"
                          : "border-gray-200 hover:border-blue-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPdfPages.includes(page.pageNumber)}
                        onChange={() => togglePdfPageSelection(page.pageNumber)}
                        className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600"
                      />
                      <div>
                        <p className="font-medium text-gray-700">หน้า {page.pageNumber}</p>
                        <p className="mt-1 max-h-10 overflow-hidden text-ellipsis text-xs text-gray-500">
                          {page.previewText || "ไม่มีข้อความตัวอย่าง"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">
                    {"ตัวคั่นหน้า (ใช้ {{page}} แทนหมายเลขหน้า)"}
                  </label>
                  <input
                    type="text"
                    value={pageSeparatorTemplate}
                    onChange={(event) => setPageSeparatorTemplate(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="rounded-lg border border-dashed border-blue-200 bg-white/60 p-3 text-xs text-blue-700">
                  เลือกหน้าที่ต้องการแล้วกด &quot;เริ่มประมวลผล&quot; เพื่อให้ระบบใช้ GPU OCR พร้อมตัวคั่นหน้าอัตโนมัติ
                </div>
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
                    disabled={
                      aiImproving ||
                      loading ||
                      (!selectedFile && pdfPages.length === 0)
                    }
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
