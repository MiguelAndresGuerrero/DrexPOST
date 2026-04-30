@echo off
title DrexPOS - Sistema de Ventas
color 0A

echo ========================================
echo    🛒 DREXPOS - Sistema de Ventas
echo ========================================
echo.

:: Verificar Node.js
echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js no esta instalado
    echo.
    echo 📥 Descargar Node.js desde: https://nodejs.org/
    echo 📌 Instalar la version LTS
    echo.
    pause
    exit
)
echo ✅ Node.js encontrado

:: Verificar MySQL (servicio)
echo [2/4] Verificando MySQL...
net start | find "MySQL" >nul 2>&1
if errorlevel 1 (
    echo ⚠️ MySQL no esta corriendo. Intentando iniciar...
    net start MySQL80 >nul 2>&1
    if errorlevel 1 (
        echo ❌ ERROR: MySQL no esta instalado o no se pudo iniciar
        echo.
        echo 📥 Descargar MySQL desde: https://dev.mysql.com/downloads/
        echo 📌 Configurar contraseña de root como: 0098
        echo.
        pause
        exit
    )
)
echo ✅ MySQL esta corriendo

:: Verificar dependencias del backend
echo [3/4] Verificando dependencias...
cd /d "%~dp0backend"
if not exist "node_modules" (
    echo 📦 Instalando dependencias (primera vez)...
    call npm install
    if errorlevel 1 (
        echo ❌ ERROR al instalar dependencias
        pause
        exit
    )
)
echo ✅ Dependencias listas

:: Iniciar el servidor
echo [4/4] Iniciando servidor DrexPOS...
echo.
echo ========================================
echo    🚀 DrexPOS INICIANDO...
echo ========================================
echo.

:: Iniciar servidor en segundo plano
start /B node server.js > server.log 2>&1

:: Esperar a que el servidor inicie
timeout /t 4 /nobreak >nul

:: Abrir navegador
start http://localhost:3000

echo.
echo ========================================
echo    ✅ DrexPOS CORRIENDO
echo ========================================
echo.
echo 🌐 Abre tu navegador en: http://localhost:3000
echo.
echo 🛑 Para detener: Cierra esta ventana
echo    o presiona Ctrl+C en la terminal
echo.
echo 📝 Logs del servidor: backend\server.log
echo.
pause