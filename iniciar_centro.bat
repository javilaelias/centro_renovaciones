@echo off
setlocal
title RenovaMEF - Iniciador (BD + Backend + Frontend)
cd /d "%~dp0"

echo =============================================
echo   RENOVAMEF - Iniciador
echo   (base de datos + backend + frontend)
echo =============================================
echo.

REM ---------- 1. Verificar Node.js ----------
where node >nul 2>&1
if errorlevel 1 goto :no_node
echo [1/5] Node.js detectado: OK
goto :check_deps

:no_node
echo [ERROR] No se encontro Node.js.
echo         Instala Node.js 20 o superior desde https://nodejs.org
echo.
pause
exit /b 1

:check_deps
REM ---------- 2. Instalar dependencias si faltan ----------
if exist "server\node_modules\express" goto :deps_ok
echo [2/5] Instalando dependencias: npm install...
pushd server
call npm install
if errorlevel 1 goto :deps_fail
popd
echo         Listo.
goto :check_env

:deps_fail
popd
echo [ERROR] Fallo npm install. Revisa la salida anterior.
echo.
pause
exit /b 1

:deps_ok
echo [2/5] Dependencias ya instaladas: OK

:check_env
REM ---------- 3. Crear .env si no existe ----------
if exist ".env" goto :env_ok
if not exist ".env.example" goto :no_env
echo [3/5] Creando .env con JWT_SECRET aleatorio...
node -e "const fs=require('fs'),c=require('crypto');let e=fs.readFileSync('.env.example','utf8');e=e.replace(/^JWT_SECRET=.*$/m,'JWT_SECRET='+c.randomBytes(48).toString('hex'));fs.writeFileSync('.env',e);"
if errorlevel 1 goto :no_env
echo         Listo. JWT_SECRET generado.
goto :env_done

:no_env
echo [ERROR] No se pudo crear .env. Copialo manualmente: copy .env.example .env
echo.
pause
exit /b 1

:env_ok
echo [3/5] .env ya existe: OK

:env_done
REM ---------- 4. Verificar base de datos ----------
if exist "server\data\centro.db" goto :db_ok
echo [4/5] Base de datos: se creara en el primer arranque (server\data\centro.db)
goto :check_server

:db_ok
echo [4/5] Base de datos detectada: server\data\centro.db

:check_server
REM ---------- 5. Si ya hay un servidor corriendo, solo abrir ----------
echo.
curl -s -m 2 http://localhost:3001/api/health >nul 2>&1
if not errorlevel 1 goto :already_running

echo [5/5] Arrancando servidor en http://localhost:3001 ...
start "RenovaMEF - Servidor" /D "%~dp0server" cmd /k "node src/index.js"

echo Esperando a que el servidor este listo...
set "READY="
set /a count=0
:wait_loop
ping -n 2 127.0.0.1 >nul
curl -s -m 2 http://localhost:3001/api/health >nul 2>&1
if not errorlevel 1 set "READY=1"
if defined READY goto :ready
set /a count+=1
if %count% lss 20 goto :wait_loop
goto :not_ready

:ready
echo Servidor listo. Abriendo RenovaMEF...
goto :open_browser

:not_ready
echo No se pudo confirmar el arranque; abriendo el navegador igualmente.
goto :open_browser

:already_running
echo Ya hay un servidor corriendo en :3001.

:open_browser
start "" "http://localhost:3001/#inicio"
echo.
echo =============================================
echo  Credenciales por defecto:  usuario: admin
echo                             password: admin
echo  Cierra la consola del servidor para detenerlo.
echo =============================================
echo.
pause
exit /b 0
