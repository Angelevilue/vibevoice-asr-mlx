import argparse
import json
import mimetypes
import requests


def format_transcription_plain(text):
    """Format JSON transcription into plain text (content only)."""
    try:
        data = json.loads(text)
        if isinstance(data, list):
            lines = []
            for seg in data:
                content = seg.get("Content", "")
                lines.append(content)
            return "\n".join(lines)
    except (json.JSONDecodeError, TypeError):
        pass
    return text


def format_transcription_full(text):
    """Format JSON transcription with timestamps and speaker info."""
    try:
        data = json.loads(text)
        if isinstance(data, list):
            lines = []
            for seg in data:
                start = seg.get("Start", 0)
                end = seg.get("End", 0)
                speaker = seg.get("Speaker", 0)
                content = seg.get("Content", "")
                start_str = format_time(start)
                end_str = format_time(end)
                lines.append(f"[{start_str} - {end_str}] Speaker {speaker}: {content}")
            return "\n".join(lines)
    except (json.JSONDecodeError, TypeError):
        pass
    return text


def format_time(seconds):
    """Format seconds to MM:SS.mmm"""
    mins = int(seconds // 60)
    secs = seconds % 60
    return f"{mins:02d}:{secs:06.3f}"


def main():
    parser = argparse.ArgumentParser(description="VibeVoice ASR Client")
    parser.add_argument("audio_path", help="Path to the audio file to transcribe")
    parser.add_argument(
        "--server", "-s", default="http://localhost:8765",
        help="Server URL (default: http://localhost:8765)"
    )
    parser.add_argument(
        "--format", "-f", default="json",
        choices=["txt", "json", "srt", "vtt"],
        help="Output format (default: json)"
    )
    parser.add_argument(
        "--output", "-o", help="Output path for transcription"
    )
    parser.add_argument(
        "--raw", action="store_true",
        help="Output raw response without formatting"
    )
    parser.add_argument(
        "--timeout", "-t", type=int, default=3600,
        help="Timeout in seconds (default: 3600 for 1 hour)"
    )

    args = parser.parse_args()

    # Determine content type from file extension
    content_type, _ = mimetypes.guess_type(args.audio_path)
    if content_type is None:
        content_type = "audio/mpeg"

    # Send request to server
    with open(args.audio_path, "rb") as f:
        response = requests.post(
            f"{args.server}/transcribe",
            data=f,
            headers={
                "X-Format": args.format,
                "Content-Type": content_type,
            },
            timeout=args.timeout
        )

    if response.status_code != 200:
        print(f"Error: Server returned {response.status_code}")
        print(response.text)
        return

    # Get timing info from headers
    text_length = response.headers.get("X-Text-Length", "N/A")
    audio_duration = response.headers.get("X-Audio-Duration", "N/A")
    processing_time = response.headers.get("X-Processing-Time", "N/A")
    text = response.text

    # Format text based on format type
    if args.raw:
        formatted = text
    elif args.format == "txt":
        formatted = format_transcription_plain(text)
    else:
        formatted = format_transcription_full(text)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(formatted)
        print(f"Transcription saved to: {args.output}")
    else:
        print(formatted)

    # Print timing info
    print(f"\n[Info] Text: {text_length} chars | Audio: {audio_duration}s | Processing: {processing_time}s", flush=True)


if __name__ == "__main__":
    main()
