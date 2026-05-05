
/**
 * Ferry — Firebase Cloud Functions
 *
 * wompiWebhook: recibe eventos transaction.updated de Wompi,
 *               verifica la firma y actualiza Firestore.
 *
 * ─── SETUP (una sola vez) ─────────────────────────────────────────────────
 *
 *  1. Guardar el secreto de eventos en Firebase Secret Manager:
 *
 *       firebase functions:secrets:set WOMPI_EVENTS_SECRET
 *       # Pega cuando pregunte: test_events_RcfdumOT5615BZtWdwpzqAjDVcSMJnKq
 *
 *  2. Instalar dependencias y desplegar:
 *
 *       cd functions
 *       npm install
 *       cd ..
 *       firebase deploy --only functions
 *
 *  3. Copiar la URL que Firebase imprime al final del deploy, ej:
 *       https://us-central1-<tu-proyecto>.cloudfunctions.net/wompiWebhook
 *
 *  4. En Wompi → Desarrolladores → Webhooks → Agregar URL → pegar la URL anterior.
 *
 * ─── ESTRUCTURA DEL EVENTO (Wompi docs) ──────────────────────────────────
 *  {
 *    event: "transaction.updated",
 *    data: { transaction: { id, status, amount_in_cents, reference, ... } },
 *    timestamp: 1234567890,          ← segundos Unix
 *    signature: {
 *      checksum: "sha256hex...",     ← firma a verificar
 *      properties: ["data.transaction.id", "data.transaction.status",
 *                   "data.transaction.amount_in_cents"]
 *    }
 *  }
 *
 *  Firma = SHA-256( id + status + amount_in_cents + timestamp + EVENTS_SECRET )
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

admin.initializeApp();
const db = admin.firestore();

// ─── Verificación de firma ────────────────────────────────────────────────────
const verifySignature = (
  body: Record<string, any>,
  eventsSecret: string,
): boolean => {
  const t = body?.data?.transaction;
  const timestamp: number = body?.timestamp;
  const receivedChecksum: string = body?.signature?.checksum;

  if (!t || !timestamp || !receivedChecksum) return false;

  // Concatenar en el orden exacto que indica body.signature.properties
  const raw = `${t.id}${t.status}${t.amount_in_cents}${timestamp}${eventsSecret}`;
  const computed = createHash('sha256').update(raw).digest('hex');
  return computed === receivedChecksum;
};

// ─── Webhook handler ──────────────────────────────────────────────────────────
export const wompiWebhook = onRequest(
  { secrets: ['WOMPI_EVENTS_SECRET'] },
  async (req, res) => {
    // Wompi solo envía POST
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const eventsSecret = process.env.WOMPI_EVENTS_SECRET!;

    if (!verifySignature(req.body, eventsSecret)) {
      console.warn('wompiWebhook: firma inválida — rechazando evento');
      res.status(401).send('Invalid signature');
      return;
    }

    const transaction = req.body?.data?.transaction;
    if (!transaction) {
      res.status(400).send('No transaction data');
      return;
    }

    const {
      id: transactionId,
      status,
      reference,
      amount_in_cents,
    } = transaction;

    console.log(`wompiWebhook: evento recibido — ref=${reference} status=${status}`);

    try {
      if (status === 'APPROVED') {
        // Buscar el doc de pago por referencia (guardado antes de inyectar el widget)
        const paySnap = await db
          .collection('payments')
          .where('wompiReference', '==', reference)
          .limit(1)
          .get();

        if (paySnap.empty) {
          console.warn(`wompiWebhook: sin doc payments para ref=${reference}`);
          // Aún respondemos 200 para que Wompi no reintente
          res.status(200).send('OK (no payment doc found)');
          return;
        }

        const payDoc = paySnap.docs[0];
        const { quoteId, requestId } = payDoc.data() as {
          quoteId: string;
          requestId: string;
        };

        await Promise.all([
          db.doc(`quotes/${quoteId}`).update({
            status: 'paid',
            wompiTransactionId: transactionId,
          }),
          db.doc(`quoteRequests/${requestId}`).update({ status: 'paid' }),
          payDoc.ref.update({
            status: 'PAGADO',
            wompiTransactionId: transactionId,
            amount_in_cents,
          }),
        ]);

        console.log(`wompiWebhook: ✅ quote ${quoteId} marcada como PAGADA`);

      } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(status)) {
        const paySnap = await db
          .collection('payments')
          .where('wompiReference', '==', reference)
          .limit(1)
          .get();
        if (!paySnap.empty) {
          await paySnap.docs[0].ref.update({
            status: 'FALLIDO',
            wompiTransactionId: transactionId,
          });
        }
        console.log(`wompiWebhook: ❌ transacción ${status} para ref=${reference}`);
      }

      res.status(200).send('OK');
    } catch (err) {
      console.error('wompiWebhook: error interno', err);
      res.status(500).send('Internal error');
    }
  },
);
