# =============================================================================
# DOCKERFILE FOR GOOGLE CLOUD RUN
# =============================================================================
# This file tells Google Cloud Run how to build and run your Halo app.
#
# To deploy:
# 1. Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install
# 2. Run: gcloud init (one-time setup)
# 3. Run: gcloud run deploy (from this directory)
# =============================================================================

# Use Python 3.11 slim image (smaller, faster)
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONUTF8=1
ENV PORT=8080

# Set working directory
WORKDIR /app

# Install system dependencies (needed for some Python packages)
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create necessary directories
RUN mkdir -p uploads manual_images

# Expose the port Cloud Run expects
EXPOSE 8080

# Start the application
# Cloud Run sets PORT env variable, uvicorn listens on it
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}

