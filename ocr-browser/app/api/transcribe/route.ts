import { NextRequest, NextResponse } from "next/server";
import { Agent } from "undici";

export const runtime = "nodejs";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8005";
const pythonApiAgent = new Agent({
  headersTimeout: 0, // allow very long Whisper jobs
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
    const initialPrompt = formData.get("initial_prompt") as string | null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ต้องอัพโหลดไฟล์เสียงหรือวิดีโอ" }, { status: 400 });
    }

    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    pythonFormData.append("model_size", modelSize);
    pythonFormData.append("language", language);
    if (initialPrompt) {
      pythonFormData.append("initial_prompt", initialPrompt);
    }

    const response = await fetch(`${PYTHON_API_URL}/transcribe`, {
      method: "POST",
      body: pythonFormData,
      dispatcher: pythonApiAgent,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "ถอดเสียงไม่สำเร็จ",
          details: errorBody || response.statusText,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/transcribe error", error);
    return NextResponse.json(
      {
        error: "เชื่อมต่อ Python backend ไม่ได้",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
