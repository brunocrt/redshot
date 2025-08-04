@echo off

mkdir data

echo "[run.cmd] Starting Redshot container..."
podman run --rm -p 8000:8000 -v data:/app/data redshot