import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, setDoc, getDoc, arrayUnion, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { MaterialItem } from '../types';
import { calculateDistance } from '../utils/geoUtils';

// ─── Comisión de plataforma ───────────────────────────────────────────────────
/**
 * Porcentaje de comisión que Ferry cobra sobre cada cotización.
 * Fuente de verdad única: todos los módulos deben importar esta constante.
 * NO redeclarar localmente en componentes o vistas.
 */
export const FERRY_MARKUP = 0.14; // 14 % — tarifa plataforma

/**
 * Toma la lista de ítems con precios BASE de la tienda y devuelve
 * una nueva lista con los precios inflados por el markup de Ferry.
 *
 * Fórmula por ítem disponible:
 *   unitPrice_cliente = round(unitPrice_tienda × (1 + FERRY_MARKUP))
 *   subtotal_cliente  = round(subtotal_tienda  × (1 + FERRY_MARKUP))
 *
 * Los ítems con available === false se mantienen con precio 0.
 *
 * @param storeItems  Ítems con precios originales de la tienda
 * @returns           Ítems con precios finales para el cliente (markup incluido)
 */
export const applyFerryMarkup = (
  storeItems: QuoteResponseItem[],
): QuoteResponseItem[] => {
  const factor = 1 + FERRY_MARKUP;
  return storeItems.map(item =>
    item.available
      ? {
          ...item,
          unitPrice: Math.round(item.unitPrice * factor),
          subtotal:  Math.round(item.subtotal  * factor),
        }
      : item, // no disponible → precios ya en 0, sin cambios
  );
};

export interface QuoteRequestPayload {
  category: string;
  items: MaterialItem[];
  userLocation?: { lat: number; lng: number } | null;
  title?: string;
  deliveryAddress: string;
}

export interface IncomingQuoteRequest {
  id: string;
  userId: string;
  category: string;
  items: MaterialItem[];
  status: string;
  createdAt: any; // Firestore Timestamp or null during optimistic writes
  userLocation?: { lat: number; lng: number } | null;
  distanceKm?: number; // computed client-side, not stored in Firestore
  title?: string;
  displayId?: string;
  deliveryAddress?: string;
}

/** Generates a short tracking ID in the format FY-XXXXXX (6 uppercase alphanumeric chars). */
const generateDisplayId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `FY-${suffix}`;
};

/**
 * Saves a new quote request to the `quoteRequests` collection in Firestore.
 * Returns the generated document ID.
 */
export const sendQuoteRequest = async (payload: QuoteRequestPayload): Promise<string> => {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error('Debes iniciar sesión para enviar cotizaciones.');
  }

  try {
    // Generate consecutive fallback title if caller didn't provide one
    let title = payload.title?.trim() || '';
    if (!title) {
      const countSnap = await getDocs(
        query(collection(db, 'quoteRequests'), where('userId', '==', uid))
      );
      const nextNum = countSnap.size + 1;
      title = `SOL-${String(nextNum).padStart(3, '0')}`;
    }

    const docRef = await addDoc(collection(db, 'quoteRequests'), {
      userId: uid,
      category: payload.category,
      title,
      displayId: generateDisplayId(),
      deliveryAddress: payload.deliveryAddress,
      items: payload.items.map(item => ({
        name: item.name || '',
        quantity: item.quantity || '',
        unit: item.unit || '',
        nombreComercial: item.nombreComercial || null,
        medidaNominal: item.medidaNominal || null,
        caracteristica: item.caracteristica || null,
        observacion: item.observacion || null,
      })),
      userLocation: payload.userLocation ?? null,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error: any) {
    console.error('Error exacto al enviar cotización:', error?.code, error?.message, error);
    throw error;
  }
};

/**
 * Fetches pending quote requests matching the store's category.
 * If storeLocation is provided, filters to requests within 50 km using
 * the Haversine formula (client-side, avoids Firestore geo-index requirement).
 * Each returned object includes a computed `distanceKm` field (or undefined if
 * the request has no userLocation).
 */
export const getPendingRequestsForStore = async (
  storeCategory: string,
  storeLocation?: { lat: number; lng: number } | null
): Promise<IncomingQuoteRequest[]> => {
  try {
    const q = query(
      collection(db, 'quoteRequests'),
      where('status', '==', 'pending'),
      where('category', '==', storeCategory)
    );

    const snapshot = await getDocs(q);

    let results: IncomingQuoteRequest[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<IncomingQuoteRequest, 'id' | 'distanceKm'>),
    }));

    // Compute distance and apply 50 km radius filter (only when storeLocation is known)
    if (storeLocation) {
      results = results
        .map(req => {
          const loc = req.userLocation;
          const distanceKm =
            loc?.lat != null && loc?.lng != null
              ? calculateDistance(storeLocation.lat, storeLocation.lng, loc.lat, loc.lng)
              : undefined;
          return { ...req, distanceKm };
        })
        .filter(req =>
          // Keep requests with unknown location OR within 50 km
          req.distanceKm === undefined || req.distanceKm <= 50
        );
    }

    // Sort newest first (client-side, avoids composite index requirement)
    results.sort((a, b) => {
      const tsA = a.createdAt?.toMillis?.() ?? 0;
      const tsB = b.createdAt?.toMillis?.() ?? 0;
      return tsB - tsA;
    });

    return results;
  } catch (error: any) {
    console.error('Error fetching pending requests:', error?.code, error?.message);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Store Price Catalog (price memory)
// ---------------------------------------------------------------------------

export interface StoreCatalogEntry {
  price: number;     // store's base price (pre-markup)
  sku: string | null;
}

/**
 * Persists each item's base price and SKU under `storeCatalog/{storeId}`.
 * Only items with price > 0 are saved. Uses merge so existing entries survive.
 */
export const saveStorePriceCatalog = async (
  items: { name: string; price: number; sku: string | null }[]
): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const catalog: Record<string, StoreCatalogEntry> = {};
  items.forEach(({ name, price, sku }) => {
    if (price > 0) catalog[name.toLowerCase().trim()] = { price, sku };
  });
  if (Object.keys(catalog).length === 0) return;
  await setDoc(doc(db, 'storeCatalog', uid), { catalog }, { merge: true });
};

/**
 * Returns the stored catalog for the current store as a name→entry map.
 */
export const getStorePriceCatalog = async (): Promise<Record<string, StoreCatalogEntry>> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return {};
  const snap = await getDoc(doc(db, 'storeCatalog', uid));
  if (!snap.exists()) return {};
  return (snap.data().catalog as Record<string, StoreCatalogEntry>) ?? {};
};

// ---------------------------------------------------------------------------
// Quote Response (Store → User)
// ---------------------------------------------------------------------------

export interface QuoteResponseItem {
  name: string;
  nombreComercial?: string | null;
  quantity: string;
  unit: string;
  unitPrice: number;
  subtotal: number;
  available: boolean; // false when unitPrice === 0 (store doesn't have the item)
  sku?: string | null; // internal store code / reference
}

/**
 * Payload que el caller (StorePanel) envía a submitQuoteResponse.
 * NOTA: el campo `items` (precios cliente) ya NO forma parte del payload;
 * el servicio lo calcula internamente aplicando FERRY_MARKUP sobre storeItems.
 * Esto garantiza que el markup nunca pueda ser alterado desde el frontend.
 */
export interface QuoteResponsePayload {
  requestId: string;
  storeName: string;
  // ── Precios de la tienda (fuente de verdad) ──────────────────────────────
  storeItems: QuoteResponseItem[];  // precios base de la tienda
  storeSubtotalBruto: number;       // suma de subtotales de tienda (sin descuento)
  discount: number;                 // descuento en COP
  storeSubtotalNeto: number;        // storeSubtotalBruto - discount
  taxRate: number;                  // % IVA aplicado (guardado para auditoría)
  taxAmount: number;                // IVA en COP
  transportCost: number;            // envío en COP
  storeTotal: number;               // total adeudado a la tienda (con IVA + envío)
  // ── Metadata ────────────────────────────────────────────────────────────
  distanceKm?: number;
  message?: string;
}

/**
 * Guarda la respuesta de cotización en la colección `quotes`.
 *
 * ANTIFRAUDE — El markup del 14% se calcula AQUÍ, en el servicio,
 * usando la constante FERRY_MARKUP importada localmente.
 * El caller solo envía los precios base de la tienda (storeItems);
 * nunca se acepta el precio del cliente como input externo.
 *
 * `storeId` se toma de auth.currentUser.uid — nunca del caller.
 */
export const submitQuoteResponse = async (payload: QuoteResponsePayload): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión para cotizar.');

  // ── Calcular precios cliente aplicando el markup aquí (antifraude) ────────
  const clientItems = applyFerryMarkup(payload.storeItems);
  const clientSubtotalBruto = clientItems.reduce((s, i) => s + i.subtotal, 0);
  const clientSubtotalNeto  = Math.max(clientSubtotalBruto - payload.discount, 0);
  const clientTotal         = Math.round(payload.storeTotal * (1 + FERRY_MARKUP));

  try {
    const docRef = await addDoc(collection(db, 'quotes'), {
      requestId:    payload.requestId,
      storeId:      uid,
      storeName:    payload.storeName,
      // Precios cliente — calculados en el servicio, NO en el componente
      items:           clientItems,
      subtotalBruto:   clientSubtotalBruto,
      discount:        payload.discount,
      subtotalNeto:    clientSubtotalNeto,
      taxRate:         0,           // baked in por ítem; no se desglosa al cliente
      taxAmount:       0,
      transportCost:   payload.transportCost,
      total:           clientTotal,
      // Precios tienda — ocultos del cliente, usados para liquidación
      storeItems:      payload.storeItems,
      storeTotal:      payload.storeTotal,
      // Metadata
      distanceKm:   payload.distanceKm ?? null,
      message:      payload.message || '',
      ferryMarkup:  FERRY_MARKUP,   // auditabilidad — guardamos el % vigente
      status:       'sent',
      createdAt:    serverTimestamp(),
    });

    // Registrar que esta tienda ya cotizó (no-bloqueante)
    updateDoc(doc(db, 'quoteRequests', payload.requestId), {
      quotedBy: arrayUnion(uid),
    }).catch(e => console.warn('[Ferry] No se pudo actualizar quotedBy:', e?.code));

    return docRef.id;
  } catch (error: any) {
    console.error('[Ferry/submitQuoteResponse]', error?.code, error?.message, error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Store: Sent Quotes (waiting for client response)
// ---------------------------------------------------------------------------

export interface StoreSentQuote {
  id: string;
  requestId: string;
  storeName: string;
  items: QuoteResponseItem[];       // client-facing prices (with markup)
  storeItems: QuoteResponseItem[];  // original store prices (pre-markup)
  total: number;                    // total charged to client
  storeTotal: number;               // amount store will receive
  transportCost: number;
  message: string;
  status: string;
  createdAt: any;
  distanceKm?: number | null;
}

/**
 * Returns all quotes sent by the current store that are still awaiting
 * the client's response (status === 'sent').
 */
export const getStoreSentQuotes = async (): Promise<StoreSentQuote[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'quotes'),
        where('storeId', '==', uid),
        where('status', '==', 'sent'),
        orderBy('createdAt', 'desc'),
      )
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreSentQuote));
  } catch (error: any) {
    console.error('[Ferry/getStoreSentQuotes]', error?.code, error?.message);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// User Inbox: Received Quotes (Store → User)
// ---------------------------------------------------------------------------

export interface QuoteReview {
  rating:    number;   // 1–5
  comment:   string;
  createdAt: any;
}

export interface ReceivedQuote {
  id: string;              // quotes doc id
  requestId: string;
  storeId: string;
  storeName: string;
  items: QuoteResponseItem[];
  total: number;
  transportCost?: number;  // delivery cost (may be 0)
  message: string;
  status: string;          // 'sent' | 'accepted' | 'paid' | 'rejected' | 'preparing' | 'shipped' | 'delivered'
  review?: QuoteReview;
  createdAt: any;
  distanceKm?: number | null; // distance from store to delivery address
  requestCategory?: string;
  requestDisplayId?: string; // short tracking code from the original quoteRequest
  requestTitle?: string;     // user-assigned title of the original quoteRequest
}

/**
 * Fetches all quotes sent to the current user.
 * 1. Queries `quoteRequests` where userId == uid to get the user's request IDs.
 * 2. Queries `quotes` where requestId in [ids] to get store responses.
 * 3. Enriches each quote with the category from the original request.
 */
export const getUserReceivedQuotes = async (): Promise<ReceivedQuote[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión para ver tus cotizaciones.');

  try {
    // Step 1: get all requests owned by this user
    const reqSnapshot = await getDocs(
      query(collection(db, 'quoteRequests'), where('userId', '==', uid))
    );

    if (reqSnapshot.empty) return [];

    // Map requestId → { category, displayId, title, rejectedQuoteIds } for enrichment
    const requestMap: Record<string, { category: string; displayId?: string; title?: string; rejectedQuoteIds: string[] }> = {};
    reqSnapshot.docs.forEach(d => {
      const data = d.data() as any;
      requestMap[d.id] = {
        category: data.category ?? '',
        displayId: data.displayId,
        title: data.title,
        rejectedQuoteIds: data.rejectedQuoteIds ?? [],
      };
    });

    const requestIds = Object.keys(requestMap);


    // Firestore `in` supports up to 30 items; chunk if needed
    const chunkSize = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < requestIds.length; i += chunkSize) {
      chunks.push(requestIds.slice(i, i + chunkSize));
    }

    // Step 2: fetch all quotes for those requests
    const quoteDocsPromises = chunks.map(chunk =>
      getDocs(query(collection(db, 'quotes'), where('requestId', 'in', chunk)))
    );
    const snapshots = await Promise.all(quoteDocsPromises);

    const quotes: ReceivedQuote[] = [];
    snapshots.forEach(snap => {
      snap.docs.forEach(d => {
        const data = d.data() as Omit<ReceivedQuote, 'id' | 'requestCategory'>;
        const req = requestMap[data.requestId];
        // Skip quotes the user has already dismissed
        if (req?.rejectedQuoteIds?.includes(d.id)) return;
        quotes.push({
          id: d.id,
          ...data,
          requestCategory: req?.category,
          requestDisplayId: req?.displayId,
          requestTitle: req?.title,
        });
      });
    });

    // Sort newest first
    quotes.sort((a, b) => {
      const tsA = a.createdAt?.toMillis?.() ?? 0;
      const tsB = b.createdAt?.toMillis?.() ?? 0;
      return tsB - tsA;
    });

    return quotes;
  } catch (error: any) {
    console.error('Error fetching received quotes:', error?.code, error?.message);
    throw error;
  }
};

export interface AcceptQuoteResult {
  splitCreated: boolean;
  splitRequestId?: string;
}

// ---------------------------------------------------------------------------
// User's own quote requests (for the "Enviadas" tab)
// ---------------------------------------------------------------------------

export interface UserOwnRequest {
  id: string;
  title: string;
  displayId: string;
  category: string;
  status: string;
  itemCount: number;
  createdAt: any;
  items: Array<{ name: string; quantity: number; unit: string }>;
  isExpandedSearch?: boolean;
  parentRequestId?: string;
}

/**
 * Fetches all quoteRequests created by the current user,
 * sorted newest first. Used in the "Enviadas" tab.
 */
export const getUserOwnRequests = async (): Promise<UserOwnRequest[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');

  try {
    const snap = await getDocs(
      query(
        collection(db, 'quoteRequests'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
      ),
    );
    return snap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title || 'Solicitud sin título',
        displayId: data.displayId || d.id.slice(0, 6).toUpperCase(),
        category: data.category || '',
        status: data.status || 'pending',
        itemCount: (data.items as any[])?.length ?? 0,
        items: ((data.items as any[]) ?? []).map((it: any) => ({
          name: it.name ?? '',
          quantity: it.quantity ?? 1,
          unit: it.unit ?? '',
        })),
        createdAt: data.createdAt,
        isExpandedSearch: data.isExpandedSearch ?? false,
        parentRequestId: data.parentRequestId,
      };
    });
  } catch (error: any) {
    console.error('Error fetching own requests:', error?.code, error?.message);
    throw error;
  }
};

/**
 * Marks a quote as 'accepted' and its sibling quotes for the same request as 'rejected'.
 * If the winning quote has unavailable items, auto-creates a new quoteRequest for those
 * orphan items (isExpandedSearch: true) and returns splitCreated: true.
 */
export const acceptQuote = async (quoteId: string, requestId: string): Promise<AcceptQuoteResult> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');

  try {
    // Accept this quote + reject siblings + mark original request accepted (parallel)
    const siblingsSnap = await getDocs(
      query(collection(db, 'quotes'), where('requestId', '==', requestId))
    );
    await Promise.all([
      updateDoc(doc(db, 'quotes', quoteId), { status: 'accepted' }),
      ...siblingsSnap.docs
        .filter(d => d.id !== quoteId)
        .map(d => updateDoc(doc(db, 'quotes', d.id), { status: 'rejected' })),
      updateDoc(doc(db, 'quoteRequests', requestId), { status: 'accepted' }),
    ]);

    // ── Split logic: check for orphan items ────────────────────────────────
    const [winningQuoteSnap, originalRequestSnap] = await Promise.all([
      getDoc(doc(db, 'quotes', quoteId)),
      getDoc(doc(db, 'quoteRequests', requestId)),
    ]);

    if (!winningQuoteSnap.exists() || !originalRequestSnap.exists()) {
      return { splitCreated: false };
    }

    const winningQuote = winningQuoteSnap.data() as any;
    const originalRequest = originalRequestSnap.data() as any;

    // Items the winning store marked as unavailable
    const unavailableNames = new Set<string>(
      (winningQuote.items as QuoteResponseItem[])
        .filter(i => !i.available)
        .map(i => i.name.toLowerCase().trim())
    );

    if (unavailableNames.size === 0) return { splitCreated: false };

    // Find those items in the original request
    const orphanItems = (originalRequest.items as MaterialItem[]).filter(
      item => unavailableNames.has(item.name.toLowerCase().trim())
    );

    if (orphanItems.length === 0) return { splitCreated: false };

    // Create a new pending request for orphan items
    const splitRef = await addDoc(collection(db, 'quoteRequests'), {
      userId: uid,
      category: originalRequest.category ?? '',
      title: `${originalRequest.title || 'SOL'} (artículos faltantes)`,
      displayId: generateDisplayId(),
      deliveryAddress: originalRequest.deliveryAddress ?? '',
      items: orphanItems,
      userLocation: originalRequest.userLocation ?? null,
      status: 'pending',
      isExpandedSearch: true,
      parentRequestId: requestId,
      createdAt: serverTimestamp(),
    });

    return { splitCreated: true, splitRequestId: splitRef.id };
  } catch (error: any) {
    console.error('Error accepting quote:', error?.code, error?.message);
    throw error;
  }
};

/**
 * Rejects a quote request by marking it as 'rejected' in Firestore.
 * The request will no longer appear in the store's inbox.
 */
export const rejectQuoteRequest = async (requestId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'quoteRequests', requestId), { status: 'rejected' });
  } catch (error: any) {
    console.error('Error rejecting quote request:', error?.code, error?.message);
    throw error;
  }
};

/**
 * Marks a quote as dismissed by the user.
 * Writes to the user-owned `quoteRequests` document (arrayUnion on `rejectedQuoteIds`)
 * instead of the store-owned `quotes` document, avoiding permission errors.
 */
export const rejectQuote = async (quoteId: string, requestId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'quoteRequests', requestId), {
      rejectedQuoteIds: arrayUnion(quoteId),
    });
  } catch (error: any) {
    console.error('Detalle del error en Firebase:', error?.code, error?.message, error);
    throw error;
  }
};

/**
 * Fetches the N most recent pending quotes (status === 'sent') for the current user.
 * Used by the home-screen notification feed. Enriches each result with the
 * request's title and displayId (same logic as getUserReceivedQuotes).
 */
export interface RecentPendingQuote {
  id: string;
  requestId: string;
  requestTitle?: string;
  requestDisplayId?: string;
  availableItems: number;
  totalItems: number;
  createdAt: any;
}

export const getRecentPendingQuotes = async (maxResults = 3): Promise<RecentPendingQuote[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  try {
    // Step 1: user's own requests
    const reqSnapshot = await getDocs(
      query(collection(db, 'quoteRequests'), where('userId', '==', uid))
    );
    if (reqSnapshot.empty) return [];

    const requestMap: Record<string, { title?: string; displayId?: string; rejectedQuoteIds: string[] }> = {};
    reqSnapshot.docs.forEach(d => {
      const data = d.data() as any;
      requestMap[d.id] = {
        title: data.title,
        displayId: data.displayId,
        rejectedQuoteIds: data.rejectedQuoteIds ?? [],
      };
    });

    const requestIds = Object.keys(requestMap);
    const chunkSize = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < requestIds.length; i += chunkSize) {
      chunks.push(requestIds.slice(i, i + chunkSize));
    }

    // Step 2: recent 'sent' quotes
    const snapshots = await Promise.all(
      chunks.map(chunk =>
        getDocs(
          query(
            collection(db, 'quotes'),
            where('requestId', 'in', chunk),
            where('status', '==', 'sent'),
            orderBy('createdAt', 'desc'),
            limit(maxResults)
          )
        )
      )
    );

    const results: RecentPendingQuote[] = [];
    snapshots.forEach(snap => {
      snap.docs.forEach(d => {
        const data = d.data() as any;
        const req = requestMap[data.requestId];
        if (!req) return;
        if (req.rejectedQuoteIds.includes(d.id)) return;
        const items: any[] = data.items ?? [];
        results.push({
          id: d.id,
          requestId: data.requestId,
          requestTitle: req.title,
          requestDisplayId: req.displayId,
          availableItems: items.filter((i: any) => i.available).length,
          totalItems: items.length,
          createdAt: data.createdAt,
        });
      });
    });

    // Sort newest first and cap at maxResults
    results.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return results.slice(0, maxResults);
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

/**
 * Marks a quote and its parent request as 'paid' after a successful Wompi transaction.
 * MVP: called directly from the client post-payment callback.
 * TODO: replace with a Cloud Function webhook for production.
 */
export const markQuoteAsPaid = async (quoteId: string, requestId: string): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');
  await Promise.all([
    updateDoc(doc(db, 'quotes', quoteId), { status: 'paid' }),
    updateDoc(doc(db, 'quoteRequests', requestId), { status: 'paid' }),
  ]);
};

// ---------------------------------------------------------------------------

/**
 * Pre-registers a Wompi payment intent before injecting the widget.
 * Saves the reference to Firestore so the webhook can find it later.
 * Returns the paymentDocId (not used by MVP but useful for tracking).
 */
export const registerWompiPayment = async (params: {
  quoteId: string;
  requestId: string;
  amount: number;
  wompiReference: string;
}): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');
  const ref = await addDoc(collection(db, 'payments'), {
    quoteId: params.quoteId,
    requestId: params.requestId,
    userId: uid,
    method: 'wompi',
    status: 'PENDIENTE',
    amount: params.amount,
    wompiReference: params.wompiReference,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Submits a manual payment (Nequi / Daviplata / Breb).
 * Uploads the proof image to Storage, saves a payment record in Firestore,
 * and sets the quote + request status to 'pending_validation'.
 */
export const submitManualPayment = async (params: {
  quoteId: string;
  requestId: string;
  method: 'nequi';
  amount: number;
  referenceNumber: string;
  proofFile: File;
}): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');

  // 1. Upload proof image to Storage
  const ext = params.proofFile.name.split('.').pop() ?? 'jpg';
  const path = `payments/${params.quoteId}/${Date.now()}_comprobante.${ext}`;
  let proofImageUrl: string;
  try {
    const snap = await uploadBytes(storageRef(storage, path), params.proofFile);
    proofImageUrl = await getDownloadURL(snap.ref);
  } catch (e: any) {
    throw new Error(`[Paso 1 - Storage] ${e?.message ?? e}`);
  }

  // 2. Create payment record
  let paymentRef;
  try {
    paymentRef = await addDoc(collection(db, 'payments'), {
      quoteId:         params.quoteId,
      requestId:       params.requestId,
      userId:          uid,
      method:          params.method,
      status:          'PENDIENTE_VALIDACION',
      amount:          params.amount,
      referenceNumber: params.referenceNumber.trim(),
      proofImageUrl,
      createdAt:       serverTimestamp(),
    });
  } catch (e: any) {
    throw new Error(`[Paso 2 - Firestore payments] ${e?.message ?? e}`);
  }

  // 3. Update quote and request to pending_validation
  try {
    await Promise.all([
      updateDoc(doc(db, 'quotes', params.quoteId),        { status: 'pending_validation' }),
      updateDoc(doc(db, 'quoteRequests', params.requestId), { status: 'pending_validation' }),
    ]);
  } catch (e: any) {
    throw new Error(`[Paso 3 - Firestore update] ${e?.message ?? e}`);
  }

  return paymentRef.id;
};

// ---------------------------------------------------------------------------
// Quote lifecycle status updates (store-side logistics)
// ---------------------------------------------------------------------------

/** Valid store-driven statuses after payment */
export type QuoteLogisticStatus = 'preparing' | 'shipped' | 'delivered';

/**
 * Client confirms delivery and submits a review.
 * Sets quote + quoteRequest status to 'delivered' and stores the review
 * inline in the quote document.
 */
export const confirmDelivery = async (
  quoteId:   string,
  requestId: string,
  review:    { rating: number; comment: string },
): Promise<void> => {
  await Promise.all([
    updateDoc(doc(db, 'quotes', quoteId), {
      status: 'delivered',
      review: { ...review, createdAt: serverTimestamp() },
    }),
    updateDoc(doc(db, 'quoteRequests', requestId), { status: 'delivered' }),
  ]);
};

/**
 * Updates the status of a quote (and its parent quoteRequest) for logistics flow.
 * Called by the store after confirming payment, dispatching, or delivering.
 */
export const updateQuoteLogisticStatus = async (
  quoteId: string,
  requestId: string,
  status: QuoteLogisticStatus,
): Promise<void> => {
  await Promise.all([
    updateDoc(doc(db, 'quotes',         quoteId),   { status }),
    updateDoc(doc(db, 'quoteRequests',  requestId), { status }),
  ]);
};

// ---------------------------------------------------------------------------
// Real-time subscription: new quote notifications
// ---------------------------------------------------------------------------

/**
 * Subscribes to new 'sent' quotes for the given request IDs.
 * Calls onNewQuote(projectTitle) whenever a brand-new quote document
 * is added. The first snapshot is used to initialise known IDs (no callback).
 * Returns an unsubscribe function.
 */
export const subscribeToNewQuotes = (
  requestIds: string[],
  titleMap: Record<string, string>,
  onNewQuote: (projectTitle: string) => void,
): (() => void) => {
  if (!requestIds.length) return () => {};

  // Firebase 'in' supports ≤ 30 items; take first chunk for MVP
  const ids = requestIds.slice(0, 30);
  const q = query(
    collection(db, 'quotes'),
    where('requestId', 'in', ids),
    where('status', '==', 'sent'),
  );

  let initialized = false;
  const knownIds = new Set<string>();

  const unsub = onSnapshot(q, snapshot => {
    if (!initialized) {
      snapshot.docs.forEach(d => knownIds.add(d.id));
      initialized = true;
      return;
    }
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' && !knownIds.has(change.doc.id)) {
        knownIds.add(change.doc.id);
        const reqId = change.doc.data().requestId as string;
        const title = titleMap[reqId] || 'tu solicitud';
        onNewQuote(title);
      }
    });
  });

  return unsub;
};

// ---------------------------------------------------------------------------
// Partial acceptance (split order logic)
// ---------------------------------------------------------------------------

/**
 * Marks a quote as 'accepted_partial', rejects sibling quotes, and
 * optionally creates a new quoteRequest for the unavailable items.
 */
export const acceptPartialQuote = async (
  quoteId: string,
  requestId: string,
  createSplit: boolean,
): Promise<AcceptQuoteResult> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');

  try {
    // ── Collect sibling quote IDs ─────────────────────────────────────────────
    const siblingsSnap = await getDocs(
      query(collection(db, 'quotes'), where('requestId', '==', requestId)),
    );
    const siblingIds = siblingsSnap.docs
      .filter(d => d.id !== quoteId)
      .map(d => d.id);

    // ── Write only to user-owned quoteRequests (same pattern as rejectQuote) ─
    // The quotes docs are store-owned; updating them from the user's session
    // would be rejected by Firestore rules (permission-denied).
    const reqUpdate: Record<string, any> = {
      status: 'accepted_partial',
      acceptedQuoteId: quoteId,
    };
    if (siblingIds.length > 0) {
      reqUpdate.rejectedQuoteIds = arrayUnion(...siblingIds);
    }
    await updateDoc(doc(db, 'quoteRequests', requestId), reqUpdate);

    if (!createSplit) return { splitCreated: false };

    // ── Fetch data needed for the split request ──────────────────────────────
    const [winningSnap, requestSnap] = await Promise.all([
      getDoc(doc(db, 'quotes', quoteId)),
      getDoc(doc(db, 'quoteRequests', requestId)),
    ]);

    if (!winningSnap.exists() || !requestSnap.exists()) {
      console.error('Split Order: no se encontró la cotización o la solicitud original.');
      return { splitCreated: false };
    }

    const winningItems = (winningSnap.data() as any).items as QuoteResponseItem[];
    const originalRequest = requestSnap.data() as any;

    const unavailableNames = new Set<string>(
      winningItems.filter(i => !i.available).map(i => i.name.toLowerCase().trim()),
    );
    if (unavailableNames.size === 0) return { splitCreated: false };

    // Sanitize orphan items to only safe, known fields (mirrors sendQuoteRequest)
    const orphanItems = (originalRequest.items as MaterialItem[])
      .filter(item => unavailableNames.has(item.name.toLowerCase().trim()))
      .map(item => ({
        name: item.name || '',
        quantity: item.quantity || '',
        unit: item.unit || '',
        nombreComercial: item.nombreComercial || null,
        medidaNominal: item.medidaNominal || null,
        caracteristica: item.caracteristica || null,
        observacion: item.observacion || null,
      }));

    if (orphanItems.length === 0) {
      console.error(
        'Split Order: matching por nombre falló.',
        'unavailableNames:', [...unavailableNames],
        'originalItems:', originalRequest.items?.map((i: any) => i.name),
      );
      // Fallback: use ALL unavailable quote items directly as orphans
      const fallbackOrphans = winningItems
        .filter(i => !i.available)
        .map(i => ({
          name: i.name || '',
          quantity: String(i.quantity ?? '1'),
          unit: i.unit || 'und',
          nombreComercial: null,
          medidaNominal: null,
          caracteristica: null,
          observacion: null,
        }));
      if (fallbackOrphans.length === 0) return { splitCreated: false };

      const splitRef = await addDoc(collection(db, 'quoteRequests'), {
        userId: uid,
        category: originalRequest.category ?? '',
        title: `${originalRequest.title || 'SOL'} (artículos faltantes)`,
        displayId: generateDisplayId(),
        deliveryAddress: originalRequest.deliveryAddress ?? '',
        items: fallbackOrphans,
        userLocation: originalRequest.userLocation ?? null,
        status: 'pending',
        isExpandedSearch: true,
        parentRequestId: requestId,
        createdAt: serverTimestamp(),
      });
      return { splitCreated: true, splitRequestId: splitRef.id };
    }

    const splitRef = await addDoc(collection(db, 'quoteRequests'), {
      userId: uid,
      category: originalRequest.category ?? '',
      title: `${originalRequest.title || 'SOL'} (artículos faltantes)`,
      displayId: generateDisplayId(),
      deliveryAddress: originalRequest.deliveryAddress ?? '',
      items: orphanItems,
      userLocation: originalRequest.userLocation ?? null,
      status: 'pending',
      isExpandedSearch: true,
      parentRequestId: requestId,
      createdAt: serverTimestamp(),
    });

    return { splitCreated: true, splitRequestId: splitRef.id };

  } catch (error: any) {
    console.error('Error exacto en Split Order:', error?.code, error?.message, error);
    throw error;
  }
};

/** Returns a human-friendly relative time string (e.g. "Hace 2 horas") */
export const formatRelativeTime = (timestamp: any): string => {
  if (!timestamp?.toMillis) return 'Hace un momento';
  const diffMs = Date.now() - timestamp.toMillis();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} hora${diffH > 1 ? 's' : ''}`;
  const diffD = Math.floor(diffH / 24);
  return `Hace ${diffD} día${diffD > 1 ? 's' : ''}`;
};
