import { ordenarComoSolicitud } from './quotes.service';

describe('ordenarComoSolicitud', () => {
  const pedidos = [{ name: 'CEMENTO - 25 KG' }, { name: 'Arena de río' }, { name: 'Varilla 3/8' }];

  it('pone los artículos cotizados en el orden en que se pidieron', () => {
    const cotizados = [{ name: 'Varilla 3/8' }, { name: 'cemento - 25 kg ' }, { name: 'Arena de río' }];
    expect(ordenarComoSolicitud(cotizados, pedidos).map(i => i.name)).toEqual(['cemento - 25 kg ', 'Arena de río', 'Varilla 3/8']);
  });

  it('los que no están en la solicitud van al final, sin cambiar su orden', () => {
    const cotizados = [{ name: 'Extra B' }, { name: 'Varilla 3/8' }, { name: 'Extra A' }];
    expect(ordenarComoSolicitud(cotizados, pedidos).map(i => i.name)).toEqual(['Varilla 3/8', 'Extra B', 'Extra A']);
  });

  it('sin artículos de la solicitud deja todo como llegó', () => {
    const cotizados = [{ name: 'B' }, { name: 'A' }];
    expect(ordenarComoSolicitud(cotizados, undefined)).toEqual(cotizados);
    expect(ordenarComoSolicitud(cotizados, [])).toEqual(cotizados);
  });
});
