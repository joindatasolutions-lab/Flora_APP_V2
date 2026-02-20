/**
 * Mapeo dinámico de categorías según número de arreglo.
 * Escalable y reutilizable.
 */

const CATEGORIAS_MAP = [
  { nombre: 'Flora boxes', rango: [1, 32] },
  { nombre: 'Flora canasto', rango: [33, 41] },
  { nombre: 'Flora bouquets', rango: [42, 53] },
  { nombre: 'Flora corazones', rango: [54, 59] },
  { nombre: 'Madera', rango: [60, 67] },
  { nombre: 'Cerámica & vidrio', rango: [68, 71] },
  { nombre: 'Anchetas', rango: [72, 74] },
  { nombre: 'Condolencias', rango: [75, 79] },
  { nombre: 'Adicionales', rango: [80, 93] }
];

/**
 * Obtiene la categoría correspondiente a un número de arreglo.
 * @param {number} numero - Número del arreglo
 * @returns {string} - Nombre de la categoría o 'Sin categoría'
 */
function obtenerCategoria(numero) {
  if (typeof numero === 'string') {
    numero = Number.parseInt(numero, 10);
  }
  
  if (Number.isNaN(numero)) return 'Sin categoría';
  
  const cat = CATEGORIAS_MAP.find(
    c => numero >= c.rango[0] && numero <= c.rango[1]
  );
  
  return cat ? cat.nombre : 'Sin categoría';
}

/**
 * Obtiene todas las categorías disponibles.
 * @returns {array} - Array de nombres de categorías
 */
function obtenerTodasLasCategorias() {
  return CATEGORIAS_MAP.map(c => c.nombre);
}

/**
 * Enriquece un catálogo de productos con información de categoría.
 * @param {array} catalogo - Array de productos
 * @returns {array} - Catálogo enriquecido (sin modificar el original)
 */
function enriquecerCatalogoCategorias(catalogo) {
  return catalogo.map(prod => ({
    ...prod,
    categoria: obtenerCategoria(prod.id)
  }));
}

/**
 * Agrupa productos por categoría manteniendo orden.
 * @param {array} catalogo - Catálogo de productos (enriquecido con categoría)
 * @returns {object} - Objeto con categorías como keys y arrays de productos
 */
function agruparPorCategoria(catalogo) {
  const grupos = {};
  
  // Inicializar todas las categorías (preserva orden)
  CATEGORIAS_MAP.forEach(c => {
    grupos[c.nombre] = [];
  });
  
  // Asignar productos a categorías
  catalogo.forEach(prod => {
    const cat = prod.categoria || obtenerCategoria(prod.id);
    if (grupos.hasOwnProperty(cat)) {
      grupos[cat].push(prod);
    } else {
      if (!grupos['Sin categoría']) {
        grupos['Sin categoría'] = [];
      }
      grupos['Sin categoría'].push(prod);
    }
  });
  
  return grupos;
}

/**
 * Filtra productos por una o múltiples categorías.
 * @param {array} catalogo - Array de productos
 * @param {string|array} categorias - Categoría(s) a filtrar
 * @returns {array} - Productos filtrados
 */
function filtrarPorCategoria(catalogo, categorias) {
  if (!categorias) return catalogo;
  
  const cats = Array.isArray(categorias) ? categorias : [categorias];
  return catalogo.filter(prod => 
    cats.includes(prod.categoria || obtenerCategoria(prod.id))
  );
}
