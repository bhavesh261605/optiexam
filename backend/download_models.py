"""Explicit model download/preflight; never downloads candidate audio."""
import os
import hashlib
import urllib.request
from pathlib import Path
from .run import load_environment


def download_whisper(name, directory):
    """Resume official checkpoints, and verify before making them available."""
    import whisper
    url = whisper._MODELS[name]
    expected = url.split("/")[-2]
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=True)
    target = root / f"{name}.pt"
    partial = root / f"{name}.pt.partial"
    def verified(path):
        if not path.exists():
            return False
        with path.open("rb") as source:
            return hashlib.file_digest(source, "sha256").hexdigest() == expected
    if verified(target):
        return
    if target.exists():
        target.replace(partial)
    for attempt in range(3):
        offset = partial.stat().st_size if partial.exists() else 0
        request = urllib.request.Request(url, headers={"Range": f"bytes={offset}-"} if offset else {})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                append = offset > 0 and response.status == 206
                if append and not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-"):
                    raise RuntimeError("Unexpected checkpoint range; refusing to append.")
                with partial.open("ab" if append else "wb") as output:
                    while chunk := response.read(1024 * 256):
                        output.write(chunk)
            if verified(partial):
                partial.replace(target)
                return
            print("Checkpoint incomplete; resuming verified source.", flush=True)
        except OSError as error:
            if getattr(error, "code", None) == 416:
                partial.unlink(missing_ok=True)
            print(f"Checkpoint transfer interrupted ({type(error).__name__}); retry {attempt + 1}/3.", flush=True)
    raise RuntimeError("Whisper checkpoint is incomplete. Re-run backend.download_models to resume; no incomplete model was loaded.")

if __name__ == "__main__":
    load_environment()
    import whisper
    import imageio_ffmpeg
    from speechbrain.inference.speaker import EncoderClassifier
    from speechbrain.utils.fetching import LocalStrategy
    print("ffmpeg:", imageio_ffmpeg.get_ffmpeg_version())
    download_whisper(os.getenv("WHISPER_MODEL", "tiny"), os.getenv("WHISPER_CACHE"))
    whisper.load_model(os.getenv("WHISPER_MODEL", "tiny"), device="cpu", download_root=os.getenv("WHISPER_CACHE"))
    EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir=os.getenv("SPEAKER_MODEL_DIR"), run_opts={"device": "cpu"}, local_strategy=LocalStrategy.COPY)
    print("Whisper and ECAPA models loaded successfully on CPU.")
