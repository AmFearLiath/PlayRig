#!/usr/bin/env bash
# ==============================================================================
# PlayRig Engine - Vollautomatischer Server-Installer für Debian / Ubuntu
# Domain: playrig.amfearliath.de
# ==============================================================================

set -e

# Farben für Terminal-Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "  =============================================================="
echo "   ⚡ PLAYRIG ENGINE - SERVER INSTALLER (DEBIAN / NGINX)"
echo "  =============================================================="
echo "   Ziel-Subdomain: playrig.amfearliath.de"
echo "  =============================================================="
echo -e "${NC}"

# 1. Root / Sudo Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[FEHLER] Bitte starte dieses Skript mit Root-Rechten: sudo ./install.sh${NC}"
  exit 1
fi

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$INSTALL_DIR" == *playrig* ]]; then
  TARGET_DIR="$INSTALL_DIR"
else
  TARGET_DIR="/var/www/playrig"
fi
DOMAIN="playrig.amfearliath.de"

echo -e "${BLUE}[1/8] Prüfe Systempakete & erstelle Systembenutzer...${NC}"

# Paketquellen aktualisieren
apt-get update -y

# Erforderliche Basispakete installieren (inkl. lsof & psmisc für Port-Management)
apt-get install -y curl wget git unzip tar build-essential mariadb-server nginx certbot python3-certbot-nginx lsof psmisc

# Systembenutzer 'playrig' anlegen falls nicht vorhanden
if ! id "playrig" &>/dev/null; then
  useradd -r -s /bin/false -d "$TARGET_DIR" playrig
  echo -e "${GREEN}✓ Systembenutzer 'playrig' erfolgreich erstellt.${NC}"
fi

# 2. Node.js Installation prüfen (mindestens v18+, empfohlen v20/v22 LTS)
echo -e "${BLUE}[2/8] Prüfe Node.js Laufzeitumgebung...${NC}"
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 18 ]; then
    echo -e "${GREEN}✓ Node.js $(node -v) ist bereits installiert.${NC}"
    NEED_NODE=0
  fi
fi

if [ "$NEED_NODE" -eq 1 ]; then
  echo -e "${YELLOW}Installiere Node.js 20 LTS von NodeSource...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo -e "${GREEN}✓ Node.js $(node -v) und npm $(npm -v) installiert.${NC}"
fi

# 3. Projektverzeichnis einrichten (/var/www/playrig)
echo -e "${BLUE}[3/8] Richte Anwendungsverzeichnis unter $TARGET_DIR ein...${NC}"
if [ "$INSTALL_DIR" != "$TARGET_DIR" ]; then
  mkdir -p "$TARGET_DIR"
  echo "Kopiere Dateien nach $TARGET_DIR..."
  cp -r "$INSTALL_DIR"/* "$TARGET_DIR"/
  cp -r "$INSTALL_DIR"/.[!.]* "$TARGET_DIR"/ 2>/dev/null || true
fi

cd "$TARGET_DIR"

# 4. MariaDB / MySQL Datenbank & Benutzer einrichten
echo -e "${BLUE}[4/8] Richte MariaDB-Datenbank ein...${NC}"
systemctl enable mariadb
systemctl start mariadb

DB_NAME="playrig_db"
DB_USER="playrig_user"

# Prüfe ob bereits .env existiert mit Passwort
if [ -f "$TARGET_DIR/.env" ]; then
  # Vorhandenes Passwort aus .env extrahieren
  DB_PASS=$(grep -E '^DB_PASSWORD=' "$TARGET_DIR/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$DB_PASS" ] || [ "$DB_PASS" = "DeinSicheresPasswortHier" ]; then
  # Sicheres Zufallspasswort generieren
  DB_PASS=$(openssl rand -hex 16)
fi

# Datenbank und Benutzer anlegen
mariadb -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mariadb -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mariadb -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mariadb -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
mariadb -e "FLUSH PRIVILEGES;"
echo -e "${GREEN}✓ MariaDB-Datenbank '${DB_NAME}' und Benutzer '${DB_USER}' bereitgestellt.${NC}"

# Port-Prüfung: Standard-Port 8882
APP_PORT=8882
if [ -f "$TARGET_DIR/.env" ]; then
  EXISTING_PORT=$(grep -E '^PORT=' "$TARGET_DIR/.env" | cut -d'=' -f2- | tr -d ' ' | tr -d '"')
  if [ -n "$EXISTING_PORT" ]; then
    APP_PORT="$EXISTING_PORT"
  fi
fi

if ss -tlpn "sport = :${APP_PORT}" 2>/dev/null | grep -q ":${APP_PORT} "; then
  echo -e "${YELLOW}[HINWEIS] Port ${APP_PORT} ist bereits belegt! Verwende Ausweich-Port 8883 für PlayRig...${NC}"
  APP_PORT=8883
fi

# .env Konfigurationsdatei schreiben
cat > "$TARGET_DIR/.env" <<EOF
# ==============================================================================
# PlayRig Engine - Produktions-Konfiguration
# ==============================================================================
PORT=${APP_PORT}
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}
PUBLIC_URL=https://${DOMAIN}
EOF
chmod 600 "$TARGET_DIR/.env"
echo -e "${GREEN}✓ Konfigurationsdatei $TARGET_DIR/.env (Port: ${APP_PORT}) erfolgreich geschrieben.${NC}"

# 5. Node.js Abhängigkeiten installieren & DB initialisieren
echo -e "${BLUE}[5/8] Installiere NPM-Dependencies & initialisiere PlayRig...${NC}"
npm install --omit=dev

# Initialisiere Schema und automatische Rig-Discovery
echo "Initialisiere Tabellen und synchronisiere Rigs in MySQL..."
node -e "
const db = require('./server/db');
(async () => {
  try {
    await db.init();
    const count = (await db.getRigs()).length;
    console.log('[Installer] Erfolgreich initialisiert! Rigs in Datenbank:', count);
    process.exit(0);
  } catch (err) {
    console.error('[Installer] Fehler bei DB-Initialisierung:', err);
    process.exit(1);
  }
})();
"

echo ""
echo -e "${CYAN}--------------------------------------------------------------${NC}"
echo -e "${CYAN} 👤 Administrator-Konto für PlayRig einrichten${NC}"
echo -e "${CYAN}--------------------------------------------------------------${NC}"
echo -e "Es existieren keine Standard-Passwörter mehr (höchste Sicherheit)."
read -p "Möchtest du jetzt ein Administrator-Konto erstellen? (j/n) [j]: " SETUP_ADMIN
if [[ "$SETUP_ADMIN" =~ ^[jJyY]$ ]] || [ -z "$SETUP_ADMIN" ]; then
  node scripts/create-user.js || {
    echo -e "${YELLOW}Hinweis: Du kannst jederzeit ein Konto mit 'node scripts/create-user.js' anlegen.${NC}"
  }
else
  echo -e "${YELLOW}Übersprungen. Du kannst jederzeit mit folgendem Befehl ein Konto erstellen:${NC}"
  echo -e "cd ${TARGET_DIR} && node scripts/create-user.js"
fi

# Dateiberechtigungen für Systembenutzer setzen
chown -R playrig:playrig "$TARGET_DIR"

# 6. Systemd Service einrichten & starten
echo -e "${BLUE}[6/8] Richte Systemd-Dienst 'playrig.service' ein...${NC}"
NODE_BIN="$(command -v node || echo /usr/bin/node)"
cat > /etc/systemd/system/playrig.service <<EOF
[Unit]
Description=PlayRig Engine Server & Modular Gaming Platform
After=network.target mysql.service mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=playrig
Group=playrig
WorkingDirectory=${TARGET_DIR}
ExecStart=${NODE_BIN} server/server.js
Restart=always
RestartSec=5
EnvironmentFile=-${TARGET_DIR}/.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=playrig
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable playrig.service
systemctl restart playrig.service
sleep 2

if systemctl is-active --quiet playrig.service; then
  echo -e "${GREEN}✓ PlayRig Engine Dienst läuft aktiv im Hintergrund.${NC}"
else
  echo -e "${RED}[WARNUNG] PlayRig Dienst konnte nicht direkt starten. Prüfe: journalctl -u playrig.service${NC}"
fi

# 7. NGINX Reverse-Proxy Konfiguration
echo -e "${BLUE}[7/8] Konfiguriere NGINX Reverse-Proxy für ${DOMAIN}...${NC}"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"

# Alte und konfliktbehaftete Konfigurationen in sites-enabled restlos entfernen
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-enabled/*playrig*
rm -f /etc/nginx/sites-enabled/*amfearliath*

SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [ -f "$SSL_CERT" ]; then
  echo -e "${GREEN}✓ SSL-Zertifikat für ${DOMAIN} gefunden.${NC}"
  cp "$TARGET_DIR/deploy/nginx/playrig.amfearliath.de.conf" "$NGINX_CONF"
  sed -i "s/127.0.0.1:[0-9]\+/127.0.0.1:${APP_PORT}/g" "$NGINX_CONF"
else
  echo -e "${YELLOW}Kein SSL-Zertifikat gefunden. Erstelle temporäre HTTP-Konfiguration für Certbot...${NC}"
  cat > "$NGINX_CONF" <<NGINX_HTTP_EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 50M;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90s;
    }
}
NGINX_HTTP_EOF
fi

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}.conf"

nginx -t
systemctl reload nginx
echo -e "${GREEN}✓ NGINX erfolgreich für ${DOMAIN} konfiguriert und neu geladen.${NC}"

# 8. Let's Encrypt SSL-Zertifikat mit Certbot (falls noch nicht aktiv)
if [ ! -f "$SSL_CERT" ]; then
  echo -e "${BLUE}[8/8] SSL-Zertifikat für ${DOMAIN}...${NC}"
  read -p "Möchtest du jetzt ein kostenloses Let's Encrypt SSL-Zertifikat via Certbot einrichten? (j/n): " RUN_CERTBOT
  if [[ "$RUN_CERTBOT" =~ ^[jJyY]$ ]]; then
    echo -e "${CYAN}Starte Certbot für ${DOMAIN}...${NC}"
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect -m admin@amfearliath.de || {
      echo -e "${YELLOW}Hinweis: Certbot konnte nicht automatisch abschließen. Stelle sicher, dass der DNS A-Record für ${DOMAIN} auf diesen Server zeigt.${NC}"
      echo -e "${YELLOW}Du kannst den Befehl später erneut ausführen: sudo certbot --nginx -d ${DOMAIN}${NC}"
    }
    if [ -f "$SSL_CERT" ]; then
      cp "$TARGET_DIR/deploy/nginx/playrig.amfearliath.de.conf" "$NGINX_CONF"
      sed -i "s/127.0.0.1:[0-9]\+/127.0.0.1:${APP_PORT}/g" "$NGINX_CONF"
      nginx -t && systemctl reload nginx
      echo -e "${GREEN}✓ NGINX mit vollem SSL/TLS-Proxy aktiviert.${NC}"
    fi
  else
    echo -e "${YELLOW}SSL-Einrichtung übersprungen. Du kannst sie jederzeit starten mit:${NC}"
    echo -e "sudo certbot --nginx -d ${DOMAIN}"
  fi
else
  echo -e "${GREEN}[8/8] SSL-Zertifikat für ${DOMAIN} ist bereits aktiv und eingebunden.${NC}"
fi

# Lokale Backend-Prüfung
sleep 1
HEALTH=$(curl -s "http://127.0.0.1:${APP_PORT}/api/health" || echo "")
if [[ "$HEALTH" == *"\"status\":\"ok\""* ]]; then
  echo -e "${GREEN}✓ PlayRig Engine antwortet erfolgreich auf Port ${APP_PORT} (Status: OK).${NC}"
fi

# Abschluss-Zusammenfassung
echo ""
echo -e "${GREEN}${BOLD}==============================================================${NC}"
echo -e "${GREEN}${BOLD} 🎉 PLAYRIG INSTALLATION ERFOLGREICH ABGESCHLOSSEN!${NC}"
echo -e "${GREEN}${BOLD}==============================================================${NC}"
echo -e " 🌐 URL:                  ${CYAN}https://${DOMAIN}${NC}"
echo -e " 📂 Installationspfad:    ${TARGET_DIR}"
echo -e " 🛠️ Dienst-Status:        systemctl status playrig"
echo -e " 📜 Live-Logs:            journalctl -u playrig.service -f"
echo -e " 👤 Benutzerverwaltung:   node scripts/create-user.js"
echo -e " 🗄️ MariaDB Benutzer:     ${DB_USER}"
echo -e " 🔑 MariaDB Passwort:     ${DB_PASS}"
echo -e "=============================================================="
echo ""

