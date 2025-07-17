# 🚀 Microsoft Web Application Proxy (WAP) Konfiguration für 4PLAN Buddy

## Übersicht
Diese Anleitung zeigt, wie Sie Microsoft Web Application Proxy konfigurieren, um Ihren 4PLAN Buddy Container (Port 8443) unter `https://keycloak.4plan.de/4planbuddy/` zu veröffentlichen.

## Voraussetzungen

### 1. WAP-Server Vorbereitung
- Windows Server mit WAP-Rolle installiert
- ADFS-Integration (optional)
- SSL-Zertifikat für keycloak.4plan.de
- Netzwerkzugriff auf Container-Host (Port 8443)

### 2. Container-Status prüfen
```bash
# Stellen Sie sicher, dass der Container läuft
docker-compose -f docker-compose.prod.yml ps

# Port 8443 sollte verfügbar sein
netstat -an | findstr :8443
```

## WAP-Konfiguration

### Option 1: PowerShell-Konfiguration (Empfohlen)

```powershell
# WAP-Anwendung für 4PLAN Buddy erstellen
Add-WebApplicationProxyApplication -Name "4PLAN Buddy" `
    -ExternalUrl "https://keycloak.4plan.de/4planbuddy/" `
    -BackendServerUrl "https://CONTAINER_HOST_IP:8443/" `
    -ExternalPreAuthentication PassThrough `
    -BackendServerAuthenticationSPN "HTTP/CONTAINER_HOST_IP" `
    -EnableHTTPRedirect:$true `
    -EnableSignOut:$false `
    -InactiveTransactionsTimeoutSec 300

# Spezielle Header für Socket.IO konfigurieren
Set-WebApplicationProxyApplication -Name "4PLAN Buddy" `
    -ClientCertificatePreAuthentication None `
    -BackendServerCertificateValidation None
```

### Option 2: GUI-Konfiguration

1. **WAP-Verwaltungskonsole öffnen**
   - Server Manager → Remote Access → Web Application Proxy

2. **Neue Anwendung veröffentlichen**
   - Name: `4PLAN Buddy`
   - External URL: `https://keycloak.4plan.de/4planbuddy/`
   - Backend Server URL: `https://CONTAINER_HOST_IP:8443/`
   - Pre-authentication: `Pass-through` (oder ADFS nach Bedarf)

3. **Erweiterte Einstellungen**
   - Enable HTTP Redirect: ✅ Aktiviert
   - Backend Server SPN: `HTTP/CONTAINER_HOST_IP`
   - Client Certificate Pre-authentication: ❌ Deaktiviert

## Spezielle Konfigurationen für Socket.IO

### 1. URL-Rewrite-Regeln (IIS ARR erforderlich)

Falls Sie IIS mit Application Request Routing auf dem WAP-Server haben:

```xml
<!-- web.config für erweiterte URL-Rewriting -->
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="4PLAN Buddy WebSocket" stopProcessing="true">
          <match url="^4planbuddy/socket\.io/(.*)$" />
          <action type="Rewrite" url="https://CONTAINER_HOST_IP:8443/socket.io/{R:1}" />
          <serverVariables>
            <set name="HTTP_UPGRADE" value="{HTTP_UPGRADE}" />
            <set name="HTTP_CONNECTION" value="{HTTP_CONNECTION}" />
          </serverVariables>
        </rule>
        <rule name="4PLAN Buddy General" stopProcessing="true">
          <match url="^4planbuddy/(.*)$" />
          <action type="Rewrite" url="https://CONTAINER_HOST_IP:8443/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### 2. Alternative: Direkter WebSocket-Proxy

```powershell
# Separate Anwendung für Socket.IO (wenn nötig)
Add-WebApplicationProxyApplication -Name "4PLAN Buddy Socket.IO" `
    -ExternalUrl "https://keycloak.4plan.de/4planbuddy/socket.io/" `
    -BackendServerUrl "https://CONTAINER_HOST_IP:8443/socket.io/" `
    -ExternalPreAuthentication PassThrough `
    -BackendServerAuthenticationSPN "HTTP/CONTAINER_HOST_IP" `
    -EnableHTTPRedirect:$false
```

## SSL-Zertifikat-Konfiguration

### 1. Backend-Zertifikat Vertrauen

```powershell
# Falls Self-Signed Zertifikate verwendet werden
# Zertifikat vom Container exportieren und importieren
$cert = Get-ChildItem -Path "Cert:\LocalMachine\Root" | Where-Object {$_.Subject -like "*localhost*"}
if (-not $cert) {
    Write-Host "Importieren Sie das Container-Zertifikat in den Trusted Root Store"
}

# Backend-Zertifikat-Validierung deaktivieren (nicht für Production empfohlen)
Set-WebApplicationProxyApplication -Name "4PLAN Buddy" `
    -BackendServerCertificateValidation None
```

### 2. Frontend-Zertifikat

```powershell
# SSL-Zertifikat für keycloak.4plan.de muss installiert sein
Get-ChildItem -Path "Cert:\LocalMachine\My" | Where-Object {$_.Subject -like "*keycloak.4plan.de*"}
```

## Firewall-Konfiguration

### 1. Windows Firewall

```powershell
# Ausgehende Verbindung zu Container erlauben
New-NetFirewallRule -DisplayName "4PLAN Buddy Backend" `
    -Direction Outbound `
    -Protocol TCP `
    -RemotePort 8443 `
    -Action Allow

# Eingehende HTTPS-Verbindungen
New-NetFirewallRule -DisplayName "WAP HTTPS" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 443 `
    -Action Allow
```

### 2. Container-Host Firewall

```bash
# Auf dem Container-Host (falls Linux)
sudo ufw allow from WAP_SERVER_IP to any port 8443

# Oder für Windows Container-Host
netsh advfirewall firewall add rule name="4PLAN Buddy WAP" dir=in action=allow protocol=TCP localport=8443 remoteip=WAP_SERVER_IP
```

## Troubleshooting

### 1. Häufige Probleme

**Problem: 404 Not Found**
```powershell
# WAP-Anwendung Status prüfen
Get-WebApplicationProxyApplication -Name "4PLAN Buddy"

# Backend-Erreichbarkeit testen
Test-NetConnection -ComputerName CONTAINER_HOST_IP -Port 8443
```

**Problem: WebSocket-Verbindung fehlgeschlagen**
```powershell
# Socket.IO spezifische Konfiguration prüfen
Invoke-WebRequest -Uri "https://CONTAINER_HOST_IP:8443/socket.io/?transport=polling" -UseBasicParsing
```

**Problem: SSL-Fehler**
```powershell
# Backend-Zertifikat-Validierung testen
[Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
Invoke-WebRequest -Uri "https://CONTAINER_HOST_IP:8443/" -UseBasicParsing
```

### 2. Debugging-Tools

```powershell
# WAP-Logs anzeigen
Get-WinEvent -LogName "Microsoft-Windows-WebApplicationProxy/Admin" -MaxEvents 50

# Performance-Counter überwachen
Get-Counter -Counter "\Web Application Proxy\Total requests per second"

# Netzwerk-Trace für detaillierte Analyse
netsh trace start capture=yes provider=Microsoft-Windows-WebApplicationProxy
# ... Test durchführen ...
netsh trace stop
```

## Alternative Lösungsansätze

### Option A: Subdomain-Ansatz (Einfacher)

Falls Sub-Path-Probleme auftreten:

```powershell
# Separate Subdomain verwenden
Add-WebApplicationProxyApplication -Name "4PLAN Buddy" `
    -ExternalUrl "https://4planbuddy.4plan.de/" `
    -BackendServerUrl "https://CONTAINER_HOST_IP:8443/" `
    -ExternalPreAuthentication PassThrough
```

**Vorteile:**
- Einfachere Konfiguration
- Bessere WebSocket-Kompatibilität
- Weniger URL-Rewriting-Probleme

### Option B: IIS mit ARR als Zwischenschicht

```powershell
# IIS Application Request Routing installieren
# Dann detaillierte URL-Rewrite-Regeln verwenden
```

## Testen der Konfiguration

### 1. Basis-Test

```powershell
# Direkte Container-Verbindung
Invoke-WebRequest -Uri "https://CONTAINER_HOST_IP:8443/4PLANBuddy/" -UseBasicParsing

# WAP-Verbindung
Invoke-WebRequest -Uri "https://keycloak.4plan.de/4planbuddy/" -UseBasicParsing
```

### 2. Browser-Test

1. Öffnen Sie: `https://keycloak.4plan.de/4planbuddy/`
2. Prüfen Sie Browser-Konsole auf Fehler
3. Testen Sie Chat-Funktionalität
4. Überprüfen Sie WebSocket-Verbindung (Status sollte "Connected" zeigen)

### 3. Socket.IO-Test

```javascript
// Browser-Konsole
const socket = io();
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
```

## ADFS-Integration (Optional)

Falls Sie ADFS-Authentifizierung benötigen:

```powershell
# ADFS Relying Party Trust erstellen
Add-AdfsRelyingPartyTrust -Name "4PLAN Buddy" `
    -Identifier "https://keycloak.4plan.de/4planbuddy/" `
    -WSFedEndpoint "https://keycloak.4plan.de/4planbuddy/"

# WAP mit ADFS Pre-Authentication
Set-WebApplicationProxyApplication -Name "4PLAN Buddy" `
    -ExternalPreAuthentication ADFS `
    -ADFSRelyingPartyName "4PLAN Buddy"
```

## Wartung und Monitoring

### 1. Log-Monitoring

```powershell
# Automatisches Log-Monitoring
$logWatcher = Register-ObjectEvent -InputObject (Get-WinEvent -LogName "Microsoft-Windows-WebApplicationProxy/Admin" -MaxEvents 1) -EventName EntryWritten -Action {
    Write-Host "New WAP event: $($Event.SourceEventArgs.Entry.Message)"
}
```

### 2. Performance-Überwachung

```powershell
# Performance-Counters kontinuierlich überwachen
while ($true) {
    $requests = (Get-Counter -Counter "\Web Application Proxy\Total requests per second").CounterSamples.CookedValue
    Write-Host "Requests/sec: $requests"
    Start-Sleep 5
}
```

## Erfolgsmeldung

Bei erfolgreicher Konfiguration sollten Sie:
- ✅ Die App unter `https://keycloak.4plan.de/4planbuddy/` erreichen können
- ✅ Status "Connected" in der App angezeigt bekommen
- ✅ Chat-Funktionalität vollständig verfügbar haben
- ✅ File-Upload und alle Features funktionsfähig haben

**Ihre 4PLAN Buddy App ist jetzt über Microsoft WAP verfügbar!**
