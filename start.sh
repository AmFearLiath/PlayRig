#!/usr/bin/env bash
echo "==================================================="
echo "  PLAYRIG PLATFORM ENGINE - SERVER INITIALISIERUNG"
echo "  Datenbank: MySQL (Port 3307) - playrig_db"
echo "==================================================="

command -v node >/dev/null 2>&1 || { echo "[FEHLER] Node.js nicht gefunden!"; exit 1; }

if [ ! -d "node_modules" ]; then
    echo "[INFO] Installiere npm Module..."
    npm install
fi

echo "[INFO] Starte PlayRig Server auf Port 8882..."
node server/server.js
