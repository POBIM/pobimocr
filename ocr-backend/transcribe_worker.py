#!/usr/bin/env python3
"""Isolated worker used by FastAPI to run speech-to-text outside the main process."""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Any, Dict

from device_info import get_device_info
import transcribe

logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stderr)
logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Whisper transcription in an isolated process")
    parser.add_argument("--mode", choices=["json", "stream"], default="json")
    parser.add_argument("--file", required=True, help="Path to the audio/video file")
    parser.add_argument("--model-size", default="base", help="Whisper model size")
    parser.add_argument("--language", default="th", help="Language code or auto")
    parser.add_argument("--initial-prompt", dest="initial_prompt")
    parser.add_argument("--chunk-duration", dest="chunk_duration", type=int, default=0)
    return parser.parse_args()


def _configure_transcribe() -> Dict[str, Any]:
    device_config = get_device_info()
    transcribe.set_device_config(device_config)
    return device_config


def _write_json(payload: Dict[str, Any]) -> int:
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()
    return 0 if payload.get("success") else 1


def _run_json_mode(args: argparse.Namespace) -> int:
    if not os.path.exists(args.file):
        return _write_json({"success": False, "error": f"file not found: {args.file}"})

    try:
        result = transcribe.transcribe_audio(
            args.file,
            model_size=args.model_size,
            language=args.language,
            initial_prompt=args.initial_prompt,
        )
    except Exception as exc:
        logger.exception("Transcription worker failed")
        return _write_json({"success": False, "error": str(exc)})

    if not result:
        return _write_json({"success": False, "error": "transcribe_audio returned no result"})

    payload = {
        "success": True,
        "text": result.get("text", ""),
        "language": result.get("language", "unknown"),
        "segments": result.get("segments", []),
        "total_segments": len(result.get("segments", [])),
    }
    return _write_json(payload)


def _run_stream_mode(args: argparse.Namespace) -> int:
    if not os.path.exists(args.file):
        sys.stdout.write(f"STATUS: ไฟล์ไม่พบ: {args.file}\nDONE\n")
        sys.stdout.flush()
        return 1

    try:
        for chunk in transcribe.transcribe_audio_stream(
            args.file,
            model_size=args.model_size,
            language=args.language,
            chunk_duration=args.chunk_duration,
            initial_prompt=args.initial_prompt,
        ):
            sys.stdout.write(chunk)
            sys.stdout.flush()
        return 0
    except Exception as exc:
        logger.exception("Streaming transcription worker failed")
        sys.stdout.write(f"STATUS: เกิดข้อผิดพลาด: {exc}\nDONE\n")
        sys.stdout.flush()
        return 1


def main() -> int:
    args = _parse_args()
    _configure_transcribe()

    if args.mode == "stream":
        return _run_stream_mode(args)
    return _run_json_mode(args)


if __name__ == "__main__":
    raise SystemExit(main())
