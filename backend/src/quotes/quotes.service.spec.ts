import { QuotesService } from './quotes.service';

describe('QuotesService.createRequest — foto adjunta', () => {
  const crear = async (imageUrl: unknown) => {
    const create = jest.fn((entity) => entity);
    const save = jest.fn(async (entity) => entity);
    const service = new QuotesService({ create, save } as any, {} as any, {} as any);
    const request = await service.createRequest('user-1', {
      title: 'Pedido',
      category: 'General',
      items: [],
      deliveryAddress: 'Calle 1',
      imageUrl,
    });
    return request.imageUrl;
  };

  it('guarda la URL https que devolvió el almacenamiento', async () => {
    const url = 'https://abc.supabase.co/storage/v1/object/public/uploads/projects/u/foto.webp';
    expect(await crear(url)).toBe(url);
  });

  it('acepta la ruta local /uploads/ cuando se guarda en disco', async () => {
    expect(await crear('/uploads/projects/u/foto.webp')).toBe('/uploads/projects/u/foto.webp');
  });

  it.each([
    ['sin foto', undefined],
    ['vacía', '   '],
    ['no es texto', 123],
    ['http sin cifrar', 'http://ejemplo.com/foto.jpg'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:image/png;base64,AAAA'],
    ['demasiado larga', 'https://ejemplo.com/' + 'a'.repeat(3000)],
  ])('descarta la URL %s', async (_caso, valor) => {
    expect(await crear(valor)).toBeNull();
  });
});
