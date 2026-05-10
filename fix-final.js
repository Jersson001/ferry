const fs = require('fs');

// ── 1. Fix useApi.ts — subscribeToNewQuotes: keep both old and new forms ─────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\hooks\\useApi.ts';
  let c = fs.readFileSync(path, 'utf8');

  // The new signature broke MaterialFlow which calls with 2 args (id, callback).
  // Make it flexible: if first arg is string and second is function → old form
  c = c.replace(
    `  const subscribeToNewQuotes = (requestIds: string[] | string, titleMap: any, callback: (title?: string) => void): (() => void) => {
    // Polling as a substitute for Firebase onSnapshot
    const poll = async () => {
      try {
        const quotes = await getUserReceivedQuotes();
        callback(quotes);
      } catch (e) {
        console.error("Polling error:", e);
      }
    };
    const interval = setInterval(poll, 5000);
    poll(); // Initial call
    return () => clearInterval(interval);
  };`,
    `  // Overloaded: called as (id, callback) from MaterialFlow, or (ids, titleMap, callback) from UserQuotesInbox
  const subscribeToNewQuotes = (
    requestIds: string[] | string,
    titleMapOrCallback: any,
    callbackOrUndefined?: (title?: string) => void,
  ): (() => void) => {
    const callback: (title?: string) => void =
      typeof titleMapOrCallback === 'function' ? titleMapOrCallback : callbackOrUndefined!;

    const poll = async () => {
      try {
        const quotes = await getUserReceivedQuotes();
        if (typeof titleMapOrCallback === 'function') {
          // Old form: pass quotes array directly
          (titleMapOrCallback as any)(quotes);
        } else {
          callback();
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    };
    const interval = setInterval(poll, 5000);
    poll(); // Initial call
    return () => clearInterval(interval);
  };`
  );

  fs.writeFileSync(path, c);
  console.log('useApi.ts subscribeToNewQuotes fixed');
}

// ── 2. Fix types.ts — add profileComplete to UserProfile ─────────────────────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\types.ts';
  let c = fs.readFileSync(path, 'utf8');
  if (!c.includes('profileComplete')) {
    c = c.replace(
      '  portfolio?: PortfolioItem[];\n  createdAt: any;',
      '  portfolio?: PortfolioItem[];\n  profileComplete?: boolean;\n  createdAt: any;'
    );
    fs.writeFileSync(path, c);
    console.log('types.ts profileComplete added');
  } else {
    console.log('types.ts profileComplete already present');
  }
}

// ── 3. Fix StorePanel.tsx — replace remaining Firestore loadPendingPayments ───
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\views\\StorePanel.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Find and replace the old function that still uses Firestore
  const oldStart = '  const loadPendingPayments = async () => {\r\n    const uid = api.getCurrentUser()?.uid;\r\n    if (!uid) return;\r\n    setLoadingPayments(true);\r\n    try {\r\n      // Fetch quotes in pending_validation OR preparing for this store\r\n      const [pendingSnap, preparingSnap] = await Promise.all([\r\n        getDocs(query(collection(db, \'quotes\'), where(\'storeId\', \'==\', uid), where(\'status\', \'==\', \'pending_validation\'))),\r\n        getDocs(query(collection(db, \'quotes\'), where(\'storeId\', \'==\', uid), where(\'status\', \'==\', \'preparing\'))),\r\n      ]);\r\n\r\n      const toQuote = async (d: any): Promise<PendingPaymentQuote> => {\r\n        const data = d.data();\r\n        const pmSnap = await getDocs(query(collection(db, \'payments\'), where(\'quoteId\', \'==\', d.id)));\r\n        const proof  = pmSnap.docs[0]?.data()?.proofImageUrl as string | undefined;\r\n        return { id: d.id, requestId: data.requestId, storeName: data.storeName, total: data.total, proofImageUrl: proof, status: data.status, createdAt: data.createdAt };\r\n      };\r\n\r\n      const [pending, preparing] = await Promise.all([\r\n        Promise.all(pendingSnap.docs.map(toQuote)),\r\n        Promise.all(preparingSnap.docs.map(toQuote)),\r\n      ]);\r\n      setPendingPaymentQuotes(pending);\r\n      setPreparingQuotes(preparing);\r\n    } catch (e) {\r\n      console.error(\'[Ferry/StorePanel] loadPendingPayments\', e);\r\n    } finally {\r\n      setLoadingPayments(false);\r\n    }\r\n  };';

  const newFn = `  const loadPendingPayments = async () => {
    setLoadingPayments(true);
    try {
      const allSent = await api.getStoreSentQuotes();
      const pending: PendingPaymentQuote[] = allSent
        .filter(q => q.status === 'pending_validation')
        .map(q => ({ id: q.id, requestId: q.requestId, storeName: q.storeName, total: q.storeTotal ?? 0, status: q.status, createdAt: q.createdAt }));
      const preparing: PendingPaymentQuote[] = allSent
        .filter(q => q.status === 'preparing')
        .map(q => ({ id: q.id, requestId: q.requestId, storeName: q.storeName, total: q.storeTotal ?? 0, status: q.status, createdAt: q.createdAt }));
      setPendingPaymentQuotes(pending);
      setPreparingQuotes(preparing);
    } catch (e) {
      console.error('[Ferry/StorePanel] loadPendingPayments', e);
    } finally {
      setLoadingPayments(false);
    }
  };`;

  if (c.includes(oldStart)) {
    c = c.replace(oldStart, newFn);
    console.log('StorePanel Firestore replaced via CRLF match');
  } else {
    // Try with LF
    const oldStartLF = oldStart.replace(/\r\n/g, '\n');
    if (c.includes(oldStartLF)) {
      c = c.replace(oldStartLF, newFn);
      console.log('StorePanel Firestore replaced via LF match');
    } else {
      // Line-level replacement
      const lines = c.split(/\r?\n/);
      let start = -1, end = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const loadPendingPayments = async () => {') && lines[i+1] && lines[i+1].includes('getCurrentUser')) {
          start = i;
        }
        if (start >= 0 && lines[i].trim() === '};' && i > start + 5) {
          end = i;
          break;
        }
      }
      if (start >= 0 && end >= 0) {
        lines.splice(start, end - start + 1, ...newFn.split('\n'));
        c = lines.join('\n');
        console.log(`StorePanel fixed via line splice [${start}-${end}]`);
      } else {
        console.log('StorePanel: could not find loadPendingPayments to replace');
      }
    }
  }

  fs.writeFileSync(path, c);
}

// ── 4. Fix UserQuotesInbox — setNewQuoteToast: title might be undefined ───────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\views\\UserQuotesInbox.tsx';
  let c = fs.readFileSync(path, 'utf8');

  c = c.replace(
    'setNewQuoteToast(title);\r\n      setTimeout(() => setNewQuoteToast(null), 6000);',
    'setNewQuoteToast(title ?? null);\r\n      setTimeout(() => setNewQuoteToast(null), 6000);'
  );
  c = c.replace(
    'setNewQuoteToast(title);\n      setTimeout(() => setNewQuoteToast(null), 6000);',
    'setNewQuoteToast(title ?? null);\n      setTimeout(() => setNewQuoteToast(null), 6000);'
  );

  fs.writeFileSync(path, c);
  console.log('UserQuotesInbox title?? null fix applied');
}

console.log('All done.');
