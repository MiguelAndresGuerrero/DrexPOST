const API = 'http://localhost:3000/api';
let carrito = [];
let productosOriginales = [];
let usuariosOriginales = [];
let busquedaTimeout;
let currentUser = null;

function getAuthToken() {
    return localStorage.getItem('drexpos_token');
}

function setAuthToken(token) {
    localStorage.setItem('drexpos_token', token);
}

function removeAuthToken() {
    localStorage.removeItem('drexpos_token');
}

function apiFetch(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = getAuthToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${API}${path}`, Object.assign({}, options, { headers }));
}

async function apiJson(path, options = {}) {
    const res = await apiFetch(path, options);
    if (res.status === 401) {
        cerrarSesion(true);
        throw new Error('No autorizado');
    }
    return res;
}

function mostrarLogin(mensaje = '') {
    const overlay = document.getElementById('loginOverlay');
    const card = overlay.querySelector('.login-card');
    overlay.classList.remove('hidden');
    // small entrance animation
    card.style.transform = 'translateY(-6px) scale(0.99)';
    card.style.opacity = '0';
    document.getElementById('userBar').classList.add('hidden');
    document.querySelectorAll('.container, .tabs, .tab-content').forEach(el => el?.classList?.add('blurred'));
    document.getElementById('loginError').textContent = mensaje;
    setTimeout(() => {
        card.style.transition = 'transform 220ms ease, opacity 220ms ease';
        card.style.transform = 'translateY(0) scale(1)';
        card.style.opacity = '1';
        const input = document.getElementById('loginUsuario');
        if (input) input.focus();
    }, 30);
}

function ocultarLogin() {
    const overlay = document.getElementById('loginOverlay');
    const card = overlay.querySelector('.login-card');
    // reverse animation
    if (card) {
        card.style.transform = 'translateY(-6px) scale(0.99)';
        card.style.opacity = '0';
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 220);
    } else {
        overlay.classList.add('hidden');
    }
    document.querySelectorAll('.container, .tabs, .tab-content').forEach(el => el?.classList?.remove('blurred'));
}

function cerrarSesion(ignoreLogin = false) {
    removeAuthToken();
    currentUser = null;
    document.getElementById('userBar').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    const adminTabButton = document.getElementById('btnTabAdmin');
    if (adminTabButton) adminTabButton.classList.add('hidden');
    const tablaUsuariosBody = document.querySelector('#tablaUsuarios tbody');
    if (tablaUsuariosBody) tablaUsuariosBody.innerHTML = '';
    if (!ignoreLogin) mostrarLogin('Sesión cerrada. Ingrese de nuevo.');
}

async function validarSesion() {
    const token = getAuthToken();
    if (!token) {
        mostrarLogin();
        return;
    }

    try {
        const res = await apiFetch('/session');
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 403 && data.error === 'Usuario bloqueado') {
                mostrarModalBloqueado(data.bloqueo_razon || 'Razón no especificada');
            }
            throw new Error('Sesión expirada');
        }
        currentUser = data;
        document.getElementById('usernameLabel').textContent = `${currentUser.username} (${currentUser.rol})`;
        document.getElementById('userBar').classList.remove('hidden');
        // Mostrar panel admin sólo si es administrador o si el usuario protegido 'Andres' está logueado
        const isProtectedAndres = currentUser.username && currentUser.username.toLowerCase() === 'andres';
        const esAdmin = currentUser.rol === 'admin' || isProtectedAndres;
        const adminTabButton = document.getElementById('btnTabAdmin');
        if (adminTabButton) {
            if (esAdmin) adminTabButton.classList.remove('hidden');
            else adminTabButton.classList.add('hidden');
        }
        if (esAdmin) {
            document.getElementById('adminPanel').classList.remove('hidden');
            cargarUsuarios();
            cargarSesiones();
            actualizarEstadoPrograma();
            actualizarFiltroUsuarioVenta();
        } else {
            document.getElementById('adminPanel').classList.add('hidden');
            actualizarFiltroUsuarioVenta();
        }
        ocultarLogin();
        cargarCarritoGuardado();
        cargarProductos();
        cargarResumen();
    } catch (e) {
        cerrarSesion(true);
        mostrarLogin('Inicie sesión para continuar.');
        console.error('Validar sesión:', e);
    }
}

async function iniciarSesion() {
    const username = document.getElementById('loginUsuario').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) {
        document.getElementById('loginError').textContent = 'Ingrese usuario y contraseña';
        return;
    }

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 403 && data.error === 'Usuario bloqueado') {
                mostrarModalBloqueado(data.bloqueo_razon || 'Razón no especificada');
                document.getElementById('loginError').textContent = '';
                return;
            }
            document.getElementById('loginError').textContent = data.error || 'Error de autenticación';
            return;
        }
        setAuthToken(data.token);
        await validarSesion();
    } catch (e) {
        document.getElementById('loginError').textContent = 'Error de conexión';
        console.error('Login:', e);
    }
}

async function cargarUsuarios() {
    if (!currentUser || currentUser.rol !== 'admin') return;
    try {
        const res = await apiFetch('/usuarios');
        if (!res.ok) throw new Error('Error cargando usuarios');
        const usuarios = await res.json();
        usuariosOriginales = usuarios;
        renderizarUsuarios(usuarios);
        renderizarFiltroUsuariosVenta(usuarios);
    } catch (e) {
        console.error('Error cargando usuarios:', e);
    }
}

function renderizarUsuarios(usuarios) {
    const tbody = document.querySelector('#tablaUsuarios tbody');
    tbody.innerHTML = '';
    usuarios.forEach(u => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = u.username;
        row.insertCell(1).textContent = u.rol;
        const estado = row.insertCell(2);
        if (u.bloqueado) {
            estado.textContent = 'Bloqueado' + (u.bloqueo_razon ? ` — razón: ${u.bloqueo_razon}` : '');
            estado.style.color = '#dc2626';
        } else {
            estado.textContent = 'Activo';
            estado.style.color = '#16a34a';
        }
        const acciones = row.insertCell(3);

        // If this user is an admin and not the current admin, disable the block/unblock button
        const isOtherAdmin = (u.rol === 'admin' && currentUser && u.id !== currentUser.id);
        // Also protect the specific username 'Andres' from being modified by others
        const isProtectedUser = (u.username && currentUser && u.username.toLowerCase() === 'andres' && u.id !== currentUser.id);

        const button = document.createElement('button');
        button.className = u.bloqueado ? 'btn-primary btn-sm' : 'btn-danger btn-sm';
        button.textContent = u.bloqueado ? 'Desbloquear' : 'Bloquear';
        if (isOtherAdmin || isProtectedUser) {
            button.disabled = true;
            button.title = isProtectedUser ? 'No puede modificar al usuario protegido' : 'No puede modificar a otro administrador';
            button.style.opacity = '0.6';
            button.onclick = () => { };
        } else {
            button.onclick = () => toggleBloqueoUsuario(u.id, !u.bloqueado);
        }
        acciones.appendChild(button);
    });
}

function renderizarFiltroUsuariosVenta(usuarios) {
    const select = document.getElementById('filtroUsuarioVenta');
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleccione usuario --</option>';
    usuarios
        .filter(u => u.rol === 'cliente' || u.rol === 'user')
        .forEach(u => {
            const option = document.createElement('option');
            option.value = u.id;
            option.textContent = `${u.username} ${u.bloqueado ? '— SIN PAGAR' : ''}`;
            select.appendChild(option);
        });

    select.onchange = () => {
        const selectedId = select.value;
        const panelDetalles = document.getElementById('panelDetallesUsuario');

        if (!selectedId) {
            if (panelDetalles) panelDetalles.style.display = 'none';
            return;
        }

        const user = usuarios.find(u => u.id.toString() === selectedId);
        if (!user) {
            if (panelDetalles) panelDetalles.style.display = 'none';
            return;
        }

        // Mostrar datos del usuario
        mostrarDetallesUsuario(user);
    };
}

function mostrarDetallesUsuario(usuario) {
    const panel = document.getElementById('panelDetallesUsuario');
    if (!panel) return;

    document.getElementById('usuarioDatosNombre').textContent = usuario.username;
    document.getElementById('usuarioDatosRol').textContent = usuario.rol.toUpperCase();
    document.getElementById('usuarioDatosEstado').textContent = usuario.bloqueado ? '❌ BLOQUEADO' : '✅ ACTIVO';
    document.getElementById('usuarioDatosPago').textContent = usuario.bloqueado ? '❌ SIN PAGAR' : '✅ AL DÍA';
    document.getElementById('usuarioDatosPago').style.color = usuario.bloqueado ? '#dc2626' : '#16a34a';

    // Fecha creación
    const fechaCreada = new Date(usuario.creado);
    document.getElementById('usuarioDatosCreado').textContent = fechaCreada.toLocaleDateString('es-CO');

    // Mostrar/ocultar razón de bloqueo
    const panelRazon = document.getElementById('usuarioDatosRazonBloqueo');
    if (usuario.bloqueado && usuario.bloqueo_razon) {
        document.getElementById('textoRazonBloqueo').textContent = usuario.bloqueo_razon;
        panelRazon.style.display = 'block';
    } else {
        panelRazon.style.display = 'none';
    }

    panel.style.display = 'block';
}

function actualizarFiltroUsuarioVenta() {
    const panelProductos = document.getElementById('panelProductosAdmin');
    const panelFiltro = document.getElementById('panelFiltroUsuarioAdmin');

    if (!panelProductos || !panelFiltro) return;

    if (currentUser && currentUser.rol === 'admin') {
        panelProductos.classList.remove('hidden');
        panelFiltro.classList.remove('hidden');
    } else {
        panelProductos.classList.add('hidden');
        panelFiltro.classList.add('hidden');
    }
}

async function toggleBloqueoUsuario(id, bloquear) {
    try {
        let options = { method: 'PUT' };
        if (bloquear) {
            const razon = prompt('Motivo de bloqueo (opcional):', 'Debe regularizar pago');
            options = {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ razon })
            };
        }
        const res = await apiFetch(`/usuarios/${id}/${bloquear ? 'block' : 'unblock'}`, options);
        if (!res.ok) {
            const error = await res.json();
            alert(`Error: ${error.error}`);
            return;
        }
        // If the current admin blocked themself, close the session immediately
        if (currentUser && id === currentUser.id && bloquear) {
            alert('Has bloqueado tu cuenta. Se cerrará la sesión.');
            // refresh UI after a short delay to let backend delete sessions
            setTimeout(() => {
                cerrarSesion();
            }, 200);
            return;
        }
        cargarUsuarios();
        cargarSesiones();
    } catch (e) {
        alert('Error de conexión');
        console.error(e);
    }
}

// ========== SESIONES ACTIVAS (ADMIN) ==========
async function cargarSesiones() {
    try {
        const res = await apiFetch('/sesiones');
        if (!res.ok) throw new Error('Error cargando sesiones');
        const sesiones = await res.json();
        renderizarSesiones(sesiones);
    } catch (e) {
        console.error('Error cargando sesiones:', e);
    }
}

function renderizarSesiones(sesiones) {
    const tbody = document.getElementById('listaSesiones');
    if (!tbody) return;
    tbody.innerHTML = '';
    sesiones.forEach(s => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = s.username;
        const fecha = new Date(s.creado);
        row.insertCell(1).textContent = fecha.toLocaleString();
        const estadoCell = row.insertCell(2);
        estadoCell.textContent = s.bloqueado ? 'Bloqueado' : 'Activo';
        estadoCell.style.color = s.bloqueado ? '#dc2626' : '#16a34a';
        const acciones = row.insertCell(3);

        const btnForce = document.createElement('button');
        btnForce.className = 'btn-secondary btn-sm';
        btnForce.textContent = 'Forzar cierre';
        btnForce.onclick = () => forzarCierreSesion(s.session_id);
        acciones.appendChild(btnForce);

        const btnBlock = document.createElement('button');
        btnBlock.className = s.bloqueado ? 'btn-primary btn-sm' : 'btn-danger btn-sm';
        btnBlock.style.marginLeft = '8px';
        btnBlock.textContent = s.bloqueado ? 'Desbloquear' : 'Bloquear';
        btnBlock.onclick = () => toggleBloqueoUsuario(s.usuario_id, !s.bloqueado);
        acciones.appendChild(btnBlock);
    });
}

async function forzarCierreSesion(sessionId) {
    if (!confirm('¿Forzar cierre de sesión de este usuario?')) return;
    try {
        const res = await apiFetch(`/sesiones/${sessionId}`, { method: 'DELETE' });
        if (!res.ok) {
            const error = await res.json();
            alert(error.error || 'Error forzando cierre');
            return;
        }
        cargarSesiones();
    } catch (e) {
        console.error('Error forzando cierre de sesión:', e);
        alert('Error de conexión');
    }
}

function abrirModalUsuario(defaultRole = 'cliente') {
    if (defaultRole && defaultRole instanceof Event) {
        defaultRole = 'cliente';
    }
    document.getElementById('usuarioNuevoNombre').value = '';
    document.getElementById('usuarioNuevoPassword').value = '';
    document.getElementById('usuarioNuevoRol').value = defaultRole;
    document.getElementById('modalUsuarioTitulo').textContent = defaultRole === 'admin' ? 'Registrar administrador' : 'Registrar cliente';
    const modal = document.getElementById('modalUsuario');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function cerrarModalUsuario() {
    const modal = document.getElementById('modalUsuario');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

function mostrarModalBloqueado(razon) {
    const modal = document.getElementById('modalBloqueado');
    const mensaje = document.getElementById('mensajeBloqueo');
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
        overlay.style.zIndex = '10000';
    }
    document.querySelectorAll('.container, .tabs, .tab-content').forEach(el => el?.classList?.remove('blurred'));
    mensaje.textContent = `Tu cuenta ha sido bloqueada. Razón: ${razon}. Por favor contacta al administrador para activar tu producto.`;
    modal.style.display = 'flex';
    modal.style.zIndex = '20000';
}

function cerrarModalBloqueado() {
    const modal = document.getElementById('modalBloqueado');
    modal.style.display = 'none';
    document.querySelectorAll('.container, .tabs, .tab-content').forEach(el => el?.classList?.add('blurred'));
}

async function guardarUsuario() {
    const username = document.getElementById('usuarioNuevoNombre').value.trim();
    const password = document.getElementById('usuarioNuevoPassword').value;
    const rol = document.getElementById('usuarioNuevoRol').value;
    if (!username || !password) {
        alert('Ingrese usuario y contraseña');
        return;
    }
    try {
        const res = await apiFetch('/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, rol })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Error creando usuario');
            return;
        }
        cerrarModalUsuario();
        cargarUsuarios();
    } catch (e) {
        alert('Error de conexión');
        console.error(e);
    }
}

async function actualizarEstadoPrograma() {
    try {
        const res = await apiFetch('/program/status');
        if (!res.ok) throw new Error('Error al cargar estado de programa');
        const data = await res.json();
        const btn = document.getElementById('btnTogglePrograma');
        if (data.habilitado) {
            btn.textContent = 'Bloquear programa';
            btn.className = 'btn-danger btn-sm';
        } else {
            btn.textContent = 'Desbloquear programa';
            btn.className = 'btn-success btn-sm';
        }
    } catch (e) {
        console.error('Error cargando estado de programa:', e);
    }
}

async function togglePrograma() {
    try {
        const estadoRes = await apiFetch('/program/status');
        const estado = await estadoRes.json();
        const res = await apiFetch('/program/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habilitado: !estado.habilitado })
        });
        if (!res.ok) {
            const error = await res.json();
            alert(error.error || 'Error cambiando estado');
            return;
        }
        actualizarEstadoPrograma();
    } catch (e) {
        alert('Error de conexión');
        console.error(e);
    }
}

// ========== PERSISTENCIA DEL CARRITO ==========
function guardarCarrito() {
    localStorage.setItem('drexpos_carrito', JSON.stringify(carrito));
}

function cargarCarritoGuardado() {
    const guardado = localStorage.getItem('drexpos_carrito');
    if (guardado) {
        try {
            carrito = JSON.parse(guardado);
            renderizarCarrito();
        } catch (e) {
            console.error('Error cargando carrito:', e);
            carrito = [];
        }
    }
}

function limpiarCarrito() {
    carrito = [];
    guardarCarrito();
    renderizarCarrito();
}

// ========== MOSTRAR PESTAÑAS ==========
function mostrarTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    if (tab === 'ventas') {
        document.getElementById('tabVentas').classList.add('active');
        document.querySelector('.tab-btn:first-child').classList.add('active');
        cargarProductos();
        actualizarFiltroUsuarioVenta();
    } else if (tab === 'reporte') {
        document.getElementById('tabReporte').classList.add('active');
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        cargarReporteDia();
    } else if (tab === 'historial') {
        document.getElementById('tabHistorial').classList.add('active');
        document.querySelectorAll('.tab-btn')[2].classList.add('active');
        const hoy = new Date();
        const hace7Dias = new Date();
        hace7Dias.setDate(hoy.getDate() - 7);
        document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];
        document.getElementById('fechaDesde').value = hace7Dias.toISOString().split('T')[0];
        buscarHistorial();
    } else if (tab === 'admin') {
        document.getElementById('tabAdmin').classList.add('active');
        document.querySelectorAll('.tab-btn')[3].classList.add('active');
        document.getElementById('adminPanel').classList.remove('hidden');
    }
}

function mostrarNotificacionInventario() {
    const info = document.getElementById('infoInventario');
    if (!info) return;
    info.classList.remove('info-inventario-hidden');
    info.classList.add('show');
}

function cerrarNotificacionInventario() {
    const info = document.getElementById('infoInventario');
    if (!info) return;
    info.classList.remove('show');
    info.classList.add('info-inventario-hidden');
}

// ========== BUSCAR HISTORIAL ==========
async function buscarHistorial() {
    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;

    if (!fechaDesde || !fechaHasta) {
        alert('❌ Seleccione ambas fechas (Desde y Hasta)');
        return;
    }

    const contenedor = document.getElementById('contenedorHistorial');
    contenedor.innerHTML = '<div class="loading">📅 Cargando historial...</div>';

    try {
        const url = `/ventas/por-fecha?fecha_inicio=${fechaDesde}&fecha_fin=${fechaHasta}`;
        const res = await apiFetch(url);

        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

        const datos = await res.json();

        if (!datos || datos.length === 0) {
            contenedor.innerHTML = '<div class="no-data">📭 No hay ventas en el rango de fechas seleccionado</div>';
            return;
        }

        const ventasUnicas = new Map();
        const productosMap = new Map();

        datos.forEach(item => {
            if (!ventasUnicas.has(item.venta_id)) {
                ventasUnicas.set(item.venta_id, {
                    id: item.venta_id,
                    factura: item.factura_numero,
                    fecha: item.fecha,
                    total: parseFloat(item.total)
                });
            }
            productosMap.set(item.producto, (productosMap.get(item.producto) || 0) + item.cantidad);
        });

        const ventasArray = Array.from(ventasUnicas.values()).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const totalVentas = ventasArray.length;
        const totalIngresos = ventasArray.reduce((sum, v) => sum + v.total, 0);
        const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0;
        const ventaMasAlta = ventasArray.length > 0 ? Math.max(...ventasArray.map(v => v.total)) : 0;
        const totalProductosVendidos = datos.reduce((sum, i) => sum + i.cantidad, 0);

        let productosHTML = '';
        for (const [nombre, cantidad] of productosMap) {
            const totalProducto = totalIngresos > 0 ? (cantidad / totalProductosVendidos) * totalIngresos : 0;
            productosHTML += `<tr><td style="padding: 10px; border: 1px solid #ddd;">${nombre}</td><td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${cantidad}</td><td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${totalProducto.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td></tr>`;
        }

        let ventasHTML = '';
        ventasArray.forEach(venta => {
            const fechaVenta = new Date(venta.fecha);
            ventasHTML += `<tr><td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${venta.factura.toString().padStart(3, '0')}</td><td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${fechaVenta.toLocaleDateString('es-CO')}</td><td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${fechaVenta.toLocaleTimeString('es-CO')}</td><td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${venta.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td></tr>`;
        });

        let detallesHTML = '';
        datos.slice(0, 100).forEach(item => {
            const fechaItem = new Date(item.fecha);
            detallesHTML += `<tr><td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${item.venta_id}</td><td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${item.factura_numero.toString().padStart(3, '0')}</td><td style="padding: 8px; border: 1px solid #ddd;">${fechaItem.toLocaleString('es-CO')}<td><td style="padding: 8px; border: 1px solid #ddd;">${item.producto}</td><td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${item.cantidad}</td><td style="padding: 8px; text-align: right; border: 1px solid #ddd;">$${parseFloat(item.subtotal).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td></tr>`;
        });

        const fechaInicioObj = new Date(fechaDesde);
        const fechaFinObj = new Date(fechaHasta);

        contenedor.innerHTML = `
            <div class="historial-print" style="max-width: 1200px; margin: 0 auto;">
                <div style="text-align: center; padding: 15px; background: #f5f5f5; border-bottom: 1px solid #ddd;">
                    <button onclick="window.print();" style="background: #667eea; color: white; border: none; padding: 12px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">🖨️ IMPRIMIR / GUARDAR PDF</button>
                </div>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0 0 5px 0; font-size: 28px;">📊 DREXPOS</h1>
                    <p style="margin: 5px 0; opacity: 0.9;">Sistema de Ventas e Inventario</p>
                    <p style="margin: 10px 0 0 0; font-size: 16px; font-weight: bold;">Reporte de Ventas por Período</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #f5f5f5; font-size: 16px; font-weight: bold; border-bottom: 1px solid #ddd;">
                    📅 Período: ${fechaInicioObj.toLocaleDateString('es-CO')} - ${fechaFinObj.toLocaleDateString('es-CO')}
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; padding: 25px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 14px; opacity: 0.9;">💰 Total Facturas</div>
                        <div style="font-size: 32px; font-weight: bold; margin-top: 8px;">${totalVentas}</div>
                    </div>
                    <div style="background: #10b981; color: white; padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 14px; opacity: 0.9;">📊 Ticket Promedio</div>
                        <div style="font-size: 28px; font-weight: bold; margin-top: 8px;">$${ticketPromedio.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 14px; opacity: 0.9;">🏆 Venta más alta</div>
                        <div style="font-size: 28px; font-weight: bold; margin-top: 8px;">$${ventaMasAlta.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div style="background: #ef4444; color: white; padding: 20px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 14px; opacity: 0.9;">💰 Total Ingresos</div>
                        <div style="font-size: 28px; font-weight: bold; margin-top: 8px;">$${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
                
                <div style="padding: 0 25px;">
                    <h3 style="color: #667eea; margin-bottom: 15px; border-left: 4px solid #667eea; padding-left: 12px;">📋 Productos Vendidos</h3>
                    <div class="tabla-container" style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead><tr style="background: #667eea; color: white;"><th style="padding: 12px; border: 1px solid #fff;">Producto</th><th style="padding: 12px; text-align: center; border: 1px solid #fff;">Cantidad</th><th style="padding: 12px; text-align: right; border: 1px solid #fff;">Total</th></tr></thead>
                            <tbody>${productosHTML}</tbody>
                        </table>
                    </div>
                </div>
                
                <div style="padding: 20px 25px;">
                    <h3 style="color: #667eea; margin-bottom: 15px; border-left: 4px solid #667eea; padding-left: 12px;">📄 Listado de Ventas</h3>
                    <div class="tabla-container" style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead><tr style="background: #667eea; color: white;"><th style="padding: 12px; border: 1px solid #fff;">Factura #</th><th style="padding: 12px; border: 1px solid #fff;">Fecha</th><th style="padding: 12px; border: 1px solid #fff;">Hora</th><th style="padding: 12px; text-align: right; border: 1px solid #fff;">Total</th></tr></thead>
                            <tbody>${ventasHTML}</tbody>
                        </table>
                    </div>
                </div>
                
                <div style="padding: 0 25px 25px 25px;">
                    <h3 style="color: #667eea; margin-bottom: 15px; border-left: 4px solid #667eea; padding-left: 12px;">📋 Detalle Completo de Productos</h3>
                    <div class="tabla-container" style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead><tr style="background: #667eea; color: white;"><th style="padding: 8px; border: 1px solid #fff;">Venta ID</th><th style="padding: 8px; border: 1px solid #fff;">Factura #</th><th style="padding: 8px; border: 1px solid #fff;">Fecha y Hora</th><th style="padding: 8px; border: 1px solid #fff;">Producto</th><th style="padding: 8px; text-align: center; border: 1px solid #fff;">Cantidad</th><th style="padding: 8px; text-align: right; border: 1px solid #fff;">Subtotal</th></tr></thead>
                            <tbody>${detallesHTML}</tbody>
                        </table>
                    </div>
                </div>
                
                <div style="padding: 20px 25px; background: #f8f9fa; text-align: right; border-top: 2px solid #e0e0e0;">
                    <p style="font-size: 22px; font-weight: bold; color: #10b981;"><strong>TOTAL PERIODO:</strong> $${totalIngresos.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</p>
                </div>
                
                <div style="text-align: center; padding: 15px; font-size: 10px; color: #888;">
                    <p>Documento generado por DrexPOS - Sistema de Ventas e Inventario</p>
                    <p>${new Date().toLocaleString('es-CO')}</p>
                </div>
            </div>
        `;

    } catch (e) {
        console.error('Error:', e);
        contenedor.innerHTML = `<div class="error">❌ Error al cargar historial: ${e.message}</div>`;
    }
}

function limpiarHistorial() {
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = '';
    document.getElementById('contenedorHistorial').innerHTML = '<div class="loading">📅 Seleccione un rango de fechas y presione "Buscar"</div>';
}

// ========== PRODUCTOS ==========
async function cargarProductos() {
    try {
        const res = await apiFetch('/productos');
        if (!res.ok) throw new Error('Error cargando productos');
        productosOriginales = await res.json();
        renderizarProductos(productosOriginales);
    } catch (e) {
        console.error('Error cargando productos:', e);
        document.getElementById('listaProductos').innerHTML = '<tr><td colspan="6">Error cargando productos</td></tr>';
    }
}

function renderizarProductos(productos) {
    const tbody = document.getElementById('listaProductos');
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    tbody.innerHTML = '';
    if (!busqueda) {
        tbody.innerHTML = '<tr><td colspan="6">✏️ Empieza a escribir para buscar productos</td></tr>';
        return;
    }
    const filtrados = productos.filter(p => (p.nombre && p.nombre.toLowerCase().includes(busqueda)) || (p.codigo && p.codigo.toLowerCase().includes(busqueda)));
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No se encontraron productos</td></tr>';
        return;
    }
    filtrados.forEach(p => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = p.codigo || '---';
        row.insertCell(1).textContent = p.nombre;
        row.insertCell(2).textContent = `$${parseFloat(p.precio).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
        row.insertCell(3).textContent = p.stock;
        row.insertCell(4).textContent = p.activo === 0 || p.activo === false ? 'No' : 'Sí';
        const acciones = row.insertCell(5);
        const btnAgregar = document.createElement('button');
        btnAgregar.textContent = '+ Vender';
        btnAgregar.className = 'btn-primary btn-sm';
        btnAgregar.style.marginRight = '5px';
        btnAgregar.onclick = () => agregarAlCarrito(p);
        const btnEditar = document.createElement('button');
        btnEditar.textContent = '✏️';
        btnEditar.className = 'btn-primary btn-sm';
        btnEditar.onclick = () => editarProducto(p);
        acciones.appendChild(btnAgregar);
        acciones.appendChild(btnEditar);
    });
}

document.getElementById('buscarProducto').addEventListener('input', function () {
    clearTimeout(busquedaTimeout);
    busquedaTimeout = setTimeout(() => renderizarProductos(productosOriginales), 300);
});

// ========== INVENTARIO ==========
async function cargarInventario() {
    const tbody = document.getElementById('listaInventario');
    if (!tbody) return;
    try {
        const res = await apiFetch('/productos/todos');
        if (!res.ok) throw new Error('Error cargando inventario');
        const productos = await res.json();
        renderizarInventario(productos);
    } catch (e) {
        console.error('Error cargando inventario:', e);
        tbody.innerHTML = '<tr><td colspan="6">Error cargando inventario</td></tr>';
    }
}

function renderizarInventario(productos) {
    const tbody = document.getElementById('listaInventario');
    const buscarInv = document.getElementById('buscarInventario');
    if (!tbody || !buscarInv) return;
    const busquedaInv = buscarInv.value.toLowerCase();
    let filtrados = busquedaInv ? productos.filter(p => (p.nombre && p.nombre.toLowerCase().includes(busquedaInv)) || (p.codigo && p.codigo.toLowerCase().includes(busquedaInv))) : productos;
    tbody.innerHTML = '';
    if (filtrados.length === 0) { tbody.innerHTML = '<tr><td colspan="6">No hay productos registrados</td></tr>'; return; }
    filtrados.forEach(p => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = p.codigo || '---';
        row.insertCell(1).textContent = p.nombre;
        row.insertCell(2).textContent = `$${parseFloat(p.precio).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;

        const cellStock = row.insertCell(3);
        const stockInput = document.createElement('input');
        stockInput.type = 'number';
        stockInput.value = p.stock;
        stockInput.min = 0;
        stockInput.style.width = '80px';
        stockInput.style.padding = '5px';
        stockInput.style.borderRadius = '5px';
        stockInput.style.border = '1px solid #ddd';
        stockInput.onchange = async () => { const nuevoStock = parseInt(stockInput.value); if (!isNaN(nuevoStock) && nuevoStock >= 0) { await actualizarStock(p.id, nuevoStock); cargarInventario(); cargarProductos(); cargarResumen(); } };
        cellStock.appendChild(stockInput);

        const cellEstado = row.insertCell(4);
        const estadoSpan = document.createElement('span');
        const esActivo = p.activo === 1;
        estadoSpan.textContent = esActivo ? '✅ Activo' : '❌ Inactivo';
        estadoSpan.style.color = esActivo ? '#10b981' : '#ef4444';
        estadoSpan.style.fontWeight = 'bold';
        cellEstado.appendChild(estadoSpan);

        const acciones = row.insertCell(5);
        const btnEditar = document.createElement('button');
        btnEditar.textContent = '✏️ Editar';
        btnEditar.className = 'btn-primary btn-sm';
        btnEditar.style.marginRight = '5px';
        btnEditar.onclick = () => editarProducto(p);
        const btnToggle = document.createElement('button');
        btnToggle.textContent = esActivo ? '🔴 Desactivar' : '🟢 Activar';
        btnToggle.className = esActivo ? 'btn-danger btn-sm' : 'btn-primary btn-sm';
        btnToggle.onclick = () => toggleProducto(p.id, esActivo);
        acciones.appendChild(btnEditar);
        acciones.appendChild(btnToggle);
        if (!esActivo) { row.style.backgroundColor = '#fee2e2'; row.style.opacity = '0.7'; }
    });
}

async function actualizarStock(id, nuevoStock) {
    try {
        const res = await apiFetch(`/productos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: nuevoStock }) });
        if (!res.ok) { const error = await res.json(); alert(`Error: ${error.error}`); }
    } catch (e) { console.error('Error actualizando stock:', e); }
}

async function toggleProducto(id, activoActual) {
    const nuevoEstado = !activoActual;
    if (confirm(`¿${nuevoEstado ? 'Activar' : 'Desactivar'} este producto? ${!nuevoEstado ? 'No aparecerá en ventas.' : ''}`)) {
        try {
            const res = await apiFetch(`/productos/${id}/toggle`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: nuevoEstado }) });
            if (res.ok) {
                alert(`✅ Producto ${nuevoEstado ? 'activado' : 'desactivado'}`);
                if (document.getElementById('listaInventario')) cargarInventario();
                cargarProductos();
                cargarResumen();
            } else { const error = await res.json(); alert(`Error: ${error.error}`); }
        } catch (e) { alert('Error de conexión'); }
    }
}

const buscarInventarioInput = document.getElementById('buscarInventario');
if (buscarInventarioInput) {
    buscarInventarioInput.addEventListener('input', function () { cargarInventario(); });
}

// ========== CARRITO ==========
function agregarAlCarrito(producto) {
    if (producto.stock <= 0) { alert('❌ Producto sin stock disponible'); return; }
    const existente = carrito.find(item => item.id === producto.id);
    if (existente) {
        if (existente.cantidad + 1 > producto.stock) { alert(`❌ Solo hay ${producto.stock} unidades disponibles`); return; }
        existente.cantidad++;
        existente.subtotal = existente.cantidad * existente.precio;
    } else {
        carrito.push({ id: producto.id, nombre: producto.nombre, precio: parseFloat(producto.precio), cantidad: 1, subtotal: parseFloat(producto.precio), stock_max: producto.stock });
    }
    guardarCarrito();
    renderizarCarrito();
}

function renderizarCarrito() {
    const tbody = document.getElementById('listaCarrito');
    tbody.innerHTML = '';
    let total = 0;
    if (carrito.length === 0) { tbody.innerHTML = '</table><td colspan="4">Carrito vacío</td></tr>'; document.getElementById('totalCarrito').textContent = '0'; return; }
    carrito.forEach((item, idx) => {
        total += item.subtotal;
        const row = tbody.insertRow();
        row.insertCell(0).textContent = item.nombre;
        const cellCantidad = row.insertCell(1);
        const inputCantidad = document.createElement('input');
        inputCantidad.type = 'number';
        inputCantidad.value = item.cantidad;
        inputCantidad.min = 1;
        inputCantidad.max = item.stock_max;
        inputCantidad.className = 'cantidad-input';
        inputCantidad.onchange = () => {
            let nuevaCant = parseInt(inputCantidad.value);
            if (isNaN(nuevaCant)) nuevaCant = 1;
            if (nuevaCant > item.stock_max) { nuevaCant = item.stock_max; inputCantidad.value = nuevaCant; alert(`⚠️ Stock máximo: ${item.stock_max}`); }
            if (nuevaCant < 1) nuevaCant = 1;
            item.cantidad = nuevaCant;
            item.subtotal = item.cantidad * item.precio;
            guardarCarrito();
            renderizarCarrito();
        };
        cellCantidad.appendChild(inputCantidad);
        row.insertCell(2).textContent = `$${item.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = '❌';
        btnEliminar.className = 'btn-danger btn-sm';
        btnEliminar.onclick = () => { carrito.splice(idx, 1); guardarCarrito(); renderizarCarrito(); };
        row.insertCell(3).appendChild(btnEliminar);
    });
    document.getElementById('totalCarrito').textContent = total.toLocaleString('es-CO', { minimumFractionDigits: 2 });
}

// ========== VENTAS ==========
async function finalizarVenta() {
    if (carrito.length === 0) { alert('❌ Agrega productos al carrito'); return; }
    const items = carrito.map(item => ({ producto_id: item.id, cantidad: item.cantidad, precio_unitario: item.precio }));
    try {
        const res = await apiFetch('/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
        if (res.ok) {
            const data = await res.json();
            alert(`✅ Venta registrada con éxito\nFactura N°: ${data.factura_numero.toString().padStart(3, '0')}\nTotal: $${parseFloat(data.total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`);
            limpiarCarrito();
            cargarProductos();
            cargarResumen();
            cargarInventario();
            if (document.getElementById('tabReporte').classList.contains('active')) { cargarReporteDia(); }
        } else { const error = await res.json(); alert(`❌ Error: ${error.error}`); }
    } catch (e) { alert('❌ Error de conexión con el servidor'); console.error(e); }
}

// ========== DASHBOARD ==========
function setTextSafe(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

async function cargarResumen() {
    try {
        const res = await apiFetch('/dashboard/resumen');
        if (!res.ok) throw new Error('Error cargando resumen');
        const data = await res.json();
        setTextSafe('totalProductos', data.total_productos_activos || 0);
        setTextSafe('stockBajo', data.productos_stock_bajo || 0);
        setTextSafe('ventasHoy', data.ventas_hoy || 0);
        setTextSafe('ingresoHoy', `$${parseFloat(data.ingreso_hoy || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`);
        setTextSafe('adminTotalActivos', data.total_productos_activos || 0);
        setTextSafe('adminTotalInactivos', data.total_productos_inactivos || 0);
        setTextSafe('adminActivadosMes', data.activaciones_mes || 0);
        setTextSafe('adminDesactivadosMes', data.desactivaciones_mes || 0);
        setTextSafe('adminIngresoMes', `$${parseFloat(data.ingreso_mes || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`);
        setTextSafe('adminUsuariosBloqueados', data.usuarios_bloqueados || 0);
    } catch (e) {
        console.error('Error cargando resumen:', e);
    }
}

// ========== REPORTE DEL DÍA ==========
async function cargarReporteDia() {
    try {
        const hoy = new Date();
        document.getElementById('fechaActual').textContent = hoy.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const res = await apiFetch('/reporte/dia');
        if (!res.ok) throw new Error('Error cargando reporte');
        const data = await res.json();
        const datos = data.detalles || [];
        const resumen = data.resumen || {};
        if (datos.length === 0) {
            document.getElementById('listaProductosVendidos').innerHTML = '</tr><td colspan="3">No hay ventas hoy</td></tr>';
            document.getElementById('listaVentasDia').innerHTML = '<tr><td colspan="6">No hay ventas hoy</td></tr>';
            document.getElementById('listaDetalleCompleto').innerHTML = '<tr><td colspan="6">No hay ventas hoy</td></tr>';
            document.getElementById('totalDia').textContent = '$0';
            document.getElementById('productosVendidosDia').textContent = '0';
            document.getElementById('numVentasDia').textContent = '0';
            return;
        }
        let totalVendido = 0, totalProductosUnidades = 0;
        const ventasUnicas = new Map(), productosVendidosMap = new Map();
        datos.forEach(item => {
            totalVendido += parseFloat(item.subtotal);
            totalProductosUnidades += item.cantidad;
            if (!ventasUnicas.has(item.venta_id)) { ventasUnicas.set(item.venta_id, { id: item.venta_id, factura: item.factura_numero, fecha: item.fecha, total: item.total }); }
            productosVendidosMap.set(item.producto, (productosVendidosMap.get(item.producto) || 0) + item.cantidad);
        });
        document.getElementById('totalDia').textContent = `$${totalVendido.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
        document.getElementById('productosVendidosDia').textContent = totalProductosUnidades;
        document.getElementById('numVentasDia').textContent = ventasUnicas.size;
        const tbodyProd = document.getElementById('listaProductosVendidos');
        tbodyProd.innerHTML = '';
        for (const [nombre, cantidad] of productosVendidosMap) {
            const totalProducto = totalVendido > 0 ? (cantidad / totalProductosUnidades) * totalVendido : 0;
            const row = tbodyProd.insertRow();
            row.insertCell(0).textContent = nombre;
            row.insertCell(1).textContent = cantidad;
            row.insertCell(2).textContent = `$${totalProducto.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
        }
        const tbodyVentas = document.getElementById('listaVentasDia');
        tbodyVentas.innerHTML = '';
        const ventasArray = Array.from(ventasUnicas.values()).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        for (const venta of ventasArray) {
            const row = tbodyVentas.insertRow();
            row.insertCell(0).textContent = venta.id;
            row.insertCell(1).textContent = venta.factura.toString().padStart(3, '0');
            row.insertCell(2).textContent = new Date(venta.fecha).toLocaleTimeString('es-CO');
            row.insertCell(3).textContent = `$${parseFloat(venta.total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
            const btnDetalle = document.createElement('button');
            btnDetalle.textContent = 'Ver Detalle';
            btnDetalle.className = 'btn-primary btn-sm';
            btnDetalle.style.marginRight = '5px';
            btnDetalle.onclick = (function (id) { return function () { verDetalleVenta(id); }; })(venta.id);
            row.insertCell(4).appendChild(btnDetalle);
            const btnFactura = document.createElement('button');
            btnFactura.textContent = '🧾 Factura';
            btnFactura.className = 'btn-success btn-sm';
            btnFactura.style.backgroundColor = '#667eea';
            btnFactura.onclick = (function (id, factura) { return function () { generarFacturaIndividual(id, factura); }; })(venta.id, venta.factura);
            row.insertCell(5).appendChild(btnFactura);
        }
        const tbodyDetalle = document.getElementById('listaDetalleCompleto');
        tbodyDetalle.innerHTML = '';
        datos.forEach(item => {
            const row = tbodyDetalle.insertRow();
            row.insertCell(0).textContent = item.venta_id;
            row.insertCell(1).textContent = item.factura_numero.toString().padStart(3, '0');
            row.insertCell(2).textContent = new Date(item.fecha).toLocaleString('es-CO');
            row.insertCell(3).textContent = item.producto;
            row.insertCell(4).textContent = item.cantidad;
            row.insertCell(5).textContent = `$${parseFloat(item.subtotal).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
        });
    } catch (e) { console.error('Error cargando reporte:', e); }
}

// ========== GENERAR FACTURA INDIVIDUAL (CORREGIDA) ==========
function generarFacturaIndividual(ventaId, facturaNumero) {
    apiFetch(`/ventas/${ventaId}`)
        .then(res => res.json())
        .then(venta => {
            const negocio = { nombre: "DREXPOS", direccion: "Cra 45 # 67-88, Bogotá D.C.", telefono: "(601) 123-4567", email: "ventas@drexpos.com", nit: "901.123.456-7" };
            const fecha = new Date(venta.fecha);
            const fechaStr = fecha.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const horaStr = fecha.toLocaleTimeString('es-CO');
            const numFactura = facturaNumero.toString().padStart(3, '0');
            let productosHTML = '', subtotal = 0;

            venta.items.forEach(item => {
                subtotal += parseFloat(item.subtotal);
                const precioUnitario = item.subtotal / item.cantidad;
                productosHTML += `
                    <tr>
                        <td style="text-align: center; padding: 10px; border: 1px solid #ddd;">${item.cantidad}</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${item.producto}</td>
                        <td style="text-align: center; padding: 10px; border: 1px solid #ddd;">${item.codigo || '---'}</td>
                        <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">$${precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                        <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">$${parseFloat(item.subtotal).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                    `
            });

            const total = subtotal;

            const facturaHTML = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>Factura N° ${numFactura} - DrexPOS</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 30px; }
                        .factura { max-width: 800px; width: 100%; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); overflow: hidden; }
                        .factura-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center; }
                        .factura-header h1 { font-size: 28px; margin-bottom: 5px; }
                        .factura-header p { font-size: 12px; opacity: 0.9; margin: 3px 0; }
                        .tipo-documento { text-align: center; margin: 20px; }
                        .tipo-documento span { background: #667eea; color: white; padding: 8px 25px; border-radius: 25px; font-size: 14px; font-weight: bold; }
                        .info-factura { display: flex; justify-content: space-between; background: #f5f5f5; padding: 12px 25px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
                        .info-cliente { padding: 15px 25px; background: #fafafa; border-bottom: 1px solid #e0e0e0; }
                        .info-cliente h4 { color: #667eea; margin-bottom: 8px; }
                        .tabla-productos { padding: 20px 25px; }
                        .tabla-productos h4 { color: #333; margin-bottom: 12px; border-left: 4px solid #667eea; padding-left: 10px; }
                        table { width: 100%; border-collapse: collapse; }
                        th { background: #667eea; color: white; padding: 10px; text-align: center; border: 1px solid #fff; }
                        td { padding: 10px; border: 1px solid #ddd; }
                        .totales { padding: 15px 25px; background: #fafafa; text-align: right; border-top: 2px solid #e0e0e0; }
                        .total-final { font-size: 22px; font-weight: bold; color: #10b981; margin-top: 10px; }
                        .footer { text-align: center; padding: 15px; background: #f5f5f5; font-size: 10px; color: #888; }
                        @media print { body { background: white; padding: 0; } .factura { box-shadow: none; } .factura-header, .tipo-documento span, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
                        .btn-print { background: #10b981; color: white; border: none; padding: 12px; margin: 15px 25px; width: calc(100% - 50px); border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; }
                        .btn-print:hover { background: #059669; }
                    </style>
                </head>
                <body>
                    <div class="factura">
                        <div class="factura-header">
                            <h1>${negocio.nombre}</h1>
                            <p>${negocio.direccion}</p>
                            <p>Tel: ${negocio.telefono} | Email: ${negocio.email}</p>
                            <p>NIT: ${negocio.nit}</p>
                        </div>
                        <div class="tipo-documento"><span>FACTURA DE VENTA</span></div>
                        <div class="info-factura">
                            <span><strong>Factura N°:</strong> ${numFactura}</span>
                            <span><strong>Fecha:</strong> ${fechaStr}</span>
                            <span><strong>Hora:</strong> ${horaStr}</span>
                        </div>
                        <div class="info-cliente">
                            <h4>📋 DATOS DEL CLIENTE</h4>
                            <p><strong>Nombre:</strong> Cliente General</p>
                            <p><strong>Documento:</strong> ----------</p>
                        </div>
                        <div class="tabla-productos">
                            <h4>📦 DETALLE DE PRODUCTOS</h4>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 10%;">Cant.</th>
                                        <th style="width: 40%;">Descripción</th>
                                        <th style="width: 15%;">Código</th>
                                        <th style="width: 15%;">Precio Unit.</th>
                                        <th style="width: 20%;">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productosHTML}
                                </tbody>
                            </table>
                        </div>
                        <div class="totales">
                            <p class="total-final"><strong>TOTAL:</strong> $${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div class="footer">
                            <p>¡Gracias por su compra!</p>
                            <p>DrexPOS - Sistema de Ventas e Inventario</p>
                        </div>
                        <button class="btn-print no-print" onclick="window.print();">🖨️ IMPRIMIR / GUARDAR PDF</button>
                    </div>
                </body>
                </html>
            `;

            const ventana = window.open('', '_blank');
            ventana.document.write(facturaHTML);
            ventana.document.close();
        })
        .catch(e => alert('Error al generar factura: ' + e.message));
}

// ========== GENERAR REPORTE COMPLETO DEL DÍA ==========
function generarReporteCompleto() {
    apiFetch('/reporte/dia')
        .then(res => res.json())
        .then(data => {
            if (!data.detalles || data.detalles.length === 0) {
                alert('No hay ventas hoy');
                return;
            }

            let totalGeneral = 0;
            let totalProductos = 0;
            const productosMap = new Map();

            data.detalles.forEach(item => {
                totalGeneral += parseFloat(item.subtotal);
                totalProductos += item.cantidad;
                productosMap.set(item.producto, (productosMap.get(item.producto) || 0) + item.cantidad);
            });

            const resumen = data.resumen || {};
            const hoy = new Date();
            const fechaStr = hoy.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            let productosHTML = '';
            for (const [nombre, cantidad] of productosMap) {
                const totalProducto = totalGeneral > 0 ? (cantidad / totalProductos) * totalGeneral : 0;
                productosHTML += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">${nombre}</td>
                        <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${cantidad}</td>
                        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${totalProducto.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                    `
            }

            const ventana = window.open('', '_blank');
            ventana.document.write(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>Reporte Diario - DrexPOS</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 30px; }
                        .reporte { max-width: 800px; width: 100%; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); overflow: hidden; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center; }
                        .header h1 { font-size: 28px; margin-bottom: 5px; }
                        .header p { font-size: 12px; opacity: 0.9; }
                        .fecha { text-align: center; padding: 12px; background: #f5f5f5; font-size: 14px; font-weight: bold; color: #667eea; border-bottom: 1px solid #ddd; }
                        .metricas { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; padding: 20px; }
                        .card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; }
                        .card span { font-size: 14px; opacity: 0.9; }
                        .card strong { font-size: 28px; display: block; margin-top: 8px; }
                        .seccion { padding: 20px; }
                        .seccion h3 { color: #667eea; margin-bottom: 15px; border-left: 4px solid #667eea; padding-left: 12px; }
                        table { width: 100%; border-collapse: collapse; }
                        th { background: #667eea; color: white; padding: 12px; text-align: left; border: 1px solid #fff; }
                        td { padding: 10px; border: 1px solid #ddd; }
                        .totales { padding: 20px; background: #fafafa; text-align: right; border-top: 2px solid #e0e0e0; }
                        .total-final { font-size: 24px; font-weight: bold; color: #10b981; margin-top: 10px; }
                        .footer { text-align: center; padding: 15px; background: #f5f5f5; font-size: 10px; color: #888; }
                        @media print { body { background: white; padding: 0; } .reporte { box-shadow: none; } .header, .card, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
                        .btn-print { background: #10b981; color: white; border: none; padding: 12px; margin: 15px 20px; width: calc(100% - 40px); border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; }
                        .btn-print:hover { background: #059669; }
                    </style>
                </head>
                <body>
                    <div class="reporte">
                        <div class="header">
                            <h1>📊 DREXPOS</h1>
                            <p>Sistema de Ventas e Inventario</p>
                            <p>Reporte de Ventas del Día</p>
                        </div>
                        <div class="fecha">${fechaStr}</div>
                        
                        <div class="metricas">
                            <div class="card"><span>💰 Total Vendido</span><strong>$${totalGeneral.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong></div>
                            <div class="card"><span>📦 Productos Vendidos</span><strong>${totalProductos} unidades</strong></div>
                        </div>
                        
                        <div class="seccion">
                            <h3>📋 Productos Vendidos</h3>
                            <div class="tabla-container">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th style="text-align: center;">Cantidad</th>
                                            <th style="text-align: right;">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>${productosHTML}</tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div class="totales">
                            <p class="total-final"><strong>TOTAL DEL DÍA:</strong> $${totalGeneral.toLocaleString('es-CO', { minimumFractionDigits: 2 })}</p>
                        </div>
                        
                        <div class="footer">
                            <p>DrexPOS - Sistema de Ventas e Inventario</p>
                            <p>Documento generado el ${new Date().toLocaleString('es-CO')}</p>
                        </div>
                        
                        <button class="btn-print no-print" onclick="window.print();">🖨️ IMPRIMIR / GUARDAR PDF</button>
                    </div>
                </body>
                </html>
            `);
            ventana.document.close();
        })
        .catch(error => { console.error('Error:', error); alert('Error al generar el reporte'); });
}

// ========== VER DETALLE DE VENTA ==========
async function verDetalleVenta(id) {
    try {
        const res = await apiFetch(`/ventas/${id}`);
        const venta = await res.json();
        document.getElementById('detalleVentaId').textContent = venta.venta_id;
        document.getElementById('detalleFacturaNumero').textContent = venta.factura_numero.toString().padStart(3, '0');
        const fecha = new Date(venta.fecha);
        document.getElementById('detalleFecha').textContent = fecha.toLocaleString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('detalleTotal').textContent = parseFloat(venta.total).toLocaleString('es-CO', { minimumFractionDigits: 2 });
        const tbody = document.getElementById('detalleItems');
        tbody.innerHTML = '';
        venta.items.forEach(item => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = item.producto;
            row.insertCell(1).textContent = item.codigo || '---';
            row.insertCell(2).textContent = item.cantidad;
            row.insertCell(3).textContent = `$${parseFloat(item.subtotal).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
        });
        document.getElementById('modalDetalleVenta').style.display = 'flex';
    } catch (e) { alert('Error cargando detalle de la venta'); console.error(e); }
}

// ========== CRUD PRODUCTOS ==========
function editarProducto(producto) {
    document.getElementById('modalTitulo').textContent = 'Editar Producto';
    document.getElementById('productoId').value = producto.id;
    document.getElementById('productoCodigo').value = producto.codigo || '';
    document.getElementById('productoNombre').value = producto.nombre;
    document.getElementById('productoPrecio').value = producto.precio;
    document.getElementById('productoStock').value = producto.stock;
    document.getElementById('modalProducto').style.display = 'flex';
}

async function guardarProducto() {
    const id = document.getElementById('productoId').value;
    const codigo = document.getElementById('productoCodigo').value;
    const nombre = document.getElementById('productoNombre').value;
    const precio = parseFloat(document.getElementById('productoPrecio').value);
    const stock = parseInt(document.getElementById('productoStock').value) || 0;
    if (!nombre || isNaN(precio)) { alert('❌ Nombre y precio son requeridos'); return; }
    let url = `${API}/productos`, method = 'POST', body = { nombre, precio, stock };
    if (codigo) body.codigo = codigo;
    if (id) { method = 'PUT'; url = `${API}/productos/${id}`; body = { nombre, precio, stock }; if (codigo) body.codigo = codigo; }
    try {
        const res = await apiFetch(url.replace(API, ''), { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) {
            alert('✅ Producto guardado');
            cerrarModal();
            cargarProductos();
            if (document.getElementById('listaInventario')) cargarInventario();
            cargarResumen();
        } else { const error = await res.json(); alert(`❌ Error: ${error.error}`); }
    } catch (e) { alert('❌ Error de conexión'); console.error(e); }
}

function cerrarModal() {
    document.getElementById('modalProducto').style.display = 'none';
    document.getElementById('modalDetalleVenta').style.display = 'none';
    document.getElementById('productoId').value = '';
    document.getElementById('productoCodigo').value = '';
    document.getElementById('productoNombre').value = '';
    document.getElementById('productoPrecio').value = '';
    document.getElementById('productoStock').value = '';
}

// ========== EVENTOS ==========
document.getElementById('btnAgregarProducto').onclick = () => {
    document.getElementById('modalTitulo').textContent = 'Agregar Producto';
    document.getElementById('productoId').value = '';
    document.getElementById('productoCodigo').value = '';
    document.getElementById('productoNombre').value = '';
    document.getElementById('productoPrecio').value = '';
    document.getElementById('productoStock').value = '';
    document.getElementById('modalProducto').style.display = 'flex';
};

const btnAgregarProductoInventario = document.getElementById('btnAgregarProductoInventario');
if (btnAgregarProductoInventario) {
    btnAgregarProductoInventario.onclick = () => {
        document.getElementById('modalTitulo').textContent = 'Agregar Producto';
        document.getElementById('productoId').value = '';
        document.getElementById('productoCodigo').value = '';
        document.getElementById('productoNombre').value = '';
        document.getElementById('productoPrecio').value = '';
        document.getElementById('productoStock').value = '';
        document.getElementById('modalProducto').style.display = 'flex';
    };
}

document.getElementById('btnGuardarProducto').onclick = guardarProducto;

document.getElementById('btnFinalizarVenta').onclick = finalizarVenta;
document.getElementById('btnReporteCompleto').onclick = generarReporteCompleto;
document.getElementById('btnBuscarHistorial').onclick = buscarHistorial;
document.getElementById('btnLimpiarHistorial').onclick = limpiarHistorial;
document.getElementById('btnLogin').onclick = iniciarSesion;
document.getElementById('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') iniciarSesion(); });
document.getElementById('togglePassword').addEventListener('click', () => {
    const passwordInput = document.getElementById('loginPassword');
    const toggleButton = document.getElementById('togglePassword');
    const isPwd = passwordInput.type === 'password';
    passwordInput.type = isPwd ? 'text' : 'password';
    // toggle CSS class to switch SVG visibility
    if (isPwd) {
        toggleButton.classList.add('showing-closed');
        toggleButton.setAttribute('aria-label', 'Ocultar contraseña');
    } else {
        toggleButton.classList.remove('showing-closed');
        toggleButton.setAttribute('aria-label', 'Mostrar contraseña');
    }
    // keep focus in the input so typing continues
    passwordInput.focus();
});
document.getElementById('btnLogout').onclick = () => cerrarSesion();
const btnCrearCliente = document.getElementById('btnCrearCliente');
if (btnCrearCliente) btnCrearCliente.onclick = () => abrirModalUsuario('cliente');
const btnCrearUsuario = document.getElementById('btnCrearUsuario');
if (btnCrearUsuario) btnCrearUsuario.onclick = abrirModalUsuario;
const btnGuardarUsuario = document.getElementById('btnGuardarUsuario');
if (btnGuardarUsuario) btnGuardarUsuario.onclick = guardarUsuario;
const closeButtons = document.querySelectorAll('.close');
closeButtons.forEach(button => {
    if (button.classList.contains('close-usuario')) {
        button.onclick = cerrarModalUsuario;
    } else if (button.classList.contains('close-bloqueado')) {
        button.onclick = cerrarModalBloqueado;
    } else {
        button.onclick = cerrarModal;
    }
});
const closeDetalle = document.querySelector('.close-detalle');
if (closeDetalle) closeDetalle.onclick = cerrarModal;
const btnCerrarBloqueado = document.getElementById('btnCerrarBloqueado');
if (btnCerrarBloqueado) btnCerrarBloqueado.onclick = cerrarModalBloqueado;

window.onclick = (e) => {
    if (e.target === document.getElementById('modalProducto')) cerrarModal();
    if (e.target === document.getElementById('modalDetalleVenta')) cerrarModal();
    if (e.target === document.getElementById('modalUsuario')) cerrarModalUsuario();
    if (e.target === document.getElementById('modalBloqueado')) cerrarModalBloqueado();
};

// ========== INICIALIZACIÓN ==========
validarSesion();
setInterval(() => { if (currentUser) cargarResumen(); }, 30000);