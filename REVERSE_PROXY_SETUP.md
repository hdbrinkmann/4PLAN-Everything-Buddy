# 🔧 Reverse-Proxy-Konfiguration für Sub-Path Deployment

## Zusammenfassung der Änderungen

✅ **Container-Port**: Von 443 auf 8443 geändert
✅ **Frontend**: Für `/4PLANBuddy` base path konfiguriert
✅ **Backend**: Sub-Path-Unterstützung implementiert
✅ **Environment**: `BASE_PATH=/4PLANBuddy` hinzugefügt
✅ **CORS**: Für alle Origins erweitert

## Reverse-Proxy-Konfiguration

### Nginx-Konfiguration

Fügen Sie folgende Konfiguration zu Ihrem Nginx-Reverse-Proxy für **keycloak.4plan.de** hinzu:

```nginx
# In Ihrer server{} Sektion
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
    
    # Wichtig für Socket.IO
    proxy_set_header X-Forwarded-Path /4PLANBuddy;
    proxy_redirect off;
    
    # SSL-Passthrough für Container
    proxy_ssl_verify off;
    proxy_ssl_session_reuse off;
}

# Socket.IO-spezifische Konfiguration
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
```

### Apache-Konfiguration (Alternative)

Falls Sie Apache verwenden:

```apache
# In Ihrer VirtualHost-Konfiguration
ProxyPreserveHost On
ProxyRequests Off

<Location /4PLANBuddy/>
    ProxyPass https://localhost:8443/
    ProxyPassReverse https://localhost:8443/
    
    # WebSocket-Support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule ^/4PLANBuddy/(.*)$ wss://localhost:8443/$1 [P,L]
</Location>

# SSL-Konfiguration
SSLProxyEngine On
SSLProxyVerify none
SSLProxyCheckPeerCN off
SSLProxyCheckPeerName off
```

### Traefik-Konfiguration (Alternative)

Falls Sie Traefik verwenden:

```yaml
# In Ihrer docker-compose.yml
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.4planbuddy.rule=Host(`keycloak.4plan.de`) && PathPrefix(`/4PLANBuddy`)"
      - "traefik.http.routers.4planbuddy.entrypoints=websecure"
      - "traefik.http.routers.4planbuddy.tls=true"
      - "traefik.http.services.4planbuddy.loadbalancer.server.port=443"
      - "traefik.http.services.4planbuddy.loadbalancer.server.scheme=https"
      - "traefik.http.middlewares.4planbuddy-stripprefix.stripprefix.prefixes=/4PLANBuddy"
      - "traefik.http.routers.4planbuddy.middlewares=4planbuddy-stripprefix"
```

### Microsoft Web Application Proxy (WAP)

Falls Sie Microsoft WAP verwenden, siehe die detaillierte Anleitung in `MICROSOFT_WAP_SETUP.md`.

**Kurze PowerShell-Konfiguration:**

```powershell
# WAP-Anwendung erstellen
Add-WebApplicationProxyApplication -Name "4PLAN Buddy" `
    -ExternalUrl "https://keycloak.4plan.de/4planbuddy/" `
    -BackendServerUrl "https://CONTAINER_HOST_IP:8443/" `
    -ExternalPreAuthentication PassThrough `
    -BackendServerAuthenticationSPN "HTTP/CONTAINER_HOST_IP" `
    -EnableHTTPRedirect:$true `
    -BackendServerCertificateValidation None
```

**Wichtige WAP-Besonderheiten:**
- ⚠️ Sub-Path-Handling komplexer als bei anderen Proxies
- ⚠️ WebSocket-Support benötigt spezielle Konfiguration
- ✅ ADFS-Integration verfügbar
- ✅ Enterprise-Sicherheitsfeatures

## Container starten

1. **Container builden und starten:**
```bash
docker-compose up --build -d
```

2. **Logs überprüfen:**
```bash
docker-compose logs -f app
```

3. **Container-Status prüfen:**
```bash
docker-compose ps
```

## Testen der Konfiguration

### 1. Lokaler Test (Container-Port)
```bash
curl -k https://localhost:8443/4PLANBuddy/
```

### 2. Reverse-Proxy-Test
```bash
curl https://keycloak.4plan.de/4PLANBuddy/
```

### 3. Browser-Test
- Öffnen Sie: `https://keycloak.4plan.de/4PLANBuddy/`
- Die App sollte normal laden und funktionieren

## Troubleshooting

### Problem: 404 Not Found
- ✅ Prüfen Sie die Reverse-Proxy-Konfiguration
- ✅ Stellen Sie sicher, dass der Container auf Port 8443 läuft
- ✅ Überprüfen Sie die Nginx/Apache-Logs

### Problem: WebSocket-Verbindung fehlgeschlagen
- ✅ Überprüfen Sie die Socket.IO-Konfiguration im Reverse-Proxy
- ✅ Stellen Sie sicher, dass Upgrade-Header weitergeleitet werden

### Problem: CSS/JS nicht geladen
- ✅ Überprüfen Sie die `base: '/4PLANBuddy/'` Konfiguration in Vite
- ✅ Prüfen Sie die Asset-Pfade in der Browser-Konsole

### Problem: API-Calls fehlgeschlagen
- ✅ Überprüfen Sie die FastAPI `root_path` Konfiguration
- ✅ Prüfen Sie die CORS-Einstellungen

## Container-Logs überwachen

```bash
# Live-Logs anzeigen
docker-compose logs -f app

# Letzte 100 Zeilen
docker-compose logs --tail=100 app

# Logs seit bestimmter Zeit
docker-compose logs --since=10m app
```

## Wichtige Hinweise

1. **SSL-Zertifikate**: Der Container erstellt automatisch selbstsignierte Zertifikate
2. **Persistente Daten**: Alle Daten bleiben in Docker-Volumes erhalten
3. **Updates**: Für Updates einfach `docker-compose up --build -d` ausführen
4. **Backup**: Sichern Sie regelmäßig die Docker-Volumes

## Erfolgsmeldung

Wenn alles korrekt konfiguriert ist, sollten Sie:
- ✅ Die App unter `https://keycloak.4plan.de/4PLANBuddy/` erreichen können
- ✅ Normale Funktionalität haben (Chat, File-Upload, etc.)
- ✅ WebSocket-Verbindungen funktionieren
- ✅ Alle API-Calls korrekt verarbeitet werden

🎉 **Gratulation! Ihre App läuft jetzt unter https://keycloak.4plan.de/4PLANBuddy**
