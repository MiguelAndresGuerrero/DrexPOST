USE slvi;

-- ==================================================
-- 1. INSERTAR PRODUCTOS (16 productos variados)
-- ==================================================
INSERT INTO productos (codigo, nombre, precio, stock, activo) VALUES
('LP001', 'Laptop Básica', 450000, 10, 1),
('LP002', 'Laptop Gamer', 2500000, 5, 1),
('LP003', 'Laptop Profesional', 1800000, 7, 1),
('MS001', 'Mouse Inalámbrico', 25000, 50, 1),
('MS002', 'Mouse Gamer', 45000, 30, 1),
('TC001', 'Teclado USB', 35000, 30, 1),
('TC002', 'Teclado Mecánico', 120000, 15, 1),
('MN001', 'Monitor 22"', 180000, 8, 1),
('MN002', 'Monitor 27"', 450000, 4, 1),
('AF001', 'Audífonos Bluetooth', 45000, 25, 1),
('AF002', 'Audífonos Gamer', 120000, 12, 1),
('USB001', 'USB 32GB', 12000, 100, 1),
('USB002', 'USB 64GB', 25000, 60, 1),
('CG001', 'Cargador Universal', 20000, 40, 1),
('FD001', 'Funda para Laptop', 18000, 20, 1),
('HD001', 'Disco Duro 1TB', 280000, 6, 1);

-- ==================================================
-- 2. VER PRODUCTOS INSERTADOS
-- ==================================================
SELECT * FROM productos ORDER BY id;

-- ==================================================
-- 3. CREAR VENTAS DE PRUEBA (FECHAS DIFERENTES)
-- ==================================================

-- VENTA 1: 2026-04-20 - Laptop + Mouse
INSERT INTO ventas (fecha) VALUES ('2026-04-20 10:30:00');
SET @v1 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v1, 1, 1, 450000),
(@v1, 4, 2, 50000);

-- VENTA 2: 2026-04-21 - Teclado + Monitor
INSERT INTO ventas (fecha) VALUES ('2026-04-21 14:15:00');
SET @v2 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v2, 6, 1, 35000),
(@v2, 8, 1, 180000);

-- VENTA 3: 2026-04-22 - Laptop Gamer + Mouse Gamer
INSERT INTO ventas (fecha) VALUES ('2026-04-22 09:45:00');
SET @v3 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v3, 2, 1, 2500000),
(@v3, 5, 1, 45000);

-- VENTA 4: 2026-04-23 - Audífonos + USB + Cargador
INSERT INTO ventas (fecha) VALUES ('2026-04-23 16:20:00');
SET @v4 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v4, 10, 2, 90000),
(@v4, 12, 5, 60000),
(@v4, 14, 1, 20000);

-- VENTA 5: 2026-04-24 - Monitor 27" + Teclado Mecánico
INSERT INTO ventas (fecha) VALUES ('2026-04-24 11:00:00');
SET @v5 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v5, 9, 1, 450000),
(@v5, 7, 1, 120000);

-- VENTA 6: 2026-04-24 - Laptop Profesional + Funda
INSERT INTO ventas (fecha) VALUES ('2026-04-24 15:30:00');
SET @v6 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v6, 3, 1, 1800000),
(@v6, 15, 1, 18000);

-- VENTA 7: 2026-04-25 - Audífonos Gamer + Disco Duro
INSERT INTO ventas (fecha) VALUES ('2026-04-25 12:00:00');
SET @v7 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v7, 11, 1, 120000),
(@v7, 16, 1, 280000);

-- VENTA 8: 2026-04-26 - USB 64GB (varios)
INSERT INTO ventas (fecha) VALUES ('2026-04-26 10:00:00');
SET @v8 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v8, 13, 10, 250000);

-- VENTA 9: 2026-04-27 - Mouse + Teclado + USB
INSERT INTO ventas (fecha) VALUES ('2026-04-27 17:00:00');
SET @v9 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v9, 4, 3, 75000),
(@v9, 6, 2, 70000),
(@v9, 12, 4, 48000);

-- VENTA 10: 2026-04-28 - Laptop Básica + Mouse + Funda
INSERT INTO ventas (fecha) VALUES ('2026-04-28 09:30:00');
SET @v10 = LAST_INSERT_ID();
INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES
(@v10, 1, 1, 450000),
(@v10, 4, 2, 50000),
(@v10, 15, 1, 18000);