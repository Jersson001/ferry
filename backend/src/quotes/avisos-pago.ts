// Textos de los avisos de pago (push y correo). Funciones puras para poder probarlas sin enviar nada.

export interface DatosPedido {
  displayId?: string | null;
  title?: string | null;
  deliveryAddress?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  storeName?: string | null;
  storeTotal: number; // Lo que recibe la ferretería: materiales + envío, en pesos
}

export interface Aviso {
  titulo: string; // Título del push y asunto del correo
  cuerpo: string; // Texto corto del push
  parrafos: string[]; // Cuerpo del correo, en texto plano
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const pedido = (d: Pick<DatosPedido, 'displayId' | 'title'>) => (d.displayId ? `#${d.displayId}` : d.title ? `"${d.title}"` : '');

export function avisosPedidoPagado(d: DatosPedido): { tienda: Aviso; cliente: Aviso } {
  const ref = pedido(d);
  const cliente = [d.clientName, d.clientPhone].filter(Boolean).join(' · ');
  return {
    tienda: {
      titulo: `¡Pedido pagado! Alista el pedido ${ref}`.trim(),
      cuerpo: `El cliente ya pagó ${pesos(d.storeTotal)}. Entra a Ferry para alistarlo y despacharlo.`,
      parrafos: [
        `El pago del pedido ${ref}${d.title && d.displayId ? ` (${d.title})` : ''} quedó confirmado. Ya puedes alistarlo.`,
        `Vas a recibir ${pesos(d.storeTotal)} por los materiales y el envío.`,
        ...(cliente ? [`Cliente: ${cliente}`] : []),
        ...(d.deliveryAddress ? [`Dirección de entrega: ${d.deliveryAddress}`] : []),
        'Cuando lo despaches, márcalo como "Enviado" en tu panel de Ferry.',
      ],
    },
    cliente: {
      titulo: `Tu pago fue confirmado ${ref}`.trim(),
      cuerpo: `${d.storeName || 'La ferretería'} ya está alistando tu pedido.`,
      parrafos: [
        `Confirmamos el pago de tu pedido ${ref}.`,
        `${d.storeName || 'La ferretería'} ya recibió la orden y está alistando los materiales. En Ferry puedes ver sus datos y escribirle por el chat.`,
      ],
    },
  };
}

export function avisoComprobanteRechazado(d: Pick<DatosPedido, 'displayId' | 'title'>): Aviso {
  const ref = pedido(d);
  return {
    titulo: `No pudimos confirmar tu pago ${ref}`.trim(),
    cuerpo: 'El pago no apareció en la cuenta de Ferry. Revisa el pedido para pagarlo de nuevo.',
    parrafos: [
      `Revisamos el comprobante que enviaste para el pedido ${ref} y el pago no apareció en la cuenta de Ferry.`,
      'Tu pedido sigue disponible: puedes pagarlo con Nequi o con tarjeta desde Ferry, y se confirma al instante.',
      'Si sí hiciste la transferencia, responde este correo con el comprobante y lo revisamos de nuevo.',
    ],
  };
}
