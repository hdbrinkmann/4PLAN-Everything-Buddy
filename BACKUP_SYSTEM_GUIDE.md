# 🔄 4PLAN Everything Buddy - Backup System Guide

Das komplette Backup/Restore-System für 4PLAN Everything Buddy mit Cross-Platform-Unterstützung und automatischer Datenhistorisierung.

## 📋 Übersicht

Das Backup-System sichert alle wichtigen Komponenten Ihres 4PLAN Everything Buddy Systems:
- 🗄️ **SQLite Datenbank** (Benutzer, Favoriten, Chat-Historie, etc.)
- 🧠 **Vector Store** (KI-Wissensbasis und Embeddings)
- ⚙️ **Konfigurationsdateien** (admins.json, features.json, knowledge_fields.json)
- 🔐 **SSL-Zertifikate**
- 📦 **Docker Images** (Anwendungs-Container)

## 🎯 Retention-Policy

**Automatische Historisierung:**
- ✅ **7 Tage** tägliche Backups
- ✅ **12 Monate** monatliche Archive (letzter Tag im Monat)
- ✅ **Unbegrenzt** manuelle Backups (bis manuell gelöscht)

## 🚀 Installation & Setup

### Schritt 1: Automatische Backups einrichten

**macOS/Linux:**
```bash
./backup.sh --setup
```

**Windows:**
```cmd
backup.bat --setup
```

Dies erstellt:
- ✅ Tägliches Backup um 2:00 Uhr
- ✅ Konfigurationsdatei `backup_config.json`
- ✅ Backup-Verzeichnis `backups/`

### Schritt 2: Erstes manuelles Backup (Empfohlen)

**macOS/Linux:**
```bash
./backup.sh "Initial setup backup"
```

**Windows:**
```cmd
backup.bat "Initial setup backup"
```

## 💾 Backup erstellen

### Manuelles Backup

**macOS/Linux:**
```bash
# Einfaches Backup
./backup.sh

# Backup mit Beschreibung
./backup.sh "Before major update"

# Spezifischer Backup-Typ
./backup.sh "Pre-deployment" --type=manual
```

**Windows:**
```cmd
REM Einfaches Backup
backup.bat

REM Backup mit Beschreibung
backup.bat "Before major update"

REM Spezifischer Backup-Typ
backup.bat "Pre-deployment" --type=manual
```

### Backup-Typen

- **manual** - Manuelle Backups (Standard, unbegrenzte Aufbewahrung)
- **daily** - Tägliche Backups (7 Tage Aufbewahrung)
- **monthly** - Monatliche Archive (12 Monate Aufbewahrung)

### Python Direct Commands

```bash
# Direkte Python-Befehle (plattformunabhängig)
python3 backup_manager.py create "My backup description"
python3 backup_manager.py create "Daily backup" --type=daily
python3 backup_manager.py list
python3 backup_manager.py status
python3 backup_manager.py cleanup
```

## 🔄 Backup wiederherstellen

### Verfügbare Backups anzeigen

**macOS/Linux:**
```bash
./restore.sh --list
```

**Windows:**
```cmd
restore.bat --list
```

### Backup wiederherstellen

**⚠️ WARNUNG:** Wiederherstellung ersetzt ALLE aktuellen Daten!

**macOS/Linux:**
```bash
# Interaktive Wiederherstellung (mit Bestätigung)
./restore.sh backup_20250119_185322_manual

# Direkte Wiederherstellung (für Scripts)
./restore.sh backup_20250119_185322_manual --confirm
```

**Windows:**
```cmd
REM Interaktive Wiederherstellung
restore.bat backup_20250119_185322_manual

REM Direkte Wiederherstellung
restore.bat backup_20250119_185322_manual --confirm
```

## 📊 System-Verwaltung

### Backup-Status prüfen

```bash
python3 backup_manager.py status
```

**Beispiel-Output:**
```
Total backups: 15
Daily: 7, Monthly: 6, Manual: 2
Total size: 2.3 GB
```

### Backup-Historie anzeigen

```bash
python3 backup_manager.py list
```

**Beispiel-Output:**
```
Name                                Type       Size      Date                 Description
backup_20250119_185322_manual      manual     156.2 MB  2025-01-19 18:53:22  Before major update
backup_20250119_020000_daily       daily      152.1 MB  2025-01-19 02:00:00  Daily automated backup
backup_20250118_020000_daily       daily      151.8 MB  2025-01-18 02:00:00  Daily automated backup
```

### Alte Backups aufräumen

```bash
python3 backup_manager.py cleanup
```

## 📁 Backup-Struktur

Jedes Backup enthält:

```
backups/backup_20250119_185322_manual/
├── metadata.json          # Backup-Informationen
├── images.tar             # Docker Images (~150MB)
├── db_data.tar.gz         # SQLite Datenbank (~5MB)
├── vector_data.tar.gz     # Vector Store (~50MB)
├── config_data.tar.gz     # Konfigurationsdateien (~1MB)
├── ssl_data.tar.gz        # SSL-Zertifikate (~1MB)
└── checksums.sha256       # Integritätsprüfung
```

## ⚙️ Konfiguration

### backup_config.json

```json
{
  "retention_days": 7,        # Tägliche Backups aufbewahren
  "retention_months": 12,     # Monatliche Archive aufbewahren
  "backup_time": "02:00",     # Uhrzeit für automatische Backups
  "compress": true,           # Komprimierung aktivieren
  "verify_integrity": true,   # Integritätsprüfung aktivieren
  "incremental": false        # Vollständige Backups (kein Incremental)
}
```

## 🛠️ Erweiterte Nutzung

### Backup vor System-Updates

```bash
# Stoppe System, erstelle Backup, starte System
docker compose down
./backup.sh "Before system update"
git pull origin master
docker compose up -d --build
```

### Backup-Scheduling anpassen (macOS/Linux)

```bash
# Crontab bearbeiten
crontab -e

# Beispiel: Backup alle 6 Stunden
0 */6 * * * /pfad/zu/backup.sh "Automated 6h backup" --type=daily
```

### Backup-Scheduling anpassen (Windows)

```cmd
# Task Scheduler öffnen
taskschd.msc

# Task "4PLAN_Daily_Backup" bearbeiten
# Zeitplan anpassen nach Bedarf
```

### Backup auf externe Systeme kopieren

```bash
# Backup-Verzeichnis auf externes System synchronisieren
rsync -av backups/ user@remote:/backup/4plan/

# Oder lokale Kopie auf externe Festplatte
cp -r backups/ /media/external/4plan-backups/
```

## 🚨 Troubleshooting

### Häufige Probleme

**Problem:** `Docker is not running`
```bash
# Docker starten
# macOS/Linux: systemctl start docker
# Windows: Docker Desktop starten
```

**Problem:** `Python 3 is required but not found`
```bash
# Python 3 installieren
# macOS: brew install python3
# Ubuntu: sudo apt install python3
# Windows: python.org download
```

**Problem:** `Backup failed! Check backup.log for details`
```bash
# Log-Datei prüfen
tail -f backup.log

# Häufige Ursachen:
# - Nicht genügend Speicherplatz
# - Docker Volume nicht verfügbar
# - Container läuft nicht
```

**Problem:** `Permission denied`
```bash
# Scripts ausführbar machen
chmod +x backup.sh restore.sh backup_manager.py
```

### Backup-Verifikation

```bash
# Backup-Integrität prüfen
cd backups/backup_20250119_185322_manual/
sha256sum -c checksums.sha256
```

### Disaster Recovery

**Kompletter System-Neuaufbau:**

1. **System neu installieren**
2. **4PLAN Repository klonen**
3. **Backup-System kopieren**
4. **Letztes Backup wiederherstellen**

```bash
git clone https://github.com/hdbrinkmann/4PLAN-Everything-Buddy.git
cd 4PLAN-Everything-Buddy
# Backup-Dateien von externer Quelle kopieren
./restore.sh backup_20250119_185322_manual --confirm
```

## 📈 Best Practices

### 1. **Regelmäßige Backups**
- ✅ Automatische Backups aktivieren
- ✅ Vor wichtigen Updates manuelles Backup
- ✅ Regelmäßig Backup-Status prüfen

### 2. **Externe Sicherung**
- ✅ Backups auf externe Festplatte/Cloud kopieren
- ✅ 3-2-1 Regel: 3 Kopien, 2 verschiedene Medien, 1 extern

### 3. **Regelmäßige Tests**
- ✅ Monatlich Restore-Test durchführen
- ✅ Backup-Integrität prüfen
- ✅ Wiederherstellungszeit messen

### 4. **Dokumentation**
- ✅ Backup-Richtlinien dokumentieren
- ✅ Recovery-Prozeduren testen
- ✅ Notfall-Kontakte definieren

## 🔧 Integration mit CI/CD

### Pre-Deployment Backup

```yaml
# .github/workflows/deploy.yml
- name: Create Pre-Deployment Backup
  run: |
    ./backup.sh "Pre-deployment $(date +%Y%m%d_%H%M%S)"
    
- name: Deploy Application
  run: |
    docker compose down
    docker compose up -d --build
```

## 📞 Support

**Bei Problemen mit dem Backup-System:**

1. **Log-Datei prüfen:** `backup.log`
2. **System-Status:** `python3 backup_manager.py status`
3. **Docker-Status:** `docker compose ps`
4. **Speicherplatz:** `df -h`

**Notfall-Wiederherstellung:**
```bash
# Schnelle Wiederherstellung des letzten Backups
python3 backup_manager.py list | head -2 | tail -1 | cut -d' ' -f1 | xargs python3 backup_manager.py restore --confirm
```

---

## 📝 Changelog

**v1.0** (2025-01-19)
- ✅ Vollständiges Backup/Restore-System
- ✅ Cross-Platform-Unterstützung (macOS/Linux/Windows)
- ✅ Automatische Historisierung (7 Tage täglich, 12 Monate monatlich)
- ✅ Integritätsprüfung mit SHA256
- ✅ SQLite Checkpoint für Datenkonsistenz
- ✅ Docker Volume Backup
- ✅ Automatische Cleanup-Funktion
- ✅ Umfassende Dokumentation

Das Backup-System ist jetzt vollständig implementiert und einsatzbereit! 🎉
