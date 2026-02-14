const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdixPJBCFos9aUaUT_NDxQ2ZMW3s2CXoQ0KRNVNe8aYmaXtTSONvKgPRXIFcFpSSmO/exec";
const IMG_FALLBACK = "https://via.placeholder.com/360x200?text=Sin+imagen";

const dom = {
  contenedor: document.getElementById('contenedor-domicilios'),
  toast: document.getElementById('toast'),
  buscar: document.getElementById('buscarPedido'),
  filtroEstado: document.getElementById('filtroEstado'),
  filtroDomiciliario: document.getElementById('filtroDomiciliario'),
  btnRefresh: document.getElementById('btnRefresh'),
  statsCount: document.getElementById('statsCount'),
  statsInfo: document.getElementById('statsInfo'),
  lastUpdate: document.getElementById('lastUpdate'),
  modal: document.getElementById('modalExterno'),
  btnGuardar: document.getElementById('btnRegistrarExterno'),
  btnCancelar: document.getElementById('btnCancelarExterno'),
  nombreExterno: document.getElementById('nombreExterno'),
  telefonoExterno: document.getElementById('telefonoExterno')
};

const state = {
  cache: [],
  timer: null
};

const mostrarToast = msg => {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2800);
};

const setLoading = isLoading => {
  if (!dom.contenedor) return;
  if (isLoading) {
    dom.contenedor.innerHTML = `
      <div class="skeleton-grid">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
  }
  if (dom.buscar) dom.buscar.disabled = isLoading;
  if (dom.filtroEstado) dom.filtroEstado.disabled = isLoading;
  if (dom.filtroDomiciliario) dom.filtroDomiciliario.disabled = isLoading;
  if (dom.btnRefresh) dom.btnRefresh.disabled = isLoading;
};

const normalizarTexto = value => {
  return (value ?? "")
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "");
};

const formatearFechaEntrega = pedido => {
  const raw =
    pedido.fechaEntrega ||
    pedido.fecha_entrega ||
    pedido.fecha ||
    pedido["FechaEntrega"] ||
    pedido["Fecha Entrega"] ||
    pedido["Fecha de entrega"] ||
    '';
  const texto = (raw ?? '').toString().trim();
  if (!texto) return '—';
  const parsed = new Date(texto);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  return texto;
};

const ordenarUnicos = valores => {
  return Array.from(new Set(valores)).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );
};

const fillSelect = (select, options, defaultLabel) => {
  if (!select) return;
  const current = select.value || 'Todos';
  select.innerHTML = '';
  const opDefault = document.createElement('option');
  opDefault.value = 'Todos';
  opDefault.textContent = defaultLabel;
  select.appendChild(opDefault);
  options.forEach(value => {
    const op = document.createElement('option');
    op.value = value;
    op.textContent = value;
    if (value === current) op.selected = true;
    select.appendChild(op);
  });
};

const actualizarFiltros = data => {
  const estados = ordenarUnicos(
    data.map(p => (p.estado || 'Pendiente').toString().trim())
  );
  const domiciliarios = ordenarUnicos(
    data.map(p => (p.domiciliario || 'Sin asignar').toString().trim())
  );
  fillSelect(dom.filtroEstado, estados, 'Todos los estados');
  fillSelect(dom.filtroDomiciliario, domiciliarios, 'Todos los domiciliarios');
};

const actualizarStats = (total, visibles) => {
  if (dom.statsCount) dom.statsCount.textContent = String(visibles);
  if (dom.statsInfo) {
    dom.statsInfo.textContent = total === visibles
      ? ''
      : `Mostrando ${visibles} de ${total}`;
  }
};

const actualizarUltimaActualizacion = () => {
  if (!dom.lastUpdate) return;
  const now = new Date();
  dom.lastUpdate.textContent = `Actualizado: ${now.toLocaleString('es-CO', { hour12: false })}`;
};

const actualizarEnCache = (pedidoId, patch) => {
  const id = String(pedidoId ?? '');
  const item = state.cache.find(p => String(p["N°Pedido"] ?? p.pedido ?? '') === id);
  if (item) Object.assign(item, patch);
};

const filtrosActivos = () => {
  const q = dom.buscar?.value?.trim();
  const est = dom.filtroEstado?.value || 'Todos';
  const domi = dom.filtroDomiciliario?.value || 'Todos';
  return Boolean(q) || est !== 'Todos' || domi !== 'Todos';
};

const filtrarData = data => {
  let filtrados = [...data];
  const estado = dom.filtroEstado?.value || 'Todos';
  const domiciliario = dom.filtroDomiciliario?.value || 'Todos';
  if (estado !== 'Todos') {
    filtrados = filtrados.filter(p => normalizarTexto(p.estado) === normalizarTexto(estado));
  }
  if (domiciliario !== 'Todos') {
    filtrados = filtrados.filter(p => normalizarTexto(p.domiciliario || 'Sin asignar') === normalizarTexto(domiciliario));
  }
  const q = normalizarTexto(dom.buscar?.value || '').trim();
  if (q) {
    filtrados = filtrados.filter(pedido => {
      const campos = [
        pedido["N°Pedido"],
        pedido.pedido,
        pedido.destinatario,
        pedido.barrio,
        pedido.producto,
        pedido.direccion,
        pedido.telefonoDestino,
        pedido.telefono,
        pedido.domiciliario,
        pedido.estado
      ];
      return campos.some(campo => normalizarTexto(campo).includes(q));
    });
  }
  return filtrados;
};

const aplicarFiltros = () => {
  const filtrados = filtrarData(state.cache);
  renderizarDomicilios(filtrados, { filtrosActivos: filtrosActivos() });
  actualizarStats(state.cache.length, filtrados.length);
};

const parseResponse = async res => {
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (err) { data = null; }
  return { raw, data };
};

const isOkResponse = (res, data, keywords) => {
  const statusValue = (data?.status || data?.result || data?.message || '').toString().toLowerCase();
  const flag = data?.success === true || data?.ok === true;
  const text = keywords.test(statusValue);
  return res.ok && (flag || text || data === null || statusValue === '');
};

function setupBuscador() {
  if (!dom.buscar) return;
  dom.buscar.addEventListener('input', () => {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => aplicarFiltros(), 160);
  });
}

function setupFiltros() {
  if (dom.filtroEstado) dom.filtroEstado.addEventListener('change', aplicarFiltros);
  if (dom.filtroDomiciliario) dom.filtroDomiciliario.addEventListener('change', aplicarFiltros);
  if (dom.btnRefresh) dom.btnRefresh.addEventListener('click', () => cargarDomicilios());
}

async function cargarDomicilios(){
  try{
    setLoading(true);
    const res = await fetch(`${SCRIPT_URL}?hoja=Domicilios`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.cache = Array.isArray(data) ? data : [];
    actualizarFiltros(state.cache);
    aplicarFiltros();
    actualizarUltimaActualizacion();
  }catch(e){
    console.error(e);
    if (dom.contenedor) {
      dom.contenedor.innerHTML = `
        <div class="empty-state">
          <strong>No se pudieron cargar los pedidos</strong>
          Revisa tu conexion e intenta de nuevo.
        </div>
      `;
    }
    mostrarToast('Error cargando pedidos');
  } finally {
    setLoading(false);
  }
}

async function asignarDomiciliario(pedido, domiciliario){
  if(!domiciliario) return false;
  try {
    const body = new URLSearchParams({
      accion:'asignarDomiciliario',
      hoja:'Domicilios',
      pedido:String(pedido),
      domiciliario
    });
    const res = await fetch(SCRIPT_URL, { method:'POST', body });
    const { data } = await parseResponse(res);
    const ok = isOkResponse(res, data, /ok|success|asignado/);
    if (ok) {
      mostrarToast('Domiciliario asignado');
      actualizarEnCache(pedido, { domiciliario });
      aplicarFiltros();
      return true;
    }
    mostrarToast(data?.message || 'No se pudo asignar');
    return false;
  } catch (e) {
    console.error(e);
    mostrarToast('Error al asignar');
    return false;
  }
}

function abrirModalExterno(pedido, select) {
  if (!dom.modal) return;
  dom.modal.style.display = 'flex';
  dom.modal.setAttribute('aria-hidden', 'false');

  if (dom.nombreExterno) dom.nombreExterno.value = "";
  if (dom.telefonoExterno) dom.telefonoExterno.value = "";

  if (!dom.btnGuardar || !dom.btnCancelar) return;

  dom.btnGuardar.onclick = async () => {
    const nombre = dom.nombreExterno ? dom.nombreExterno.value.trim() : "";
    const tel = dom.telefonoExterno ? dom.telefonoExterno.value.trim() : "";
    if (!nombre || !tel) {
      mostrarToast("Completa todos los campos");
      return;
    }

    try {
      const body = new URLSearchParams({
        accion: "registrarExterno",
        Nombre: nombre,
        Telefono: tel,
        pedido: String(pedido)
      });

      const res = await fetch(SCRIPT_URL, { method: "POST", body });
      const { data } = await parseResponse(res);
      const ok = isOkResponse(res, data, /ok|success|registrado/);

      if (ok) {
        mostrarToast(`Externo asignado: ${nombre}`);
        select.value = "Externo";
        select.title = `${nombre} (${tel})`;
        select.disabled = true;
        select.style.background = "#f5f5f5";
        select.style.cursor = "not-allowed";
        dom.modal.style.display = "none";
        dom.modal.setAttribute('aria-hidden', 'true');
        actualizarEnCache(pedido, { domiciliario: 'Externo' });
        aplicarFiltros();
      } else {
        mostrarToast(data?.message || "No se pudo registrar");
      }
    } catch (err) {
      console.error(err);
      mostrarToast("Error al registrar externo");
    }
  };

  dom.btnCancelar.onclick = () => {
    dom.modal.style.display = "none";
    dom.modal.setAttribute('aria-hidden', 'true');
    select.value = 'Asignar domiciliario';
  };
}

function renderizarDomicilios(domicilios, options = {}) {
  if (!dom.contenedor) return;
  dom.contenedor.innerHTML = '';

  if (!domicilios?.length) {
    dom.contenedor.innerHTML = `
      <div class="empty-state">
        <strong>${options.filtrosActivos ? 'Sin resultados' : 'No hay pedidos'}</strong>
        ${options.filtrosActivos ? 'Prueba con otros filtros o busca algo diferente.' : 'No se encontraron pedidos disponibles.'}
      </div>
    `;
    return;
  }

  const grupos = {};
  domicilios.forEach(d => {
    const domi = (d.domiciliario || 'Sin asignar').trim();
    if (!grupos[domi]) grupos[domi] = [];
    grupos[domi].push(d);
  });

  for (const [domiciliario, pedidos] of Object.entries(grupos)) {
    const grupoDiv = document.createElement('div');
    grupoDiv.classList.add('grupo');
    grupoDiv.innerHTML = `<h3>${domiciliario} <small>(${pedidos.length})</small></h3>`;

    const contenedorGrupo = document.createElement('div');
    contenedorGrupo.classList.add('contenedor-grupo');
    contenedorGrupo.dataset.domiciliario = domiciliario;

    pedidos.forEach(pedido => {
      const num = pedido["N°Pedido"] || pedido.pedido;
      const est = pedido.estado || 'Pendiente';
      const estClase = est.toLowerCase().replace(/\s+/g, '_');
      const btnTxt = est === 'Pendiente' ? 'En Ruta' : est === 'En Ruta' ? 'Entregado' : 'Entregado';
      const btnClass = /entregado/i.test(est) ? 'btn-estado entregado' : 'btn-estado';
      const domi = (pedido.domiciliario || '').trim();
      const valorActual = domi || 'Asignar domiciliario';

      const imgSrc = pedido.imagen || IMG_FALLBACK;
      const producto = pedido.producto || 'Producto';
      const fechaEntrega = formatearFechaEntrega(pedido);

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="encabezado">
          <div class="pedido-num">Pedido #${num}</div>
          <div class="estado ${estClase}">${est}</div>
        </div>
        <div class="img-wrap">
          <img src="${imgSrc}" class="img-card" alt="${producto}" loading="lazy">
        </div>
        <div class="detalle">
          <h3>${producto}</h3>
          <p><strong>Destinatario:</strong> ${pedido.destinatario || '—'}</p>
          <p><strong>Direccion:</strong> ${pedido.direccion || '—'}</p>
          <p><strong>Barrio:</strong> ${pedido.barrio || '—'}</p>
          <p><strong>Telefono:</strong> ${pedido.telefonoDestino || pedido.telefono || '—'}</p>
          <p class="meta-row"><strong>Entrega:</strong> <span class="fecha-entrega">${fechaEntrega}</span></p>
        </div>
      `;

      if (!/entregado/i.test(est)) {
        const acciones = document.createElement('div');
        acciones.className = 'acciones';
        acciones.innerHTML = `
          <select>
            <option ${valorActual === 'Asignar domiciliario' ? 'selected' : ''}>Asignar domiciliario</option>
            <option ${valorActual === 'Elvis' ? 'selected' : ''}>Elvis</option>
            <option ${valorActual === 'Oscar' ? 'selected' : ''}>Oscar</option>
            <option ${valorActual === 'Externo' ? 'selected' : ''}>Externo</option>
          </select>
          <button class="${btnClass}">${btnTxt}</button>
        `;
        const select = acciones.querySelector('select');
        const boton = acciones.querySelector('button');
        const badge = card.querySelector('.estado');

        if (valorActual !== 'Asignar domiciliario') {
          select.disabled = true;
          select.style.background = "#f5f5f5";
          select.style.cursor = "not-allowed";
        }

        select.addEventListener('change', async () => {
          if (select.value === 'Asignar domiciliario') return;
          if (select.value === 'Externo') abrirModalExterno(num, select);
          else {
            select.disabled = true;
            const ok = await asignarDomiciliario(num, select.value);
            if (!ok) {
              select.disabled = false;
              select.value = 'Asignar domiciliario';
            }
          }
        });

        boton.addEventListener('click', async () => {
          const nuevoEstado = badge.textContent === 'Pendiente' ? 'En Ruta' : 'Entregado';
          const originalText = boton.textContent;
          boton.disabled = true;
          const ok = await actualizarEstado(num, nuevoEstado, boton, originalText);
          if (!ok) {
            boton.disabled = false;
            boton.textContent = originalText;
          }
        });

        card.appendChild(acciones);
      }

      contenedorGrupo.appendChild(card);
    });

    grupoDiv.appendChild(contenedorGrupo);
    dom.contenedor.appendChild(grupoDiv);
  }
}

async function actualizarEstado(pedido, nuevoEstado, boton, originalText) {
  boton.textContent = "Actualizando...";
  try {
    const body = new URLSearchParams({
      accion: 'actualizarEstado',
      hoja: 'Domicilios',
      pedido: String(pedido),
      estado: nuevoEstado
    });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const { data } = await parseResponse(res);
    const ok = isOkResponse(res, data, /ok|success|actualizado|actualizada/);

    if (ok) {
      actualizarEnCache(pedido, { estado: nuevoEstado });
      aplicarFiltros();
      mostrarToast(nuevoEstado === 'Entregado' ? 'Pedido entregado' : 'Estado actualizado');
      return true;
    }
    mostrarToast(data?.message || 'Error al actualizar');
    boton.textContent = originalText;
    return false;
  } catch (e) {
    console.error(e);
    mostrarToast('Error de conexion');
    boton.textContent = originalText;
    return false;
  }
}

function init() {
  setupBuscador();
  setupFiltros();
  cargarDomicilios();
}

init();
