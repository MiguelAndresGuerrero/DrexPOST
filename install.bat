@echo off
title DrexPOS - Instalador
color 0E

echo ========================================
echo    🛒 DREXPOS - INSTALADOR
echo ========================================
echo.

:: Verificar Node.js
echo [1/3] Verificando Node.js...
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
echo ✅ Node.js: 
node --version

:: Verificar MySQL
echo.
echo [2/3] Verificando MySQL...
mysql --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: MySQL no esta instalado
    echo.
    echo 📥 Descargar MySQL desde: https://dev.mysql.com/downloads/
    echo 📌 Configurar contraseña de root como: 0098
    echo 📌 O cambiar la contraseña en backend/server.js
    echo.
    pause
    exit
)
echo ✅ MySQL: 
mysql --version

:: Instalar dependencias
echo.
echo [3/3] Instalando dependencias del backend...
cd /d "%~dp0backend"
if exist "node_modules" (
    echo 📦 Eliminando node_modules antiguo...
    rmdir /s /q node_modules
)
call npm install
if errorlevel 1 (
    echo ❌ ERROR al instalar dependencias
    pause
    exit
)

echo ✅ Dependencias instaladas correctamente

:: Crear acceso directo en el escritorio
echo.
echo 📌 Creando acceso directo en el escritorio...
cd /d "%~dp0"
powershell -command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%userprofile%\Desktop\DrexPOS.lnk'); $SC.TargetPath = '%~dp0start.bat'; $SC.IconLocation = '%~dp0frontend\favicon.ico'; $SC.Save()" 2>nul

echo.
echo ========================================
echo    ✅ INSTALACION COMPLETADA
echo ========================================
echo.
echo 📋 PASOS PARA USAR DREXPOS:
echo.
echo 1. Asegurate de tener MySQL corriendo
echo 2. Ejecuta database\setup.sql en MySQL Workbench
echo 3. Haz doble clic en start.bat
echo 4. Usa el acceso directo en el escritorio
echo.
echo 🔑 Credenciales por defecto:
echo    MySQL User: Dr3X
echo    MySQL Password: 0098
echo    Database: SLVI
echo.
pause