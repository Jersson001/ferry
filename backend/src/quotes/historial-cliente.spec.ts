import { armarHistorial, nivelDeCliente } from './historial-cliente';

describe('nivelDeCliente', () => {
  it('es nuevo mientras no haya comprado ni pedido varias veces', () => {
    expect(nivelDeCliente(0, 0)).toBe('nuevo');
    expect(nivelDeCliente(2, 0)).toBe('nuevo');
  });

  it('pasa a activo con una entrega o con 3 solicitudes', () => {
    expect(nivelDeCliente(1, 1)).toBe('activo');
    expect(nivelDeCliente(3, 0)).toBe('activo');
  });

  it('solo es frecuente con 3 pedidos entregados, no por pedir mucho', () => {
    expect(nivelDeCliente(50, 2)).toBe('activo');
    expect(nivelDeCliente(3, 3)).toBe('frecuente');
  });
});

describe('armarHistorial', () => {
  it('convierte los textos de Postgres y descarta basura', () => {
    expect(armarHistorial('4', '1')).toEqual({ solicitudes: 4, entregados: 1, nivel: 'activo' });
    expect(armarHistorial(null, undefined)).toEqual({ solicitudes: 0, entregados: 0, nivel: 'nuevo' });
    expect(armarHistorial(-5, 'x')).toEqual({ solicitudes: 0, entregados: 0, nivel: 'nuevo' });
  });
});
