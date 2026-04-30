const API = 'http://localhost:3000/api';
let carrito = [];
let productosOriginales = [];
let busquedaTimeout;

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
    } else if (tab === 'inventario') {
        document.getElementById('tabInventario').classList.add('active');
        document.querySelectorAll('.tab-btn')[3].classList.add('active');
        cargarInventario();
    }
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
        const url = `${API}/ventas/por-fecha?fecha_inicio=${fechaDesde}&fecha_fin=${fechaHasta}`;
        const res = await fetch(url);

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
        const res = await fetch(`${API}/productos`);
        if (!res.ok) throw new Error('Error cargando productos');
        productosOriginales = await res.json();
        renderizarProductos(productosOriginales);
    } catch (e) {
        console.error('Error cargando productos:', e);
        document.getElementById('listaProductos').innerHTML = '<tr><td colspan="5">Error cargando productos</div>';
    }
}

function renderizarProductos(productos) {
    const tbody = document.getElementById('listaProductos');
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    tbody.innerHTML = '';
    if (!busqueda) {
        tbody.innerHTML = '<tr><td colspan="5">✏️ Empieza a escribir para buscar productos</td></tr>';
        return;
    }
    const filtrados = productos.filter(p => (p.nombre && p.nombre.toLowerCase().includes(busqueda)) || (p.codigo && p.codigo.toLowerCase().includes(busqueda)));
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No se encontraron productos</td></tr>';
        return;
    }
    filtrados.forEach(p => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = p.codigo || '---';
        row.insertCell(1).textContent = p.nombre;
        row.insertCell(2).textContent = `$${parseFloat(p.precio).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
        row.insertCell(3).textContent = p.stock;
        const acciones = row.insertCell(4);
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
    try {
        const res = await fetch(`${API}/productos/todos`);
        if (!res.ok) throw new Error('Error cargando inventario');
        const productos = await res.json();
        renderizarInventario(productos);
    } catch (e) {
        console.error('Error cargando inventario:', e);
        document.getElementById('listaInventario').innerHTML = '<tr><td colspan="6">Error cargando inventario</td></tr>';
    }
}

function renderizarInventario(productos) {
    const tbody = document.getElementById('listaInventario');
    const busquedaInv = document.getElementById('buscarInventario').value.toLowerCase();
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
        const res = await fetch(`${API}/productos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: nuevoStock }) });
        if (!res.ok) { const error = await res.json(); alert(`Error: ${error.error}`); }
    } catch (e) { console.error('Error actualizando stock:', e); }
}

async function toggleProducto(id, activoActual) {
    const nuevoEstado = !activoActual;
    if (confirm(`¿${nuevoEstado ? 'Activar' : 'Desactivar'} este producto? ${!nuevoEstado ? 'No aparecerá en ventas.' : ''}`)) {
        try {
            const res = await fetch(`${API}/productos/${id}/toggle`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: nuevoEstado }) });
            if (res.ok) { alert(`✅ Producto ${nuevoEstado ? 'activado' : 'desactivado'}`); cargarInventario(); cargarProductos(); cargarResumen(); }
            else { const error = await res.json(); alert(`Error: ${error.error}`); }
        } catch (e) { alert('Error de conexión'); }
    }
}

document.getElementById('buscarInventario').addEventListener('input', function () { cargarInventario(); });

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
        const res = await fetch(`${API}/ventas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
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
async function cargarResumen() {
    try {
        const res = await fetch(`${API}/dashboard/resumen`);
        if (!res.ok) throw new Error('Error cargando resumen');
        const data = await res.json();
        document.getElementById('totalProductos').textContent = data.total_productos || 0;
        document.getElementById('stockBajo').textContent = data.productos_stock_bajo || 0;
        document.getElementById('ventasHoy').textContent = data.ventas_hoy || 0;
        document.getElementById('ingresoHoy').textContent = `$${parseFloat(data.ingreso_hoy || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
    } catch (e) { console.error('Error cargando resumen:', e); }
}

// ========== REPORTE DEL DÍA ==========
async function cargarReporteDia() {
    try {
        const hoy = new Date();
        document.getElementById('fechaActual').textContent = hoy.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const res = await fetch(`${API}/reporte/dia`);
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
    fetch(`${API}/ventas/${ventaId}`)
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
    fetch(`${API}/reporte/dia`)
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
        const res = await fetch(`${API}/ventas/${id}`);
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
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) { alert('✅ Producto guardado'); cerrarModal(); cargarProductos(); cargarInventario(); cargarResumen(); }
        else { const error = await res.json(); alert(`❌ Error: ${error.error}`); }
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

document.getElementById('btnAgregarProductoInventario').onclick = () => {
    document.getElementById('modalTitulo').textContent = 'Agregar Producto';
    document.getElementById('productoId').value = '';
    document.getElementById('productoCodigo').value = '';
    document.getElementById('productoNombre').value = '';
    document.getElementById('productoPrecio').value = '';
    document.getElementById('productoStock').value = '';
    document.getElementById('modalProducto').style.display = 'flex';
};

document.getElementById('btnGuardarProducto').onclick = guardarProducto;
document.getElementById('btnFinalizarVenta').onclick = finalizarVenta;
document.getElementById('btnReporteCompleto').onclick = generarReporteCompleto;
document.getElementById('btnBuscarHistorial').onclick = buscarHistorial;
document.getElementById('btnLimpiarHistorial').onclick = limpiarHistorial;

document.querySelector('.close').onclick = cerrarModal;
document.querySelector('.close-detalle').onclick = cerrarModal;

window.onclick = (e) => {
    if (e.target === document.getElementById('modalProducto')) cerrarModal();
    if (e.target === document.getElementById('modalDetalleVenta')) cerrarModal();
};

// ========== INICIALIZACIÓN ==========
cargarCarritoGuardado();
cargarProductos();
cargarResumen();

setInterval(cargarResumen, 30000);