# 🚀 Production Deployment Guide

## 📋 Overview

This project now uses Docker Compose override pattern for clean separation between development and production configurations while maintaining the robust initialization and volume management from the development setup.

## 🔄 Development vs Production

### Development (Default)
```bash
docker compose up -d
```
- **Port**: 443:443 (direct access)
- **Build**: Development mode with hot-reloading capabilities
- **SSL**: Auto-generated self-signed certificates
- **Path**: Root path (`/`)
- **Files**: Uses `docker-compose.yml` + `docker-compose.override.yml` (automatic)

### Production
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
- **Port**: 8443:443 (for reverse proxy)
- **Build**: Production mode (optimized build)
- **SSL**: Auto-generated self-signed certificates for internal communication
- **Path**: Root path (`/`) - no sub-path complexity
- **Files**: Uses `docker-compose.yml` + `docker-compose.prod.yml`

## 🎯 Key Improvements in New Production Setup

✅ **Retains init container**: Automatically handles all setup (SSL, directories, permissions)  
✅ **Uses Docker volumes**: No more bind mount permission issues  
✅ **No manual setup**: Everything is automated  
✅ **Simplified SSL**: Internal certificates generated automatically  
✅ **No sub-path complexity**: Serves at root path  
✅ **Same robust architecture**: Uses the proven patterns from development  

## 🚀 Production Deployment

### 1. Clone and Setup
```bash
git clone https://github.com/hdbrinkmann/4PLAN-Everything-Buddy.git
cd 4PLAN-Everything-Buddy
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values:
# VITE_TENANT_ID=your_tenant_id_here
# VITE_CLIENT_ID=your_client_id_here  
# TOGETHER_API_KEY=your_together_api_key_here
```

### 3. Deploy Production Container
```bash
# Build and start production containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Monitor startup
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

### 4. Verify Deployment
```bash
# Check container status
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Test internal SSL and application
curl -k https://localhost:8443/

# Check Docker volumes
docker volume ls | grep 4plan
```

## 🔧 Reverse Proxy Configuration

### Nginx Example
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # Your SSL certificates for external communication
    ssl_certificate /path/to/your/external/cert.pem;
    ssl_certificate_key /path/to/your/external/key.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Proxy to Docker container
    location / {
        proxy_pass https://localhost:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        
        # SSL settings for backend communication
        proxy_ssl_verify off;
        proxy_ssl_session_reuse off;
        proxy_read_timeout 86400;
    }
    
    # WebSocket support for real-time features
    location /socket.io/ {
        proxy_pass https://localhost:8443/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_ssl_verify off;
    }
}
```

### Apache Example
```apache
<VirtualHost *:443>
    ServerName your-domain.com
    
    # Your SSL certificates for external communication
    SSLEngine on
    SSLCertificateFile /path/to/your/external/cert.pem
    SSLCertificateKeyFile /path/to/your/external/key.pem
    
    # Proxy settings
    SSLProxyEngine on
    SSLProxyVerify none
    SSLProxyCheckPeerCN off
    SSLProxyCheckPeerName off
    
    ProxyPreserveHost On
    ProxyPass / https://localhost:8443/
    ProxyPassReverse / https://localhost:8443/
    
    # WebSocket support
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "wss://localhost:8443/$1" [P,L]
</VirtualHost>
```

## 🔍 Management Commands

### Check Status
```bash
# View running containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f app

# View init container logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs init
```

### Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Clean up old images
docker image prune -f
```

### Backup Data
```bash
# Backup volumes
docker run --rm -v 4plan-everything-buddy_db_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/db_data.tar.gz -C /data .
docker run --rm -v 4plan-everything-buddy_vector_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/vector_data.tar.gz -C /data .
docker run --rm -v 4plan-everything-buddy_config_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/config_data.tar.gz -C /data .
```

### Stop Services
```bash
# Stop containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Stop and remove volumes (CAUTION: This will delete all data)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

## 🛡️ Security Notes

- **Internal SSL**: The container generates its own SSL certificates for internal communication
- **External SSL**: Your reverse proxy handles SSL termination with your real certificates  
- **Data Persistence**: All data is stored in Docker volumes, not bind mounts
- **Port Isolation**: Only port 8443 is exposed from the container
- **Auto-restart**: Container automatically restarts unless manually stopped

## ✅ Why This Approach is Better

1. **No Permission Issues**: Docker volumes eliminate host filesystem permission problems
2. **Automated Setup**: Init container handles all initialization automatically  
3. **Consistent Architecture**: Same robust patterns for dev and production
4. **Simplified SSL**: No need to manage certificates manually
5. **Clean Configuration**: Override pattern keeps configurations DRY and maintainable
6. **Production Ready**: Optimized build process for production deployment

Your production deployment is now as reliable and automated as your development environment, without the complexity and permission issues of the previous approach.
