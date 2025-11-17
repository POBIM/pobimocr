#!/usr/bin/env python3
"""
CLI tool for transcribing audio/video files using faster-whisper
"""
import sys
import os

# Add backend path
sys.path.insert(0, '/home/pobimgroup/POBIMOCR/ocr-backend')

import transcribe

def main():
    # Set device config
    device_config = {
        'type': 'cuda',
        'name': 'NVIDIA GeForce RTX 4060 Laptop GPU',
        'craft_supports_cuda': True,
        'easyocr_gpu': True
    }
    transcribe.set_device_config(device_config)

    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: python transcribe_cli.py <video_file> [model_size] [language]")
        print("\nExample:")
        print("  python transcribe_cli.py video.mp4 base th")
        print("  python transcribe_cli.py audio.mp3 small auto")
        print("\nModel sizes: tiny, base, small, medium, large")
        print("Languages: th, en, auto")
        sys.exit(1)

    file_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
    language = sys.argv[3] if len(sys.argv) > 3 else "th"

    # Check if file exists
    if not os.path.exists(file_path):
        print(f"ERROR: File not found: {file_path}")
        sys.exit(1)

    print("=" * 80)
    print(f"ไฟล์: {file_path}")
    print(f"Model: {model_size}")
    print(f"ภาษา: {language}")
    print("=" * 80)
    print()

    try:
        result = transcribe.transcribe_audio(
            file_path,
            model_size=model_size,
            language=language
        )

        if result:
            print("\n" + "=" * 80)
            print("ผลลัพธ์การถอดเสียง:")
            print("=" * 80)
            print(f"ภาษาที่ตรวจจับได้: {result.get('language', 'unknown')}")
            print(f"จำนวนช่วงเสียง: {len(result.get('segments', []))}")
            print()
            print("ข้อความที่ถอดได้:")
            print("-" * 80)
            print(result['text'])
            print("-" * 80)
            print()

            # Show segments if available
            segments = result.get('segments', [])
            if segments and len(segments) > 1:
                print("\nรายละเอียดแต่ละช่วง:")
                print("=" * 80)
                for i, seg in enumerate(segments, 1):
                    start = seg.get('start', 0)
                    end = seg.get('end', 0)
                    text = seg.get('text', '').strip()
                    print(f"[{i:02d}] {start:6.1f}s - {end:6.1f}s : {text}")
                print()
        else:
            print("\nERROR: ไม่สามารถถอดเสียงได้")
            sys.exit(1)

    except Exception as e:
        print(f"\nERROR: เกิดข้อผิดพลาด: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
