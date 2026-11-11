import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuoteChatService } from './quote-chat.service';
import { QuoteStatus } from '../entities/quote.entity';

const armar = (status: QuoteStatus = QuoteStatus.ACCEPTED) => {
  const quote = { id: 'q1', storeId: 'tienda', status, request: { userId: 'cliente' } };
  const quotes: any = { findOne: jest.fn(async () => quote) };
  const guardados: any[] = [];
  const messages: any = {
    update: jest.fn(async () => undefined),
    find: jest.fn(async () => []),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => { const m = { id: `m${guardados.length + 1}`, createdAt: new Date(), ...x }; guardados.push(m); return m; }),
  };
  const storage: any = { saveChatAttachment: jest.fn(async () => ({ url: 'https://x/chat/a.webp', type: 'image', size: 10 })) };
  const push: any = { avisarUsuario: jest.fn(async () => 1) };
  return { service: new QuoteChatService(quotes, messages, storage, push), messages, storage, push, guardados };
};

describe('QuoteChatService', () => {
  it('antes de aceptar la cotización no hay chat', async () => {
    const { service } = armar(QuoteStatus.PENDING);
    await expect(service.enviar('q1', 'cliente', { text: 'Hola' })).rejects.toThrow(BadRequestException);
  });

  it('una cotización rechazada no tiene chat', async () => {
    const { service } = armar(QuoteStatus.REJECTED);
    await expect(service.listar('q1', 'tienda')).rejects.toThrow(BadRequestException);
  });

  it('solo escriben el cliente y la ferretería de esa cotización', async () => {
    const { service } = armar();
    await expect(service.enviar('q1', 'otra-persona', { text: 'Hola' })).rejects.toThrow(ForbiddenException);
  });

  it('el cliente escribe y se avisa a la ferretería', async () => {
    const { service, push } = armar();
    const m = await service.enviar('q1', 'cliente', { text: '  ¿Tienen sifón de 1 1/2?  ' });
    expect(m.from).toBe('me');
    expect(m.text).toBe('¿Tienen sifón de 1 1/2?');
    expect(push.avisarUsuario).toHaveBeenCalledWith('tienda', expect.objectContaining({ body: '¿Tienen sifón de 1 1/2?' }));
  });

  it('la ferretería responde y se avisa al cliente', async () => {
    const { service, push } = armar(QuoteStatus.PAID);
    await service.enviar('q1', 'tienda', { text: 'Sí, ya lo separamos' });
    expect(push.avisarUsuario).toHaveBeenCalledWith('cliente', expect.anything());
  });

  it('un mensaje vacío y sin adjunto se rechaza', async () => {
    const { service } = armar();
    await expect(service.enviar('q1', 'cliente', { text: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('un texto demasiado largo se rechaza', async () => {
    const { service } = armar();
    await expect(service.enviar('q1', 'cliente', { text: 'a'.repeat(2001) })).rejects.toThrow(BadRequestException);
  });

  it('un adjunto que el almacenamiento rechaza (p. ej. un Word) devuelve 400', async () => {
    const { service, storage } = armar();
    storage.saveChatAttachment.mockRejectedValueOnce(new Error('Solo se pueden enviar imágenes (JPG, PNG, WebP) o PDF.'));
    await expect(service.enviar('q1', 'cliente', { attachment: { dataUrl: 'data:application/msword;base64,AA==', name: 'x.doc' } }))
      .rejects.toThrow('Solo se pueden enviar imágenes');
  });

  it('una imagen sin texto se guarda y el aviso lo dice', async () => {
    const { service, push } = armar();
    const m = await service.enviar('q1', 'tienda', { attachment: { dataUrl: 'data:image/png;base64,AA==', name: 'foto.png' } });
    expect(m.attachment).toEqual({ url: 'https://x/chat/a.webp', type: 'image', name: 'foto.png', size: 10 });
    expect(push.avisarUsuario).toHaveBeenCalledWith('cliente', expect.objectContaining({ body: '📷 Te envió una imagen' }));
  });

  it('abrir el chat marca como leído solo lo que mandó el otro', async () => {
    const { service, messages } = armar();
    await service.listar('q1', 'cliente');
    const [filtro] = messages.update.mock.calls[0];
    expect(filtro.quoteId).toBe('q1');
    expect(filtro.senderId).toEqual(expect.objectContaining({ _type: 'not' }));
  });

  it('mientras el cliente no paga, el chat va a ciegas', async () => {
    expect((await armar(QuoteStatus.ACCEPTED).service.listar('q1', 'cliente')).aCiegas).toBe(true);
    expect((await armar(QuoteStatus.PAID).service.listar('q1', 'cliente')).aCiegas).toBe(false);
  });
});
