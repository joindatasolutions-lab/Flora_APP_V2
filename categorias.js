function agruparPorCategoria(productos) {
  return productos.reduce((acc, prod) => {
    const categoria = prod.Categoria || prod.categoria || "Sin categoría";
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(prod);
    return acc;
  }, {});
}

function filtrarPorCategoria(productos, categoriaSeleccionada) {
  return productos.filter(prod =>
    (prod.Categoria || prod.categoria || "Sin categoría") === categoriaSeleccionada
  );
}

// Exportar para tests de Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    agruparPorCategoria,
    filtrarPorCategoria
  };
}
