# 4PLAN Everything Buddy - Docker Deployment Guide

## Übersicht
Diese Anleitung beschreibt, wie Sie das 4PLAN Everything Buddy Projekt mit Docker auf verschiedenen Systemen deployen.

## Voraussetzungen
- Docker Desktop installiert und gestartet
- Git (optional, für Versionskontrolle)
- OpenSSL (für SSL-Zertifikate, falls nicht über Docker verfügbar)

## Schnellstart

### 1. SSL-Zertifikate erstellen
**Wichtig:** SSL-Zertifikate müssen vor dem ersten Start erstellt werden!

#### Option A: Mit vorhandenen Skripten
```bash
# Linux/Mac:
./setup-ssl.sh

# Windows PowerShell:
.\setup-ssl.ps1
```

#### Option B: Manuell mit OpenSSL
```bash
mkdir ssl
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=DE/ST=State/L=City/O=Organization/CN=localhost"
```

#### Option C: Im Docker Container (falls OpenSSL lokal nicht verfügbar)
```bash
# Container starten (läuft zunächst auf HTTP)
docker compose up -d

# SSL-Zertifikate im Container erstellen
docker compose exec app openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=DE/ST=State/L=City/O=Organization/CN=localhost"

# Container neu starten für HTTPS
docker compose restart
```

### 2. Container starten
```bash
# Erste Ausführung - initialisiert alle Volumes automatisch
docker compose up --build -d

# Bei nachfolgenden Starts werden bestehende Daten wiederverwendet
docker compose up -d
```

### 3. Status prüfen
```bash
docker compose ps
docker compose logs
```

### 4. Anwendung testen
```bash
# HTTPS (empfohlen)
curl -k https://localhost:443/

# Im Browser
https://localhost:443/
```

## Problembehandlung

### Docker Credential Fehler
Falls Sie den Fehler `docker-credential-desktop: executable file not found` erhalten:

```bash
# Docker abmelden
docker logout

# Oder Docker-Konfiguration bearbeiten
# Entfernen Sie "credsStore": "desktop" aus ~/.docker/config.json
```

### SSL-Probleme
- Stellen Sie sicher, dass die Dateien `ssl/cert.pem` und `ssl/key.pem` existieren
- Bei selbst-signierten Zertifikaten: Browser-Sicherheitswarnung akzeptieren
- Verwenden Sie `-k` Flag bei curl für selbst-signierte Zertifikate

### Container startet nicht
```bash
# Logs prüfen
docker compose logs

# Container neu bauen
docker compose down
docker compose up --build
```

## Konfiguration

### Umgebungsvariablen
Die wichtigsten Konfigurationen befinden sich in der `.env` Datei:
- `TOGETHER_API_KEY`: API-Schlüssel für LLM
- `TENANT_ID`, `CLIENT_ID`: Azure AD Konfiguration
- `VITE_TENANT_ID`, `VITE_CLIENT_ID`: Frontend Azure AD Konfiguration

### Container Volumes
Das System verwendet persistente Docker Volumes für Datenbeständigkeit:
- `ssl_data`: SSL-Zertifikate
- `vector_data`: Vector Store Datenbank
- `db_data`: SQLite Datenbank (`/app/db_volume/favorites.db`)
- `config_data`: Konfigurationsdateien (`/app/config_volume/`)

Die Konfigurationsdateien werden automatisch beim ersten Start initialisiert:
- `admins.json`: Administrator-Liste
- `features.json`: Feature-Konfiguration
- `knowledge_fields.json`: Wissensbereich-Definitionen

### Ports
- **443**: HTTPS (Produktion)
- **8002**: HTTP (Fallback, nur wenn SSL fehlschlägt)

### Ressourcen
Der Container ist konfiguriert für:
- 4GB RAM
- 4 CPU Cores
- 16GB Swap (für bessere Vector Database Performance)

## Deployment auf verschiedenen Systemen

### Windows
1. Docker Desktop installieren
2. PowerShell als Administrator öffnen
3. SSL-Zertifikate erstellen: `.\setup-ssl.ps1`
4. Container starten: `docker compose up --build -d`

### macOS
1. Docker Desktop installieren
2. Terminal öffnen
3. SSL-Zertifikate erstellen: `./setup-ssl.sh`
4. Container starten: `docker compose up --build -d`

### Linux
1. Docker und Docker Compose installieren
2. SSL-Zertifikate erstellen: `./setup-ssl.sh`
3. Container starten: `docker compose up --build -d`

## Git Integration

### Wichtige Dateien für Git
Die `.gitignore` Datei ist so konfiguriert, dass folgende Dateien **nicht** committet werden:
- `ssl/` - SSL-Zertifikate (sicherheitsrelevant)
- `.env` - Umgebungsvariablen (enthält API-Keys)
- `*.db` - Datenbank-Dateien
- `vector_store/` - Vector Database (kann groß sein)
- `temp_uploads/` - Temporäre Dateien

### Sicheres Committing
```bash
# Repository initialisieren (falls noch nicht geschehen)
git init

# Dateien hinzufügen (SSL-Zertifikate werden automatisch ignoriert)
git add .

# Commit erstellen
git commit -m "Add Docker deployment configuration"

# Remote Repository hinzufügen und pushen
git remote add origin <your-repo-url>
git push -u origin main
```

## Sicherheitshinweise

1. **SSL-Zertifikate**: Niemals in Git committen
2. **API-Keys**: Niemals in Git committen (sind in .env)
3. **Produktionsumgebung**: Verwenden Sie echte SSL-Zertifikate von einer CA
4. **Firewall**: Stellen Sie sicher, dass nur notwendige Ports geöffnet sind

## Support

Bei Problemen:
1. Prüfen Sie die Container-Logs: `docker compose logs`
2. Stellen Sie sicher, dass Docker Desktop läuft
3. Überprüfen Sie, ob alle Ports verfügbar sind
4. Bei SSL-Problemen: Zertifikate neu generieren

## Wartung

### Container Updates
```bash
# Container stoppen
docker compose down

# Images aktualisieren
docker compose pull

# Neu starten
docker compose up --build -d
```

### SSL-Zertifikate erneuern
```bash
# Alte Zertifikate löschen
rm -rf ssl/

# Neue erstellen
./setup-ssl.sh  # oder setup-ssl.ps1 auf Windows

# Container neu starten
docker compose restart
