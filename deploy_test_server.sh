#!/usr/bin/env bash
# ============================================================
# Centro de Renovaciones — Despliegue automático al servidor de
# pruebas (10.118.67.55:3005)
#
# - Empaqueta el código (frontend + backend) en centro_deploy.tar.gz
# - Lo sube por scp junto con deploy_remote_update.sh
# - Ejecuta el despliegue remoto EN el servidor
# - NO regenera la contraseña admin ni el JWT_SECRET (usa los
#   existentes en el servidor: .env.prod + ADMIN_PASSWORD.txt)
#
# Uso:  ./deploy_test_server.sh [--with-db]
#   --with-db   Incluye la BD local (server/data/centro.db) en el paquete
#   -h, --help  Muestra ayuda
#
# Requiere: ssh, scp, tar, base64.
# Credenciales: leerlas de .deploy.env (gitignored; ver .deploy.env.example).
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---------- Credenciales y configuración ----------
if [ -f .deploy.env ]; then
  set -a
  # shellcheck disable=SC1091
  # tr -d '\r' evita problemas si el archivo tiene fin de línea CRLF (Windows)
  source <(tr -d '\r' < .deploy.env)
  set +a
fi

DEPLOY_HOST="${DEPLOY_HOST:-10.118.67.55}"
DEPLOY_USER="${DEPLOY_USER:-usr_admin}"
DEPLOY_PORT="${DEPLOY_PORT:-3005}"
DEPLOY_APP_DIR="${DEPLOY_APP_DIR:-/home/usr_admin/centro_renovaciones}"
DEPLOY_SSH_PASS="${DEPLOY_SSH_PASS:-}"
WITH_DB="${WITH_DB:-0}"

if [ -z "$DEPLOY_SSH_PASS" ]; then
  echo "❌ Falta DEPLOY_SSH_PASS. Configúrala en .deploy.env (ver .deploy.env.example)."
  exit 1
fi

# ---------- Argumentos ----------
for arg in "$@"; do
  case "$arg" in
    --with-db) WITH_DB=1 ;;
    -h|--help)
      echo "Uso: ./deploy_test_server.sh [--with-db]"
      echo "  --with-db   Incluye la BD local (server/data/centro.db) en el despliegue"
      echo "  -h, --help  Muestra esta ayuda"
      exit 0 ;;
    *) echo "Argumento desconocido: $arg (usa -h para ayuda)"; exit 1 ;;
  esac
done

# ---------- Helpers SSH (askpass con base64: sin problemas con $ y %) ----------
ASKPASS="$(mktemp)"
chmod 600 "$ASKPASS"
trap 'rm -f "$ASKPASS"' EXIT
printf '#!/bin/bash\necho "%s" | base64 -d\n' "$(printf '%s' "$DEPLOY_SSH_PASS" | base64 | tr -d '\n')" > "$ASKPASS"
chmod +x "$ASKPASS"

export SSH_ASKPASS_REQUIRE=force
export SSH_ASKPASS="$ASKPASS"
SSH_OPTS=(-o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no -o ConnectTimeout=15)

run_remote() { # run_remote 'comando'
  if command -v setsid >/dev/null 2>&1; then
    setsid ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$1" < /dev/null
  else
    ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$1" < /dev/null
  fi
}

upload() { # upload 'archivo' 'destino_remoto'
  if command -v setsid >/dev/null 2>&1; then
    setsid scp "${SSH_OPTS[@]}" "$1" "${DEPLOY_USER}@${DEPLOY_HOST}:$2" < /dev/null
  else
    scp "${SSH_OPTS[@]}" "$1" "${DEPLOY_USER}@${DEPLOY_HOST}:$2" < /dev/null
  fi
}

# ---------- 1. Empaquetar ----------
FILES=(index.html script.js style.css sw.js xlsx_export.js Dockerfile .dockerignore .env.example railway.json \
       server/package.json server/package-lock.json server/src)
if [ "$WITH_DB" = "1" ]; then
  FILES+=(server/data/centro.db)
  echo "[1/5] Incluyendo BD local en el paquete (--with-db)"
else
  echo "[1/5] BD NO incluida: se conserva la base de datos del servidor"
fi

echo "[2/5] Creando centro_deploy.tar.gz ..."
rm -f centro_deploy.tar.gz
tar czf centro_deploy.tar.gz "${FILES[@]}"
echo "      $(du -h centro_deploy.tar.gz | cut -f1) — $(tar tzf centro_deploy.tar.gz | wc -l) archivos"

# ---------- 2. Subir paquete + script remoto ----------
echo "[3/5] Subiendo a ${DEPLOY_USER}@${DEPLOY_HOST} ..."
upload centro_deploy.tar.gz "centro_deploy.tar.gz"
upload deploy_remote_update.sh "deploy_remote_update.sh"
echo "      Subida OK"

# ---------- 3. Ejecutar despliegue remoto ----------
echo "[4/5] Ejecutando deploy_remote_update.sh en el servidor ..."
run_remote "WITH_DB=$WITH_DB DEPLOY_APP_DIR='$DEPLOY_APP_DIR' bash /home/usr_admin/deploy_remote_update.sh"

# ---------- 4. Verificar ----------
echo "[5/5] Verificando instancia remota ..."
sleep 2
code="$(curl -s -m 8 -o /dev/null -w '%{http_code}' "http://${DEPLOY_HOST}:${DEPLOY_PORT}/api/health" || true)"
echo "      Health: HTTP ${code}"
if [ "$code" = "200" ]; then
  echo "✅ Despliegue completado: http://${DEPLOY_HOST}:${DEPLOY_PORT}"
else
  echo "⚠️  Health no responde 200. Revisa los logs del contenedor."
  exit 1
fi
