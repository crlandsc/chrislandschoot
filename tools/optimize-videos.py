#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import subprocess
import sys
import unicodedata as u
from pathlib import Path

VIDEO_EXTS = {".webm", ".mov"}

def which_ffmpeg() -> str:
    p = shutil.which("ffmpeg")
    if not p:
        sys.stderr.write("Error: ffmpeg not found. Install with Homebrew: brew install ffmpeg\n")
        sys.exit(1)
    return p

def which_ffprobe() -> str:
    p = shutil.which("ffprobe")
    if not p:
        sys.stderr.write("Error: ffprobe not found. Install with Homebrew: brew install ffmpeg\n")
        sys.exit(1)
    return p

def ensure_videotoolbox(ffmpeg_path: str) -> None:
    try:
        cp = subprocess.run(
            [ffmpeg_path, "-hide_banner", "-encoders"],
            capture_output=True, text=True, check=False
        )
    except Exception as e:
        sys.stderr.write(f"Error: failed to run ffmpeg: {e}\n")
        sys.exit(1)
    if "hevc_videotoolbox" not in cp.stdout:
        sys.stderr.write(
            "Error: Your ffmpeg is missing the hevc_videotoolbox encoder (needed for HEVC with alpha on macOS).\n"
            "Fix: brew reinstall ffmpeg  (Homebrew builds include VideoToolbox).\n"
        )
        sys.exit(1)

def clean_name(name: str) -> str:
    # Normalize and remove ASCII control chars (<0x20) and Unicode format chars (Cf, e.g., bidi marks)
    n = u.normalize("NFC", name)
    n = "".join(ch for ch in n if (ord(ch) >= 32 and u.category(ch) != "Cf"))
    return n.strip()

def sanitize_filenames(in_dir: Path) -> int:
    renamed = 0
    for p in in_dir.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() != ".webm":
            continue
        new_name = clean_name(p.name)
        if new_name != p.name:
            dst = p.with_name(new_name)
            base, ext = os.path.splitext(new_name)
            i = 1
            while dst.exists() and dst.resolve() != p.resolve():
                dst = p.with_name(f"{base} ({i}){ext}")
                i += 1
            print(f"Renaming: <{p.name}> -> <{dst.name}>")
            p.rename(dst)
            renamed += 1
    return renamed

def probe_stream(ffprobe: str, path: Path) -> dict:
    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=pix_fmt,alpha_mode",
        "-of", "json",
        str(path)
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return {"pix_fmt": None, "alpha_mode": None, "has_alpha": False}
    try:
        data = json.loads(proc.stdout)
        stream = data.get("streams", [{}])[0]
    except (json.JSONDecodeError, IndexError):
        return {"pix_fmt": None, "alpha_mode": None, "has_alpha": False}

    pix_fmt = stream.get("pix_fmt")
    alpha_mode = stream.get("alpha_mode")
    has_alpha = False
    if isinstance(pix_fmt, str) and "a" in pix_fmt.lower():
        has_alpha = True
    if isinstance(alpha_mode, str):
        try:
            has_alpha = has_alpha or int(alpha_mode) == 1
        except ValueError:
            pass
    return {"pix_fmt": pix_fmt, "alpha_mode": alpha_mode, "has_alpha": has_alpha}


def convert_one(ffmpeg: str, ffprobe: str, infile: Path, outfile: Path, bitrate: str, overwrite: bool) -> int:
    outfile.parent.mkdir(parents=True, exist_ok=True)
    ow_flag = "-y" if overwrite else "-n"
    info = probe_stream(ffprobe, infile)
    expect_alpha = info.get("has_alpha", False)
    if expect_alpha:
        filter_chain = (
            "pad=ceil(iw/2)*2:ceil(ih/2)*2:color=#00000000,"  # keep even dims with transparent padding
            "format=yuva420p"
        )
        pix_fmt = "yuva420p"
        encoder_opts = ["-alpha_quality", "1", "-allow_sw", "1"]
    else:
        filter_chain = "pad=ceil(iw/2)*2:ceil(ih/2)*2:color=#00000000,format=yuv420p"
        pix_fmt = "yuv420p"
        encoder_opts = []

    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", ow_flag,
        "-i", str(infile),
        "-vf", filter_chain,
        "-pix_fmt", pix_fmt,
        "-c:v", "hevc_videotoolbox",
        *encoder_opts,
        "-tag:v", "hvc1",
        "-b:v", bitrate, "-movflags", "+faststart",
        "-an",
        str(outfile),
    ]
    # Remove empty args (if any)
    cmd = [a for a in cmd if a]
    proc = subprocess.run(cmd)
    return proc.returncode

def main():
    parser = argparse.ArgumentParser(description="Batch convert WebM/MOV assets to HEVC-with-Alpha .mov for iOS/Safari.")
    parser.add_argument("-i", "--input",  required=True, help="Input folder containing source files")
    parser.add_argument("-o", "--output", required=True, help="Output folder for .mov files")
    parser.add_argument("--bitrate", default="8M", help="Target video bitrate (default: 8M)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing outputs")
    parser.add_argument("--recursive", action="store_true", help="Recurse into subfolders (default: off)")
    parser.add_argument("--no-sanitize", action="store_true", help="Skip filename sanitation step")
    args = parser.parse_args()

    in_dir  = Path(args.input).expanduser().resolve()
    out_dir = Path(args.output).expanduser().resolve()

    if not in_dir.is_dir():
        sys.stderr.write(f"Error: input directory not found: {in_dir}\n")
        sys.exit(1)
    out_dir.mkdir(parents=True, exist_ok=True)

    ffmpeg = which_ffmpeg()
    ffprobe = which_ffprobe()
    ensure_videotoolbox(ffmpeg)

    print(f"Input dir:  {in_dir}")
    print(f"Output dir: {out_dir}")
    print(f"Bitrate:    {args.bitrate}")
    print(f"Overwrite:  {bool(args.overwrite)}")
    print(f"Recursive:  {bool(args.recursive)}")
    print()

    # Sanitize odd filenames so subprocess/ffmpeg never sees control or bidi characters
    if not args.no_sanitize:
        renamed = sanitize_filenames(in_dir)
        if renamed:
            print(f"Sanitized {renamed} filename(s).\n")

    # Collect .webm files
    if args.recursive:
        sources = [p for p in in_dir.rglob("*") if p.is_file() and p.suffix.lower() in VIDEO_EXTS]
    else:
        sources = [p for p in in_dir.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXTS]

    if not sources:
        print("No source files found. Nothing to do.")
        return

    count_total = 0
    count_done = 0
    count_skipped = 0
    count_failed = 0

    for src in sorted(sources, key=lambda x: x.name.lower()):
        count_total += 1
        dst = out_dir / (src.stem + ".mov")

        if not args.overwrite and dst.exists():
            print(f"Skipping (exists): {dst.name}")
            count_skipped += 1
            continue

        if not os.access(src, os.R_OK):
            print(f"Cannot read (permissions/missing): <{src.name}>")
            count_failed += 1
            continue

        print("Encoding:")
        print(f"  IN : <{src.name}>")
        print(f"  OUT: <{dst.name}>")

        rc = convert_one(ffmpeg, ffprobe, src, dst, args.bitrate, args.overwrite)
        if rc == 0:
            out_info = probe_stream(ffprobe, dst)
            has_alpha = out_info.get("has_alpha", False)
            if has_alpha or not probe_stream(ffprobe, src).get("has_alpha", False):
                print(f"OK: {dst.name}\n")
                count_done += 1
            else:
                print(f"WARNING: {dst.name} appears to have lost alpha (pix_fmt={out_info.get('pix_fmt')}).\n")
                count_failed += 1
        else:
            print(f"FAILED (ffmpeg exit {rc}): {src.name}\n")
            count_failed += 1

    print("Done.")
    print(f"Total:   {count_total}")
    print(f"Encoded: {count_done}")
    print(f"Skipped: {count_skipped}")
    print(f"Failed:  {count_failed}")

if __name__ == "__main__":
    main()