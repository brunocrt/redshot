@echo off

echo "[build.cmd] Building the Redshot Docker image..."
podman build -t redshot .
echo "[build.cmd] Build complete. Use run.cmd to start the service."