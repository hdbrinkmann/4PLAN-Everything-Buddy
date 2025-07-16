#!/bin/bash

# SSL Certificate Generation Script for Development
# This script generates self-signed certificates for HTTPS development

SSL_DIR="ssl"
DOMAIN="localhost"
DAYS=365

# Create SSL directory if it doesn't exist
mkdir -p $SSL_DIR

echo "Generating SSL certificates for development..."

# Remove existing certificates
rm -f $SSL_DIR/key.pem $SSL_DIR/cert.pem $SSL_DIR/cert.csr

# Generate private key
openssl genrsa -out $SSL_DIR/key.pem 2048

# Create config file for certificate
cat > $SSL_DIR/cert.conf <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = 127.0.0.1
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate certificate signing request
openssl req -new -key $SSL_DIR/key.pem -out $SSL_DIR/cert.csr -config $SSL_DIR/cert.conf

# Generate self-signed certificate
openssl x509 -req -in $SSL_DIR/cert.csr -signkey $SSL_DIR/key.pem -out $SSL_DIR/cert.pem -days $DAYS -extensions v3_req -extfile $SSL_DIR/cert.conf

# Clean up temporary files
rm $SSL_DIR/cert.csr $SSL_DIR/cert.conf

echo "SSL certificates generated successfully!"
echo "Certificate: $SSL_DIR/cert.pem"
echo "Private Key: $SSL_DIR/key.pem"
echo ""
echo "For development, you may need to accept the self-signed certificate in your browser."
echo "For production, replace these files with your actual SSL certificates."
