// ================================
// Configuración
// ================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdixPJBCFos9aUaUT_NDxQ2ZMW3s2CXoQ0KRNVNe8aYmaXtTSONvKgPRXIFcFpSSmO/exec";

// Estado local del panel
const adminState = {
  productos: [],
  originalesPorId: new Map(),
  query: ""
};

const tbodyProductos = document.getElementById("tbodyProductos");
const btnGuardar = document.getElementById("btnGuardar");
const btnRecargar = document.getElementById("btnRecargar");
const estadoMsg = document.getElementById("estadoMsg");
const searchAdmin = document.getElementById("searchAdmin");
const pendingCounter = document.getElementById("pendingCounter");
const btnActivarTodos = document.getElementById("btnActivarTodos");
const btnDesactivarTodos = document.getElementById("btnDesactivarTodos");

// Formatea números como COP para vista rápida junto al input
const fmtCOP = (valor) => Number(valor || 0).toLocaleString("es-CO");

// Normaliza texto para búsqueda por ID o nombre
function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

// Obtiene productos visibles según filtro de búsqueda actual
function obtenerProductosVisibles() {
  const query = normalizarTexto(adminState.query);
  return adminState.productos.filter((producto) => {
    if (!query) return true;

    const nombre = normalizarTexto(producto.name);
    const id = normalizarTexto(producto.id);
    return nombre.includes(query) || id.includes(query);
  });
}

// Convierte valores de hoja/API a boolean real
function normalizarActivo(valor) {
  if (typeof valor === "boolean") return valor;
  const texto = String(valor || "").trim().toLowerCase();
  return texto === "true" || texto === "1" || texto === "si" || texto === "sí";
}

// Construye el HTML del indicador de estado (pill grande)
function crearPillEstado(activo) {
  if (activo) {
    return `<span class="estado-pill-lg activo">Activo</span>`;
  }
  return `<span class="estado-pill-lg inactivo">Inactivo</span>`;
}

// Determina si un producto cambió respecto al snapshot original
function productoTieneCambios(producto) {
  const key = String(producto.id ?? "");
  const original = adminState.originalesPorId.get(key);
  if (!original) return false;

  const cambioPrecio = Number(producto.price || 0) !== Number(original.price || 0);
  const cambioEstado = Boolean(producto.activo) !== Boolean(original.activo);

  return cambioPrecio || cambioEstado;
}

// Cuenta el total global de cambios pendientes
function contarCambiosPendientes() {
  return adminState.productos.reduce((acc, prod) => {
    return acc + (productoTieneCambios(prod) ? 1 : 0);
  }, 0);
}

// Sincroniza contador y estado del botón guardar
function refrescarIndicadoresGuardado() {
  const pendientes = contarCambiosPendientes();
  pendingCounter.textContent = `${pendientes} cambio${pendientes === 1 ? "" : "s"} pendiente${pendientes === 1 ? "" : "s"}`;
  btnGuardar.disabled = pendientes === 0;
}

// Carga catálogo desde Apps Script (GET)
async function cargarProductos() {
  try {
    estadoMsg.textContent = "Cargando catálogo...";

    const res = await fetch(SCRIPT_URL, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status}`);
    }

    const data = await res.json();

    if (!data || !Array.isArray(data.catalogo)) {
      adminState.productos = [];
      renderTabla();
      estadoMsg.textContent = "La respuesta no incluye el arreglo catalogo.";
      Swal.fire("Atención", "La respuesta del servidor no incluye data.catalogo.", "warning");
      return;
    }

    const catalogo = data.catalogo;

    // Guardamos copia editable en memoria
    adminState.productos = catalogo.map((p) => ({
      id: p.id,
      name: p.name || "",
      price: Number(p.price || 0),
      img: p.img || "",
      categoria: p.categoria || "",
      activo: normalizarActivo(p.activo ?? p.ACTIVO),
      updatedAt: p.updatedAt || p.UPDATED_AT || ""
    }));

    // Snapshot original para detectar cambios en precio/estado
    adminState.originalesPorId = new Map(
      adminState.productos.map((p) => [
        String(p.id ?? ""),
        { price: Number(p.price || 0), activo: Boolean(p.activo) }
      ])
    );

    renderTabla();
    refrescarIndicadoresGuardado();
    estadoMsg.textContent = `Productos cargados: ${adminState.productos.length}`;
  } catch (error) {
    console.error("Error cargando productos:", error);
    Swal.fire("Error", "No se pudo cargar el catálogo desde Apps Script.", "error");
    estadoMsg.textContent = "Error al cargar catálogo.";
  }
}

// Alterna activo/inactivo por id y re-renderiza para conservar consistencia visual
function toggleEstado(productoId) {
  const index = adminState.productos.findIndex((p) => String(p.id) === String(productoId));
  if (index < 0) return;

  adminState.productos[index].activo = !adminState.productos[index].activo;
  renderTabla();
  refrescarIndicadoresGuardado();
}

// Render de tabla admin
function renderTabla() {
  tbodyProductos.innerHTML = "";

  const productosFiltrados = obtenerProductosVisibles();

  if (productosFiltrados.length === 0) {
    const trVacio = document.createElement("tr");
    const tdVacio = document.createElement("td");
    tdVacio.colSpan = 5;
    tdVacio.textContent = "No hay productos que coincidan con la búsqueda.";
    trVacio.appendChild(tdVacio);
    tbodyProductos.appendChild(trVacio);
    return;
  }

  productosFiltrados.forEach((producto) => {
    const tr = document.createElement("tr");
    if (productoTieneCambios(producto)) {
      tr.classList.add("row-dirty");
    }

    const tdId = document.createElement("td");
    tdId.className = "admin-id";
    tdId.textContent = producto.id;

    const tdImagen = document.createElement("td");
    const img = document.createElement("img");
    img.className = "admin-img";
    img.src = producto.img || "";
    img.alt = producto.name ? `Imagen ${producto.name}` : "Imagen del producto";
    img.loading = "lazy";
    tdImagen.appendChild(img);

    const tdNombre = document.createElement("td");
    tdNombre.textContent = producto.name;

    const tdPrecio = document.createElement("td");
    tdPrecio.className = "precio-cell";

    const inputPrecio = document.createElement("input");
    inputPrecio.type = "number";
    inputPrecio.className = "precio-input";
    inputPrecio.min = "0";
    inputPrecio.step = "1";
    inputPrecio.value = String(producto.price);

    const copLabel = document.createElement("small");
    copLabel.className = "cop-hint";
    copLabel.textContent = `COP $${fmtCOP(producto.price)}`;

    inputPrecio.addEventListener("input", (event) => {
      const nuevoValor = Number(event.target.value || 0);
      producto.price = Number.isFinite(nuevoValor) ? nuevoValor : 0;
      copLabel.textContent = `COP $${fmtCOP(producto.price)}`;

      tr.classList.toggle("row-dirty", productoTieneCambios(producto));
      refrescarIndicadoresGuardado();
    });

    tdPrecio.appendChild(inputPrecio);
    tdPrecio.appendChild(copLabel);

    const tdEstado = document.createElement("td");
    tdEstado.className = "estado-cell";

    const switchLabel = document.createElement("label");
    switchLabel.className = "switch";

    const switchInput = document.createElement("input");
    switchInput.type = "checkbox";
    switchInput.checked = Boolean(producto.activo);
    switchInput.setAttribute("aria-label", `Cambiar estado de ${producto.name || producto.id || "producto"}`);

    const slider = document.createElement("span");
    slider.className = "slider";

    switchLabel.appendChild(switchInput);
    switchLabel.appendChild(slider);

    const estadoPill = document.createElement("span");
    estadoPill.innerHTML = crearPillEstado(producto.activo);

    // Toggle ON/OFF accesible
    switchInput.addEventListener("change", (event) => {
      const indexOriginal = adminState.productos.findIndex((p) => String(p.id) === String(producto.id));
      if (indexOriginal < 0) return;

      adminState.productos[indexOriginal].activo = event.target.checked;
      producto.activo = event.target.checked;

      estadoPill.innerHTML = crearPillEstado(producto.activo);
      tr.classList.toggle("row-dirty", productoTieneCambios(producto));
      refrescarIndicadoresGuardado();
    });

    tdEstado.appendChild(switchLabel);
    tdEstado.appendChild(estadoPill);

    tr.appendChild(tdId);
    tr.appendChild(tdImagen);
    tr.appendChild(tdNombre);
    tr.appendChild(tdPrecio);
    tr.appendChild(tdEstado);

    tbodyProductos.appendChild(tr);
  });
}

// Activa todos los productos visibles con confirmación
async function activarTodos() {
  const visibles = obtenerProductosVisibles();

  if (visibles.length === 0) {
    Swal.fire("Atención", "No hay productos visibles para activar.", "info");
    return;
  }

  const resultado = await Swal.fire({
    title: "¿Activar todos los visibles?",
    text: `Se activarán ${visibles.length} producto(s) del filtro actual.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí, activar",
    cancelButtonText: "Cancelar"
  });

  if (!resultado.isConfirmed) return;

  visibles.forEach((producto) => {
    const indexOriginal = adminState.productos.findIndex((p) => String(p.id) === String(producto.id));
    if (indexOriginal >= 0) {
      adminState.productos[indexOriginal].activo = true;
    }
  });

  renderTabla();
  refrescarIndicadoresGuardado();
}

// Desactiva todos los productos visibles con confirmación
async function desactivarTodos() {
  const visibles = obtenerProductosVisibles();

  if (visibles.length === 0) {
    Swal.fire("Atención", "No hay productos visibles para desactivar.", "info");
    return;
  }

  const resultado = await Swal.fire({
    title: "¿Desactivar todos los visibles?",
    text: `Se desactivarán ${visibles.length} producto(s) del filtro actual.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí, desactivar",
    cancelButtonText: "Cancelar"
  });

  if (!resultado.isConfirmed) return;

  visibles.forEach((producto) => {
    const indexOriginal = adminState.productos.findIndex((p) => String(p.id) === String(producto.id));
    if (indexOriginal >= 0) {
      adminState.productos[indexOriginal].activo = false;
    }
  });

  renderTabla();
  refrescarIndicadoresGuardado();
}

// Guarda todos los cambios en un solo POST
async function guardarCambios() {
  try {
    if (contarCambiosPendientes() === 0) {
      Swal.fire("Atención", "No hay cambios pendientes por guardar.", "info");
      return;
    }

    const payload = {
      accion: "actualizarProductos",
      productos: adminState.productos.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        img: p.img,
        categoria: p.categoria,
        activo: Boolean(p.activo)
      }))
    };

    estadoMsg.textContent = "Guardando cambios...";

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || data.ok !== true) {
      throw new Error(data.error || `Error HTTP ${res.status}`);
    }

    Swal.fire("Éxito", "Cambios guardados correctamente.", "success");
    estadoMsg.textContent = "Cambios guardados correctamente.";

    // Recarga para refrescar snapshot y limpiar cambios pendientes
    await cargarProductos();
  } catch (error) {
    console.error("Error guardando cambios:", error);
    Swal.fire("Error", "Falló la actualización de productos.", "error");
    estadoMsg.textContent = "Error guardando cambios.";
  }
}

// Confirma navegación/cierre si hay cambios pendientes
window.addEventListener("beforeunload", (event) => {
  if (contarCambiosPendientes() > 0) {
    event.preventDefault();
  }
});

// Búsqueda en tiempo real por ID o nombre
searchAdmin.addEventListener("input", (event) => {
  adminState.query = event.target.value || "";
  renderTabla();
});

btnGuardar.addEventListener("click", guardarCambios);
btnRecargar.addEventListener("click", cargarProductos);
btnActivarTodos.addEventListener("click", activarTodos);
btnDesactivarTodos.addEventListener("click", desactivarTodos);

// Carga inicial
cargarProductos();
