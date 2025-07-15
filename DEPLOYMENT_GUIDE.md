# 4PLAN Everything Buddy - Production Deployment Guide

This guide explains how to deploy the 4PLAN Everything Buddy Docker container on a different computer that can be accessed from other computers or the internet.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Basic Deployment Steps](#basic-deployment-steps)
3. [Network Configuration](#network-configuration)
4. [SSL Certificate Setup](#ssl-certificate-setup)
5. [Azure AD Configuration](#azure-ad-configuration)
6. [Environment Variables](#environment-variables)
7. [Security Considerations](#security-considerations)
8. [Firewall Configuration](#firewall-configuration)
9. [Domain and DNS Setup](#domain-and-dns-setup)
10. [Production Optimization](#production-optimization)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+ recommended), Windows Server, or macOS
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 20GB free space
- **CPU**: 2+ cores recommended
- **Network**: Static IP address (recommended for production)

### Required Software
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git (for cloning the repository)

### Installation Commands

**Ubuntu/Debian:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Reboot to apply Docker group changes
sudo reboot
```

**CentOS/RHEL:**
```bash
# Install Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

## Basic Deployment Steps

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd 4PLAN-Everything-Buddy
```

### 2. Prepare Environment Files
```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file with your production values
nano .env
```

### 3. Configure Environment Variables
Edit `.env` file with your production settings:

```env
TOGETHER_API_KEY=868b9d2e470aac7e8cceca7a75c42e28b37cb92d9a51f3b7df91a5e454ad23ce

# Azure AD Configuration
# For Backend (auth.py)
TENANT_ID=12b1196f-a6d3-492d-a0ad-fdb8cdcb3ed9
CLIENT_ID=80f3cca8-a4a0-4848-b8ef-7b8fe7606bda

# For Frontend (vite.config.js -> authConfig.js)
VITE_TENANT_ID=12b1196f-a6d3-492d-a0ad-fdb8cdcb3ed9
VITE_CLIENT_ID=80f3cca8-a4a0-4848-b8ef-7b8fe7606bda
```

### 4. Build and Deploy
```bash
# Build the container
docker compose build

# Start the services
docker compose up -d

# Check status
docker compose ps
docker compose logs app
```

## Network Configuration

### Port Configuration
The application uses the following ports:
- **443 (HTTPS)**: Main application access
- **80 (HTTP)**: Optional redirect to HTTPS

### Docker Compose Network Setup
For production access, modify `docker-compose.yml`:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_TENANT_ID: ${VITE_TENANT_ID}
        VITE_CLIENT_ID: ${VITE_CLIENT_ID}
    ports:
      - "443:443"
      - "80:80"  # Optional: for HTTP to HTTPS redirect
    volumes:
      - ./ssl:/app/ssl
      - ./.env:/app/.env:ro
      - ./Documents:/app/Documents:ro
      - ./vector_store:/app/vector_store
      - ./favorites.db:/app/favorites.db
      - ./admins.json:/app/admins.json
      - ./features.json:/app/features.json
      - ./knowledge_fields.json:/app/knowledge_fields.json
      - ./Beispieldaten:/app/Beispieldaten:ro
    environment:
      - PYTHONPATH=/app
      - FRONTEND_PATH=/app/frontend/dist
      - PRODUCTION_DOMAIN=${PRODUCTION_DOMAIN}
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

## SSL Certificate Setup

### Option 1: Let's Encrypt (Recommended for Production)

**Install Certbot:**
```bash
# Ubuntu/Debian
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot
```

**Generate Certificate:**
```bash
# Stop the container temporarily
docker compose down

# Generate certificate (replace your-domain.com)
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to ssl directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/key.pem

# Set proper permissions
sudo chown $USER:$USER ./ssl/*.pem
chmod 600 ./ssl/*.pem

# Restart container
docker compose up -d
```

**Auto-renewal Setup:**
```bash
# Create renewal script
cat << 'EOF' > /home/$USER/renew-ssl.sh
#!/bin/bash
cd /path/to/your/4PLAN-Everything-Buddy
docker compose down
sudo certbot renew --standalone
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/key.pem
sudo chown $USER:$USER ./ssl/*.pem
chmod 600 ./ssl/*.pem
docker compose up -d
EOF

chmod +x /home/$USER/renew-ssl.sh

# Add to crontab for monthly renewal
(crontab -l 2>/dev/null; echo "0 2 1 * * /home/$USER/renew-ssl.sh") | crontab -
```

### Option 2: Self-Signed Certificate (Development/Internal Use)
```bash
# Generate self-signed certificate
./generate-ssl.sh

# This creates ssl/cert.pem and ssl/key.pem
```

### Option 3: Custom Certificate
If you have your own SSL certificate:
```bash
# Copy your certificate files
cp your-certificate.crt ./ssl/cert.pem
cp your-private-key.key ./ssl/key.pem

# Set proper permissions
chmod 600 ./ssl/*.pem
```

## Azure AD Configuration

### 1. Register New Application
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: `4PLAN Everything Buddy Production`
   - **Supported account types**: Choose appropriate option
   - **Redirect URI**: 
     - Type: `Single-page application (SPA)`
     - URI: `https://your-domain.com`

### 2. Configure Authentication
1. In your app registration, go to **Authentication**
2. Add redirect URIs:
   - `https://your-domain.com`
   - `https://your-domain.com/` (with trailing slash)
3. Enable **Access tokens** and **ID tokens**
4. Configure **Logout URL**: `https://your-domain.com`

### 3. Update Environment Variables
```env
# Update .env with your production Azure AD settings
VITE_TENANT_ID=your_production_tenant_id
VITE_CLIENT_ID=your_production_client_id
```

### 4. Update Frontend Configuration
The application automatically detects the domain, but you can verify in `frontend/src/authConfig.js`:

```javascript
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID}`,
    redirectUri: window.location.origin, // This adapts to your domain
  }
};
```

## Environment Variables

### Complete .env File Template
```env
# =================================================================
# 4PLAN Everything Buddy - Production Environment Configuration
# =================================================================

# API Keys
TOGETHER_API_KEY=your_together_ai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Azure Active Directory
VITE_TENANT_ID=your_azure_tenant_id
VITE_CLIENT_ID=your_azure_client_id

# Production Settings
PRODUCTION_DOMAIN=your-domain.com
ENVIRONMENT=production

# Database Settings (if using external database)
# DATABASE_URL=postgresql://user:password@host:port/database

# Email Configuration (for notifications)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# Logging Level
LOG_LEVEL=INFO

# Security
# JWT_SECRET=your_jwt_secret_here
# ENCRYPTION_KEY=your_encryption_key_here
```

## Security Considerations

### 1. Firewall Configuration
**Ubuntu (UFW):**
```bash
# Enable firewall
sudo ufw enable

# Allow SSH (replace 22 with your SSH port if changed)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

**CentOS/RHEL (FirewallD):**
```bash
# Enable firewall
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Allow HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-all
```

### 2. File Permissions
```bash
# Set proper ownership
sudo chown -R $USER:$USER /path/to/4PLAN-Everything-Buddy

# Secure sensitive files
chmod 600 .env
chmod 600 ssl/*.pem
chmod 600 admins.json

# Set directory permissions
chmod 755 Documents/
chmod 755 vector_store/
```

### 3. Admin Configuration
Edit `admins.json` to set production administrators:
```json
{
  "admins": [
    "admin1@your-company.com",
    "admin2@your-company.com"
  ]
}
```

### 4. Network Security
- Use a reverse proxy (Nginx/Apache) for additional security
- Implement rate limiting
- Use fail2ban for intrusion prevention
- Regular security updates

## Firewall Configuration

### Router/Network Configuration
1. **Port Forwarding**: Forward ports 80 and 443 to your server
2. **Static IP**: Assign a static IP to your server
3. **DMZ**: Consider placing the server in a DMZ

### Cloud Provider Specific

**AWS EC2:**
```bash
# Security Group rules
# Inbound: HTTP (80) from 0.0.0.0/0
# Inbound: HTTPS (443) from 0.0.0.0/0
# Inbound: SSH (22) from your IP only
```

**Google Cloud:**
```bash
# Create firewall rules
gcloud compute firewall-rules create allow-http --allow tcp:80
gcloud compute firewall-rules create allow-https --allow tcp:443
```

**Azure:**
```bash
# Network Security Group rules
# Allow HTTP (80) from any source
# Allow HTTPS (443) from any source
```

## Domain and DNS Setup

### 1. Domain Registration
- Register a domain name from a registrar (GoDaddy, Namecheap, etc.)
- Or use a subdomain from your existing domain

### 2. DNS Configuration
Set up DNS records pointing to your server:

```
Type: A
Name: @ (or subdomain)
Value: YOUR_SERVER_IP_ADDRESS
TTL: 3600

Type: A  
Name: www
Value: YOUR_SERVER_IP_ADDRESS
TTL: 3600
```

### 3. Dynamic DNS (for home/office deployment)
If using dynamic IP:
```bash
# Install ddclient for dynamic DNS updates
sudo apt install ddclient

# Configure with your DNS provider
sudo nano /etc/ddclient.conf
```

## Production Optimization

### 1. Performance Tuning
**Increase Docker resources:**
```yaml
# In docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 2G
          cpus: '1.0'
```

### 2. Monitoring Setup
**Install monitoring tools:**
```bash
# Docker stats monitoring
docker stats

# System monitoring
sudo apt install htop iotop nethogs

# Log monitoring
docker compose logs -f app
```

### 3. Backup Strategy
**Create backup script:**
```bash
cat << 'EOF' > backup.sh
#!/bin/bash
BACKUP_DIR="/backup/4plan-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database and config files
cp favorites.db "$BACKUP_DIR/"
cp admins.json "$BACKUP_DIR/"
cp features.json "$BACKUP_DIR/"
cp knowledge_fields.json "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/"

# Backup vector store
cp -r vector_store/ "$BACKUP_DIR/"

# Backup documents (optional)
cp -r Documents/ "$BACKUP_DIR/"

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x backup.sh

# Schedule daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup.sh") | crontab -
```

### 4. Log Rotation
```bash
# Configure Docker log rotation
cat << 'EOF' > /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

sudo systemctl restart docker
```

## Troubleshooting

### Common Issues and Solutions

**1. Container won't start:**
```bash
# Check logs
docker compose logs app

# Check port conflicts
sudo netstat -tulpn | grep :443

# Rebuild container
docker compose down
docker compose build --no-cache
docker compose up -d
```

**2. SSL Certificate Issues:**
```bash
# Verify certificate files
ls -la ssl/
openssl x509 -in ssl/cert.pem -text -noout

# Check certificate expiry
openssl x509 -in ssl/cert.pem -enddate -noout
```

**3. Azure AD Authentication Fails:**
```bash
# Check environment variables
docker compose exec app env | grep VITE_

# Verify redirect URIs in Azure portal
# Check browser console for detailed errors
```

**4. Database Connection Issues:**
```bash
# Check file permissions
ls -la favorites.db admins.json features.json

# Verify volume mounts
docker compose exec app ls -la /app/
```

**5. Network Accessibility Issues:**
```bash
# Test internal access
curl -k https://localhost

# Test external access
curl -k https://your-domain.com

# Check firewall
sudo ufw status
sudo netstat -tulpn | grep :443
```

### Debugging Commands
```bash
# Enter container shell
docker compose exec app /bin/bash

# View container logs
docker compose logs -f app

# Check container resource usage
docker stats

# Network diagnostics
docker network ls
docker network inspect 4planeverythingbuddy_default
```

### Performance Monitoring
```bash
# Monitor system resources
htop
iotop
nethogs

# Monitor Docker resources
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Application logs
tail -f /var/log/docker.log
```

## Support and Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Check logs for errors
2. **Monthly**: Update system packages and restart
3. **Quarterly**: Review and rotate logs
4. **Annually**: Review SSL certificates and Azure AD settings

### Update Procedure
```bash
# Pull latest changes
git pull origin main

# Rebuild container
docker compose down
docker compose build
docker compose up -d

# Verify deployment
docker compose ps
docker compose logs app
```

### Contact Information
For technical support or issues:
- Check the GitHub repository issues
- Review application logs
- Contact your system administrator

---

**Note**: This guide assumes basic familiarity with Linux system administration, Docker, and network configuration. For production deployments, consider consulting with a DevOps engineer or system administrator.
