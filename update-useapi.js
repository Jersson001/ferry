const fs = require('fs');
const path = require('path');

const useApiFile = path.join(__dirname, 'frontend/src/hooks/useApi.ts');
let content = fs.readFileSync(useApiFile, 'utf-8');

if (!content.includes('formatRelativeTime')) {
  const helpers = `
export const formatRelativeTime = (dateInput: any): string => {
  if (!dateInput) return '';
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return \`hace \${diffMins} min\`;
  if (diffHours < 24) return \`hace \${diffHours} h\`;
  if (diffDays === 1) return 'ayer';
  return \`hace \${diffDays} d\`;
};
`;
  content = content.replace('// Hook principal de la API', helpers + '\n// Hook principal de la API');
}

if (!content.includes('updateQuoteLogisticStatus')) {
  const method = `
  const updateQuoteLogisticStatus = async (quoteId: string, requestId: string, status: string): Promise<void> => {
    await request(\`/quotes/\${quoteId}/status\`, { method: 'POST', body: JSON.stringify({ requestId, status }) });
  };
  `;
  content = content.replace('markQuoteAsPaid,', method + '\n    markQuoteAsPaid,');
  content = content.replace('const markQuoteAsPaid', method.trim() + '\n  const markQuoteAsPaid');
}

fs.writeFileSync(useApiFile, content);
console.log('useApi.ts updated with missing helpers.');
