const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Conexión a MySQL
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'Dr3X',
    password: '0098',
    database: 'SLVI'
});

db.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a MySQL:', err.message);
        return;
    }
    console.log('✅ Conectado a MySQL');
});

// ========== PRODUCTOS ==========

// Obtener productos ACTIVOS (para ventas)
app.get('/api/productos', (req, res) => {
    db.query('SELECT id, codigo, nombre, precio, stock FROM productos WHERE activo = 1 ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Obtener TODOS los productos (para inventario)
app.get('/api/productos/todos', (req, res) => {
    db.query('SELECT id, codigo, nombre, precio, stock, activo FROM productos ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Crear producto
app.post('/api/productos', (req, res) => {
    const { nombre, precio, stock, codigo } = req.body;
    if (!nombre || precio === undefined) {
        return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }

    db.query('INSERT INTO productos (nombre, precio, stock, codigo, activo) VALUES (?, ?, ?, ?, 1)',
        [nombre, precio, stock || 0, codigo || null],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: result.insertId, message: 'Producto creado' });
        });
});

// Actualizar producto
app.put('/api/productos/:id', (req, res) => {
    const { nombre, precio, stock, codigo } = req.body;

    db.query('UPDATE productos SET nombre = COALESCE(?, nombre), precio = COALESCE(?, precio), stock = COALESCE(?, stock), codigo = COALESCE(?, codigo) WHERE id = ?',
        [nombre, precio, stock, codigo || null, req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Producto no encontrado' });
            res.json({ message: 'Producto actualizado' });
        });
});

// Activar/Desactivar producto
app.put('/api/productos/:id/toggle', (req, res) => {
    const { activo } = req.body;
    db.query('UPDATE productos SET activo = ? WHERE id = ?', [activo ? 1 : 0, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ message: `Producto ${activo ? 'activado' : 'desactivado'}` });
    });
});

// ========== VENTAS ==========
app.post('/api/ventas', (req, res) => {
    const { items } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
    }

    // Verificar stock antes de la venta
    const checkQueries = items.map(item => {
        return new Promise((resolve, reject) => {
            db.query('SELECT stock FROM productos WHERE id = ? AND activo = 1', [item.producto_id], (err, results) => {
                if (err) reject(err);
                if (results.length === 0) {
                    reject(new Error(`Producto no encontrado o inactivo`));
                } else if (results[0].stock < item.cantidad) {
                    reject(new Error(`Stock insuficiente. Stock disponible: ${results[0].stock}`));
                }
                resolve(results[0].stock);
            });
        });
    });

    Promise.all(checkQueries)
        .then(() => {
            db.beginTransaction((err) => {
                if (err) throw err;

                db.query('INSERT INTO ventas (fecha) VALUES (NOW())', (err, result) => {
                    if (err) return db.rollback(() => { throw err; });
                    const ventaId = result.insertId;

                    const detailQueries = items.map(item => {
                        return new Promise((resolve, reject) => {
                            const subtotal = item.cantidad * item.precio_unitario;
                            db.query('INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, subtotal) VALUES (?, ?, ?, ?)',
                                [ventaId, item.producto_id, item.cantidad, subtotal],
                                (err) => err ? reject(err) : resolve());
                        });
                    });

                    Promise.all(detailQueries)
                        .then(() => {
                            // Actualizar el total de la venta
                            db.query('UPDATE ventas SET total = (SELECT SUM(subtotal) FROM detalle_ventas WHERE venta_id = ?) WHERE id = ?',
                                [ventaId, ventaId],
                                (err) => {
                                    if (err) return db.rollback(() => { throw err; });
                                    db.commit((err) => {
                                        if (err) return db.rollback(() => { throw err; });
                                        db.query('SELECT factura_numero, total FROM ventas WHERE id = ?', [ventaId], (err, venta) => {
                                            if (err) return res.status(500).json({ error: err.message });
                                            res.json({
                                                venta_id: ventaId,
                                                factura_numero: venta[0].factura_numero,
                                                total: venta[0].total,
                                                message: 'Venta registrada'
                                            });
                                        });
                                    });
                                });
                        })
                        .catch((err) => db.rollback(() => res.status(500).json({ error: err.message })));
                });
            });
        })
        .catch((err) => res.status(400).json({ error: err.message }));
});

// ========== ENDPOINTS DE VENTAS ==========

// 1. PRIMERO: Endpoint fijo para historial por fechas
app.get('/api/ventas/por-fecha', (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;

    console.log('=== ENDPOINT /api/ventas/por-fecha LLAMADO ===');
    console.log('fecha_inicio:', fecha_inicio);
    console.log('fecha_fin:', fecha_fin);

    if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: 'Se requieren fecha_inicio y fecha_fin' });
    }

    const query = `
        SELECT 
            v.id AS venta_id,
            v.fecha,
            v.total,
            v.factura_numero,
            p.nombre AS producto,
            p.codigo,
            dv.cantidad,
            dv.subtotal
        FROM ventas v
        INNER JOIN detalle_ventas dv ON v.id = dv.venta_id
        INNER JOIN productos p ON dv.producto_id = p.id
        WHERE DATE(v.fecha) >= ? AND DATE(v.fecha) <= ?
        ORDER BY v.fecha DESC, dv.id ASC
    `;

    db.query(query, [fecha_inicio, fecha_fin], (err, results) => {
        if (err) {
            console.error('Error en consulta:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Historial: ${results.length} registros encontrados`);
        res.json(results);
    });
});

// 2. SEGUNDO: Listar todas las ventas
app.get('/api/ventas', (req, res) => {
    db.query('SELECT id, fecha, total, factura_numero FROM ventas ORDER BY fecha DESC LIMIT 100', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 3. TERCERO: Endpoint con parámetro (debe ir después de los fijos)
app.get('/api/ventas/:id', (req, res) => {
    const ventaId = req.params.id;

    db.query('SELECT id, fecha, total, factura_numero FROM ventas WHERE id = ?', [ventaId], (err, venta) => {
        if (err) return res.status(500).json({ error: err.message });
        if (venta.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });

        db.query(`
            SELECT 
                p.nombre AS producto,
                p.codigo,
                dv.cantidad,
                dv.subtotal
            FROM detalle_ventas dv
            JOIN productos p ON dv.producto_id = p.id
            WHERE dv.venta_id = ?
            ORDER BY dv.id ASC
        `, [ventaId], (err, detalles) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                venta_id: venta[0].id,
                fecha: venta[0].fecha,
                total: venta[0].total,
                factura_numero: venta[0].factura_numero,
                items: detalles.map(d => ({
                    producto: d.producto,
                    codigo: d.codigo,
                    cantidad: d.cantidad,
                    subtotal: d.subtotal
                }))
            });
        });
    });
});

// Reporte del día
app.get('/api/reporte/dia', (req, res) => {
    db.query(`
        SELECT 
            v.id AS venta_id,
            v.fecha,
            v.total,
            v.factura_numero,
            p.nombre AS producto,
            p.codigo,
            dv.cantidad,
            dv.subtotal
        FROM ventas v
        JOIN detalle_ventas dv ON v.id = dv.venta_id
        JOIN productos p ON dv.producto_id = p.id
        WHERE DATE(v.fecha) = CURDATE()
        ORDER BY v.fecha DESC, dv.id ASC
    `, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const ventasUnicas = new Map();
        results.forEach(item => {
            if (!ventasUnicas.has(item.venta_id)) {
                ventasUnicas.set(item.venta_id, {
                    id: item.venta_id,
                    factura: item.factura_numero,
                    fecha: item.fecha,
                    total: item.total
                });
            }
        });

        const ventasArray = Array.from(ventasUnicas.values());
        const totalVentas = ventasArray.length;
        const totalIngresos = ventasArray.reduce((sum, v) => sum + v.total, 0);
        const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0;
        const ventaMasAlta = ventasArray.length > 0 ? Math.max(...ventasArray.map(v => v.total)) : 0;

        res.json({
            detalles: results,
            resumen: {
                total_ventas: totalVentas,
                total_ingresos: totalIngresos,
                ticket_promedio: ticketPromedio,
                venta_mas_alta: ventaMasAlta
            }
        });
    });
});

// Obtener todas las fechas con ventas
app.get('/api/fechas-con-ventas', (req, res) => {
    db.query(`
        SELECT DISTINCT DATE(fecha) as fecha, 
                COUNT(*) as total_ventas,
                SUM(total) as total_ingresos
        FROM ventas 
        GROUP BY DATE(fecha)
        ORDER BY fecha DESC
    `, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Dashboard resumen
app.get('/api/dashboard/resumen', (req, res) => {
    db.query(`
        SELECT 
            (SELECT COUNT(*) FROM productos WHERE activo = 1) AS total_productos,
            (SELECT COUNT(*) FROM productos WHERE stock < 5 AND activo = 1) AS productos_stock_bajo,
            (SELECT COUNT(*) FROM ventas WHERE DATE(fecha) = CURDATE()) AS ventas_hoy,
            (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE DATE(fecha) = CURDATE()) AS ingreso_hoy,
            (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE MONTH(fecha) = MONTH(CURDATE())) AS ingreso_mes,
            (SELECT COALESCE(SUM(dv.cantidad), 0) 
                FROM detalle_ventas dv 
                JOIN ventas v ON dv.venta_id = v.id 
                WHERE DATE(v.fecha) = CURDATE()) AS productos_vendidos_hoy
    `, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`✅ Conectado a base de datos: SLVI`);
});