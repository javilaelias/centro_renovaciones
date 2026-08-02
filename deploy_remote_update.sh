#!/bin/bash
# ============================================================
# Centro de Renovaciones — Actualización remota (SE EJECUTA EN
# EL SERVIDOR de pruebas 10.118.67.55, normalmente invocado por
# deploy_test_server.sh vía ssh).
#
# - Extrae centro_deploy.tar.gz sobre el directorio de la app
# - (Opcional) copia la BD local al volumen si WITH_DB=1
# - Construye la imagen Docker y recrea el contenedor
# - NO regenera la contraseña admin ni el JWT_SECRET: reutiliza
#   .env.prod y ADMIN_PASSWORD.txt existentes del servidor.
# ============================================================
set -u

APP_DIR="${DEPLOY_APP_DIR:-/home/usr_admin/centro_renovaciones}"
PORT=3005
WITH_DB="${WITH_DB:-0}"
STAGE="$APP_DIR/.deploy_stage"

log() { echo "[deploy-remote] $*"; }
# Limpieza del staging incluso si algo falla a mitad de camino
cleanup() { [ -n "${STAGE:-}" ] && rm -rf "$STAGE"; }
trap cleanup EXIT

log "=== 1. Extraer paquete ==="
rm -rf "$STAGE"
mkdir -p "$STAGE"
tar xzf "$HOME/centro_deploy.tar.gz" -C "$STAGE" || { echo "ERROR_TAR"; exit 1; }
log "Paquete extraído: $(ls -la "$STAGE" | wc -l) entradas"

# Mover los archivos nuevos sobre el directorio de la app, limpiando antes
# los archivos reemplazables para evitar obsoletos (stale) en la imagen.
cd "$APP_DIR" || { echo "ERROR_CD"; exit 1; }
rm -rf server/src
rm -f index.html script.js style.css sw.js xlsx_export.js Dockerfile .dockerignore .env.example railway.json server/package.json server/package-lock.json
cp -a "$STAGE"/. "$APP_DIR"/ || { echo "ERROR_CP"; exit 1; }
rm -rf "$STAGE"
log "Código actualizado en $APP_DIR"

log "=== 2. Base de datos ==="
if [ "$WITH_DB" = "1" ] && [ -f "$APP_DIR/server/data/centro.db" ]; then
  mkdir -p "$APP_DIR/data"
  cp "$APP_DIR/server/data/centro.db" "$APP_DIR/data/centro.db"
  log "BD local copiada al volumen: $(du -h "$APP_DIR/data/centro.db" | cut -f1)"
else
  log "BD del servidor preservada (volumen intacto)."
fi

log "=== 3. JWT_SECRET existente (.env.prod) ==="
if [ -f "$APP_DIR/.env.prod" ]; then
  JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' "$APP_DIR/.env.prod" | head -1)"
  if [ -z "$JWT_SECRET" ]; then
    echo "ERROR: JWT_SECRET vacío en .env.prod"; exit 1
  fi
  log "JWT_SECRET reutilizado (${#JWT_SECRET} chars)"
else
  echo "ERROR: no existe .env.prod"; exit 1
fi

log "=== 4. Construir imagen Docker ==="
docker build -t centro_renovaciones:test . > /tmp/docker_build_update.log 2>&1
BUILD_RC=$?
echo "BUILD_RC=$BUILD_RC"
tail -6 /tmp/docker_build_update.log
if [ "$BUILD_RC" -ne 0 ]; then echo "FALLO_BUILD"; exit 1; fi

log "=== 5. Recrear contenedor (misma config, sin tocar contraseña) ==="
docker rm -f centro_renovaciones 2>/dev/null || true
RC_RUN=0
docker run -d --name centro_renovaciones --restart unless-stopped \
  -p "${PORT}:3001" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e PORT=3001 \
  -v "$APP_DIR/data:/app/server/data" \
  centro_renovaciones:test || RC_RUN=$?
echo "RC_RUN=$RC_RUN"
if [ "$RC_RUN" -ne 0 ]; then echo "FALLO_RUN"; exit 1; fi
sleep 8
docker ps --filter name=centro_renovaciones --format "{{.Names}} | {{.Status}} | {{.Ports}}"

log "=== 6. Health check (espera hasta 40s) ==="
READY=0
for i in $(seq 1 20); do
  code="$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/api/health" 2>/dev/null)"
  if [ "$code" = "200" ]; then READY=1; break; fi
  sleep 2
done
echo "READY=$READY"
curl -s -m 3 "http://localhost:${PORT}/api/health"; echo ""
if [ "$READY" != "1" ]; then
  echo "--- logs del contenedor ---"
  docker logs --tail 40 centro_renovaciones 2>&1
  exit 1
fi

log "=== 7. Verificar login admin (sin cambiarla) ==="
if [ -f "$APP_DIR/ADMIN_PASSWORD.txt" ]; then
  ADMIN_PASS="$(tr -d '\r\n ' < "$APP_DIR/ADMIN_PASSWORD.txt")"
  TOKEN="$(curl -s -m 5 -X POST "http://localhost:${PORT}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PASS\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  if [ -n "$TOKEN" ]; then
    log "Login admin OK con la contraseña existente (no modificada)."
  else
    log "⚠️  No se pudo verificar el login admin (¿cambió ADMIN_PASSWORD.txt?)."
  fi
else
  log "Sin ADMIN_PASSWORD.txt en el servidor; se omite verificación de login."
fi

log "=== FIN: instancia actualizada en http://localhost:${PORT} ==="
