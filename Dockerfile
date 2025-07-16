# Multi-stage Dockerfile for React Frontend + FastAPI Backend with HTTPS
# Stage 1: Build the React frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Accept build arguments for environment variables
ARG VITE_TENANT_ID
ARG VITE_CLIENT_ID

# Set environment variables for the build process
ENV VITE_TENANT_ID=$VITE_TENANT_ID
ENV VITE_CLIENT_ID=$VITE_CLIENT_ID

# Copy package files
COPY frontend/package*.json ./

# Install dependencies with legacy peer deps to handle React 19 compatibility
# Also clear any existing cache to prevent platform conflicts
RUN npm cache clean --force && npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ ./

# Build the frontend for production
RUN npm run build

# Stage 2: Python backend with frontend integration
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY *.py ./
COPY *.json ./
COPY *.txt ./
COPY Documents/ ./Documents/

# Create vector_store directory (will be managed by persistent volume)
RUN mkdir -p vector_store

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create necessary directories
RUN mkdir -p temp_uploads generated_images

# Create SSL certificates directory
RUN mkdir -p ssl

# Expose HTTPS port
EXPOSE 443

# Environment variables
ENV PYTHONPATH=/app
ENV FRONTEND_PATH=/app/frontend/dist

# Start command
CMD ["python", "main.py"]
