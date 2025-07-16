# 🐳 Container Deployment Guide

## 📋 Zusammenfassung der Fixes

### ✅ **Knowledge Base Fix**
- **Problem**: Knowledge Field wurde falsch als "Python" statt "S4U & 4PLAN" erkannt
- **Lösung**: Path-Parsing-Logik in `llm.py` repariert
- **Status**: ✅ Funktioniert jetzt korrekt in allen Umgebungen

### ✅ **Docker Production Fix**
- **Problem**: Documents und Vector Store waren nicht persistent in der Produktion
- **Lösung**: Volume-Mounts in `docker-compose.prod.yml` hinzugefügt
- **Status**: ✅ "Update Knowledge Base" funktioniert jetzt auch in der Produktion

## 🚀 Deployment auf einem anderen Rechner

### 1. **Verzeichnisstruktur erstellen**
```bash
mkdir -p /path/to/your/deployment/4plan-buddy
cd /path/to/your/deployment/4plan-buddy

# Erstelle die notwendigen Verzeichnisse
mkdir -p Documents/S4U\ \&\ 4PLAN
mkdir -p vector_store
mkdir -p ssl
```

### 2. **Docker-Compose-Datei kopieren**
```bash
# Kopiere die reparierte docker-compose.prod.yml
wget https://raw.githubusercontent.com/hdbrinkmann/4PLAN-Everything-Buddy/main/docker-compose.prod.yml
```

### 3. **Konfigurationsdateien erstellen**
```bash
# Erstelle leere Konfigurationsdateien
echo "[]" > admins.json
echo '{"image_generation":true,"pdf_docx_upload":true,"txt_sql_upload":true,"xlsx_csv_analysis":true,"web_search":true}' > features.json
echo '["S4U & 4PLAN"]' > knowledge_fields.json
touch favorites.db
```

### 4. **Dokumente hinzufügen**
```bash
# Kopiere Ihre Word-Dokumente in den richtigen Ordner
cp /path/to/your/documents/*.docx "Documents/S4U & 4PLAN/"
```

### 5. **Umgebungsvariablen konfigurieren**
```bash
# Erstelle .env Datei mit Ihren API-Keys
cat > .env << 'EOF'
TOGETHER_API_KEY=your_together_api_key_here
VITE_TENANT_ID=your_tenant_id_here
VITE_CLIENT_ID=your_client_id_here
EOF
```

### 6. **SSL-Zertifikate generieren**
```bash
# Automatische SSL-Zertifikat-Generierung
openssl req -x509 -newkey rsa:4096 -keyout ssl/server.key -out ssl/server.crt -days 365 -nodes -subj "/CN=localhost"
```

### 7. **Container starten**
```bash
# Production-Deployment starten
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Nach dem Deployment

### 1. **Knowledge Base erstellen**
- Öffnen Sie `https://your-server-ip:443`
- Loggen Sie sich als Administrator ein
- Klicken Sie auf "Update Knowledge Base"
- ✅ Funktioniert jetzt korrekt dank unserer Fixes!

### 2. **Neue Dokumente hinzufügen**
```bash
# Neue Dokumente hinzufügen
cp new_document.docx "Documents/S4U & 4PLAN/"

# Knowledge Base über die Web-UI aktualisieren
# Oder per CLI:
docker-compose -f docker-compose.prod.yml exec app python rebuild_knowledge_base.py
```

## 📊 Verifikation

### Container-Status prüfen:
```bash
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f app
```

### Volume-Persistenz testen:
```bash
# Prüfe, ob die Volumes korrekt gemountet sind
docker-compose -f docker-compose.prod.yml exec app ls -la /app/Documents/
docker-compose -f docker-compose.prod.yml exec app ls -la /app/vector_store/
```

## 🎯 **Antworten auf Ihre Fragen:**

### ✅ **"Kann ich Update Knowledge Base im Container aufrufen?"**
**JA!** Mit den Fixes funktioniert es:
- Development: ✅ Funktionierte bereits
- Production: ✅ Funktioniert jetzt auch (Volume-Mounts hinzugefügt)

### ✅ **"Funktioniert es auf anderen Rechnern?"**
**JA!** Die Pfad-Logik ist jetzt robust:
- Arbeitet relativ zum Container-Arbeitsverzeichnis (`/app`)
- Unabhängig von der Host-Verzeichnisstruktur oberhalb des Deployment-Ordners
- Funktioniert auf Linux, macOS, Windows mit Docker

### 💡 **Warum funktioniert es jetzt überall?**
1. **Container-interne Pfade**: `/app/Documents` und `/app/vector_store`
2. **Relative Pfad-Berechnung**: `SCRIPT_DIR` basiert auf Container-Arbeitsverzeichnis
3. **Volume-Persistenz**: Host-Verzeichnisse werden korrekt gemountet

## 🔄 **Migrations-Hinweis**
Bestehende Produktions-Deployments müssen:
1. `docker-compose.prod.yml` aktualisieren
2. Container neu starten
3. Knowledge Base einmal neu erstellen

Das war's! Die Anwendung sollte jetzt überall funktionieren. 🎉
