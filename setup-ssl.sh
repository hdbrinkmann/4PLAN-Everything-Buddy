#!/bin/bash
# SSL Certificate Setup Script
# This script creates self-signed SSL certificates for development

SSL_DIR="ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

echo "Setting up SSL certificates..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "SSL certificates already exist. Skipping generation."
    exit 0
fi

# Generate self-signed certificate
echo "Generating self-signed SSL certificate..."
openssl req -x509 -newkey rsa:4096 -keyout "$KEY_FILE" -out "$CERT_FILE" -days 365 -nodes -subj "/C=DE/ST=State/L=City/O=Organization/CN=localhost"

if [ $? -eq 0 ]; then
    echo "SSL certificates generated successfully!"
    echo "Certificate: $CERT_FILE"
    echo "Private Key: $KEY_FILE"
else
    echo "Error: Failed to generate SSL certificates"
    echo "Please ensure OpenSSL is installed on your system"
    exit 1
fi
