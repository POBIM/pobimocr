import { NextRequest, NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8005';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const languagesStr = formData.get('languages') as string;
    const aiCorrect = formData.get('ai_correct') as string;
    const craftLongSize = formData.get('craft_long_size') as string | null;
    const craftUseRefiner = formData.get('craft_use_refiner') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Parse languages
    let languages = ['th', 'en']; // default
    if (languagesStr) {
      try {
        languages = JSON.parse(languagesStr);
      } catch (e) {
        console.error('Failed to parse languages:', e);
      }
    }

    // Forward the request to Python backend
    const pythonFormData = new FormData();
    pythonFormData.append('file', file);
    pythonFormData.append('languages', JSON.stringify(languages));
    pythonFormData.append('ai_correct', aiCorrect || 'false');
    if (craftLongSize) {
      pythonFormData.append('craft_long_size', craftLongSize);
    }
    if (craftUseRefiner) {
      pythonFormData.append('craft_use_refiner', craftUseRefiner);
    }

    // Try CRAFT endpoint first, fallback to simple if it fails
    let response = await fetch(`${PYTHON_API_URL}/ocr`, {
      method: 'POST',
      body: pythonFormData,
    });

    // If CRAFT fails, try simple OCR endpoint
    if (!response.ok) {
      console.log('CRAFT OCR failed, trying simple OCR...');
      const simplePythonFormData = new FormData();
      simplePythonFormData.append('file', file);
      simplePythonFormData.append('languages', JSON.stringify(languages));
      simplePythonFormData.append('ai_correct', aiCorrect || 'false');
      if (craftLongSize) {
        simplePythonFormData.append('craft_long_size', craftLongSize);
      }
      if (craftUseRefiner) {
        simplePythonFormData.append('craft_use_refiner', craftUseRefiner);
      }

      response = await fetch(`${PYTHON_API_URL}/ocr-simple`, {
        method: 'POST',
        body: simplePythonFormData,
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || 'OCR processing failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to connect to Python backend. Make sure it is running on port 8005.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
