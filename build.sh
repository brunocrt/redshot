#!/bin/bash
# Build the Redshot Docker image.
#
# Usage:
#   ./build.sh
#
# This script wraps the `docker build` command to build the backend
# and frontend into a single image tagged `redshot`.  It must be
# executed from the root of the project repository.

set -euo pipefail

echo "[build.sh] Building the Redshot Docker image..."
docker build -t redshot .
echo "[build.sh] Build complete. Use ./run.sh to start the service."