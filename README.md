# 🔄 Centro de Renovaciones

Panel centralizado para gestionar y recordar renovaciones de **dominios, SSL, hosting, licencias, seguros, colegiaturas, suscripciones y garantías**. Nunca más pierdas una renovación.

![Stack](https://img.shields.io/badge/Node.js-20-339933) ![Stack](https://img.shields.io/badge/Express-4-000000) ![DB](https://img.shields.io/badge/SQLite-sql.js-003B57) ![Deploy](https://img.shields.io/badge/Railway-ready-0B0D0E)

---

## ✨ Características

- **Login seguro** con JWT (tokens de 30 días).
- **Vista lista y calendario** con filtros por categoría, urgencia, fecha y búsqueda.
- **Alertas automáticas** por **Email (SMTP)**, **SMS/WhatsApp (Twilio)**, **Telegram** y **Push (Web Push)**, programadas diariamente a las 8:00 AM.
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
| Notificaciones | nodemailer (SMTP) · twilio (SMS) · Telegram Bot API · web-push (Push) · node-cron |

## 📁 Estructura del proyecto

```
centro_renovaciones/
├── index.html          # Frontend (SPA)
├── script.js           # Lógica del frontend
├── style.css           # Estilos
├── test_helpers.js     # Helpers compartidos (request + waitForServer)
├── test_server.js      # Suite de tests automatizada (npm test)
├── start_and_test.js   # Script heredado de verificación manual
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
        ├── notifications.js# Orquestación de alertas (email + SMS + Telegram + Push)
        ├── sms.js          # Alertas por SMS (Twilio)
        ├── telegram.js     # Alertas por Telegram (Bot API)
        ├── push.js         # Alertas push del navegador (Web Push + VAPID)
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
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | No | Claves VAPID para notificaciones push. Si no se definen, el servidor las genera automáticamente y las persiste en la base de datos. |

> Las credenciales **SMTP**, **Twilio** y **Telegram** no van en variables de entorno: se configuran desde la interfaz (⚙️ **Configurar alertas**) y se guardan en la base de datos.
> Las notificaciones **push** funcionan en el navegador y requieren HTTPS (o localhost) y permisos de notificación.
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

Ejecuta la suite de pruebas automatizada (arranca el servidor en un puerto de pruebas con una base de datos temporal, corre los tests y lo detiene):

```bash
cd server
npm test
```

> La suite usa el runner nativo de Node (`node:test`), sin dependencias extra. Puedes elegir otro puerto con `TEST_PORT=3100 npm test` si el `3210` está ocupado.

Cubre: healthcheck, login `admin/admin`, rechazo de contraseña incorrecta, rechazo sin autenticación, verificación de token, CRUD completo de items, validaciones, datos demo, settings enmascarados (sin fuga de `vapid_private_key`), clave VAPID, suscripciones push, verificación manual de alertas, servicio del frontend y del service worker, y cambio de contraseña.

> Script heredado: `node start_and_test.js` sigue disponible (resultados en `test_results.txt`). Ambos scripts comparten los helpers HTTP de `test_helpers.js` (`request` y `waitForServer`).

### 🔔 Configurar Telegram

1. Crea un bot con [@BotFather](https://t.me/BotFather) y copia el token.
2. Envía un mensaje a tu bot y obtén el chat ID con `https://api.telegram.org/bot<TOKEN>/getUpdates`.
3. En la app: ⚙️ **Configurar alertas** → **Telegram**, pega el token y el chat ID y activa la sección. Usa **Enviar mensaje de prueba** para verificar.
4. Marca la casilla **Telegram** en cada renovación para recibir su alerta.

### 🔔 Configurar Push (navegador)

1. En ⚙️ **Configurar alertas** → **Push**, activa la sección y pulsa **Suscribirme a notificaciones**.
2. Acepta el permiso del navegador. El servidor genera automáticamente las claves VAPID (o usa las variables `VAPID_*`).
3. Las renovaciones con alertas activas dispararán notificaciones aunque la pestaña esté cerrada (requiere HTTPS).

## 🔧 Scripts disponibles

```bash
cd server
npm start   # Inicia en producción
npm run dev # Inicia con recarga automática (node --watch)
```

---

Hecho con ❤️ para no volver a pagar una renovación vencida.
