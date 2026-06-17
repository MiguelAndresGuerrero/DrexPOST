USE SLVI;

-- ==================================================
-- 1. VER TODOS LOS PRODUCTOS
-- ==================================================
SELECT id, codigo, nombre, precio, stock, activo FROM productos ORDER BY nombre;

-- ==================================================
-- 2. VER STOCK ACTUAL
-- ==================================================
SELECT id, nombre, stock FROM productos ORDER BY stock ASC;

-- ==================================================
-- 3. VER VENTAS REGISTRADAS
-- ==================================================
SELECT id, fecha, factura_numero, total FROM ventas ORDER BY fecha DESC;

-- ==================================================
-- 4. VER DETALLE DE VENTAS COMPLETO
-- ==================================================
SELECT 
    v.id AS venta_id,
    v.factura_numero,
    DATE(v.fecha) AS fecha,
    TIME(v.fecha) AS hora,
    p.nombre AS producto,
    dv.cantidad,
    dv.subtotal
FROM ventas v
JOIN detalle_ventas dv ON v.id = dv.venta_id
JOIN productos p ON dv.producto_id = p.id
ORDER BY v.fecha DESC, dv.id;

-- ==================================================
-- 5. VER RESUMEN DE VENTAS POR DÍA
-- ==================================================
SELECT 
    DATE(fecha) AS dia,
    COUNT(DISTINCT id) AS num_ventas,
    SUM(total) AS total_dia,
    COUNT(*) AS productos_vendidos
FROM ventas
GROUP BY DATE(fecha)
ORDER BY dia DESC;

-- ==================================================
-- 6. VER PRODUCTOS MÁS VENDIDOS
-- ==================================================
SELECT 
    p.nombre,
    p.codigo,
    SUM(dv.cantidad) AS unidades_vendidas,
    SUM(dv.subtotal) AS total_generado
FROM detalle_ventas dv
JOIN productos p ON dv.producto_id = p.id
GROUP BY p.id
ORDER BY unidades_vendidas DESC
LIMIT 10;

-- ==================================================
-- 7. VER FACTURAS GENERADAS
-- ==================================================
SELECT factura_numero, fecha, total FROM ventas ORDER BY factura_numero;

-- ==================================================
-- 8. VER NÚMERO DE FACTURA ACTUAL
-- ==================================================
SELECT ultimo_numero FROM control_factura;

-- ==================================================
-- 9. VER v_reporte_ventas
-- ==================================================
CREATE OR REPLACE VIEW v_reporte_ventas AS
SELECT 
    v.id AS venta_id,
    v.factura_numero,
    v.fecha,
    v.total,
    p.nombre AS producto,
    p.codigo,
    dv.cantidad,
    dv.subtotal
FROM ventas v
JOIN detalle_ventas dv ON v.id = dv.venta_id
JOIN productos p ON dv.producto_id = p.id
ORDER BY v.fecha DESC, dv.id ASC;