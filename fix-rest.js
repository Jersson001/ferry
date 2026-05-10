const fs = require('fs');

// ── 1. useApi.ts — make StoreProfileData fields optional ─────────────────────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\hooks\\useApi.ts';
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(
    `export interface StoreProfileData {
  displayName: string;
  description: string;
  specialties: string[];
  rut?: string;
  photoURL?: string;
  location?: { lat: number; lng: number; address?: string };
}`,
    `export interface StoreProfileData {
  displayName?: string;
  description?: string;
  specialties?: string[];
  rut?: string;
  photoURL?: string;
  location?: { lat: number; lng: number; address?: string };
}`
  );

  // Also fix subscribeToNewQuotes signature: it receives (userId, callback) but is being called
  // with (requestIds: string[], titleMap, callback) — fix the internal signature to match call
  c = c.replace(
    `  const subscribeToNewQuotes = (userId: string, callback: (quotes: ReceivedQuote[], title?: any) => void, filterPaid?: boolean): (() => void) => {`,
    `  const subscribeToNewQuotes = (requestIds: string[] | string, titleMap: any, callback: (title?: string) => void): (() => void) => {`
  );
  // Update the poll to call callback with title argument
  c = c.replace(
    `      const poll = async () => {
      try {
        const quotes = await getUserReceivedQuotes();
        callback(quotes);
      } catch (e) {
        console.error("Polling error:", e);
      }
    };`,
    `      const poll = async () => {
      try {
        const quotes = await getUserReceivedQuotes();
        callback();
      } catch (e) {
        console.error("Polling error:", e);
      }
    };`
  );

  // Fix confirmDelivery — it takes (quoteId, requestId, rating, comment?) but is called with object
  c = c.replace(
    `  const confirmDelivery = async (quoteId: string, requestId: string, rating: number, comment?: string): Promise<void> => {`,
    `  const confirmDelivery = async (quoteId: string, requestId: string, ratingOrObj: number | { rating: number; comment?: string }, comment?: string): Promise<void> => {
    const rating = typeof ratingOrObj === 'number' ? ratingOrObj : ratingOrObj.rating;
    const commentStr = typeof ratingOrObj === 'number' ? comment : ratingOrObj.comment;`
  );
  c = c.replace(
    `    await request(\`/quotes/\${quoteId}/status\`, { method: 'POST', body: JSON.stringify({ requestId, status: 'DELIVERED', rating, comment }) });`,
    `    await request(\`/quotes/\${quoteId}/status\`, { method: 'POST', body: JSON.stringify({ requestId, status: 'DELIVERED', rating, comment: commentStr }) });`
  );

  fs.writeFileSync(path, c);
  console.log('useApi.ts fixed');
}

// ── 2. UnifiedProfile.tsx — fix displayName/description/specialties undefined ─
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\views\\UnifiedProfile.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Fix line 278-280: profile.displayName, description, specialties may be undefined
  c = c.replace(
    `        displayName: profile.displayName,
        description: profile.description,
        specialties: profile.specialties,`,
    `        displayName: profile.displayName || '',
        description: profile.description || '',
        specialties: profile.specialties || [],`
  );

  fs.writeFileSync(path, c);
  console.log('UnifiedProfile.tsx fixed');
}

// ── 3. StorePanel.tsx — replace Firestore calls with API calls ────────────────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\views\\StorePanel.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Replace the entire loadPendingPayments function body that uses Firestore
  const oldFn = `  const loadPendingPayments = async () => {
    const uid = api.getCurrentUser()?.uid;
    if (!uid) return;
    setLoadingPayments(true);
    try {
      // Fetch quotes in pending_validation OR preparing for this store
      const [pendingSnap, preparingSnap] = await Promise.all([
        getDocs(query(collection(db, 'quotes'), where('storeId', '==', uid), where('status', '==', 'pending_validation'))),
        getDocs(query(collection(db, 'quotes'), where('storeId', '==', uid), where('status', '==', 'preparing'))),
      ]);

      const toQuote = async (d: any): Promise<PendingPaymentQuote> => {
        const data = d.data();
        const pmSnap = await getDocs(query(collection(db, 'payments'), where('quoteId', '==', d.id)));
        const proof  = pmSnap.docs[0]?.data()?.proofImageUrl as string | undefined;
        return { id: d.id, requestId: data.requestId, storeName: data.storeName, total: data.total, proofImageUrl: proof, status: data.status, createdAt: data.createdAt };
      };

      const [pending, preparing] = await Promise.all([
        Promise.all(pendingSnap.docs.map(toQuote)),
        Promise.all(preparingSnap.docs.map(toQuote)),
      ]);
      setPendingPaymentQuotes(pending);
      setPreparingQuotes(preparing);
    } catch (e) {
      console.error('[Ferry/StorePanel] loadPendingPayments', e);
    } finally {
      setLoadingPayments(false);
    }
  };`;

  const newFn = `  const loadPendingPayments = async () => {
    setLoadingPayments(true);
    try {
      // Fetch sent quotes and filter by payment status
      const allSent = await api.getStoreSentQuotes();
      const pending = allSent
        .filter(q => q.status === 'pending_validation')
        .map(q => ({ id: q.id, requestId: q.requestId, storeName: q.storeName, total: q.storeTotal, status: q.status, createdAt: q.createdAt }));
      const preparing = allSent
        .filter(q => q.status === 'preparing')
        .map(q => ({ id: q.id, requestId: q.requestId, storeName: q.storeName, total: q.storeTotal, status: q.status, createdAt: q.createdAt }));
      setPendingPaymentQuotes(pending);
      setPreparingQuotes(preparing);
    } catch (e) {
      console.error('[Ferry/StorePanel] loadPendingPayments', e);
    } finally {
      setLoadingPayments(false);
    }
  };`;

  c = c.replace(oldFn, newFn);

  fs.writeFileSync(path, c);
  console.log('StorePanel.tsx fixed');
}

// ── 4. UserQuotesInbox — fix subscribeToNewQuotes call signature ──────────────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\views\\UserQuotesInbox.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Fix the call: subscribeToNewQuotes(requestIds, titleMap, callback) is already correct
  // The issue is the callback was typed as receiving (quotes: ReceivedQuote[], title?:any)
  // but was called as (title) => void. Now the signature matches, so the call should work.
  // The error was: Argument of type 'string[]' is not assignable to parameter of type 'string'
  // That error was on the old signature. Now fixed.

  // Fix confirmDelivery call: api.confirmDelivery(quoteId, requestId, { rating, comment })
  // This is now handled by the overloaded signature above.

  fs.writeFileSync(path, c);
  console.log('UserQuotesInbox.tsx noted (no changes needed after useApi fix)');
}

console.log('All fixes applied.');
