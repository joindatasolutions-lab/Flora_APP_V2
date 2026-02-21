/**
 * Tests para el módulo de catálogo (script.js)
 * Ejecutar con: npm test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  fmtCOP,
  extraerEmailDeData,
  SCRIPT_URL,
  ORIGEN_CATALOGO
} = require('../script.js');

describe('fmtCOP - Formateo de moneda colombiana', () => {
  it('debe formatear números correctamente con separadores de miles', () => {
    assert.strictEqual(fmtCOP(1000), '1.000');
    assert.strictEqual(fmtCOP(50000), '50.000');
    assert.strictEqual(fmtCOP(1000000), '1.000.000');
  });

  it('debe manejar ceros y valores falsy', () => {
    assert.strictEqual(fmtCOP(0), '0');
    assert.strictEqual(fmtCOP(null), '0');
    assert.strictEqual(fmtCOP(undefined), '0');
    assert.strictEqual(fmtCOP(''), '0');
  });

  it('debe convertir strings numéricos', () => {
    assert.strictEqual(fmtCOP('1500'), '1.500');
    assert.strictEqual(fmtCOP('100000'), '100.000');
  });

  it('debe manejar decimales', () => {
    const result = fmtCOP(1234.56);
    // El formato puede variar según locale, pero debe incluir el número
    assert.ok(result.includes('1') && result.includes('234'));
  });

  it('debe manejar números negativos', () => {
    const result = fmtCOP(-5000);
    assert.ok(result.includes('5') && result.includes('000'));
  });
});

describe('extraerEmailDeData - Extracción de email de objetos', () => {
  it('debe extraer email de campo directo "email"', () => {
    const data = { email: 'usuario@example.com' };
    assert.strictEqual(extraerEmailDeData(data), 'usuario@example.com');
  });

  it('debe extraer email de campo "correo"', () => {
    const data = { correo: 'cliente@flora.com' };
    assert.strictEqual(extraerEmailDeData(data), 'cliente@flora.com');
  });

  it('debe extraer email con mayúsculas "Email"', () => {
    const data = { Email: 'test@mail.com' };
    assert.strictEqual(extraerEmailDeData(data), 'test@mail.com');
  });

  it('debe buscar en campos que contengan "email" en el nombre', () => {
    const data = { emailCliente: 'user@test.com' };
    assert.strictEqual(extraerEmailDeData(data), 'user@test.com');
  });

  it('debe buscar en campos que contengan "correo" en el nombre', () => {
    const data = { correoElectronico: 'admin@site.com' };
    assert.strictEqual(extraerEmailDeData(data), 'admin@site.com');
  });

  it('debe buscar en cualquier campo que tenga email en el nombre (case insensitive)', () => {
    const data = { 
      nombre: 'Juan',
      MiEmail: 'juan@example.com',
      telefono: '123456'
    };
    assert.strictEqual(extraerEmailDeData(data), 'juan@example.com');
  });

  it('debe buscar en cualquier campo con "correo" en el nombre (case insensitive)', () => {
    const data = { 
      nombre: 'Maria',
      miCorreo: 'maria@test.com'
    };
    assert.strictEqual(extraerEmailDeData(data), 'maria@test.com');
  });

  it('debe retornar string vacío si no hay email', () => {
    const data = { nombre: 'Juan', telefono: '123456' };
    assert.strictEqual(extraerEmailDeData(data), '');
  });

  it('debe retornar string vacío con objeto vacío', () => {
    assert.strictEqual(extraerEmailDeData({}), '');
  });

  it('debe retornar string vacío con null', () => {
    assert.strictEqual(extraerEmailDeData(null), '');
  });

  it('debe retornar string vacío con undefined', () => {
    assert.strictEqual(extraerEmailDeData(undefined), '');
  });

  it('debe retornar string vacío con valores no-objeto', () => {
    assert.strictEqual(extraerEmailDeData('string'), '');
    assert.strictEqual(extraerEmailDeData(123), '');
    assert.strictEqual(extraerEmailDeData(true), '');
  });

  it('debe validar que el valor contenga @ antes de retornarlo', () => {
    const data = { email: 'sinArroba' };
    assert.strictEqual(extraerEmailDeData(data), '');
  });

  it('debe eliminar espacios en blanco con trim()', () => {
    const data = { email: '  usuario@test.com  ' };
    assert.strictEqual(extraerEmailDeData(data), 'usuario@test.com');
  });

  it('debe priorizar campos directos sobre búsqueda genérica', () => {
    const data = { 
      email: 'directo@test.com',
      otroEmail: 'secundario@test.com'
    };
    assert.strictEqual(extraerEmailDeData(data), 'directo@test.com');
  });

  it('debe ignorar valores no-string en los campos', () => {
    const data = { 
      email: 12345, // no es string
      correo: 'correcto@test.com'
    };
    assert.strictEqual(extraerEmailDeData(data), 'correcto@test.com');
  });

  it('debe manejar emails complejos válidos', () => {
    const data = { email: 'usuario.nombre+tag@dominio.subdomain.com' };
    assert.strictEqual(extraerEmailDeData(data), 'usuario.nombre+tag@dominio.subdomain.com');
  });
});

describe('Constantes de configuración', () => {
  it('SCRIPT_URL debe ser una URL válida', () => {
    assert.ok(SCRIPT_URL.startsWith('https://'));
    assert.ok(SCRIPT_URL.includes('script.google.com'));
  });

  it('ORIGEN_CATALOGO debe estar definido', () => {
    assert.strictEqual(typeof ORIGEN_CATALOGO, 'string');
    assert.strictEqual(ORIGEN_CATALOGO, 'normal');
  });
});

describe('Integración - Flujo de datos típico', () => {
  it('debe formatear precios extraídos de un catálogo simulado', () => {
    const producto = { name: 'Flora Box', price: 85000 };
    const precioFormateado = fmtCOP(producto.price);
    assert.strictEqual(precioFormateado, '85.000');
  });

  it('debe extraer email de formulario de pedido', () => {
    const formData = {
      nombre: 'Cliente',
      telefono: '3001234567',
      email: 'cliente@flora.com',
      direccion: 'Calle 123'
    };
    const email = extraerEmailDeData(formData);
    assert.strictEqual(email, 'cliente@flora.com');
  });

  it('debe manejar múltiples productos con formateo de precios', () => {
    const productos = [
      { name: 'Box 1', price: 50000 },
      { name: 'Box 2', price: 75000 },
      { name: 'Box 3', price: 120000 }
    ];

    const preciosFormateados = productos.map(p => fmtCOP(p.price));
    
    assert.strictEqual(preciosFormateados[0], '50.000');
    assert.strictEqual(preciosFormateados[1], '75.000');
    assert.strictEqual(preciosFormateados[2], '120.000');
  });
});
