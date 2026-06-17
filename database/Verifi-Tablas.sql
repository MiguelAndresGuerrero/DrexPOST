USE slvi;

-- Ver todas las tablas
SHOW TABLES;

-- Ver estructura de cada tabla
DESCRIBE productos;
DESCRIBE ventas;
DESCRIBE detalle_ventas;
DESCRIBE control_factura;

-- Ver triggers
SHOW TRIGGERS;

-- Ver vistas
SHOW FULL TABLES WHERE TABLE_TYPE LIKE 'VIEW';

-- Ver datos insertados
SELECT * FROM productos;
SELECT * FROM ventas;
SELECT * FROM detalle_ventas;
SELECT * FROM control_factura;
SELECT * FROM v_reporte_ventas;

USE SLVI;
SHOW TRIGGERS;