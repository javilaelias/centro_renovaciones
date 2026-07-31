# ============================================
# Centro de Renovaciones — Dockerfile
# Ejecuta la API (server/) y sirve el frontend estático (raíz).
# Compatible con Railway (builder: DOCKERFILE).
# ============================================

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# 1) Dependencias primero (aprovecha la caché de capas de Docker)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# 2) Código de la aplicación:
#    - Frontend estático en la raíz (lo sirve express.static desde ../..)
#    - Backend en server/
COPY index.html style.css script.js sw.js ./
COPY server/src ./server/src

# 3) Variables de entorno por defecto (Railway las puede sobrescribir)
ENV PORT=3001

EXPOSE 3001

# Arranca la API, que también sirve el frontend
CMD ["node", "server/src/index.js"]
