# Multi‑stage build for Redshot backend and frontend

# -------- Stage 1: build the React frontend --------
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy only package files first to leverage npm cache
COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend
RUN npm install && \
    # Ensure the Vite binary has execute permissions.  On some platforms
    # (notably Alpine), npm may install Vite without the executable bit
    # set, which results in a "Permission denied" error when running
    # the build script.  Adjusting permissions here avoids that issue.
    chmod +x node_modules/.bin/vite

# Copy the rest of the frontend source and build
COPY frontend/ ./
# Build the React frontend.  We invoke Vite via `npm exec` rather than
# relying on the npm script directly, because the latter can fail if the
# underlying binary lacks execute permission.  `npm exec vite build`
# explicitly resolves the correct Vite binary within node_modules and
# executes it with the appropriate Node interpreter.
RUN npm exec vite build

# -------- Stage 2: build the Python backend --------
FROM python:3.10-slim AS backend

WORKDIR /app

# Create a directory for persistent data (e.g. the SQLite database).  Declaring
# this as a volume allows the database to survive container restarts when the
# user mounts a host directory or a named volume to `/app/data`.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy Python source and install dependencies
COPY redshot/ ./redshot/
COPY backend/ ./backend/
COPY redshot/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    fastapi==0.110.0 \
    "uvicorn[standard]" \
    SQLAlchemy==2.0.30 \
    python-dotenv==1.0.0

# Copy compiled frontend assets
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist/

EXPOSE 8000

# Default command runs the FastAPI app
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]