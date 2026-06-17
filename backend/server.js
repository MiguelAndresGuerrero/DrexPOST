const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

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

db.connect(async (err) => {
    if (err) {
        console.error('❌ Error conectando a MySQL:', err.message);
        return;
    }
    console.log('✅ Conectado a MySQL');

    try {
        await inicializarUsuarios();
    } catch (e) {
        console.error('❌ Error inicializando usuarios y control de programa:', e.message);
    }
});

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
}

async function inicializarUsuarios() {
    await dbQuery(`CREATE TABLE IF NOT EXISTS usuarios (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash CHAR(64) NOT NULL,
        rol ENUM('admin','user','cliente') NOT NULL DEFAULT 'user',
        bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
        bloqueo_razon TEXT NULL,
        creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    try {
        await dbQuery("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin','user','cliente') NOT NULL DEFAULT 'user'");
    } catch (e) {
        // ignore if the column already has the desired enum values or if ALTER fails
    }

    await dbQuery(`CREATE TABLE IF NOT EXISTS sesiones (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        token VARCHAR(128) NOT NULL UNIQUE,
        creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);

    await dbQuery(`CREATE TABLE IF NOT EXISTS programa_control (
        id INT PRIMARY KEY DEFAULT 1,
        habilitado BOOLEAN NOT NULL DEFAULT TRUE
    )`);

    await dbQuery(`INSERT INTO programa_control (id, habilitado) VALUES (1, TRUE) ON DUPLICATE KEY UPDATE habilitado = habilitado`);

    // Ensure productos table and tracking columns exist for admin metrics
    await dbQuery(`CREATE TABLE IF NOT EXISTS productos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(255) NOT NULL,
        precio DECIMAL(10,2) NOT NULL DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        codigo VARCHAR(100) NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        fecha_activado DATETIME NULL,
        fecha_desactivado DATETIME NULL,
        creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    try {
        await dbQuery("ALTER TABLE productos ADD COLUMN IF NOT EXISTS fecha_activado DATETIME NULL");
        await dbQuery("ALTER TABLE productos ADD COLUMN IF NOT EXISTS fecha_desactivado DATETIME NULL");
    } catch (e) {
        // ignore if columns already exist or ALTER not supported
    }

    // Ensure bloqueo_razon column exists (in case DB updated after initial schema)
    try {
        await dbQuery("ALTER TABLE usuarios ADD COLUMN bloqueo_razon TEXT NULL");
    } catch (e) {
        // ignore if column already exists or ALTER not supported
    }

    const usuarios = await dbQuery('SELECT id FROM usuarios LIMIT 1');
    const usuarioAndres = await dbQuery('SELECT id FROM usuarios WHERE LOWER(username) = LOWER(?)', ['Andres']);
    const usuarioAdminOriginal = await dbQuery('SELECT id FROM usuarios WHERE LOWER(username) = LOWER(?)', ['admin']);

    if (usuarioAndres.length === 0) {
        if (usuarios.length === 0) {
            console.log('⚠️ No se encontraron usuarios. Creando administrador por defecto: Andres/009890');
            await dbQuery('INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, ?)', ['Andres', hashPassword('009890'), 'admin']);
        } else if (usuarios.length === 1 && usuarioAdminOriginal.length === 1) {
            console.log('⚠️ Actualizando administrador existente a Andres/009890');
            await dbQuery('UPDATE usuarios SET username = ?, password_hash = ? WHERE id = ?', ['Andres', hashPassword('009890'), usuarioAdminOriginal[0].id]);
        }
    }
    // Ensure the protected admin 'Andres' is not left blocked on startup
    try {
        await dbQuery('UPDATE usuarios SET bloqueado = FALSE WHERE LOWER(username) = LOWER(?)', ['Andres']);
    } catch (e) {
        console.error('Error asegurando desbloqueo de Andres:', e.message);
    }
}

function autenticar(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];

    db.query(`SELECT u.id, u.username, u.rol, u.bloqueado, u.bloqueo_razon, p.habilitado
              FROM sesiones s
              JOIN usuarios u ON s.usuario_id = u.id
              JOIN programa_control p ON p.id = 1
              WHERE s.token = ?`, [token], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!results || results.length === 0) {
            return res.status(401).json({ error: 'Sesión no válida' });
        }

        const user = results[0];
        if (user.bloqueado) {
            return res.status(403).json({ error: 'Usuario bloqueado', bloqueo_razon: user.bloqueo_razon || 'Razón no especificada' });
        }

        if (!user.habilitado && user.rol !== 'admin') {
            return res.status(403).json({ error: 'Programa bloqueado. Contacte al administrador.' });
        }

        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso de administrador requerido' });
    }
    next();
}

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    try {
        const results = await dbQuery(`SELECT u.id, u.password_hash, u.rol, u.bloqueado, u.bloqueo_razon, p.habilitado
                           FROM usuarios u
                           JOIN programa_control p ON p.id = 1
                           WHERE LOWER(u.username) = LOWER(?)`, [username]);

        if (!results || results.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const user = results[0];
        if (user.bloqueado) {
            return res.status(403).json({ error: 'Usuario bloqueado', bloqueo_razon: user.bloqueo_razon || 'Razón no especificada' });
        }

        if (hashPassword(password) !== user.password_hash) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        if (!user.habilitado && user.rol !== 'admin') {
            return res.status(403).json({ error: 'Programa bloqueado. Contacte al administrador.' });
        }

        const token = generateToken();
        await dbQuery('INSERT INTO sesiones (usuario_id, token) VALUES (?, ?)', [user.id, token]);

        res.json({ token, username, rol: user.rol });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.use('/api', autenticar);

app.post('/api/logout', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    try {
        await dbQuery('DELETE FROM sesiones WHERE token = ?', [token]);
        res.json({ message: 'Sesión cerrada' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/session', (req, res) => {
    res.json({ username: req.user.username, rol: req.user.rol });
});

app.get('/api/program/status', requireAdmin, async (req, res) => {
    try {
        const results = await dbQuery('SELECT habilitado FROM programa_control WHERE id = 1');
        res.json({ habilitado: results[0]?.habilitado ? true : false });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/program/toggle', requireAdmin, async (req, res) => {
    const { habilitado } = req.body;
    if (typeof habilitado !== 'boolean') {
        return res.status(400).json({ error: 'Valor habilitado requerido' });
    }

    try {
        await dbQuery('UPDATE programa_control SET habilitado = ? WHERE id = 1', [habilitado]);
        res.json({ habilitado });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/usuarios', requireAdmin, async (req, res) => {
    try {
        const users = await dbQuery('SELECT id, username, rol, bloqueado, bloqueo_razon, creado FROM usuarios ORDER BY creado DESC, id ASC');
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/usuarios', requireAdmin, async (req, res) => {
    const { username, password, rol } = req.body;
    if (!username || !password || !rol) {
        return res.status(400).json({ error: 'usuario, contraseña y rol son requeridos' });
    }
    if (!['admin', 'user', 'cliente'].includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido' });
    }
    try {
        const passwordHash = hashPassword(password);
        const result = await dbQuery('INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, ?)', [username, passwordHash, rol]);
        res.json({ id: result.insertId, username, rol });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/usuarios/:id/block', requireAdmin, async (req, res) => {
    try {
        const target = await dbQuery('SELECT id, username, rol FROM usuarios WHERE id = ?', [req.params.id]);
        if (!target || target.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        const userTarget = target[0];
        // Prevent blocking other admins or the protected user 'Andres'. Allow self-block.
        if ((userTarget.rol === 'admin' || (userTarget.username && userTarget.username.toLowerCase() === 'andres')) && userTarget.id !== req.user.id) {
            return res.status(403).json({ error: 'No puede bloquear a otro administrador o al usuario protegido' });
        }
        const { razon } = req.body || {};
        await dbQuery('UPDATE usuarios SET bloqueado = TRUE, bloqueo_razon = ? WHERE id = ?', [razon || null, req.params.id]);
        // remove any active sessions for that user
        await dbQuery('DELETE FROM sesiones WHERE usuario_id = ?', [req.params.id]);
        res.json({ message: 'Usuario bloqueado' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/usuarios/:id/unblock', requireAdmin, async (req, res) => {
    try {
        const target = await dbQuery('SELECT id, username, rol FROM usuarios WHERE id = ?', [req.params.id]);
        if (!target || target.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        const userTarget = target[0];
        // Prevent others from unblocking an admin or the protected user (only self-unblock allowed)
        if ((userTarget.rol === 'admin' || (userTarget.username && userTarget.username.toLowerCase() === 'andres')) && userTarget.id !== req.user.id) {
            return res.status(403).json({ error: 'No puede modificar el estado de otro administrador o del usuario protegido' });
        }
        await dbQuery('UPDATE usuarios SET bloqueado = FALSE, bloqueo_razon = NULL WHERE id = ?', [req.params.id]);
        res.json({ message: 'Usuario desbloqueado' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// List active sessions (exclude the requesting admin's own sessions)
app.get('/api/sesiones', requireAdmin, async (req, res) => {
    try {
        const sessions = await dbQuery(`SELECT s.id as session_id, u.id as usuario_id, u.username, u.bloqueado, u.bloqueo_razon, s.creado
                                        FROM sesiones s
                                        JOIN usuarios u ON s.usuario_id = u.id
                                        WHERE u.id <> ?
                                        ORDER BY s.creado DESC`, [req.user.id]);
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Force logout (delete a specific session)
app.delete('/api/sesiones/:id', requireAdmin, async (req, res) => {
    try {
        await dbQuery('DELETE FROM sesiones WHERE id = ?', [req.params.id]);
        res.json({ message: 'Sesión eliminada' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ========== PRODUCTOS ==========

// Obtener productos ACTIVOS (para ventas)
app.get('/api/productos', (req, res) => {
    db.query('SELECT id, codigo, nombre, precio, stock, activo FROM productos WHERE activo = 1 ORDER BY nombre ASC', (err, results) => {
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

    db.query('INSERT INTO productos (nombre, precio, stock, codigo, activo, fecha_activado) VALUES (?, ?, ?, ?, 1, NOW())',
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
    const query = `UPDATE productos SET activo = ?, fecha_activado = ${activo ? 'NOW()' : 'fecha_activado'}, fecha_desactivado = ${activo ? 'fecha_desactivado' : 'NOW()'} WHERE id = ?`;
    db.query(query, [activo ? 1 : 0, req.params.id], (err, result) => {
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
            (SELECT COUNT(*) FROM productos WHERE activo = 1) AS total_productos_activos,
            (SELECT COUNT(*) FROM productos WHERE activo = 0) AS total_productos_inactivos,
            (SELECT COUNT(*) FROM productos WHERE activo = 1 AND MONTH(fecha_activado) = MONTH(CURDATE()) AND YEAR(fecha_activado) = YEAR(CURDATE())) AS activaciones_mes,
            (SELECT COUNT(*) FROM productos WHERE activo = 0 AND MONTH(fecha_desactivado) = MONTH(CURDATE()) AND YEAR(fecha_desactivado) = YEAR(CURDATE())) AS desactivaciones_mes,
            (SELECT COUNT(*) FROM productos WHERE stock < 5 AND activo = 1) AS productos_stock_bajo,
            (SELECT COUNT(*) FROM ventas WHERE DATE(fecha) = CURDATE()) AS ventas_hoy,
            (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE DATE(fecha) = CURDATE()) AS ingreso_hoy,
            (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE MONTH(fecha) = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())) AS ingreso_mes,
            (SELECT COUNT(*) FROM usuarios WHERE bloqueado = 1) AS usuarios_bloqueados
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