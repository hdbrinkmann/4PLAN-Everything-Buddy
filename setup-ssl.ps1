# SSL Certificate Setup Script for Windows PowerShell
# This script creates self-signed SSL certificates for development

$SSL_DIR = "ssl"
$CERT_FILE = "$SSL_DIR/cert.pem"
$KEY_FILE = "$SSL_DIR/key.pem"

Write-Host "Setting up SSL certificates..." -ForegroundColor Green

# Create SSL directory if it doesn't exist
if (!(Test-Path $SSL_DIR)) {
    New-Item -ItemType Directory -Path $SSL_DIR | Out-Null
}

# Check if certificates already exist
if ((Test-Path $CERT_FILE) -and (Test-Path $KEY_FILE)) {
    Write-Host "SSL certificates already exist. Skipping generation." -ForegroundColor Yellow
    exit 0
}

# Generate self-signed certificate
Write-Host "Generating self-signed SSL certificate..." -ForegroundColor Blue

try {
    # Try using openssl if available
    $opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
    if ($opensslPath) {
        & openssl req -x509 -newkey rsa:4096 -keyout $KEY_FILE -out $CERT_FILE -days 365 -nodes -subj "/C=DE/ST=State/L=City/O=Organization/CN=localhost"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SSL certificates generated successfully!" -ForegroundColor Green
            Write-Host "Certificate: $CERT_FILE" -ForegroundColor Cyan
            Write-Host "Private Key: $KEY_FILE" -ForegroundColor Cyan
        } else {
            throw "OpenSSL command failed"
        }
    } else {
        # Fallback: Use PowerShell to create a self-signed certificate
        Write-Host "OpenSSL not found. Using PowerShell to create certificate..." -ForegroundColor Yellow
        
        $cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My" -KeyAlgorithm RSA -KeyLength 4096 -NotAfter (Get-Date).AddDays(365)
        
        # Export certificate
        $certPath = "cert:\LocalMachine\My\$($cert.Thumbprint)"
        Export-Certificate -Cert $certPath -FilePath $CERT_FILE -Type CERT
        
        # Export private key (requires additional steps in PowerShell)
        Write-Host "Note: Private key export requires manual steps in PowerShell." -ForegroundColor Yellow
        Write-Host "For full Docker compatibility, please install OpenSSL or use the Docker container method." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: Failed to generate SSL certificates" -ForegroundColor Red
    Write-Host "Please ensure OpenSSL is installed or use: docker compose exec app openssl ..." -ForegroundColor Red
    exit 1
}
