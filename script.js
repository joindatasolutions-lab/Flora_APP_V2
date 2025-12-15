// === CONFIGURACIÓN GENERAL ===
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxmJTD-hah5be-RiDETQSglkQOzDfc6muSPvHjtv_ADvEiRbpJuvkJfFzbhpJjvXxUP/exec";
const state = {
  catalogo: [],
  barrios: {},
  cart: [],
  domicilio: 0,
  iva: 0,
};
const fmtCOP = v => Number(v || 0).toLocaleString('es-CO');

// === INICIALIZACIÓN ===
async function init() {
  try {
    const res = await fetch(SCRIPT_URL);
    const data = await res.json();
    state.catalogo = data.catalogo || [];
    state.barrios = data.barrios || {};
    renderCatalog();
    fillBarrios();
  } catch (error) {
    console.error("Error al cargar datos:", error);
    Swal.fire("Error", "No se pudieron cargar los datos del catálogo", "error");
  }
}

/*
function setDefaultFechaHora() {
  const fechaInput = document.getElementById("fechaEntrega");
  const horaInput = document.getElementById("horaEntrega");

  const now = new Date();

  // 🟢 Fecha actual en formato YYYY-MM-DD
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const fechaActual = `${yyyy}-${mm}-${dd}`;

  // 🟢 Hora +2 horas y +5 minutos
  const futura = new Date(now.getTime() + (2 * 60 + 5) * 60000);
  const hh = String(futura.getHours()).padStart(2, "0");
  const min = String(futura.getMinutes()).padStart(2, "0");
  const horaFutura = `${hh}:${min}`;

  if (fechaInput) fechaInput.value = fechaActual;
  if (horaInput) horaInput.value = horaFutura;
}*/


// === RENDERIZAR CATÁLOGO ==
function renderCatalog() {
  const cont = document.getElementById("catalogo");
  cont.innerHTML = "";
  state.catalogo.forEach(prod => {
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
      </div>`;
    card.querySelector(".btn-add").addEventListener("click", () => addToCart(prod));
    cont.appendChild(card);
  });
}

// === BUSCADOR DE PRODUCTOS ===
function filtrarCatalogo() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const cont = document.getElementById("catalogo");
  cont.innerHTML = "";

  // Si no hay texto, mostramos todo el catálogo
  const productosFiltrados = query
    ? state.catalogo.filter(p => p.name.toLowerCase().includes(query))
    : state.catalogo;

  if (productosFiltrados.length === 0) {
    cont.innerHTML = `<p style="text-align:center;color:#888;">No se encontraron productos con "${query}" 😔</p>`;
    return;
  }

  productosFiltrados.forEach(prod => {
    if (!prod.img) return;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${prod.img}" alt="${prod.name}">
      <div class="body">
        <div class="name">${prod.name}</div>
        <div class="price">$${fmtCOP(prod.price)}</div>
        <button class="btn-add">Agregar al carrito</button>
      </div>`;
    card.querySelector(".btn-add").addEventListener("click", () => addToCart(prod));
    cont.appendChild(card);
  });
}


// === BARRIOS ===
function fillBarrios() {
  const sel = document.getElementById("barrio");
  sel.innerHTML = '<option value="">Selecciona un barrio...</option>';

  // 🔤 Ordenar los barrios alfabéticamente
  const barriosOrdenados = Object.keys(state.barrios).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );

  barriosOrdenados.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b; // solo mostramos el nombre
    sel.appendChild(opt);
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
// Inputs de fecha y hora (solo existen en el formulario)
const fechaEntregaInput = document.getElementById("fechaEntrega");
//const horaEntregaInput  = document.getElementById("horaEntrega");

// Evita errores cuando la página es el catálogo
/*if (horaEntregaInput) {
    horaEntregaInput.addEventListener("change", validarHoraEntrega);
}

if (fechaEntregaInput && horaEntregaInput) {
    fechaEntregaInput.addEventListener("change", () => {
        horaEntregaInput.value = "";
    });
}*/

/*
function validarHoraEntrega() {
  const fechaStr = fechaEntregaInput.value; 
  const horaStr = horaEntregaInput.value;

  if (!fechaStr || !horaStr) return;

  const ahora = new Date();
  const fechaSeleccionada = new Date(fechaStr + "T" + horaStr + ":00");

  // Verifica si la fecha seleccionada es hoy
  const esHoy =
    fechaSeleccionada.getFullYear() === ahora.getFullYear() &&
    fechaSeleccionada.getMonth() === ahora.getMonth() &&
    fechaSeleccionada.getDate() === ahora.getDate();

  if (esHoy) {
    const horaMinima = new Date(ahora.getTime() + 2 * 60 * 60 * 1000); // +2 horas exactas

    if (fechaSeleccionada < horaMinima) {
      Swal.fire({
        icon: "warning",
        title: "Hora no válida ⏰",
        text: "La hora de entrega debe ser al menos 2 horas después de la hora actual.",
      });
      horaEntregaInput.value = "";
    }
  }
}*/


// Escuchar cambios
//horaEntregaInput.addEventListener("change", validarHoraEntrega);
fechaEntregaInput.addEventListener("change", () => {
  // Limpiar hora si cambia la fecha
  horaEntregaInput.value = "";
});


// === CARRITO ===
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
const drawer = document.getElementById("drawerCarrito");
document.getElementById("btnDrawer").onclick = () => {
  renderDrawerCart();
  drawer.classList.add("open");
};
document.getElementById("cerrarDrawer").onclick = () => drawer.classList.remove("open");
document.getElementById("vaciarCarrito").onclick = vaciarCarrito;

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

  // 🟢 Si es el formulario → asignar fecha y hora por defecto
  if (id === "viewForm") {
  const fechaInput = document.getElementById("fechaEntrega");
  if (fechaInput && !fechaInput.value) {
    fechaInput.value = new Date().toISOString().split("T")[0];
  }
}
}

document.getElementById("btnPedidoDrawer").onclick = () => {
  drawer.classList.remove("open");
  const resumen = state.cart.map(p => `${p.qty}x ${p.name}`).join(" | ");
  const subtotal = state.cart.reduce((a, b) => a + b.price * b.qty, 0);
  document.getElementById("resumenProducto").textContent =
    `🛍 ${resumen} — Subtotal: $${fmtCOP(subtotal)} + Domicilio: $${fmtCOP(state.domicilio)}`;
  show("viewForm");
};

document.getElementById("btnVolver").addEventListener("click", () => show("viewCatalog"));

/*// === FIRMA MENSAJE ===
document.getElementById("firmaMensaje").addEventListener("change", e => {
  const campo = document.getElementById("campoFirmaWrapper");
  if (e.target.value === "Firmado") {
    campo.style.display = "block";
    document.getElementById("nombreFirma").required = true;
  } else {
    campo.style.display = "none";
    document.getElementById("nombreFirma").required = false;
    document.getElementById("nombreFirma").value = "";
  }
});*/

// === DETECCIÓN Y AUTOCOMPLETADO DE CLIENTE EXISTENTE ===
let lookupTimer = null;

document.getElementById("identificacion").addEventListener("input", e => {
  clearTimeout(lookupTimer);
  const val = e.target.value.trim();
  if (!val) {
    setClienteBadge(null);
    return;
  }
  lookupTimer = setTimeout(() => buscarCliente(val), 300);
});

async function buscarCliente(ident) {
  try {
    const res = await fetch(`${SCRIPT_URL}?cliente=${encodeURIComponent(ident)}`);
    const data = await res.json();

    if (data && data.found) {
      setClienteBadge(true);

      // autocompletar con los nombres reales que devuelve el Apps Script
      document.getElementById("primerNombre").value = data.primerNombre || "";
      document.getElementById("primerApellido").value = data.primerApellido || "";
      document.getElementById("telefono").value = data.telefono || "";
      if (document.getElementById("email")) {
        document.getElementById("email").value = data.email || "";
      }
    } else {
      setClienteBadge(false);
      limpiarCliente(false);
    }
  } catch (err) {
    console.error("Error al buscar cliente:", err);
    setClienteBadge(null);
  }
}

// prueba commit
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

/*
function toggleFirma() {
  const firmado = document.getElementById("firmado").value;
  const nombreFirma = document.getElementById("nombreFirma");
  nombreFirma.parentElement.style.display = (firmado === "Firmado") ? "block" : "none";
  if (firmado === "Anónimo") nombreFirma.value = "";
}*/

// === ENVÍO DEL FORMULARIO ===
document.getElementById("pedidoForm").addEventListener("submit", async e => {
  e.preventDefault();

  const btnSubmit = document.getElementById("btnSubmit");
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Procesando pedido..."; // ⏳ Cambia el texto

  // 📌 PRIMERO crear formData (ESTE ERA EL PROBLEMA)
  const formData = new FormData(e.target);

  // ===============================
  // HORA DE ENTREGA FIJA DESDE SCRIPT
  // ===============================
  formData.set("Hora de Entrega", "00:00:00");


  // ============================================================
  // 2. PASAR DESCRIPCIÓN PERSONALIZADA A "observaciones"
  // ============================================================

  const esPersonalizado =
      state.cart.length === 1 &&
      state.cart[0].name === "Arreglo Personalizado";

  if (esPersonalizado) {
      const textoPersonalizado =
          document.getElementById("detallePersonalizado").value.trim();

      if (!textoPersonalizado) {
          Swal.fire("Falta descripción", "Debes describir tu arreglo personalizado.", "warning");
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Confirmar pedido";
          return;
      }

      // 🟢 Guardar descripción en Observaciones
      formData.set("observaciones", textoPersonalizado);

  } else {
    // Para arreglos normales → Observaciones viene del input que reemplazó la firma
    const observacionesNormal = document.getElementById("mensaje").value.trim();
    formData.set("observaciones", "");
  }
  /*
  // ============================================================
  // 3. FIRMA DEL MENSAJE → NombreFirma + firmado
  // ============================================================
  const firmaTexto = document.getElementById("nombreFirma")?.value.trim() || "";

  // Guardar lo que la persona escribió como firma
  formData.set("NombreFirma", firmaTexto);

  // Si escribió firma → firmado = "Firmado"
  // Si no escribió → firmado = ""
  if (firmaTexto !== "") {
      formData.set("firmado", "Firmado");
  } else {
      formData.set("firmado", "");
  }*/

  // ===============================
  // FIRMA Y OBSERVACIONES (NUEVO)
  // ===============================
  const firma = document.getElementById("firma")?.value.trim() || "";
  const observaciones = document.getElementById("observaciones")?.value.trim() || "";

  formData.set("firma", firma);
  formData.set("observaciones", observaciones);    

  // ============================================================
  // Validación: carrito vacío
  // ============================================================
  if (state.cart.length === 0) {
    Swal.fire("Carrito vacío", "Agrega al menos un producto antes de enviar el pedido.", "warning");
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Confirmar pedido"; // 🔁 Restablecer
    return;
  }

  // ============================================================
  // 🔥 1. NORMALIZAR EL TELÉFONO DEL CLIENTE (indicativo + número)
  // ============================================================
  const indicativo = document.getElementById("indicativo")?.value || "+57";
  let telefonoCliente = document.getElementById("telefono").value.trim();

  if (telefonoCliente && !telefonoCliente.startsWith("+")) {
    telefonoCliente = indicativo + telefonoCliente;
  }

  formData.set("telefono", telefonoCliente);

  // ============================================================
  // 3. Dirección final (dirección + tipoLugar)
  // ============================================================
  const direccion = document.getElementById("direccion")?.value.trim() || "";
  const tipoLugar = document.querySelector('input[name="tipoLugar"]:checked')?.value || "";
  const direccionFinal = tipoLugar ? `${direccion} - ${tipoLugar}` : direccion;
  formData.set("direccion", direccionFinal);

  // ============================================================
  // 4. Productos y totales
  // ============================================================
  const productos = state.cart.map(p => `${p.qty}× ${p.name}`).join(" | ");
  const cantidad = state.cart.reduce((a, p) => a + p.qty, 0);
  const subtotal = state.cart.reduce((a, p) => a + (p.price * p.qty), 0);
  const iva = state.iva || 0;
  const domicilio = state.domicilio || 0;
  const total = subtotal + iva + domicilio;

  formData.append("tipoIdent", document.getElementById("tipoIdent").value);
  formData.append("producto", productos);
  formData.append("cantidad", cantidad);
  formData.append("precio", subtotal);
  formData.append("iva", iva);
  formData.append("domicilio", domicilio);
  formData.append("total", total);

  // ============================================================
  // 5. Enviar pedido a Apps Script
  // ============================================================
  try {
    const response = await fetch(SCRIPT_URL, { method: "POST", body: formData });
    const data = await response.json();

    if (data.status === "success") {
      Swal.fire("Pedido enviado", "Tu pedido fue registrado correctamente 🌸", "success");
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


// === ACTUALIZAR IVA AL CAMBIAR IDENTIFICACIÓN ===
document.getElementById("tipoIdent").addEventListener("change", () => renderDrawerCart());

// === CARGA INICIAL ===
init();

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
document.querySelectorAll('input[name="tipoLugar"]').forEach(radio => {
  radio.addEventListener("change", () => {

    const tipo = document.querySelector('input[name="tipoLugar"]:checked')?.value;

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

      // Autollenar
      destinatario.value = `${nombre} ${apellido}`.trim();
      telefonoDestino.value = telefono;
      direccion.value = VALOR_TIENDA;

      // Si no existe el option → lo creamos
      if (![...barrioSel.options].some(o => o.value === VALOR_TIENDA)) {
        const opt = document.createElement("option");
        opt.value = VALOR_TIENDA;
        opt.textContent = VALOR_TIENDA;
        barrioSel.insertBefore(opt, barrioSel.firstChild);
      }

      // Seleccionarlo SIEMPRE
      barrioSel.value = VALOR_TIENDA;

      // Domicilio = 0
      state.domicilio = 0;
      renderDrawerCart();

      // Habilitar / deshabilitar campos (si deseas bloquearlos déjame saber)
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

      telefonoDestino.value = "";
      direccion.value = "";
      barrioSel.value = "";
    }
  });
});

// === ACTIVAR ARREGLO PERSONALIZADO ===
document.getElementById("btnIrPersonalizado").addEventListener("click", () => {
  // vaciamos carrito para que no mezcle productos normales
  state.cart = [{
    name: "Arreglo Personalizado",
    price: 0,
    qty: 1
  }];

  updateCartCount();
  renderDrawerCart();

  // mostrar formulario
  show("viewForm");

  // activar la caja personalizada
  document.getElementById("boxPersonalizado").style.display = "block";
});

// === LLAMAR INIT AUTOMÁTICAMENTE ===
document.addEventListener("DOMContentLoaded", () => {
  init();
  setDefaultFechaHora(); 
});

// === LLENAR BARRIOS ===
function fillBarrios() {
  const sel = document.getElementById("barrio");
  if (!sel) return;

  sel.innerHTML = `<option value="">Seleccionar...</option>`;

  Object.entries(state.barrios).forEach(([barrio, valor]) => {
    const op = document.createElement("option");
    op.value = barrio;
    op.textContent = `${barrio} ($${fmtCOP(valor)})`;
    sel.appendChild(op);
  });
}

// === ACTUALIZAR DOMICILIO ===
function actualizarDomicilio() {
  const sel = document.getElementById("barrio");
  const barrio = sel.value;

  state.domicilio = state.barrios[barrio] || 0;

  document.getElementById("domicilio").value = state.domicilio;

  updateCartTotals();
}
