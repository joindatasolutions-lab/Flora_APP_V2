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

// === RENDERIZAR CATÁLOGO ===
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
  state.domicilio = state.barrios[barrioSel] || 0;
  renderDrawerCart();
}

function actualizarDomicilio() {
  const barrioSel = document.getElementById("barrio").value;
  state.domicilio = state.barrios[barrioSel] || 0;
  renderDrawerCart();
}

// === CARRITO ===
function addToCart(prod) {
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
    timer: 1200,
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

// === FIRMA MENSAJE ===
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
});

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
    if (data && data.cliente) {
      setClienteBadge(true);
      autofillCliente(data.cliente);
    } else {
      setClienteBadge(false);
      limpiarCliente(false);
    }
  } catch (err) {
    console.error("Error al buscar cliente:", err);
    setClienteBadge(null);
  }
}

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

function toggleFirma() {
  const firmado = document.getElementById("firmado").value;
  const nombreFirma = document.getElementById("nombreFirma");
  nombreFirma.parentElement.style.display = (firmado === "Firmado") ? "block" : "none";
  if (firmado === "Anónimo") nombreFirma.value = "";
}

// === ENVÍO DEL FORMULARIO ===
document.getElementById("pedidoForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (state.cart.length === 0) {
    Swal.fire("Carrito vacío", "Agrega al menos un producto antes de enviar el pedido.", "warning");
    return;
  }

  const formData = new FormData(e.target);

  // 🧩 Agregar productos al payload
  const productos = state.cart.map(p => `${p.qty}× ${p.name}`).join(" | ");
  const cantidad = state.cart.reduce((a, p) => a + p.qty, 0);
  const subtotal = state.cart.reduce((a, p) => a + (p.price * p.qty), 0);
  const iva = state.iva || 0;
  const domicilio = state.domicilio || 0;
  const total = subtotal + iva + domicilio;

  // 🧩 Enviar campos esperados por Apps Script
  formData.append("producto", productos);
  formData.append("cantidad", cantidad);
  formData.append("precio", subtotal);
  formData.append("iva", iva);
  formData.append("domicilio", domicilio);
  formData.append("total", total);

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
  }
});

// === ACTUALIZAR IVA AL CAMBIAR IDENTIFICACIÓN ===
document.getElementById("tipoIdent").addEventListener("change", () => renderDrawerCart());

// === CARGA INICIAL ===
init();
