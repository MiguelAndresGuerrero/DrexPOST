# 🛒 DrexPOS - Sistema de Ventas e Inventario

![Version](https://img.shields.io/badge/version-5.0.0-blue)
![Node](https://img.shields.io/badge/node-16%2B-green)
![MySQL](https://img.shields.io/badge/mysql-8.0-orange)
![License](https://img.shields.io/badge/license-MIT-yellow)

## 📋 Descripción

**DrexPOS** es un sistema ligero de ventas e inventario diseñado para computadores de bajos recursos. Ideal para tiendas, pequeños comercios y emprendedores que necesitan una solución sencilla, rápida y sin complicaciones.

### ✨ Características principales

| Módulo | Funcionalidad |
|--------|---------------|
| 🛒 **Ventas** | Carrito de compras persistente, validación de stock en tiempo real |
| 📊 **Reporte del Día** | Resumen de ventas diarias, productos vendidos y totales |
| 📅 **Historial** | Búsqueda de ventas por rango de fechas con métricas avanzadas |
| 📦 **Inventario** | CRUD completo de productos, edición de stock, activar/desactivar |
| 🧾 **Facturación** | Generación de facturas individuales por venta, formato profesional |
| 🖨️ **Impresión** | Reportes y facturas con formato optimizado para impresión |

---

## 🖥️ Requisitos del sistema

| Componente | Mínimo | Recomendado |
|------------|--------|--------------|
| **Sistema Operativo** | Windows 7 | Windows 10/11 |
| **RAM** | 2GB | 4GB |
| **Espacio en disco** | 500MB | 1GB |
| **Procesador** | 1.5 GHz | 2.0 GHz+ |

### 📦 Tecnologías utilizadas

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Node.js | 16.x o superior | Backend / API REST |
| Express | 4.18.2 | Framework web |
| MySQL | 8.0 | Base de datos |
| HTML5 | - | Interfaz de usuario |
| CSS3 | - | Estilos y diseño responsive |
| JavaScript | ES6 | Lógica del cliente |

---

## 🚀 Instalación

### Opción 1: Instalación completa (recomendada)

#### Paso 1: Instalar Node.js

1. Descargar Node.js desde [nodejs.org](https://nodejs.org/)
2. Seleccionar la versión **LTS** (Long Term Support)
3. Ejecutar el instalador con todas las opciones por defecto
4. Verificar la instalación:
   ```bash
   node --version
   npm --version
    ```

## 🔧 Paso 2: Instalar MySQL Server

### 📥 Descarga

1. Ve a [https://dev.mysql.com/downloads/installer/](https://dev.mysql.com/downloads/installer/)
2. Haz clic en **"Download"** en `mysql-installer-web-community-8.0.46.0.msi`
3. Espera a que termine la descarga (aproximadamente 15MB)

### ⚙️ Instalación

1. **Ejecuta** el archivo `mysql-installer-web-community-8.0.46.0.msi`
2. **Acepta** los términos de licencia → Siguiente
3. **Selecciona** `Developer Default` → Siguiente
4. **Haz clic** en `Execute` para instalar los requisitos previos
5. **Siguiente** hasta llegar a la configuración de productos

### 🔑 Configuración de MySQL Server

| Campo | Valor |
|-------|-------|
| **Config Type** | `Development Computer` |
| **TCP/IP** | ✅ Activado |
| **Port** | `3306` |
| **Open Windows Firewall** | ✅ Activado |

### 🔐 Contraseña de root

| Campo | Valor |
|-------|-------|
| **MySQL Root Password** | `0098` |
| **Repeat Password** | `0098` |

> ⚠️ **IMPORTANTE**: Esta contraseña debe coincidir con la configurada en `backend/server.js`

### 🧪 Verificar la instalación

1. **Abre** MySQL Workbench (se instala automáticamente)
2. **Haz clic** en la conexión `Local instance MySQL80`
3. **Ingresa** la contraseña `0098`
4. **Ejecuta** esta consulta para verificar:
   ```sql
   SELECT VERSION();
    ```

## 📋 Resumen rápido de la instalación de MySQL:

| Paso | Acción |
|------|--------|
| 1 | Descargar `mysql-installer-web-community-8.0.46.0.msi` |
| 2 | Ejecutar el instalador |
| 3 | Seleccionar `Developer Default` |
| 4 | Puerto: `3306` |
| 5 | Contraseña root: `0098` |
| 6 | Finalizar instalación |
