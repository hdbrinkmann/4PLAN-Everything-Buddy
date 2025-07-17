# 🚀 Production Deployment für keycloak.4plan.de/4PLANBuddy

## ✅ Korrekturen implementiert

- **Domain**: keycloak.4plan.de (statt 4PLAN.de)
- **SSL-Zertifikat**: Verwendet vorhandenes Host-Zertifikat
- **Separate Configs**: Development und Production getrennt

## 📋 Unterschied Development vs Production

### Development (`docker-compose.yml`)
- Port: 443 (für lokale Entwicklung)
- Frontend: Ohne Sub-Path (`/`)
- SSL: Selbstsignierte Zertifikate im Container
- Backend: Ohne `root_path`

### Production (`docker-compose.prod.yml`)
- Port: 8443 (für Reverse-Proxy)
- Frontend: Mit Sub-Path (`/4PLANBuddy`)
- SSL: Host-Zertifikate eingebunden
- Backend: Mit `root_path=/4PLANBuddy`

## 🔧 Production Setup

### 1. Verzeichnisstruktur auf dem Server

```bash
mkdir -p /path/to/production/4plan-buddy
cd /path/to/production/4plan-buddy

# SSL-Zertifikate (WICHTIG: Verwenden Sie Ihre vorhandenen Zertifikate)
mkdir -p ssl
# Kopieren Sie Ihre echten Zertifikate hierher:
# cp /path/to/your/cert.pem ssl/cert.pem
# cp /path/to/your/key.pem ssl/key.pem

# Dokumente
mkdir -p Documents/"S4U & 4PLAN"

# Persistente Daten
mkdir -p vector_store
touch favorites.db
echo '[]' > admins.json
echo '{"image_generation":true,"pdf_docx_upload":true,"txt_sql_upload":true,"xlsx_csv_analysis":true,"web_search":true}' > features.json
echo '["S4U & 4PLAN"]' > knowledge_fields.json
```

### 2. docker-compose.prod.yml herunterladen

```bash
# Download der Production-Konfiguration
wget https://raw.githubusercontent.com/hdbrinkmann/4PLAN-Everything-Buddy/main/docker-compose.prod.yml
```

### 3. .env Datei erstellen

```bash
cat > .env << 'EOF'
VITE_TENANT_ID=your_tenant_id_here
VITE_CLIENT_ID=your_client_id_here
TOGETHER_API_KEY=your_together_api_key_here
EOF
```

### 4. SSL-Zertifikate konfigurieren

**WICHTIG**: Stellen Sie sicher, dass Ihre echten SSL-Zertifikate verwendet werden:

```bash
# Beispiel: Kopieren von Let's Encrypt Zertifikaten
sudo cp /etc/letsencrypt/live/keycloak.4plan.de/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/keycloak.4plan.de/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*.pem
```

### 5. Production Container starten

```bash
# Production-Version mit Registry-Image starten
docker-compose -f docker-compose.prod.yml up -d

# Logs überwachen
docker-compose -f docker-compose.prod.yml logs -f app
```

## 🔍 Testen der Konfiguration

### 1. Container-Status prüfen
```bash
docker-compose -f docker-compose.prod.yml ps
```

### 2. SSL-Zertifikat überprüfen
```bash
# Das richtige Zertifikat sollte angezeigt werden
curl -I https://localhost:8443/4PLANBuddy/
```

### 3. Live-Test über Reverse-Proxy
```bash
curl https://keycloak.4plan.de/4PLANBuddy/
```

## 🔧 Reverse-Proxy-Konfiguration

Nginx-Beispiel für keycloak.4plan.de:

```nginx
server {
    listen 443 ssl;
    server_name keycloak.4plan.de;
    
    # Ihre SSL-Konfiguration hier
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # 4PLAN Buddy Sub-Path
    location /4PLANBuddy/ {
        proxy_pass https://localhost:8443/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        
        # SSL-Passthrough
        proxy_ssl_verify off;
        proxy_ssl_session_reuse off;
    }
    
    # Socket.IO Support
    location /4PLANBuddy/socket.io/ {
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

## 🔄 Development vs Production Workflow

### Lokale Entwicklung
```bash
# Development-Container verwenden
docker-compose up --build -d

# App erreichbar unter: https://localhost:443/
```

### Production-Deployment
```bash
# Production-Container verwenden
docker-compose -f docker-compose.prod.yml up -d

# App erreichbar unter: https://keycloak.4plan.de/4PLANBuddy/
```

## ⚠️ Wichtige Hinweise

1. **SSL-Zertifikate**: 
   - Production verwendet Host-Zertifikate (read-only mount)
   - Development generiert selbstsignierte Zertifikate

2. **Port-Mapping**:
   - Development: 443:443 (direkt)
   - Production: 8443:443 (für Reverse-Proxy)

3. **Frontend-Build**:
   - Development: Ohne Sub-Path
   - Production: Mit `/4PLANBuddy` Sub-Path

4. **Backend-Konfiguration**:
   - Development: Ohne `root_path`
   - Production: Mit `BASE_PATH=/4PLANBuddy`

## 🎯 Erfolgsmeldung

✅ **Ihre App läuft erfolgreich unter https://keycloak.4plan.de/4PLANBuddy**

- Container läuft auf Port 8443
- Verwendet echte SSL-Zertifikate
- Frontend korrekt für Sub-Path konfiguriert
- API-Routen funktionieren
- WebSocket-Verbindungen aktiv
