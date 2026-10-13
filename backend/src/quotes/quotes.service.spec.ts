import { QuotesService } from './quotes.service';
import { QuoteStatus } from './entities/quote.entity';

describe('QuotesService.updateQuoteStatus — calificaciones', () => {
  const armar = (calificacionPrevia: number | null = null) => {
    const quote: any = {
      id: 'q1',
      storeId: 'tienda-1',
      status: QuoteStatus.SHIPPED,
      rating: calificacionPrevia,
      reviewComment: null,
      request: { userId: 'cliente-1' },
    };
    const quoteRepository = { findOne: jest.fn(async () => quote), save: jest.fn(async (q) => q) };
    const service = new QuotesService({} as any, quoteRepository as any, {} as any);
    return { service, quote };
  };

  it('guarda la calificación que deja el cliente al recibir el pedido', async () => {
    const { service } = armar();
    const quote = await service.updateQuoteStatus('q1', QuoteStatus.DELIVERED, 'cliente-1', false, 5, 'Muy bien');
    expect(quote.rating).toBe(5);
    expect(quote.reviewComment).toBe('Muy bien');
  });

  it.each([0, 6, -1, 4.5, 999, NaN, '5' as any, null as any, undefined as any])(
    'descarta la calificación fuera de 1 a 5 (%p)',
    async (valor) => {
      const { service } = armar();
      const quote = await service.updateQuoteStatus('q1', QuoteStatus.DELIVERED, 'cliente-1', false, valor, '');
      expect(quote.rating).toBeNull();
    },
  );

  it('la tienda no puede calificarse a sí misma al marcar la entrega', async () => {
    const { service } = armar();
    const quote = await service.updateQuoteStatus('q1', QuoteStatus.DELIVERED, 'tienda-1', true, 5, 'Soy el mejor');
    expect(quote.rating).toBeNull();
    expect(quote.reviewComment).toBeNull();
  });

  it('marcar la entrega desde la tienda no borra la calificación que el cliente ya dejó', async () => {
    const { service } = armar(4);
    const quote = await service.updateQuoteStatus('q1', QuoteStatus.DELIVERED, 'tienda-1', true);
    expect(quote.rating).toBe(4);
  });
});

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
