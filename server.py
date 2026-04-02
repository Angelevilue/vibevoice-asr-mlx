import os
import sys
import tempfile
from io import StringIO
from http.server import HTTPServer, BaseHTTPRequestHandler
from mlx_audio.stt.utils import load_model
from mlx_audio.stt.generate import generate_transcription

# Load model once at startup
MODEL_PATH = os.environ.get(
    "VIBEVOICE_MODEL_PATH",
    "/Users/zephyrmuse/LLMs/model_weights/VibeVoice-ASR-4bit"
)
PORT = 8765

print(f"Loading model: {MODEL_PATH}")
model = load_model(MODEL_PATH)
print("Model loaded and ready!")


class TranscriptionHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/transcribe":
            self.send_error(404, "Not Found")
            return

        # Get content length
        content_length = int(self.headers.get("Content-Length", 0))

        # Read audio file data
        audio_data = self.rfile.read(content_length)

        # Get format from headers (default: txt)
        format_type = self.headers.get("X-Format", "txt")

        # Always detect format from file header, regardless of Content-Type
        # This handles cases where files are misnamed (e.g., WAV saved as .mp3)
        if audio_data[:4] == b"RIFF":
            suffix = ".wav"
        elif audio_data[:3] == b"ID3":
            suffix = ".mp3"
        elif audio_data[:4] == b"\x89PNG":
            suffix = ".m4a"
        elif audio_data[:4] == b"OggS":
            suffix = ".ogg"
        elif audio_data[:4] == b"fLaC":
            suffix = ".flac"
        elif audio_data[0] == 0xFF and (audio_data[1] & 0xE0) == 0xE0:
            # MPEG ADTS sync word: 0xFF followed by 0xF0-0xFF
            suffix = ".mp3"
        else:
            suffix = ".audio"

        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_data)
            temp_path = f.name

        try:
            print(f"Transcribing: {temp_path} ({len(audio_data)} bytes)", flush=True)

            # Capture verbose output and filter for progress lines
            old_stdout = sys.stdout
            sys.stdout = captured = StringIO()

            result = generate_transcription(
                model=model,
                audio=temp_path,
                output_path="",
                format=format_type,
                verbose=True,
            )

            sys.stdout = old_stdout
            output = captured.getvalue()

            # Filter and print only progress-related lines
            for line in output.split("\n"):
                if any(x in line for x in ["Encoding audio:", "Prefilling:", "Generating:", "Saving file to:", "Processing time:"]):
                    if "Saving file to:" not in line:  # Skip the "Saving file to:" line
                        print(line, flush=True)

            # Get audio duration from segments
            audio_duration = result.segments[0]['end'] if result.segments else 0
            processing_time = getattr(result, 'total_time', 0)

            # Send response with timing info in headers
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("X-Text-Length", str(len(result.text)))
            self.send_header("X-Audio-Duration", f"{audio_duration:.2f}")
            self.send_header("X-Processing-Time", f"{processing_time:.2f}")
            self.end_headers()
            self.wfile.write(result.text.encode("utf-8"))
            print(f"Done! {len(result.text)} chars | {audio_duration:.1f}s | {processing_time:.2f}s | {result.segments[0]['text'][:50]}...", flush=True)

        except Exception as e:
            sys.stdout = old_stdout
            print(f"Error: {e}", flush=True)
            self.send_error(500, str(e))

        finally:
            os.unlink(temp_path)

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_error(404, "Not Found")

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")


def main():
    server = HTTPServer(("0.0.0.0", PORT), TranscriptionHandler)
    print(f"VibeVoice ASR server running on http://0.0.0.0:{PORT}")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
