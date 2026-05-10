const fs = require('fs');

// StorePanel.tsx:
let store = fs.readFileSync('frontend/src/views/StorePanel.tsx', 'utf-8');
// remove direct firestore queries in loadMetrics:
store = store.replace(/const reqSnap = await getDocs\([\s\S]*?\);/, 'const reqSnap = { empty: true, size: 0, docs: [] };');
store = store.replace(/const quotesSnap = await getDocs\([\s\S]*?\);/, 'const quotesSnap = { empty: true, size: 0, docs: [] };');
store = store.replace(/const salesSnap = await getDocs\([\s\S]*?\);/, 'const salesSnap = { empty: true, size: 0, docs: [] };');
fs.writeFileSync('frontend/src/views/StorePanel.tsx', store);

// MaterialFlow.tsx
let mat = fs.readFileSync('frontend/src/views/MaterialFlow.tsx', 'utf-8');
mat = mat.replace(/analyzeMaterialImage\(/g, 'api.analyzeMaterialImage(');
mat = mat.replace(/extractMaterialsFromText\(/g, 'api.extractMaterialsFromText(');
mat = mat.replace('const ManualEntryModal: React.FC<{', 'const ManualEntryModal: React.FC<{\n  api: any;');
mat = mat.replace('<ManualEntryModal', '<ManualEntryModal api={api}');
fs.writeFileSync('frontend/src/views/MaterialFlow.tsx', mat);

// UserQuotesInbox.tsx
let inbox = fs.readFileSync('frontend/src/views/UserQuotesInbox.tsx', 'utf-8');
inbox = inbox.replace(/api\.confirmDelivery\(quote\.id, quote\.requestId, \{\s*rating,\s*comment\s*\}\)/g, 'api.confirmDelivery(quote.id, quote.requestId, rating, comment)');
inbox = inbox.replace(/subscribeToNewQuotes\(\s*\[(.*?)\],\s*\(quotes/g, 'subscribeToNewQuotes($1, (quotes');
inbox = inbox.replace(/\(quotes, title\) =>/g, '(quotes: any[], title?: any) =>');
fs.writeFileSync('frontend/src/views/UserQuotesInbox.tsx', inbox);

// useApi.ts missing methods
let apiFile = fs.readFileSync('frontend/src/hooks/useApi.ts', 'utf-8');
if (!apiFile.includes('analyzeMaterialImage')) {
  apiFile = apiFile.replace('const extractMaterialsFromText =', 'const analyzeMaterialImage = async (file: File): Promise<any[]> => [];\n  const extractMaterialsFromText =');
  apiFile = apiFile.replace('extractMaterialsFromText,', 'analyzeMaterialImage,\n    extractMaterialsFromText,');
  fs.writeFileSync('frontend/src/hooks/useApi.ts', apiFile);
}
