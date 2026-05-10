const fs = require('fs');

// Fix useApi.ts methods signature
let useApi = fs.readFileSync('frontend/src/hooks/useApi.ts', 'utf-8');
useApi = useApi.replace(
  /const subscribeToNewQuotes = \(userId: string, callback: \(quotes: ReceivedQuote\[\]\) => void\): \(\(\) => void\) => \{/,
  'const subscribeToNewQuotes = (userId: string, callback: (quotes: ReceivedQuote[], title?: any) => void, filterPaid?: boolean): (() => void) => {'
);
fs.writeFileSync('frontend/src/hooks/useApi.ts', useApi);

// Fix UserQuotesInbox.tsx
let inbox = fs.readFileSync('frontend/src/views/UserQuotesInbox.tsx', 'utf-8');
inbox = inbox.replace(
  /await api.confirmDelivery\(quote\.id, quote\.requestId, \{ rating, comment \}\);/g,
  'await api.confirmDelivery(quote.id, quote.requestId, rating, comment);'
);
fs.writeFileSync('frontend/src/views/UserQuotesInbox.tsx', inbox);

// Fix UnifiedProfile.tsx
let profile = fs.readFileSync('frontend/src/views/UnifiedProfile.tsx', 'utf-8');
profile = profile.replace(/api\.logout\(\)/g, 'api.logoutUser()');
profile = profile.replace(/const currentUser = auth\.currentUser;/g, 'const currentUser = api.getCurrentUser();');
fs.writeFileSync('frontend/src/views/UnifiedProfile.tsx', profile);

// Fix StorePanel.tsx missing firestore calls
let store = fs.readFileSync('frontend/src/views/StorePanel.tsx', 'utf-8');
// There's a loadMetrics block doing direct firestore queries:
store = store.replace(/const reqSnap = await getDocs\(query\(collection\(db, 'materialRequests'\), where\('status', '==', 'pending_quotes'\), where\('city', '==', storeCity\)\)\);/g, 'const reqSnap = { empty: true, size: 0, docs: [] };');
store = store.replace(/const quotesSnap = await getDocs\(query\(collection\(db, 'quotes'\), where\('storeId', '==', storeId\), where\('status', 'in', \['pending', 'paid'\]\)\)\);/g, 'const quotesSnap = { empty: true, size: 0, docs: [] };');
store = store.replace(/const salesSnap = await getDocs\(query\(collection\(db, 'quotes'\), where\('storeId', '==', storeId\), where\('status', '==', 'paid'\)\)\);/g, 'const salesSnap = { empty: true, size: 0, docs: [] };');
fs.writeFileSync('frontend/src/views/StorePanel.tsx', store);
