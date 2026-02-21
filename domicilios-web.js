const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdixPJBCFos9aUaUT_NDxQ2ZMW3s2CXoQ0KRNVNe8aYmaXtTSONvKgPRXIFcFpSSmO/exec";
const IMG_FALLBACK = "https://via.placeholder.com/360x200?text=Sin+imagen";
const getById = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);

const dom = {
  contenedor: getById('contenedor-domicilios'),
  toast: getById('toast'),
  buscar: getById('buscarPedido'),
  filtroEstado: getById('filtroEstado'),
  filtroDomiciliario: getById('filtroDomiciliario'),
  btnRefresh: getById('btnRefresh'),
  statsCount: getById('statsCount'),
  statsInfo: getById('statsInfo'),
  lastUpdate: getById('lastUpdate'),
  modal: getById('modalExterno'),
  btnGuardar: getById('btnRegistrarExterno'),
  btnCancelar: getById('btnCancelarExterno'),
  nombreExterno: getById('nombreExterno'),
  telefonoExterno: getById('telefonoExterno')
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

const obtenerNombreExterno = pedido => {
  if (!pedido) return '';
  const posiblesCampos = [
    pedido.externoNombre,
    pedido.nombreExterno,
    pedido.NombreExterno,
    pedido.nombre_externo,
    pedido['Nombre Externo'],
    pedido['Nombre externo'],
    pedido['Domiciliario Externo'],
    pedido['Domiciliario externo'],
    pedido.domiciliarioExterno
  ];
  const nombre = posiblesCampos.find(value => (value ?? '').toString().trim());
  return (nombre ?? '').toString().trim();
};

const obtenerTelefonoExterno = pedido => {
  if (!pedido) return '';
  const posiblesCampos = [
    pedido.telefonoExterno,
    pedido.TelefonoExterno,
    pedido.telefono_externo,
    pedido['Telefono Externo'],
    pedido['Teléfono Externo'],
    pedido['Teléfono externo'],
    pedido['Telefono externo']
  ];
  const telefono = posiblesCampos.find(value => (value ?? '').toString().trim());
  return (telefono ?? '').toString().trim();
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
        pedido.zona,
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
  const valorPrevio = select?.value || 'Asignar domiciliario';
  const estabaDeshabilitado = Boolean(select?.disabled);
  const backgroundPrevio = select?.style?.background || '';
  const cursorPrevio = select?.style?.cursor || '';

  if (select) {
    select.disabled = true;
    select.style.background = "#f5f5f5";
    select.style.cursor = "not-allowed";
  }

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
        actualizarEnCache(pedido, {
          domiciliario: 'Externo',
          externoNombre: nombre,
          nombreExterno: nombre,
          telefonoExterno: tel
        });
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
    select.value = valorPrevio;
    select.disabled = estabaDeshabilitado;
    select.style.background = backgroundPrevio;
    select.style.cursor = cursorPrevio;
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
    const nombreExterno = pedidos
      .map(obtenerNombreExterno)
      .find(nombre => Boolean(nombre));
    const telefonoExterno = pedidos
      .map(obtenerTelefonoExterno)
      .find(telefono => Boolean(telefono));
    const nombreConTelefono = telefonoExterno
      ? `${nombreExterno} (${telefonoExterno})`
      : nombreExterno;
    const tituloGrupo =
      normalizarTexto(domiciliario) === normalizarTexto('Externo') && nombreExterno
        ? nombreConTelefono
        : domiciliario;

    const grupoDiv = document.createElement('div');
    grupoDiv.classList.add('grupo');
    grupoDiv.innerHTML = `<h3>${tituloGrupo} <small>(${pedidos.length})</small></h3>`;

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
      const valorActualNorm = normalizarTexto(valorActual);

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
          <p><strong>Zona:</strong> ${pedido.zona || '—'}</p>
          <p><strong>Telefono:</strong> ${pedido.telefonoDestino || pedido.telefono || '—'}</p>
          <p class="meta-row"><strong>Entrega:</strong> <span class="fecha-entrega">${fechaEntrega}</span></p>
        </div>
        <div class="observacion-box">
          <textarea 
            class="textarea-observacion" 
            placeholder="Observaciones del domiciliario... (Ej: Se entrega a portería, cliente no responde, etc.)"
            data-pedido="${num}">${pedido.observacion || ''}</textarea>
          <button class="btn-guardar-observacion" data-pedido="${num}">Guardar observación</button>
        </div>
        <div class="evidencia-box">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            class="input-foto"
            data-pedido="${num}"
            aria-label="Subir foto de entrega">
          <button class="btn-guardar-foto" data-pedido="${num}">Guardar foto</button>
          ${pedido.fotoBase64 ? `<div class="preview-foto"><img src="data:image/jpeg;base64,${pedido.fotoBase64.substring(0, 100)}..." alt="Preview" title="Foto guardada"></div>` : ''}
        </div>
      `;

      if (!/entregado/i.test(est)) {
        const acciones = document.createElement('div');
        acciones.className = 'acciones';
        acciones.innerHTML = `
          <select>
            <option ${valorActualNorm === normalizarTexto('Asignar domiciliario') ? 'selected' : ''}>Asignar domiciliario</option>
            <option ${valorActualNorm === normalizarTexto('Elvis') ? 'selected' : ''}>Elvis</option>
            <option ${valorActualNorm === normalizarTexto('Oscar') ? 'selected' : ''}>Oscar</option>
            <option ${valorActualNorm === normalizarTexto('Externo') ? 'selected' : ''}>Externo</option>
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

      // Listeners para bitácora - Observaciones
      const btnGuardarObs = card.querySelector('.btn-guardar-observacion');
      if (btnGuardarObs) {
        btnGuardarObs.addEventListener('click', async () => {
          const textareaObs = card.querySelector('.textarea-observacion');
          const observacion = textareaObs?.value?.trim() || '';
          await guardarObservacion(num, observacion, btnGuardarObs);
        });
      }

      // Listeners para bitácora - Foto
      const btnGuardarFoto = card.querySelector('.btn-guardar-foto');
      const inputFoto = card.querySelector('.input-foto');
      if (btnGuardarFoto && inputFoto) {
        inputFoto.addEventListener('change', (e) => {
          const archivo = e.target.files?.[0];
          if (archivo) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const base64 = event.target?.result;
              await guardarFotoDomicilio(num, base64, btnGuardarFoto);
            };
            reader.readAsDataURL(archivo);
          }
        });

        btnGuardarFoto.addEventListener('click', () => {
          inputFoto.click();
        });
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

async function guardarObservacion(pedido, observacion, btnElement) {
  try {
    btnElement.disabled = true;
    btnElement.textContent = "Guardando...";
    const body = new URLSearchParams({
      accion: 'guardarObservacion',
      hoja: 'Domicilios',
      pedido: String(pedido),
      observacion: observacion
    });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const { data } = await parseResponse(res);
    const ok = isOkResponse(res, data, /ok|success|guardado|guardada/);

    if (ok) {
      actualizarEnCache(pedido, { observacion });
      mostrarToast('Observación guardada');
      btnElement.textContent = "Guardar observación";
      return true;
    }
    mostrarToast(data?.message || 'Error al guardar observación');
    btnElement.textContent = "Guardar observación";
    return false;
  } catch (e) {
    console.error(e);
    mostrarToast('Error de conexión');
    btnElement.textContent = "Guardar observación";
    return false;
  } finally {
    btnElement.disabled = false;
  }
}

async function guardarFotoDomicilio(pedido, base64, btnElement) {
  try {
    btnElement.disabled = true;
    btnElement.textContent = "Guardando foto...";
    const body = new URLSearchParams({
      accion: 'guardarFotoDomicilio',
      hoja: 'Domicilios',
      pedido: String(pedido),
      imagen: base64
    });
    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const { data } = await parseResponse(res);
    const ok = isOkResponse(res, data, /ok|success|guardado|guardada|cargado|cargada/);

    if (ok) {
      actualizarEnCache(pedido, { fotoBase64: base64 });
      mostrarToast('Foto guardada');
      btnElement.textContent = "Guardar foto";
      return true;
    }
    mostrarToast(data?.message || 'Error al guardar foto');
    btnElement.textContent = "Guardar foto";
    return false;
  } catch (e) {
    console.error(e);
    mostrarToast('Error de conexión');
    btnElement.textContent = "Guardar foto";
    return false;
  } finally {
    btnElement.disabled = false;
  }
}

function init() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.error('No se pudo registrar el service worker:', err);
      });
    });
  }

  setupBuscador();
  setupFiltros();
  cargarDomicilios();
}

if (typeof document !== 'undefined') {
  init();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizarTexto,
    obtenerNombreExterno,
    obtenerTelefonoExterno,
    formatearFechaEntrega,
    ordenarUnicos,
    isOkResponse
  };
}
