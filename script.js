const ORIGEN_CATALOGO = "normal";
// === CONFIGURACIÓN GENERAL ===
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdixPJBCFos9aUaUT_NDxQ2ZMW3s2CXoQ0KRNVNe8aYmaXtTSONvKgPRXIFcFpSSmO/exec";

/**
 * Estado global de la aplicación
 * @type {Object}
 * @property {Array} catalogo - Catálogo original de productos
 * @property {Array} catalogoEnriquecido - Catálogo con categorías asignadas
 * @property {Object} barrios - Objeto con barrios y costos de domicilio
 * @property {Array} cart - Productos en el carrito
 * @property {number} domicilio - Costo de domicilio seleccionado
 * @property {number} iva - IVA aplicado (19% para NIT)
 * @property {string|null} categoriaSeleccionada - Filtro de categoría activo
 */
const state = {
  catalogo: [],
  catalogoEnriquecido: [],
  barrios: {},
  cart: [],
  domicilio: 0,
  iva: 0,
  categoriaSeleccionada: null,
};

/**
 * Formatea un número como moneda colombiana (COP)
 * @param {number|string} v - Valor a formatear
 * @returns {string} Valor formateado con separadores de miles
 */
const fmtCOP = v => Number(v || 0).toLocaleString('es-CO');

/**
 * Inicializa la aplicación cargando datos del servidor
 * @async
 * @returns {Promise<void>}
 */
async function init() {
  try {
    const res = await fetch(SCRIPT_URL);
    const data = await res.json();
    state.catalogo = data.catalogo || [];
    state.catalogoEnriquecido = enriquecerCatalogoCategorias(state.catalogo);
    state.barrios = data.barrios || {};
    renderCatalogoPorCategorias();
    fillBarrios();
    fillFiltrosCategorias();
  } catch (error) {
    console.error("Error al cargar datos:", error);
    Swal.fire("Error", "No se pudieron cargar los datos del catálogo", "error");
  }
}

// === RENDERIZAR CATÁLOGO POR CATEGORÍAS ===
function renderCatalogoPorCategorias() {
  const cont = document.getElementById("catalogo");
  cont.innerHTML = "";

  // Filtrar por categoría si está seleccionada
  const catalogoParaMostrar = state.categoriaSeleccionada
    ? filtrarPorCategoria(state.catalogoEnriquecido, state.categoriaSeleccionada)
    : state.catalogoEnriquecido;

  // Agrupar por categoría
  const grupos = agruparPorCategoria(catalogoParaMostrar);

  // Renderizar cada grupo
  Object.entries(grupos).forEach(([categoria, productos]) => {
    if (productos.length === 0) return;

    // Contenedor de categoría con título sutil
    const seccionDiv = document.createElement("div");
    seccionDiv.className = "categoria-seccion";

    // Título de categoría más sutil
    const tituloDiv = document.createElement("div");
    tituloDiv.className = "categoria-header";
    tituloDiv.innerHTML = `<h3 class="categoria-titulo">${categoria}</h3>`;
    seccionDiv.appendChild(tituloDiv);

    // Grid de productos
    const gridDiv = document.createElement("div");
    gridDiv.className = "catalogo-grid";

    productos.forEach(prod => {
      if (!prod.img) return;

      const codigo = prod.id !== undefined && prod.id !== null && prod.id !== ""
        ? prod.id
        : "-";

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <img src="${prod.img}" alt="${prod.name}">
        <div class="body">
          <div class="product-id">N°: ${codigo}</div>
          <div class="name">${prod.name}</div>
          <div class="price">$${fmtCOP(prod.price)}</div>
          <button class="btn-add">Agregar al carrito</button>
        </div>
      `;

      card.querySelector(".btn-add")
        .addEventListener("click", () => addToCart(prod));

      gridDiv.appendChild(card);
    });

    seccionDiv.appendChild(gridDiv);
    cont.appendChild(seccionDiv);
  });

  if (Object.values(grupos).every(p => p.length === 0)) {
    cont.innerHTML = `<p style="text-align:center; color:#888; padding:40px 20px;">No hay productos en esta categoría 😔</p>`;
  }
}


// === BUSCADOR DE PRODUCTOS ===
function filtrarCatalogo() {
  const query = document
    .getElementById("searchInput")
    .value
    .toLowerCase()
    .trim();

  // Aplicar búsqueda y filtro de categoría
  let productosFiltrados = state.catalogoEnriquecido;
  
  // Filtrar por búsqueda si hay query
  if (query) {
    productosFiltrados = productosFiltrados.filter(p => {
      const nombre = (p.name || "").toLowerCase();
      const codigo = String(p.id || "").toLowerCase();
      return nombre.includes(query) || codigo.includes(query);
    });
  }

  // Limpiar la búsqueda y renderizar
  state.categoriaSeleccionada = null;
  document.getElementById("filtroCategorias").value = "";
  
  // Renderizar con el nuevo set de productos
  const cont = document.getElementById("catalogo");
  cont.innerHTML = "";

  if (productosFiltrados.length === 0) {
    cont.innerHTML = `<p style="text-align:center;color:#888; padding:40px 20px;">No se encontraron productos con "${query}" 😔</p>`;
    return;
  }

  // Agrupar y renderizar con estilos mejorados
  const grupos = agruparPorCategoria(productosFiltrados);
  
  Object.entries(grupos).forEach(([categoria, productos]) => {
    if (productos.length === 0) return;

    const seccionDiv = document.createElement("div");
    seccionDiv.className = "categoria-seccion";

    const headerDiv = document.createElement("div");
    headerDiv.className = "categoria-header";
    headerDiv.innerHTML = `<h3 class="categoria-titulo">${categoria}</h3>`;
    seccionDiv.appendChild(headerDiv);

    const gridDiv = document.createElement("div");
    gridDiv.className = "catalogo-grid";

    productos.forEach(prod => {
      if (!prod.img) return;

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <img src="${prod.img}" alt="${prod.name}">
        <div class="body">
          <div class="product-id">N°: ${prod.id}</div>
          <div class="name">${prod.name}</div>
          <div class="price">$${fmtCOP(prod.price)}</div>
          <button class="btn-add">Agregar al carrito</button>
        </div>
      `;

      card.querySelector(".btn-add")
        .addEventListener("click", () => addToCart(prod));

      gridDiv.appendChild(card);
    });

    seccionDiv.appendChild(gridDiv);
    cont.appendChild(seccionDiv);
  });
}

// === BARRIOS ===
function fillBarrios() {
  const sel = document.getElementById("barrio");
  if (!sel) return;

  sel.innerHTML = `<option value="">Selecciona un barrio...</option>`;

  const barriosOrdenados = Object.keys(state.barrios).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );

  barriosOrdenados.forEach(barrio => {
    const op = document.createElement("option");
    op.value = barrio;
    op.textContent = `${barrio} ($${fmtCOP(state.barrios[barrio])})`;
    sel.appendChild(op);
  });
}

// === FILTRO POR CATEGORÍA ===
function fillFiltrosCategorias() {
  // El select ya existe en el HTML, solo lo obtenemos
  const filtroSelect = document.getElementById("filtroCategorias");
  
  if (!filtroSelect) return;

  // Llenar opciones
  const categorias = obtenerTodasLasCategorias();
  const options = filtroSelect.querySelectorAll("option");
  
  // Agregar nuevas opciones si no existen
  categorias.forEach(cat => {
    if (![...options].find(o => o.value === cat)) {
      const op = document.createElement("option");
      op.value = cat;
      op.textContent = cat;
      filtroSelect.appendChild(op);
    }
  });

  // Evento de cambio
  filtroSelect.addEventListener("change", (e) => {
    state.categoriaSeleccionada = e.target.value || null;
    document.getElementById("searchInput").value = "";
    renderCatalogoPorCategorias();
  });
}

function actualizarDomicilio() {
  const barrioSel = document.getElementById("barrio").value;

  // 🧠 Si no hay barrio seleccionado, domicilio = 0
  if (!barrioSel || !state.barrios[barrioSel]) {
    state.domicilio = 0;
  } else {
    state.domicilio = state.barrios[barrioSel];
  }

  renderDrawerCart();
}

// === VALIDAR HORA DE ENTREGA ===
if (typeof document !== 'undefined') {
  // Inputs de fecha y hora (solo existen en el formulario)
  const fechaEntregaInput = document.getElementById("fechaEntrega");
  
  // Escuchar cambios
  //horaEntregaInput.addEventListener("change", validarHoraEntrega);
  if (fechaEntregaInput) {
    fechaEntregaInput.addEventListener("change", () => {
      // Limpiar hora si cambia la fecha
      const horaEntregaInput = document.getElementById("horaEntrega");
      if (horaEntregaInput) horaEntregaInput.value = "";
    });
  }
}


// === CARRITO ===
/**
 * Agrega un producto al carrito
 * @param {Object} prod - Producto a agregar
 * @param {string} prod.name - Nombre del producto
 * @param {number} prod.price - Precio del producto
 */
function addToCart(prod) {

  // 🌸 DETECTAR ARREGLO PERSONALIZADO
  if (prod.name === "Arreglo Personalizado") {

    // dejar sólo este item especial
    state.cart = [{
      name: "Arreglo Personalizado",
      price: 0,
      qty: 1
    }];

    updateCartCount();
    renderDrawerCart();

    // ir al formulario
    show("viewForm");

    // activar cuadro de descripción personalizada
    const boxPers = document.getElementById("boxPersonalizado");
    if (boxPers) boxPers.style.display = "block";

    // actualizar resumen del pedido
    document.getElementById("resumenProducto").innerHTML =
      `🌸 <strong>Arreglo Personalizado</strong>`;

    return; // detener aquí, no seguir lógica normal
  }

  // 🛒 LÓGICA NORMAL PARA PRODUCTOS REGULARES
  const existing = state.cart.find(p => p.name === prod.name);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ ...prod, qty: 1 });
  }

  updateCartCount();
  renderDrawerCart();

  Swal.fire({
    title: 'Producto agregado',
    text: `${prod.name} se añadió al carrito`,
    icon: 'success',
    timer: 3000,
    showConfirmButton: false
  });
}
function changeQty(name, delta) {
  const item = state.cart.find(p => p.name === name);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter(p => p.name !== name);
  }
  updateCartCount();
  renderDrawerCart();
}

function removeFromCart(name) {
  state.cart = state.cart.filter(p => p.name !== name);
  updateCartCount();
  renderDrawerCart();
}

function vaciarCarrito() {
  state.cart = [];
  updateCartCount();
  renderDrawerCart();
}

// === DRAWER ===
let hideFabOnForm = false;
if (typeof document !== 'undefined') {
  const drawer = document.getElementById("drawerCarrito");
  const btnDrawer = document.getElementById("btnDrawer");
  const cerrarDrawer = document.getElementById("cerrarDrawer");
  const vaciarCarritoBtn = document.getElementById("vaciarCarrito");
  
  if (btnDrawer) {
    btnDrawer.onclick = () => {
      renderDrawerCart();
      if (drawer) drawer.classList.add("open");
    };
  }
  if (cerrarDrawer && drawer) {
    cerrarDrawer.onclick = () => drawer.classList.remove("open");
  }
  if (vaciarCarritoBtn) {
    vaciarCarritoBtn.onclick = vaciarCarrito;
  }
}

function updateCartCount() {
  const totalQty = state.cart.reduce((a, b) => a + b.qty, 0);
  document.getElementById("cartCount").textContent = totalQty;
}

function renderDrawerCart() {
  const cont = document.getElementById("cartItemsDrawer");
  cont.innerHTML = "";
  let subtotal = 0;
  if (state.cart.length === 0) {
    cont.innerHTML = `<p style="text-align:center;color:#666;">Tu carrito está vacío 🛒</p>`;
  } else {
    state.cart.forEach(p => {
      const sub = p.price * p.qty;
      subtotal += sub;
      cont.innerHTML += `
        <li class="cart-item">
          <div>
            <div class="name">${p.name}</div>
            <div class="price">$${fmtCOP(p.price)} c/u</div>
          </div>
          <div class="qty">
            <button onclick="changeQty('${p.name}', -1)">−</button>
            <span>${p.qty}</span>
            <button onclick="changeQty('${p.name}', 1)">+</button>
          </div>
        </li>`;
    });
  }

  // Calcular IVA si es NIT
  const tipoIdent = document.getElementById("tipoIdent")?.value || "CEDULA";
  state.iva = tipoIdent === "NIT" ? subtotal * 0.19 : 0;

  const domicilio = state.domicilio || 0;
  const total = subtotal + domicilio + state.iva;

  document.getElementById("subtotalDrawer").textContent = fmtCOP(subtotal);
  document.getElementById("ivaDrawer").textContent = fmtCOP(state.iva);
  document.getElementById("domicilioDrawer").textContent = fmtCOP(domicilio);
  document.getElementById("totalDrawer").textContent = fmtCOP(total);

  // Actualizar inputs ocultos
  const domInput = document.getElementById("domicilio");
  const ivaInput = document.getElementById("iva");
  const totalInput = document.getElementById("total");
  if (domInput) domInput.value = domicilio;
  if (ivaInput) ivaInput.value = state.iva;
  if (totalInput) totalInput.value = total;
}

// === NAVEGACIÓN ===
function show(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const fab = document.getElementById("btnDrawer");
  if (fab) {
    fab.classList.toggle("is-hidden", id === "viewForm" && hideFabOnForm);
    if (id !== "viewForm") {
      hideFabOnForm = false;
    }
  }

  // 🟢 Si es el formulario → asignar fecha y hora por defecto
  if (id === "viewForm") {
  const fechaInput = document.getElementById("fechaEntrega");
  if (fechaInput && !fechaInput.value) {
    fechaInput.value = new Date().toISOString().split("T")[0];
  }
}
}

if (typeof document !== 'undefined') {
  const btnPedidoDrawer = document.getElementById("btnPedidoDrawer");
  const btnVolver = document.getElementById("btnVolver");
  
  if (btnPedidoDrawer) {
    btnPedidoDrawer.onclick = () => {
      const drawer = document.getElementById("drawerCarrito");
      if (drawer) drawer.classList.remove("open");
      const resumen = state.cart.map(p => `${p.qty}x ${p.name}`).join(" | ");
      const subtotal = state.cart.reduce((a, b) => a + b.price * b.qty, 0);
      const resumenProducto = document.getElementById("resumenProducto");
      if (resumenProducto) {
        resumenProducto.textContent =
          `🛍 ${resumen} — Subtotal: $${fmtCOP(subtotal)} + Domicilio: $${fmtCOP(state.domicilio)}`;
      }
      hideFabOnForm = true;
      show("viewForm");
    };
  }

  if (btnVolver) {
    btnVolver.addEventListener("click", () => show("viewCatalog"));
  }
}

// === DETECCIÓN Y AUTOCOMPLETADO DE CLIENTE EXISTENTE ===
let lookupTimer = null;

if (typeof document !== 'undefined') {
  const identificacionInput = document.getElementById("identificacion");
  if (identificacionInput) {
    identificacionInput.addEventListener("input", e => {
      clearTimeout(lookupTimer);
      const val = e.target.value.trim();
      if (!val) {
        setClienteBadge(null);
        document.getElementById("telefono").value = "";
        document.getElementById("primerNombre").value = "";
        document.getElementById("primerApellido").value = "";
        const emailInput = document.getElementById("email");
        if (emailInput) emailInput.value = "";
        return;
      }
      lookupTimer = setTimeout(() => buscarCliente(val), 300);
    });
  }
}

async function buscarCliente(ident) {
  try {
    const res = await fetch(`${SCRIPT_URL}?cliente=${encodeURIComponent(ident)}`);
    const data = await res.json();

    if (data && data.found) {
      setClienteBadge(true);

      document.getElementById("primerNombre").value = data.primerNombre || "";
      document.getElementById("primerApellido").value = data.primerApellido || "";
      document.getElementById("telefono").value = data.telefono || "";

      // 🔥 ESTA LÍNEA ES LA QUE FALTA
      if (data.tipoIdent) {
        document.getElementById("tipoIdent").value = data.tipoIdent;
      }

      const emailInput = document.getElementById("email");
      const emailValor = extraerEmailDeData(data);
      if (emailInput && emailValor) emailInput.value = emailValor;

      // 🔥 Recalcular IVA si cambia a NIT
      renderDrawerCart();

    } else {
      setClienteBadge(false);
    }

  } catch (err) {
    console.error("Error al buscar cliente:", err);
    setClienteBadge(null);
  }
}


function extraerEmailDeData(data) {
  if (!data || typeof data !== "object") return "";
  const directKeys = [
    "email",
    "correo",
    "correoElectronico",
    "emailCliente",
    "Email",
    "Correo",
    "CorreoElectronico",
    "EmailCliente"
  ];
  for (const key of directKeys) {
    const value = data[key];
    if (typeof value === "string" && value.includes("@")) return value.trim();
  }
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string") continue;
    const lowerKey = key.toLowerCase();
    if ((lowerKey.includes("email") || lowerKey.includes("correo")) && value.includes("@")) {
      return value.trim();
    }
  }
  return "";
}

/**
 * Actualiza el badge visual del estado de búsqueda de cliente
 * @param {boolean|null} encontrado - true: cliente encontrado, false: no encontrado, null: sin búsqueda
 */
function setClienteBadge(encontrado) {
  const b = document.getElementById("badgeCliente");
  b.classList.remove("hidden", "ok", "warn");
  if (encontrado === true) {
    b.textContent = "Cliente encontrado";
    b.classList.add("ok");
  } else if (encontrado === false) {
    b.textContent = "Nuevo cliente";
    b.classList.add("warn");
  } else {
    b.classList.add("hidden");
  }
}

function autofillCliente(c) {
  const nombre = [c.PrimerNombre, c.SegundoNombre].filter(Boolean).join(" ").trim();
  const apellidos = [c.PrimerApellido, c.SegundoApellido].filter(Boolean).join(" ").trim();
  document.getElementById("primerNombre").value = nombre || "";
  document.getElementById("primerApellido").value = apellidos || "";
  document.getElementById("telefono").value = c.Telefono || "";
}

function limpiarCliente(clearId) {
  if (clearId) document.getElementById("identificacion").value = "";
  document.getElementById("primerNombre").value = "";
  document.getElementById("primerApellido").value = "";
  document.getElementById("telefono").value = "";
}

// === ENVÍO DEL FORMULARIO ===
// === FORMULARIO DE PEDIDO ===
if (typeof document !== 'undefined') {
  const pedidoForm = document.getElementById("pedidoForm");
  if (pedidoForm) {
    pedidoForm.addEventListener("submit", async e => {
  e.preventDefault();

  const btnSubmit = document.getElementById("btnSubmit");
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Procesando pedido...";

  // 📌 Crear FormData
  const formData = new FormData(e.target);

  // 🟢 BANDERA: origen del catálogo
  formData.set("origenCatalogo", ORIGEN_CATALOGO);

  // ===============================
  // HORA DE ENTREGA FIJA
  // ===============================
  formData.set("Hora de Entrega", "00:00:00");

  // ==================================
  // 🔑 ACCIÓN PARA ACTUALIZAR EMAIL
  // ==================================
  formData.set("accion", "actualizarEmail");

  // ============================================================
  // OBSERVACIONES + FIRMA (CAMPO ÚNICO / NO OBLIGATORIO)
  // ============================================================
  const obsInput = document.getElementById("observaciones");
  const observaciones = obsInput ? obsInput.value.trim() : "";

  const firmaInput = document.getElementById("firma");
  const firma = firmaInput ? firmaInput.value.trim() : "";

  formData.set("observaciones", observaciones);
  formData.set("firma", firma);

  // ============================================================
  // Validación: carrito vacío
  // ============================================================
  if (state.cart.length === 0) {
    Swal.fire(
      "Carrito vacío",
      "Agrega al menos un producto antes de enviar el pedido.",
      "warning"
    );
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Confirmar pedido";
    return;
  }

  // ============================================================
  // NORMALIZAR TELÉFONO
  // ============================================================
  const indicativo = document.getElementById("indicativo")?.value || "+57";
  let telefonoCliente = document.getElementById("telefono").value.trim();

  if (telefonoCliente && !telefonoCliente.startsWith("+")) {
    telefonoCliente = indicativo + telefonoCliente;
  }
  formData.set("telefono", telefonoCliente);

  // ============================================================
  // Dirección final (dirección + tipoLugar)
  // ============================================================
  const direccion = document.getElementById("direccion")?.value.trim() || "";
  const tipoLugar = document.getElementById("tipoLugar")?.value || "";
  const direccionFinal = tipoLugar ? `${direccion} - ${tipoLugar}` : direccion;

  formData.set("direccion", direccionFinal);

  // ============================================================
  // Productos y totales
  // ============================================================
  const productos = state.cart.map(p => `${p.qty}× ${p.name}`).join(" | ");
  const cantidad = state.cart.reduce((a, p) => a + p.qty, 0);
  const subtotal = state.cart.reduce((a, p) => a + p.price * p.qty, 0);
  const iva = state.iva || 0;
  const domicilio = state.domicilio || 0;
  const total = subtotal + iva + domicilio;

  formData.set("tipoIdent", document.getElementById("tipoIdent").value);
  formData.set("producto", productos);
  formData.set("cantidad", cantidad);
  formData.set("precio", subtotal);
  formData.set("iva", iva);
  formData.set("domicilio", domicilio);
  formData.set("total", total);

  // ============================================================
  // Enviar pedido a Apps Script
  // ============================================================
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (data.status === "success") {

      const telefonoFlora = ("57" + "3013755838").replace(/\D/g, ""); // 📲 WhatsApp oficial Flora
      const mensaje = encodeURIComponent(
        "Hola 🌸 Ya realicé el registro de mi pedido en el formulario y quedo atento(a) para continuar con el proceso de pago."
      );
      const whatsappLink = `https://wa.me/${telefonoFlora}?text=${mensaje}`;

      Swal.fire({
        icon: "success",
        title: "Pedido recibido 🌸",
        html: `
          <p style="margin-bottom:10px;">
            Tu solicitud fue registrada correctamente.
          </p>
          <p style="margin-bottom:10px;">
            📲 Para continuar con el proceso de pago,
            <strong>escríbenos ahora mismo por WhatsApp</strong>.
          </p>
          <p style="font-size:14px;color:#666;">
            Una persona del equipo Flora te responderá para confirmar el pedido
            y brindarte las instrucciones de pago.
          </p>
        `,
        confirmButtonText: "Continuar por WhatsApp",
        confirmButtonColor: "#25D366", // 🟢 WhatsApp
        showCancelButton: false,       // ❌ sin “Entendido”
        allowOutsideClick: false,      // 🔒 no cerrar clic afuera
        allowEscapeKey: false          // 🔒 no cerrar con ESC
      }).then(() => {
        window.open(whatsappLink, "_blank");
      });

      // 🔄 Reset normal del flujo
      state.cart = [];
      updateCartCount();
      renderDrawerCart();
      show("viewCatalog");
      e.target.reset();

    } else {
      Swal.fire("Error", "No se pudo registrar el pedido correctamente.", "error");
    }
  } catch (error) {
    console.error("❌ Error al enviar pedido:", error);
    Swal.fire("Error", "Hubo un problema al enviar el pedido.", "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Confirmar pedido";
  }
  });
  } // Cierre del if para pedidoForm

  // === ACTUALIZAR IVA AL CAMBIAR IDENTIFICACIÓN ===
  const tipoIdentSelect = document.getElementById("tipoIdent");
  if (tipoIdentSelect) {
    tipoIdentSelect.addEventListener("change", () => renderDrawerCart());
  }

  // === BANDERAS DEL INDICATIVO (COMPATIBLE iPhone/Android) ===
  document.addEventListener("DOMContentLoaded", function () {
    const select = document.getElementById("indicativo");
    const flagIcon = document.getElementById("flagIcon");

    if (!select || !flagIcon) return;

    function countryFlagEmoji(code) {
      return code
        .toUpperCase()
        .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt()));
    }

    function actualizarBandera() {
      const opt = select.selectedOptions[0];
      const flag = opt.dataset.flag || "co";
      flagIcon.textContent = countryFlagEmoji(flag);
    }

    select.addEventListener("change", actualizarBandera);
    actualizarBandera(); 
  });

  // === AUTO-RELLENO PARA "ENTREGA EN TIENDA" ===
  const tipoLugarSelectEntrega = document.getElementById("tipoLugar");
  if (tipoLugarSelectEntrega) {
    tipoLugarSelectEntrega.addEventListener("change", () => {
      const tipo = tipoLugarSelectEntrega.value;

    const destinatario = document.getElementById("destinatario");
    const telefonoDestino = document.getElementById("telefonoDestino");
    const direccion = document.getElementById("direccion");
    const barrioSel = document.getElementById("barrio");

    // 🔥 Valor estandarizado único
    const VALOR_TIENDA = "Entrega En Tienda";

    if (tipo === VALOR_TIENDA) {
      // Obtener datos del cliente
      const nombre = document.getElementById("primerNombre").value.trim();
      const apellido = document.getElementById("primerApellido").value.trim();
      const telefono = document.getElementById("telefono").value.trim();

      // Autollenar destinatario y telefono destino
      destinatario.value = `${nombre} ${apellido}`.trim();
      destinatario.dataset.autofilled = "true";
      telefonoDestino.value = telefono;
      telefonoDestino.dataset.autofilled = "true";

      // Asignar direccion para Entrega En Tienda
      direccion.value = VALOR_TIENDA;
      direccion.dataset.autofilled = "true";

      // Si no existe el option → lo creamos
      if (![...barrioSel.options].some(o => o.value === VALOR_TIENDA)) {
        const opt = document.createElement("option");
        opt.value = VALOR_TIENDA;
        opt.textContent = VALOR_TIENDA;
        barrioSel.insertBefore(opt, barrioSel.firstChild);
      }

      // Seleccionarlo SIEMPRE
      barrioSel.value = VALOR_TIENDA;
      barrioSel.dataset.autofilled = "true";

      // Domicilio = 0
      state.domicilio = 0;
      renderDrawerCart();

      // Habilitar / deshabilitar campos
      destinatario.disabled = false;
      telefonoDestino.disabled = false;
      direccion.disabled = false;
      barrioSel.disabled = false;

    } else {
      // Si NO es tienda → resetear
      destinatario.disabled = false;
      telefonoDestino.disabled = false;
      direccion.disabled = false;
      barrioSel.disabled = false;

      if (destinatario.dataset.autofilled === "true") {
        destinatario.value = "";
        delete destinatario.dataset.autofilled;
      }
      if (telefonoDestino.dataset.autofilled === "true") {
        telefonoDestino.value = "";
        delete telefonoDestino.dataset.autofilled;
      }
      if (direccion.dataset.autofilled === "true" && direccion.value === VALOR_TIENDA) {
        direccion.value = "";
        delete direccion.dataset.autofilled;
      }
      if (barrioSel.dataset.autofilled === "true" && barrioSel.value === VALOR_TIENDA) {
        barrioSel.value = "";
        delete barrioSel.dataset.autofilled;
      }
    }
  });
  }

  // Si el usuario edita manualmente, dejar de considerar auto-llenado
  const direccionInput = document.getElementById("direccion");
  if (direccionInput) {
    direccionInput.addEventListener("input", () => {
      if (direccionInput.dataset.autofilled === "true" && direccionInput.value !== "Entrega En Tienda") {
        delete direccionInput.dataset.autofilled;
      }
    });
  }

  const barrioSelect = document.getElementById("barrio");
  if (barrioSelect) {
    barrioSelect.addEventListener("change", () => {
      if (barrioSelect.dataset.autofilled === "true" && barrioSelect.value !== "Entrega En Tienda") {
        delete barrioSelect.dataset.autofilled;
      }
    });
  }

  // === ACTIVAR ARREGLO PERSONALIZADO ===
  const btnIrPersonalizado = document.getElementById("btnIrPersonalizado");
  if (btnIrPersonalizado) {
    btnIrPersonalizado.addEventListener("click", () => {
      // vaciamos carrito para que no mezcle productos normales
      state.cart = [{
        name: "Arreglo Personalizado",
        price: 0,
        qty: 1
      }];

      updateCartCount();
      renderDrawerCart();

      // mostrar formulario
      hideFabOnForm = false;
      show("viewForm");

      // activar la caja personalizada
      const boxPersonalizado = document.getElementById("boxPersonalizado");
      if (boxPersonalizado) boxPersonalizado.style.display = "block";
    });
  }

  // === LLAMAR INIT AUTOMÁTICAMENTE ===
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
} // Cierre del if (typeof document !== 'undefined')

// === EXPORTS PARA TESTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fmtCOP,
    extraerEmailDeData,
    SCRIPT_URL,
    ORIGEN_CATALOGO
  };
}
