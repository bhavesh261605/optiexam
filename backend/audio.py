"""Bounded audio decoding and lazy, self-hosted inference. No cloud audio APIs."""
import os
import subprocess
import tempfile
import threading
import shutil
from pathlib import Path

import numpy as np


class AudioError(ValueError):
    pass


class ModelUnavailable(RuntimeError):
    pass


def normalize(vector):
    vector = np.asarray(vector, dtype=np.float32).reshape(-1)
    norm = np.linalg.norm(vector)
    if not vector.size or not np.all(np.isfinite(vector)) or norm < 1e-8:
        raise AudioError("No usable speaker signal. Please record again.")
    return vector / norm


def cosine(left, right):
    left, right = normalize(left), normalize(right)
    if left.shape != right.shape:
        raise AudioError("Voice profile needs to be enrolled again.")
    return float(np.clip(np.dot(left, right), -1, 1))


class AudioEngine:
    def __init__(self):
        self._speaker = None
        self._whisper = None
        self._lock = threading.Lock()

    def _decode(self, path):
        with open(path, "rb") as audio:
            header = audio.read(12)
        container = (
            "matroska" if header.startswith(b"\x1aE\xdf\xa3") else
            "ogg" if header.startswith(b"OggS") else
            "wav" if header.startswith(b"RIFF") and header[8:12] == b"WAVE" else
            "mov" if header[4:8] == b"ftyp" else None
        )
        if container is None:
            raise AudioError("File is not a supported WebM, Ogg, WAV or MP4 recording.")
        try:
            executable = os.getenv("FFMPEG_PATH") or shutil.which("ffmpeg")
            if not executable:
                import imageio_ffmpeg
                executable = imageio_ffmpeg.get_ffmpeg_exe()
            result = subprocess.run(
                [executable, "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe",
                 "-f", container, "-i", str(path), "-vn", "-t", "61", "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"],
                capture_output=True, timeout=25, check=True,
            )
        except (FileNotFoundError, ImportError) as exc:
            raise ModelUnavailable("Install ffmpeg on the audio service host.") from exc
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise AudioError("Audio could not be decoded. Record a new sample.") from exc
        samples = np.frombuffer(result.stdout, dtype=np.float32).copy()
        if not 16000 <= samples.size <= 60 * 16000:
            raise AudioError("Record between 1 and 60 seconds of speech.")
        if not np.all(np.isfinite(samples)) or np.sqrt(np.mean(samples ** 2)) < 0.002:
            raise AudioError("Audio is silent or too quiet. Move closer to the microphone.")
        return samples

    def process(self, content: bytes, speaker: bool = False, language: str | None = None):
        if language not in {None, "en", "hi"}:
            raise AudioError("Choose English or Hindi for audio.")
        path = None
        try:
            # Ignore uploaded filenames; generated names cannot escape the temp directory.
            with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as temp:
                path = Path(temp.name)
                temp.write(content)
            samples = self._decode(path)
            with self._lock:
                try:
                    import whisper
                    import torch
                    if self._whisper is None:
                        model = os.getenv("WHISPER_MODEL", "tiny")
                        if model not in {"tiny", "base"}:
                            raise ModelUnavailable("WHISPER_MODEL must be tiny or base.")
                        checkpoint = Path(os.getenv("WHISPER_CACHE", "data/models/whisper")) / f"{model}.pt"
                        if not checkpoint.is_file():
                            raise ModelUnavailable("Whisper is not installed. Run python -m backend.download_models before using audio inference.")
                        self._whisper = whisper.load_model(str(checkpoint), device="cpu")
                    result = self._whisper.transcribe(samples, fp16=False, verbose=None, language=language, task="transcribe")
                    embedding = None
                    if speaker:
                        if samples.size < 3 * 16000:
                            raise AudioError("Voice authentication needs at least 3 seconds of speech.")
                        if self._speaker is None:
                            from speechbrain.inference.speaker import EncoderClassifier
                            from speechbrain.utils.fetching import LocalStrategy
                            self._speaker = EncoderClassifier.from_hparams(
                                source="speechbrain/spkrec-ecapa-voxceleb",
                                savedir=os.getenv("SPEAKER_MODEL_DIR", "data/models/ecapa"),
                                run_opts={"device": "cpu"},
                                local_strategy=LocalStrategy.COPY,
                            )
                        with torch.inference_mode():
                            embedding = normalize(self._speaker.encode_batch(torch.from_numpy(samples).unsqueeze(0)).cpu().numpy())
                    return {"text": result["text"].strip(), "embedding": embedding}
                except AudioError:
                    raise
                except (ImportError, OSError, RuntimeError) as exc:
                    raise ModelUnavailable("Audio models are unavailable. Run the documented model setup and retry.") from exc
        finally:
            if path is not None:
                path.unlink(missing_ok=True)
