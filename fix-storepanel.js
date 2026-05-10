const fs = require('fs');
let content = fs.readFileSync('frontend/src/views/StorePanel.tsx', 'utf-8');

if (!content.includes("import { useApi")) {
  content = "import { useApi, formatRelativeTime, StoreCatalogEntry, IncomingQuoteRequest, StoreSentQuote } from '../hooks/useApi';\n" + content;
}

content = content.replace(
  'const QuoteResponseModal: React.FC<QuoteResponseModalProps> = ({ req, storeName, storeId, onClose, onSuccess }) => {',
  'const QuoteResponseModal: React.FC<QuoteResponseModalProps> = ({ req, storeName, storeId, onClose, onSuccess }) => {\n  const api = useApi();'
);

content = content.replace(/getStorePriceCatalog\(/g, 'api.getStorePriceCatalog(');
content = content.replace(/getStoreCatalogProducts\(/g, 'api.getStoreCatalogProducts(');
content = content.replace(/saveStorePriceCatalog\(/g, 'api.saveStorePriceCatalog(');
content = content.replace(/submitQuoteResponse\(/g, 'api.submitQuoteResponse(');

content = content.replace(
  'export const StorePanel: React.FC<Props> = ({ requests, profile }) => {',
  'export const StorePanel: React.FC<Props> = ({ requests, profile }) => {\n  const api = useApi();'
);

content = content.replace(/getStoreSentQuotes\(/g, 'api.getStoreSentQuotes(');
content = content.replace(/updateQuoteLogisticStatus\(/g, 'api.updateQuoteLogisticStatus(');
content = content.replace(/getPendingRequestsForStore\(/g, 'api.getPendingRequestsForStore(');
content = content.replace(/rejectQuoteRequest\(/g, 'api.rejectQuoteRequest(');

// auth.currentUser?.uid is used in StorePanel.tsx, let's use api.getCurrentUser()?.uid
content = content.replace(/auth\.currentUser\?\.uid/g, 'api.getCurrentUser()?.uid');
content = content.replace(/import \{ db, auth \} from '\.\.\/firebase';\n/g, '');
content = content.replace(/import \{ collection, query, where, getDocs \} from 'firebase\/firestore';\n/g, '');

// Clean old imports that we replace
content = content.replace(/import \{ getPendingRequestsForStore[^;]+;/g, '');
content = content.replace(/import \{ getStoreCatalogProducts[^;]+;/g, '');

fs.writeFileSync('frontend/src/views/StorePanel.tsx', content);
console.log('StorePanel updated');
