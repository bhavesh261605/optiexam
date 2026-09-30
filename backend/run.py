"""Load private local settings and run one inference worker on loopback."""
import os
from pathlib import Path


def load_environment():
    root = Path(__file__).resolve().parents[1]
    path = root / ".env.voice"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                if key.startswith(("VOICE_", "WHISPER_", "SPEAKER_", "FFMPEG_")):
                    os.environ.setdefault(key, value)
    os.environ.setdefault("HF_HOME", str(root / "data" / "models" / "huggingface"))
    os.environ.setdefault("SPEAKER_MODEL_DIR", str(root / "data" / "models" / "ecapa"))
    os.environ.setdefault("WHISPER_CACHE", str(root / "data" / "models" / "whisper"))
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


if __name__ == "__main__":
    load_environment()
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8001, workers=1)
