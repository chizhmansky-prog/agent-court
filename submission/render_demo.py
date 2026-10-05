"""Render an 80s edited demo from untouched production screenshots.

Python standard library only; FFmpeg/ffprobe must already be installed.
Run from any directory: python submission/render_demo.py
Existing final exports require --regenerate, with old metadata/hash read first.
All captures/fonts are required before any generated artifact is written.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap

WORKSPACE = Path(__file__).resolve().parent.parent
SUBMISSION = WORKSPACE / "submission"


def resolve_relative(value: str) -> Path:
    if not isinstance(value, str) or not value or any(ch in value for ch in "\n\r:'"):
        raise ValueError("Expected a simple relative path without FFmpeg escape characters")
    path = (WORKSPACE / value).resolve()
    if not path.is_relative_to(WORKSPACE) or Path(value).is_absolute():
        raise ValueError(f"Path leaves the workspace: {value}")
    return path


def relative(path: Path) -> str:
    return path.resolve().relative_to(WORKSPACE).as_posix()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run(command: list[str]) -> str:
    completed = subprocess.run(command, cwd=WORKSPACE, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=False)
    if completed.returncode:
        raise RuntimeError(f"{Path(command[0]).name} exited {completed.returncode}:\n{completed.stderr[-6000:]}")
    return completed.stdout


def probe(binary: str, path: Path) -> dict:
    return json.loads(run([binary, "-v", "error", "-show_format", "-show_streams", "-of", "json", relative(path)]))


def wrapped_caption(value: str) -> str:
    lines = []
    for paragraph in value.splitlines():
        lines.extend(textwrap.wrap(paragraph, width=90, break_long_words=False, break_on_hyphens=False) or [""])
    if len(lines) > 2:
        raise ValueError("Caption exceeds the two-line header area")
    return "\n".join(lines)


def verify_output(metadata: dict, manifest: dict) -> dict:
    video = next((item for item in metadata["streams"] if item.get("codec_type") == "video"), None)
    audio = next((item for item in metadata["streams"] if item.get("codec_type") == "audio"), None)
    duration = float(metadata["format"]["duration"])
    expected = sum(scene["seconds"] for scene in manifest["scenes"])
    checks = {
        "under90Seconds": 0 < duration < 90,
        "expectedDuration": abs(duration - expected) < 0.25,
        "resolution": bool(video and video.get("width") == manifest["width"] and video.get("height") == manifest["height"]),
        "h264": bool(video and video.get("codec_name") == "h264"),
        "yuv420p": bool(video and video.get("pix_fmt") == "yuv420p"),
        "30fps": bool(video and video.get("avg_frame_rate") in ("30/1", "60/2")),
        "silentAacTrack": bool(audio and audio.get("codec_name") == "aac") if manifest["silentAac"] else audio is None,
    }
    if not all(checks.values()):
        raise RuntimeError(f"Export read-back failed: {json.dumps(checks)}")
    return {
        "durationSeconds": duration, "expectedDurationSeconds": expected,
        "width": video["width"], "height": video["height"], "codec": video["codec_name"],
        "pixelFormat": video["pix_fmt"], "averageFrameRate": video["avg_frame_rate"],
        "audioCodec": audio.get("codec_name") if audio else None, "checks": checks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true", help="Check capture/font/binary availability without generating files")
    parser.add_argument("--regenerate", action="store_true", help="Explicitly replace a read-back and hashed existing final export")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    parser.add_argument("--ffprobe", default=shutil.which("ffprobe"))
    args = parser.parse_args()
    manifest_path = SUBMISSION / "video-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("version") != 1 or manifest["width"] != 1280 or manifest["height"] not in (960, 1280) or manifest["fps"] != 30:
        raise ValueError("Unsupported manifest format")
    if [scene["seconds"] for scene in manifest["scenes"]] != [8, 8, 22, 12, 15, 10, 5]:
        raise ValueError("Scene timing must preserve the approved 80-second sequence")
    if not args.ffmpeg or not args.ffprobe:
        raise RuntimeError("Install/provide existing FFmpeg and ffprobe binaries before rendering")
    captures = {scene["capture"]: resolve_relative(scene["capture"]) for scene in manifest["scenes"]}
    fonts = [resolve_relative(manifest["headingFont"]), resolve_relative(manifest["captionFont"])]
    missing = [relative(path) for path in [*captures.values(), *fonts] if not path.is_file()]
    for scene in manifest["scenes"]:
        if not re.fullmatch(r"[a-z0-9-]+", scene["id"]) or len(scene["heading"]) > 42 or "\n" in scene["heading"]:
            raise ValueError("Scene ID/heading is outside the approved safe format")
        wrapped_caption(scene["caption"])
    if missing:
        print(json.dumps({"status": "WAITING_FOR_ACTUAL_CAPTURES", "missing": missing, "renderStarted": False}, indent=2))
        return 2
    output = resolve_relative(manifest["output"])
    verification_path = resolve_relative(manifest["verification"])
    if output.parent != SUBMISSION or verification_path.parent != SUBMISSION:
        raise ValueError("Final export and verification must remain in submission/")
    if args.check_only:
        print(json.dumps({"status": "READY_TO_RENDER", "sourceCaptures": list(captures), "durationSeconds": 80, "renderStarted": False}, indent=2))
        return 0
    previous_export = None
    if output.exists():
        previous_export = {"sha256": sha256(output), "metadata": probe(args.ffprobe, output)}
        if not args.regenerate:
            raise RuntimeError("Final export exists and was read back. Pass --regenerate to explicitly replace it.")
    source_hashes = {name: sha256(path) for name, path in captures.items()}
    segment_dir = SUBMISSION / "render-segments"
    segment_dir.mkdir(exist_ok=True)
    segments = []
    for index, scene in enumerate(manifest["scenes"], start=1):
        print(f"Rendering scene {index}/{len(manifest['scenes'])}: {scene['id']}", flush=True)
        prefix = f"{index:02d}-{scene['id']}"
        heading_file = segment_dir / f"{prefix}-heading.txt"
        caption_file = segment_dir / f"{prefix}-caption.txt"
        label_file = segment_dir / f"{prefix}-label.txt"
        heading_file.write_text(scene["heading"], encoding="utf-8")
        caption_lines = wrapped_caption(scene["caption"]).split("\n")
        caption_files = []
        for line_index, caption_line in enumerate(caption_lines):
            line_file = segment_dir / f"{prefix}-caption-{line_index}.txt"
            line_file.write_text(caption_line, encoding="utf-8", newline="\n")
            caption_files.append(line_file)
        label_file.write_text("ACTUAL RUNTIME CAPTURE / EDITED DEMO / SIMULATED MONEY", encoding="utf-8")
        segment = segment_dir / f"{prefix}.mp4"
        fade = manifest["fadeSeconds"]
        filters = ",".join([
            f"scale={manifest['imageWidth']}:{manifest['imageHeight']}:force_original_aspect_ratio=decrease:force_divisible_by=2:out_range=tv",
            f"pad={manifest['imageWidth']}:{manifest['imageHeight']}:(ow-iw)/2:(oh-ih)/2:color={manifest['background']}",
            f"pad={manifest['width']}:{manifest['height']}:50:{manifest['imageTop']}:color={manifest['background']}",
            f"drawtext=fontfile={manifest['headingFont']}:textfile={relative(heading_file)}:fontcolor={manifest['headingColor']}:fontsize=34:x=50:y=29",
            *[f"drawtext=fontfile={manifest['captionFont']}:textfile={relative(line_file)}:fontcolor={manifest['captionColor']}:fontsize=21:x=50:y={79 + line_index * 31}" for line_index, line_file in enumerate(caption_files)],
            f"drawtext=fontfile={manifest['captionFont']}:textfile={relative(label_file)}:fontcolor=0x8e969f:fontsize=18:x=50:y={manifest['height'] - 35}",
            f"fade=t=in:st=0:d={fade}",
            f"fade=t=out:st={scene['seconds'] - fade}:d={fade}",
        ])
        command = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", str(manifest["fps"]), "-i", scene["capture"]]
        if manifest["silentAac"]:
            command += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]
        command += ["-t", str(scene["seconds"]), "-vf", filters, "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "18", "-pix_fmt", "yuv420p", "-color_range", "tv", "-r", str(manifest["fps"]), "-threads", "2"]
        if manifest["silentAac"]:
            command += ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-shortest"]
        else:
            command += ["-an"]
        command += ["-movflags", "+faststart", relative(segment)]
        run(command)
        segments.append(segment)
    concat_file = segment_dir / "concat.txt"
    concat_file.write_text("\n".join(f"file '{segment.name}'" for segment in segments) + "\n", encoding="utf-8")
    with tempfile.NamedTemporaryFile(prefix="rendering-", suffix=".mp4", dir=SUBMISSION, delete=False) as temporary:
        temporary_output = Path(temporary.name)
    run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "1", "-i", relative(concat_file), "-c", "copy", "-movflags", "+faststart", relative(temporary_output)])
    checked_metadata = verify_output(probe(args.ffprobe, temporary_output), manifest)
    for name, source in captures.items():
        if sha256(source) != source_hashes[name]:
            raise RuntimeError(f"Source capture changed during render: {name}; final export was not replaced")
    temporary_output.replace(output)
    verification = {
        "status": "VERIFIED_EXPORT_METADATA", "exportLabel": manifest["exportLabel"],
        "continuousScreenRecording": False, "financialMode": manifest["financialMode"],
        "verifiedAtUtc": datetime.now(timezone.utc).isoformat(), "output": relative(output),
        "sha256": sha256(output), "manifestSha256": sha256(manifest_path),
        "sourceCaptures": [{"path": name, "sha256": digest} for name, digest in source_hashes.items()],
        "fontFiles": [{"path": relative(font), "sha256": sha256(font)} for font in fonts],
        "metadata": checked_metadata, "previousExport": previous_export,
        "visualReview": "PENDING independent review of actual exported video frames",
    }
    verification_path.write_text(json.dumps(verification, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": verification["status"], "output": verification["output"], "verification": relative(verification_path), **checked_metadata}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        print(f"Video render stopped: {error}", file=sys.stderr)
        sys.exit(1)
