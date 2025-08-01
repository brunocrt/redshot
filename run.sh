#!/bin/bash
# Run the Redshot application in a Docker container.
#
# Usage:
#   ./run.sh
#
# This script starts the `redshot` Docker image and maps the service to
# port 8000 on the host.  It also creates and mounts a persistent
# `data` directory under the current working directory to store the
# SQLite database so that trade history survives container restarts.

set -euo pipefail

# Determine the directory where this script resides.  When running
# commands that reference files relative to the project root, it's
# important to resolve paths relative to this script's location.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}"

# Ensure a persistent data directory exists.  This directory will be
# mounted into the container at `/app/data` where the SQLite database
# lives.  Trades and other persisted state will remain on the host
# between container restarts.
PERSIST_DIR="${ROOT_DIR}/data"
mkdir -p "$PERSIST_DIR"

echo "[run.sh] Starting Redshot container..."
docker run --rm \
  -p 8000:8000 \
  -v "$PERSIST_DIR":/app/data \
  redshot