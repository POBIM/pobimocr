import { NextRequest, NextResponse } from "next/server";
import { Agent } from "undici";

export const runtime = "nodejs";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8005";
const DEFAULT_GUIDED_PROMPT =
  "ถอดเสียงบทสนทนาภาษาไทยให้ชัดเจน ใช้เครื่องหมายวรรคตอนไทยและรักษาชื่อเฉพาะที่เกี่ยวกับสภาพอากาศ เมืองเชียงใหม่ และคำว่าพายุ/ความกดอากาศ";
const pythonApiAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 600_000,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const modelSize = (formData.get("model_size") as string) ?? "base";
    const language = (formData.get("language") as string) ?? "th";
    const chunkDuration = (formData.get("chunk_duration") as string) ?? "0";
    let initialPrompt = formData.get("initial_prompt") as string | null;
    if (!initialPrompt || initialPrompt.trim().length === 0) {
      initialPrompt = DEFAULT_GUIDED_PROMPT;
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ต้องอัพโหลดไฟล์ก่อน" }, { status: 400 });
    }

    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    pythonFormData.append("model_size", modelSize);
    pythonFormData.append("language", language);
    pythonFormData.append("chunk_duration", chunkDuration);
    pythonFormData.append("initial_prompt", initialPrompt);

    const response = await fetch(`${PYTHON_API_URL}/transcribe/stream`, {
      method: "POST",
      body: pythonFormData,
      dispatcher: pythonApiAgent,
    });

    if (!response.body) {
      const errorBody = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "ไม่ได้รับสตรีมจาก backend",
          details: errorBody || response.statusText,
        },
        { status: response.ok ? 500 : response.status },
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "สตรีมถอดเสียงล้มเหลว",
          details: errorBody || response.statusText,
        },
        { status: response.status },
      );
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("/api/transcribe/stream error", error);
    return NextResponse.json(
      {
        error: "เชื่อมต่อ Python backend ไม่ได้",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
