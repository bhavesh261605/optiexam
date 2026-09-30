"""Run with Python 3.11/3.12: python backend/setup.py [--models] [--skip-install]."""
import argparse
import base64
import os
import secrets
import subprocess
import sys
import venv
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", action="store_true", help="Install Whisper, ECAPA and CPU PyTorch dependencies (large download)")
    parser.add_argument("--skip-install", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    environment = root / ".venv"
    python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.exists():
        venv.create(environment, with_pip=True)
    if not args.skip_install:
        os.environ.setdefault("PIP_CACHE_DIR", str(root / ".venv" / "pip-cache"))
        requirements = "requirements-models.txt" if args.models else "requirements-test.txt"
        subprocess.run([str(python), "-m", "pip", "install", "-r", str(root / "backend" / requirements)], check=True)
    config_path = root / ".env.voice"
    if not config_path.exists():
        config_path.write_text("VOICE_JWT_SECRET=" + secrets.token_urlsafe(48) + "\nVOICE_TEMPLATE_KEY=" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode() + "\nVOICE_MATCH_THRESHOLD=0.85\nWHISPER_MODEL=tiny\n", encoding="utf-8")
        if os.name != "nt":
            config_path.chmod(0o600)
    values = dict(line.split("=", 1) for line in config_path.read_text(encoding="utf-8").splitlines() if "=" in line and not line.startswith("#"))
    web_path = root / ".env.local"
    existing = web_path.read_text(encoding="utf-8") if web_path.exists() else ""
    additions = []
    if not any(line.startswith("VOICE_JWT_SECRET=") for line in existing.splitlines()):
        additions.append("VOICE_JWT_SECRET=" + values["VOICE_JWT_SECRET"])
    if not any(line.startswith("VOICE_SERVICE_URL=") for line in existing.splitlines()):
        additions.append("VOICE_SERVICE_URL=http://127.0.0.1:8001")
    if additions:
        web_path.write_text(existing.rstrip() + "\n" + "\n".join(additions) + "\n", encoding="utf-8")
    print("Audio setup complete. Secrets are in ignored local env files; keep them private.")
    print("Start: .venv Python -m backend.run. Install --models, then run -m backend.download_models for inference.")


if __name__ == "__main__":
    main()
