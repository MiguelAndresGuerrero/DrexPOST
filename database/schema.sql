CREATE DATABASE IF NOT EXISTS SLVI;

USE SLVI;

-- ==================================================
-- 1. CREAR TABLA: control_factura
-- ==================================================
CREATE TABLE control_factura (
    id INT PRIMARY KEY DEFAULT 1,
    ultimo_numero INT NOT NULL DEFAULT 0
);

-- ==================================================
-- 2. CREAR TABLA: productos
-- ==================================================
CREATE TABLE productos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(50) UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================================================
-- 3. CREAR TABLA: ventas
-- ==================================================
CREATE TABLE ventas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    factura_numero INT UNIQUE
);

-- ==================================================
-- 4. CREAR TABLA: detalle_ventas
-- ==================================================
CREATE TABLE detalle_ventas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos (id)
);

-- ==================================================
-- 5. CREAR ÍNDICES
-- ==================================================
CREATE INDEX idx_ventas_fecha ON ventas (fecha);

CREATE INDEX idx_ventas_factura ON ventas (factura_numero);

CREATE INDEX idx_detalle_venta ON detalle_ventas (venta_id);

CREATE INDEX idx_detalle_producto ON detalle_ventas (producto_id);

CREATE INDEX idx_productos_nombre ON productos (nombre);

CREATE INDEX idx_productos_codigo ON productos (codigo);

CREATE INDEX idx_productos_activo ON productos (activo);

-- ==================================================
-- 6. TRIGGERS
-- ==================================================

-- Trigger para asignar número de factura automático
DELIMITER /
/

CREATE TRIGGER asignar_factura_numero
BEFORE INSERT ON ventas
FOR EACH ROW
BEGIN
    DECLARE nuevo_numero INT;
    
    UPDATE control_factura SET ultimo_numero = ultimo_numero + 1 WHERE id = 1;
    SELECT ultimo_numero INTO nuevo_numero FROM control_factura WHERE id = 1;
    
    SET NEW.factura_numero = nuevo_numero;
END
/
/

DELIMITER;

-- Trigger para actualizar el total de la venta
DELIMITER /
/

CREATE TRIGGER actualizar_total_venta
AFTER INSERT ON detalle_ventas
FOR EACH ROW
BEGIN
    DECLARE nuevo_total DECIMAL(10,2);
    
    SELECT SUM(subtotal) INTO nuevo_total 
    FROM detalle_ventas 
    WHERE venta_id = NEW.venta_id;
    
    UPDATE ventas SET total = nuevo_total WHERE id = NEW.venta_id;
END
/
/

DELIMITER;

-- Trigger para restar stock automáticamente
DELIMITER /
/

CREATE TRIGGER restar_stock_after_venta
AFTER INSERT ON detalle_ventas
FOR EACH ROW
BEGIN
    UPDATE productos 
    SET stock = stock - NEW.cantidad 
    WHERE id = NEW.producto_id;
END
/
/

DELIMITER;

-- ==================================================
-- TABLA DE USUARIOS Y CONTROL DE ACCESO
-- ==================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash CHAR(64) NOT NULL,
    rol ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
    creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sesiones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS programa_control (
    id INT PRIMARY KEY DEFAULT 1,
    habilitado BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO
    programa_control (id, habilitado)
VALUES (1, TRUE)
ON DUPLICATE KEY UPDATE
    habilitado = habilitado;

-- Insertar administrador por defecto en instalaciones nuevas
INSERT INTO
    usuarios (username, password_hash, rol)
SELECT 'Andres', SHA2('009890', 256), 'admin'
WHERE
    NOT EXISTS (
        SELECT 1
        FROM usuarios
    );