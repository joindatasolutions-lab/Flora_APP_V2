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

const wizardState = {
  currentStep: 1,
  totalSteps: 4
};

function esTelefonoColombiaValido(valor) {
  const limpio = String(valor || "").replaceAll(/\D/g, "");
  return /^3\d{9}$/.test(limpio);
}

function normalizarTelefonoColombia(valor) {
  const limpio = String(valor || "").replaceAll(/\D/g, "");
  return limpio ? `+57${limpio}` : "";
}

function extraerTelefonoLocal10(valor) {
  const limpio = String(valor || "").replaceAll(/\D/g, "");
  if (!limpio) return "";
  return limpio.slice(-10);
}

function scrollSuaveAElemento(elemento, duracion = 380) {
  if (!elemento) return;

  const inicioY = window.scrollY || window.pageYOffset;
  const destinoY = elemento.getBoundingClientRect().top + inicioY - 16;
  const cambio = destinoY - inicioY;
  if (Math.abs(cambio) < 6) return;

  const inicioTiempo = performance.now();
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  const animar = tiempoActual => {
    const transcurrido = tiempoActual - inicioTiempo;
    const progreso = Math.min(transcurrido / duracion, 1);
    const eased = easeOutCubic(progreso);
    window.scrollTo(0, inicioY + cambio * eased);
    if (progreso < 1) requestAnimationFrame(animar);
  };

  requestAnimationFrame(animar);
}

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
  const inputBusqueda = document.getElementById("buscarBarrio");
  const barrioHidden = document.getElementById("barrio");
  if (inputBusqueda && !inputBusqueda.value.trim()) inputBusqueda.value = "";
  if (barrioHidden && !barrioHidden.value.trim()) barrioHidden.value = "";
  renderBarrioSuggestions("");
  setupBusquedaBarrio();
  actualizarDomicilio();
}

function renderBarrioSuggestions(query = "") {
  const list = document.getElementById("barrioSuggestions");
  if (!list) return;

  const termino = query.toLowerCase().trim();
  if (!termino) {
    list.innerHTML = "";
    list.style.display = "none";
    return;
  }

  const barriosOrdenados = Object.keys(state.barrios).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );

  const filtrados = barriosOrdenados
    .filter(barrio => barrio.toLowerCase().includes(termino))
    .slice(0, 6);

  if (!filtrados.length) {
    list.innerHTML = "";
    list.style.display = "none";
    return;
  }

  list.innerHTML = filtrados.map(barrio => `
    <div class="autocomplete-item" data-value="${barrio}">
      ${barrio} ($${fmtCOP(state.barrios[barrio])})
    </div>
  `).join("");

  list.style.display = "block";
}

function setupBusquedaBarrio() {
  const inputBusqueda = document.getElementById("buscarBarrio");
  const barrioHidden = document.getElementById("barrio");
  const suggestions = document.getElementById("barrioSuggestions");
  if (!inputBusqueda || !barrioHidden || !suggestions || inputBusqueda.dataset.bound === "true") return;

  inputBusqueda.dataset.bound = "true";

  inputBusqueda.addEventListener("input", () => {
    const valor = inputBusqueda.value.trim();
    renderBarrioSuggestions(valor);

    if (!valor) {
      barrioHidden.value = "";
      suggestions.style.display = "none";
      actualizarDomicilio();
      updateSubmitState();
      return;
    }

    const exacto = Object.keys(state.barrios).find(barrio =>
      barrio.toLowerCase() === valor.toLowerCase()
    );
    barrioHidden.value = exacto || "";
    actualizarDomicilio();
    updateSubmitState();
  });

  inputBusqueda.addEventListener("focus", () => {
    renderBarrioSuggestions(inputBusqueda.value);
  });

  suggestions.addEventListener("click", event => {
    const item = event.target.closest(".autocomplete-item");
    if (!item) return;
    const barrio = item.dataset.value || "";
    inputBusqueda.value = barrio;
    barrioHidden.value = barrio;
    suggestions.style.display = "none";
    actualizarDomicilio();
    updateSubmitState();
    renderDrawerCart();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".autocomplete-wrapper")) {
      suggestions.style.display = "none";
    }
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
    if (![...options].some(o => o.value === cat)) {
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
  const barrioInput = document.getElementById("barrio");
  if (!barrioInput) return;

  const barrioSel = barrioInput.value;

  // 🧠 Si no hay barrio seleccionado, domicilio = 0
  if (!barrioSel || !state.barrios[barrioSel]) {
    state.domicilio = 0;
  } else {
    state.domicilio = state.barrios[barrioSel];
  }

  const costoInfo = document.getElementById("barrioCostoInfo");
  if (costoInfo) {
    const textoBarrio = barrioSel ? ` (${barrioSel})` : "";
    costoInfo.textContent = `Costo de domicilio${textoBarrio}: $${fmtCOP(state.domicilio)}`;
  }

  renderDrawerCart();
  updateSubmitState();
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
      qty: 1,
      nota: ""
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
    if (typeof existing.nota !== "string") existing.nota = "";
  } else {
    state.cart.push({ ...prod, qty: 1, nota: "" });
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

  if (wizardState.currentStep === 3) {
    renderNotasPersonalizadas();
  }

  if (wizardState.currentStep === 4) {
    actualizarResumenConfirmacion();
  }
  updateSubmitState();
}

function renderNotasPersonalizadas() {
  const contenedor = document.getElementById("notasPersonalizadasContainer");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const personalizados = state.cart
    .map((producto, index) => ({ producto, index }))
    .filter(({ producto }) => producto.name === "Arreglo Personalizado");

  personalizados.forEach(({ producto, index }, posicion) => {
    const grupo = document.createElement("div");
    grupo.className = "form-group";

    const label = document.createElement("label");
    const idTextarea = `notaPersonalizada-${index}`;
    label.setAttribute("for", idTextarea);
    label.textContent = personalizados.length > 1
      ? `Instrucciones del arreglo personalizado #${posicion + 1}`
      : "Instrucciones del arreglo personalizado";

    const textarea = document.createElement("textarea");
    textarea.id = idTextarea;
    textarea.placeholder = "Describe colores, flores, estilo, presupuesto o cualquier detalle importante.";
    textarea.value = typeof producto.nota === "string" ? producto.nota : "";

    textarea.addEventListener("input", () => {
      if (state.cart[index]) {
        state.cart[index].nota = textarea.value;
      }
    });

    grupo.appendChild(label);
    grupo.appendChild(textarea);
    contenedor.appendChild(grupo);
  });
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
  irAPaso(1);
}
}

function getWizardSteps() {
  return [...document.querySelectorAll(".wizard-step")];
}

function sincronizarNombreCompleto() {
  const fullInput = document.getElementById("nombreCompletoVisible");
  const primerNombre = document.getElementById("primerNombre");
  const primerApellido = document.getElementById("primerApellido");
  if (!fullInput || !primerNombre || !primerApellido) return;

  const fullName = fullInput.value.trim();
  primerNombre.value = fullName;
  primerApellido.value = "";
}

function obtenerTipoEntrega() {
  const seleccionado = document.querySelector('input[name="tipoEntrega"]:checked');
  return seleccionado ? seleccionado.value : "DOMICILIO";
}

function activarModoTienda(destinatarioInput, telefonoDestinoInput) {
  sincronizarNombreCompleto();
  const nombreCliente = document.getElementById("primerNombre")?.value || "";
  const telefonoCliente = document.getElementById("telefono")?.value || "";

  destinatarioInput.value = nombreCliente;
  telefonoDestinoInput.value = telefonoCliente;
  destinatarioInput.dataset.autoFilled = "true";
  telefonoDestinoInput.dataset.autoFilled = "true";
  destinatarioInput.disabled = true;
  telefonoDestinoInput.disabled = true;
}

function activarModoDomicilio(destinatarioInput, telefonoDestinoInput) {
  destinatarioInput.disabled = false;
  telefonoDestinoInput.disabled = false;

  if (destinatarioInput.dataset.autoFilled === "true") {
    destinatarioInput.value = "";
    delete destinatarioInput.dataset.autoFilled;
  }
  if (telefonoDestinoInput.dataset.autoFilled === "true") {
    telefonoDestinoInput.value = "";
    delete telefonoDestinoInput.dataset.autoFilled;
  }
}

function aplicarAutofillTipoEntrega(esTienda) {
  const destinatarioInput = document.getElementById("destinatario");
  const telefonoDestinoInput = document.getElementById("telefonoDestino");
  if (!destinatarioInput || !telefonoDestinoInput) return;

  if (esTienda) {
    activarModoTienda(destinatarioInput, telefonoDestinoInput);
    return;
  }

  activarModoDomicilio(destinatarioInput, telefonoDestinoInput);
}

function actualizarBloqueDireccion() {
  const tipoEntrega = obtenerTipoEntrega();
  const direccion = document.getElementById("direccionCompleta");
  const barrio = document.getElementById("barrio");
  const buscarBarrio = document.getElementById("buscarBarrio");
  if (!direccion || !barrio) return;

  const grupoDireccion = direccion.closest(".form-group");
  const grupoBarrio = buscarBarrio ? buscarBarrio.closest(".form-group") : null;

  const esTienda = tipoEntrega === "TIENDA";

  if (esTienda) {
    if (grupoDireccion) grupoDireccion.style.display = "none";
    if (grupoBarrio) grupoBarrio.style.display = "none";

    direccion.removeAttribute("required");
    barrio.removeAttribute("required");

    direccion.value = "";
    barrio.value = "";
    if (buscarBarrio) buscarBarrio.value = "";

    state.domicilio = 0;
    const costoInfo = document.getElementById("barrioCostoInfo");
    if (costoInfo) {
      costoInfo.textContent = `Costo de domicilio: $${fmtCOP(state.domicilio)}`;
    }
    renderDrawerCart();
  } else {
    if (grupoDireccion) grupoDireccion.style.display = "";
    if (grupoBarrio) grupoBarrio.style.display = "";

    direccion.setAttribute("required", "required");
    barrio.setAttribute("required", "required");

    actualizarDomicilio();
  }

  updateSubmitState();
}

function updateSubmitState() {
  const btnSubmit = document.getElementById("btnSubmit");
  if (!btnSubmit) return;

  const tipoEntrega = obtenerTipoEntrega();
  const requeridos = ["tipoIdent", "identificacion", "telefono", "nombreCompletoVisible", "destinatario"];
  if (tipoEntrega !== "TIENDA") {
    requeridos.push("direccionCompleta", "barrio");
  }

  const camposCompletos = requeridos.every(id => {
    const campo = document.getElementById(id);
    return campo ? Boolean(String(campo.value || "").trim()) : true;
  });

  btnSubmit.disabled = state.cart.length === 0 || !camposCompletos;
}

function validarCampoTelefonoPorId(fieldId, required = false) {
  const input = document.getElementById(fieldId);
  if (!input) return true;
  const valor = input.value.trim();

  if (!valor) {
    input.setCustomValidity(required ? "Este campo es obligatorio." : "");
    return !required;
  }

  const valido = esTelefonoColombiaValido(valor);
  input.setCustomValidity(
    valido ? "" : "Ingresa un número válido de Colombia (10 dígitos, inicia por 3)."
  );
  return valido;
}

function validarPaso(step, showAlert = true) {
  sincronizarNombreCompleto();
  const tipoEntrega = obtenerTipoEntrega();

  const requeridosPorPaso = {
    1: ["tipoIdent", "identificacion", "telefono", "nombreCompletoVisible"],
    2: tipoEntrega === "TIENDA" ? ["destinatario"] : ["destinatario", "direccionCompleta", "barrio"],
    3: [],
    4: []
  };

  const requeridos = requeridosPorPaso[step] || [];
  let invalido = false;
  for (const id of requeridos) {
    const campo = document.getElementById(id);
    if (!campo) continue;
    if (!String(campo.value || "").trim()) {
      campo.setCustomValidity("Este campo es obligatorio.");
      if (showAlert) campo.reportValidity();
      invalido = true;
      break;
    }
    campo.setCustomValidity("");
  }

  if (invalido) return false;

  const telefonoValido = step === 1 ? validarCampoTelefonoPorId("telefono", true) : true;
  const telefonoDestinoValido = step === 2 ? validarCampoTelefonoPorId("telefonoDestino", false) : true;

  if (!telefonoValido || !telefonoDestinoValido) {
    if (showAlert) {
      Swal.fire("Campos pendientes", "Completa los campos requeridos antes de continuar.", "warning");
    }
    return false;
  }

  return true;
}

function actualizarResumenConfirmacion() {
  const contenedor = document.getElementById("confirmSummary");
  if (!contenedor) return;

  const subtotal = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const productos = state.cart.map(p => `${p.qty}x ${p.name}`).join(" | ") || "Sin productos";
  const telefonoCliente = extraerTelefonoLocal10(document.getElementById("telefono")?.value || "");
  const telefonoDestino = extraerTelefonoLocal10(document.getElementById("telefonoDestino")?.value || "");

  contenedor.innerHTML = `
    <p><strong>Cliente:</strong> ${(document.getElementById("primerNombre")?.value || "").trim()} ${(document.getElementById("primerApellido")?.value || "").trim()}</p>
    <p><strong>Identificación:</strong> ${(document.getElementById("tipoIdent")?.value || "")} ${(document.getElementById("identificacion")?.value || "")}</p>
    <p><strong>Teléfono cliente:</strong> ${telefonoCliente ? `+57 ${telefonoCliente}` : "-"}</p>
    <p><strong>Destinatario:</strong> ${(document.getElementById("destinatario")?.value || "").trim()}</p>
    <p><strong>Teléfono destino:</strong> ${telefonoDestino ? `+57 ${telefonoDestino}` : "-"}</p>
    <p><strong>Dirección completa:</strong> ${(document.getElementById("direccionCompleta")?.value || "").trim()}</p>
    <p><strong>Barrio:</strong> ${(document.getElementById("barrio")?.value || "")}</p>
    <p><strong>Fecha de entrega:</strong> ${(document.getElementById("fechaEntrega")?.value || "")}</p>
    <p><strong>Productos:</strong> ${productos}</p>
    <p><strong>Subtotal:</strong> $${fmtCOP(subtotal)}</p>
    <p><strong>IVA:</strong> $${fmtCOP(state.iva || 0)}</p>
    <p><strong>Domicilio:</strong> $${fmtCOP(state.domicilio || 0)}</p>
    <p><strong>Total:</strong> $${fmtCOP(subtotal + (state.iva || 0) + (state.domicilio || 0))}</p>
  `;
}

function actualizarUIWizard() {
  const pasos = getWizardSteps();
  if (!pasos.length) return;

  pasos.forEach(stepEl => {
    const paso = Number(stepEl.dataset.step);
    stepEl.classList.toggle("active", paso === wizardState.currentStep);
  });

  const porcentaje = (wizardState.currentStep / wizardState.totalSteps) * 100;
  const barra = document.getElementById("wizardProgressFill");
  const textoPaso = document.getElementById("wizardStepText");
  const textoTitulo = document.getElementById("wizardStepLabel");
  const pasoActivo = pasos.find(stepEl => Number(stepEl.dataset.step) === wizardState.currentStep);

  if (barra) barra.style.width = `${porcentaje}%`;
  if (textoPaso) textoPaso.textContent = `Paso ${wizardState.currentStep} de ${wizardState.totalSteps}`;
  if (textoTitulo && pasoActivo) textoTitulo.textContent = pasoActivo.dataset.title || "";

  if (wizardState.currentStep === 3) {
    renderNotasPersonalizadas();
  }

  if (wizardState.currentStep === 4) actualizarResumenConfirmacion();
  updateSubmitState();

  if (pasoActivo) {
    scrollSuaveAElemento(pasoActivo, 420);
  }
}

function irAPaso(step) {
  wizardState.currentStep = Math.min(Math.max(step, 1), wizardState.totalSteps);
  actualizarUIWizard();
}

function avanzarPaso() {
  if (!validarPaso(wizardState.currentStep, true)) return;
  if (wizardState.currentStep < wizardState.totalSteps) {
    irAPaso(wizardState.currentStep + 1);
  }
}

function retrocederPaso() {
  if (wizardState.currentStep > 1) {
    irAPaso(wizardState.currentStep - 1);
  }
}

function setupWizard() {
  const form = document.getElementById("pedidoForm");
  if (!form) return;

  const nombreCompletoVisible = document.getElementById("nombreCompletoVisible");
  if (nombreCompletoVisible) {
    nombreCompletoVisible.addEventListener("input", () => {
      sincronizarNombreCompleto();
      if (obtenerTipoEntrega() === "TIENDA") actualizarBloqueDireccion();
      updateSubmitState();
    });
  }

  const telefonoClienteInput = document.getElementById("telefono");
  if (telefonoClienteInput) {
    telefonoClienteInput.addEventListener("input", () => {
      if (obtenerTipoEntrega() === "TIENDA") actualizarBloqueDireccion();
    });
  }

  const radiosEntrega = document.querySelectorAll('input[name="tipoEntrega"]');
  radiosEntrega.forEach(radio => {
    radio.addEventListener("change", () => {
      actualizarBloqueDireccion();

      const destinatario = document.getElementById("destinatario");
      const telefonoDestino = document.getElementById("telefonoDestino");

      if (!destinatario || !telefonoDestino) return;

      if (radio.value === "TIENDA" && radio.checked) {
        const nombre = document.getElementById("nombreCompletoVisible")?.value || "";
        const telefono = document.getElementById("telefono")?.value || "";

        destinatario.value = nombre;
        telefonoDestino.value = telefono;

        destinatario.dataset.autoFilled = "true";
        telefonoDestino.dataset.autoFilled = "true";
      }

      if (radio.value === "DOMICILIO" && radio.checked) {
        if (destinatario.dataset.autoFilled === "true") {
          destinatario.value = "";
          delete destinatario.dataset.autoFilled;
        }

        if (telefonoDestino.dataset.autoFilled === "true") {
          telefonoDestino.value = "";
          delete telefonoDestino.dataset.autoFilled;
        }
      }
    });
  });

  const destinatarioInput = document.getElementById("destinatario");
  if (destinatarioInput && destinatarioInput.dataset.manualBound !== "true") {
    destinatarioInput.dataset.manualBound = "true";
    destinatarioInput.addEventListener("input", () => {
      if (destinatarioInput.dataset.autoFilled === "true") {
        delete destinatarioInput.dataset.autoFilled;
      }
    });
  }

  const telefonoDestinoInput = document.getElementById("telefonoDestino");
  if (telefonoDestinoInput && telefonoDestinoInput.dataset.manualBound !== "true") {
    telefonoDestinoInput.dataset.manualBound = "true";
    telefonoDestinoInput.addEventListener("input", () => {
      if (telefonoDestinoInput.dataset.autoFilled === "true") {
        delete telefonoDestinoInput.dataset.autoFilled;
      }
    });
  }

  form.querySelectorAll("[data-wizard-next]").forEach(btn => btn.addEventListener("click", avanzarPaso));
  form.querySelectorAll("[data-wizard-prev]").forEach(btn => btn.addEventListener("click", retrocederPaso));

  form.addEventListener("input", () => updateSubmitState());
  form.addEventListener("change", () => {
    if (wizardState.currentStep === 4) actualizarResumenConfirmacion();
    updateSubmitState();
  });

  sincronizarNombreCompleto();
  actualizarBloqueDireccion();
  irAPaso(1);
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
      irAPaso(1);
      updateSubmitState();
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
        const nombreCompletoVisible = document.getElementById("nombreCompletoVisible");
        if (nombreCompletoVisible) nombreCompletoVisible.value = "";
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

    if (data?.found) {
      setClienteBadge(true);

      document.getElementById("primerNombre").value = data.primerNombre || "";
      document.getElementById("primerApellido").value = data.primerApellido || "";
      const nombreCompletoVisible = document.getElementById("nombreCompletoVisible");
      if (nombreCompletoVisible) {
        nombreCompletoVisible.value = [data.primerNombre || "", data.primerApellido || ""].filter(Boolean).join(" ").trim();
      }
      document.getElementById("telefono").value = extraerTelefonoLocal10(data.telefono);

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
  const nombreCompletoVisible = document.getElementById("nombreCompletoVisible");
  if (nombreCompletoVisible) nombreCompletoVisible.value = `${nombre} ${apellidos}`.trim();
  document.getElementById("telefono").value = c.Telefono || "";
}

function limpiarCliente(clearId) {
  if (clearId) document.getElementById("identificacion").value = "";
  document.getElementById("primerNombre").value = "";
  document.getElementById("primerApellido").value = "";
  const nombreCompletoVisible = document.getElementById("nombreCompletoVisible");
  if (nombreCompletoVisible) nombreCompletoVisible.value = "";
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
  sincronizarNombreCompleto();
  if (!validarPaso(1, true)) {
    irAPaso(1);
    updateSubmitState();
    return;
  }

  if (!validarPaso(2, true)) {
    irAPaso(2);
    updateSubmitState();
    return;
  }

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
  // OBSERVACIONES + FIRMA (OBSERVACIÓN GENERAL + NOTAS POR PRODUCTO)
  // ============================================================
  const obsInput = document.getElementById("observacionGeneral");
  const observaciones = obsInput ? obsInput.value.trim() : "";
  const notasPersonalizadas = state.cart
    .filter(p => p.name === "Arreglo Personalizado")
    .map((p, i) => `#${i + 1}: ${(p.nota || "").trim()}`)
    .filter(Boolean)
    .join(" | ");

  const firmaInput = document.getElementById("firma");
  const firma = firmaInput ? firmaInput.value.trim() : "";

  formData.set("observaciones", observaciones);
  formData.set("notasPersonalizadas", notasPersonalizadas);
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
  // NORMALIZAR TELÉFONOS (+57 fijo)
  // ============================================================
  const telefonoClienteRaw = document.getElementById("telefono")?.value || "";
  const telefonoDestinoRaw = document.getElementById("telefonoDestino")?.value || "";

  if (!esTelefonoColombiaValido(telefonoClienteRaw)) {
    Swal.fire("Teléfono inválido", "Ingresa un celular colombiano válido (10 dígitos).", "warning");
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Confirmar pedido";
    return;
  }

  if (telefonoDestinoRaw && !esTelefonoColombiaValido(telefonoDestinoRaw)) {
    Swal.fire("Teléfono destino inválido", "Si completas el teléfono destino, debe ser un celular colombiano válido.", "warning");
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Confirmar pedido";
    return;
  }

  formData.set("telefono", normalizarTelefonoColombia(telefonoClienteRaw));
  if (telefonoDestinoRaw) formData.set("telefonoDestino", normalizarTelefonoColombia(telefonoDestinoRaw));

  // ============================================================
  // Dirección final (direccionCompleta)
  // ============================================================
  const direccionCompleta = document.getElementById("direccionCompleta")?.value.trim() || "";
  formData.set("direccion", direccionCompleta);
  formData.set("direccionCompleta", direccionCompleta);

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
      //3013755838
      const telefonoFlora = ("57" + "3013755838").replaceAll(/\D/g, ""); // 📲 WhatsApp oficial Flora
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
      irAPaso(1);
      updateSubmitState();

    } else {
      Swal.fire("Error", "No se pudo registrar el pedido correctamente.", "error");
    }
  } catch (error) {
    console.error("❌ Error al enviar pedido:", error);
    Swal.fire("Error", "Hubo un problema al enviar el pedido.", "error");
  } finally {
    updateSubmitState();
    btnSubmit.textContent = "Confirmar pedido";
  }
  });
  } // Cierre del if para pedidoForm

  // === ACTUALIZAR IVA AL CAMBIAR IDENTIFICACIÓN ===
  const tipoIdentSelect = document.getElementById("tipoIdent");
  if (tipoIdentSelect) {
    tipoIdentSelect.addEventListener("change", () => renderDrawerCart());
  }

  setupWizard();

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
} 

// === EXPORTS PARA TESTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fmtCOP,
    extraerEmailDeData,
    SCRIPT_URL,
    ORIGEN_CATALOGO
  };
}
