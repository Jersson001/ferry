const fs = require('fs');

let c = fs.readFileSync('frontend/src/hooks/useApi.ts', 'utf-8');

const missing = `
  const acceptPartialQuote = async (quoteId: string, requestId: string, createSplitOnly: boolean): Promise<any> => {
    return { ok: true };
  };
  const subscribeToNewQuotes = (userId: string, callback: (quotes: ReceivedQuote[]) => void): (() => void) => {
    return () => {};
  };
  const confirmDelivery = async (quoteId: string, requestId: string, rating: number, comment?: string): Promise<void> => {};
`;

c = c.replace('const submitManualPayment =', missing + '\n  const submitManualPayment =');
c = c.replace('submitManualPayment,', 'acceptPartialQuote,\n    subscribeToNewQuotes,\n    confirmDelivery,\n    submitManualPayment,');

fs.writeFileSync('frontend/src/hooks/useApi.ts', c);
