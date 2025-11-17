import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-800">OCR Platform</h1>
        <p className="text-gray-600 max-w-xl">
          เลือก OCR engine ที่เหมาะกับงานของคุณ
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
        <Link
          href="/browser-ocr"
          className="group rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 transition hover:shadow-md hover:border-blue-200"
        >
          <h2 className="text-lg font-semibold text-gray-800 group-hover:text-blue-700 transition">Browser Engine</h2>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            ประมวลผลบนเบราว์เซอร์ด้วย Tesseract.js ไม่ต้องติดตั้ง backend
          </p>
          <div className="mt-4 inline-flex items-center text-xs text-blue-600 font-medium">
            เริ่มใช้งาน
            <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/craft-ocr"
          className="group rounded-2xl border border-gray-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6 transition hover:shadow-md hover:border-purple-200"
        >
          <h2 className="text-lg font-semibold text-gray-800 group-hover:text-purple-700 transition">CRAFT Engine</h2>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            ใช้ CRAFT + EasyOCR ผ่าน Python backend สำหรับเอกสารซับซ้อน
          </p>
          <div className="mt-4 inline-flex items-center text-xs text-purple-600 font-medium">
            เริ่มใช้งาน
            <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/speech-ocr"
          className="group rounded-2xl border border-gray-200 bg-gradient-to-br from-green-50 to-teal-50 p-6 transition hover:shadow-md hover:border-green-200"
        >
          <h2 className="text-lg font-semibold text-gray-800 group-hover:text-green-700 transition">Speech-to-Text</h2>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            แปลงเสียงและวิดีโอเป็นข้อความด้วย OpenAI Whisper
          </p>
          <div className="mt-4 inline-flex items-center text-xs text-green-600 font-medium">
            เริ่มใช้งาน
            <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </section>
    </div>
  );
}
