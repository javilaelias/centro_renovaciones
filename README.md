# 🔄 Centro de Renovaciones

Panel centralizado para gestionar y recordar renovaciones de **dominios, SSL, hosting, licencias, seguros, colegiaturas, suscripciones y garantías**. Nunca más pierdas una renovación.

![Stack](https://img.shields.io/badge/Node.js-20-339933) ![Stack](https://img.shields.io/badge/Express-4-000000) ![DB](https://img.shields.io/badge/SQLite-sql.js-003B57) ![Deploy](https://img.shields.io/badge/Railway-ready-0B0D0E)

---

## ✨ Características

- **Login seguro** con JWT (tokens de 30 días).
- **Vista lista y calendario** con filtros por categoría, urgencia, fecha y búsqueda.
- **Alertas automáticas** por **Email (SMTP)** y **SMS/WhatsApp (Twilio)**, programadas diariamente a las 8:00 AM.
- **Envío manual** de recordatorios por WhatsApp, Telegram, Email, Push y exportación JSON/CSV/PDF.
- **Importar/exportar** datos, datos de ejemplo, temas claro/oscuro y colores de acento.
- **Cambio de contraseña** desde la interfaz y **logout** con un clic.

## 🧱 Stack

| Capa      | Tecnología                                        |
|-----------|---------------------------------------------------|
| Frontend  | HTML + CSS + JavaScript vanilla (sin dependencias)|
| Backend   | Node.js 20 + Express 4                            |
| Base datos| SQLite vía [sql.js](https://sql.js.org/) (archivo) |
| Auth      | JWT + bcryptjs                                    |
| Notificaciones | nodemailer (SMTP) · twilio (SMS) · node-cron |

## 📁 Estructura del proyecto

```
centro_renovaciones/
├── index.html          # Frontend (SPA)
├── script.js           # Lógica del frontend
├── style.css           # Estilos
├── Dockerfile          # Imagen para producción (Railway)
├── railway.json        # Config de despliegue en Railway
├── .env.example        # Variables de entorno de ejemplo
└── server/
    ├── package.json
    └── src/
        ├── index.js        # Servidor Express (sirve API + frontend)
        ├── auth.js         # JWT + middleware requireAuth
        ├── authRoutes.js   # Login, verify, cambio de contraseña
        ├── routes.js       # CRUD de items, settings, seed, import
        ├── db.js           # Base de datos SQLite (sql.js)
        ├── notifications.js# Alertas por email
        ├── sms.js          # Alertas por SMS (Twilio)
        └── scheduler.js    # Tarea diaria (8:00 AM)
```

## 🚀 Puesta en marcha local

Requisitos: **Node.js 20+**.

```bash
# 1. Instalar dependencias del servidor
cd server
npm install

# 2. (Opcional) definir variables de entorno (ver sección más abajo)
#    En Windows (PowerShell):  $env:JWT_SECRET="tu-secreto"
#    En bash/macOS/Linux:      export JWT_SECRET="tu-secreto"

# 3. Arrancar el servidor (sirve API + frontend en http://localhost:3001)
npm run dev
```

> El proyecto **no** carga archivos `.env` automáticamente (no usa `dotenv`): las variables de entorno deben estar definidas en el sistema/hosting (en Railway, en la sección **Variables** del servicio). El archivo `.env.example` documenta cuáles existen.

> **Credenciales por defecto:** usuario `admin`, contraseña `admin`.
> **⚠️ Cámbialas al primer inicio** (botón de llave 🔑 en el header) antes de exponer la app.

## 🌐 Variables de entorno

| Variable     | Requerida | Descripción                                                        |
|--------------|-----------|--------------------------------------------------------------------|
| `PORT`       | No        | Puerto del servidor (por defecto `3001`; Railway lo inyecta solo). |
| `JWT_SECRET` | **Sí**    | Secreto para firmar tokens JWT. Genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `TZ`         | No        | Zona horaria del contenedor (p. ej. `America/Mexico_City`). Afecta al scheduler diario de alertas (8:00 AM). Por defecto Railway usa UTC. |

> Las credenciales **SMTP** y **Twilio** no van en variables de entorno: se configuran desde la interfaz (⚙️ **Configurar alertas**) y se guardan en la base de datos.
> El archivo `.env.example` es solo referencia: define las variables directamente en tu sistema u hosting.

## ☁️ Despliegue en Railway

El proyecto incluye un `Dockerfile` y `railway.json` listos. Railway detecta automáticamente el `Dockerfile` (builder `DOCKERFILE`) y usa `/api/health` como healthcheck.

### Opción A — Desde GitHub (recomendada)

1. Sube este repositorio a GitHub.
2. En [Railway](https://railway.app), crea un proyecto → **Deploy from GitHub repo**.
3. Railway detecta el `Dockerfile` automáticamente. Verifica en los logs: `Using detected Dockerfile!`.
4. En **Variables**, agrega:
   - `JWT_SECRET` → un valor aleatorio largo (genera uno con el comando de arriba).
   - `PORT` → `3001` (opcional; Railway lo asigna por su cuenta si lo dejas vacío).
5. Espera a que el build termine y abre la URL pública de producción.

### Opción B — Desde la CLI (Railway CLI)

```bash
# Dentro del directorio del proyecto
railway login
railway init
railway up
railway variable set JWT_SECRET=<tu-secreto-aleatorio>
```

### 💾 Persistir la base de datos (importante)

La app guarda todo en `server/data/centro.db` (SQLite). El filesystem de Railway es **efímero**, así que **sin un volumen los datos se pierden en cada redeploy**. Para persistirlos:

1. En Railway, ve a tu servicio → **Volumes** → **Add Volume**.
2. **Mount path:** `/app/server/data` (ruta dentro del contenedor donde vive la BD).
3. Tamaño: mínimo disponible (gratis: 0.5 GB).

> Nota: los volúmenes de Railway solo funcionan con `numReplicas: 1` (ya configurado en `railway.json`) y añaden unos segundos de downtime al redeployar.

### 🔁 Config de `railway.json`

```json
{
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## 🧪 Pruebas

Ejecuta la suite de pruebas automatizada (arranca el servidor, corre las pruebas y lo detiene):

```bash
node start_and_test.js
# Resultados en test_results.txt
```

Cubre: healthcheck, login `admin/admin`, obtención de items, verificación de token, rechazo de contraseña incorrecta, rechazo sin autenticación y servicio del frontend.

## 🔧 Scripts disponibles

```bash
cd server
npm start   # Inicia en producción
npm run dev # Inicia con recarga automática (node --watch)
```

---

Hecho con ❤️ para no volver a pagar una renovación vencida.
