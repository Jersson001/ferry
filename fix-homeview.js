const fs = require('fs');

const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\views\\HomeView.tsx';
let c = fs.readFileSync(path, 'utf8');

// The file has CRLF endings. The broken section starts after "];\r\n" on line 54
// and ends before "// -----------" on line 59.
// We need to:
// 1) Remove lines 55-58 (the dangling return fragments)
// 2) Insert the full hook + buildNotificationMessage after line 54 ("];\r\n")

const marker = '];\r\n    return `${alias} ya envió la cotización para ${label}.`;\r\n  }\r\n  return `${alias} cotizó ${q.availableItems} de ${q.totalItems} productos. Algunos artículos no están en stock.`;\r\n\r\n// ---------------------------------------------------------------------------';

const replacement = `];

// ---------------------------------------------------------------------------
// Notification feed hook
// ---------------------------------------------------------------------------

const useRecentQuotes = () => {
  const api = useApi();
  const [quotes, setQuotes] = useState<RecentPendingQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getRecentPendingQuotes(3)
      .then(data => { if (!cancelled) setQuotes(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { quotes, loading };
};

const buildNotificationMessage = (q: RecentPendingQuote, idx: number): string => {
  const alias = \`Experto Local #\${idx + 1}\`;
  const label = q.requestTitle || q.requestDisplayId || 'tu solicitud';
  if (q.availableItems === q.totalItems) {
    return \`\${alias} ya envió la cotización para \${label}.\`;
  }
  return \`\${alias} cotizó \${q.availableItems} de \${q.totalItems} productos. Algunos artículos no están en stock.\`;
};

// ---------------------------------------------------------------------------`;

if (c.includes(marker)) {
  c = c.replace(marker, replacement);
  console.log('Direct CRLF replacement applied.');
} else {
  // Try with just LF
  const markerLF = marker.replace(/\r\n/g, '\n');
  if (c.includes(markerLF)) {
    c = c.replace(markerLF, replacement.replace(/\r\n/g, '\n'));
    console.log('LF replacement applied.');
  } else {
    // Split and rebuild
    const lines = c.split(/\r?\n/);
    const newLines = [];
    let skip = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect line 55 pattern: starts with spaces then "return `${alias} ya envió"
      if (line.trim().startsWith('return `${alias} ya envió')) {
        // This is the dangling fragment - insert hook before first such occurrence
        // but only if the previous line was "];"
        if (i > 0 && lines[i-1].trim() === '];') {
          // Insert the hook code
          newLines.push('');
          newLines.push('// ---------------------------------------------------------------------------');
          newLines.push('// Notification feed hook');
          newLines.push('// ---------------------------------------------------------------------------');
          newLines.push('');
          newLines.push('const useRecentQuotes = () => {');
          newLines.push('  const api = useApi();');
          newLines.push('  const [quotes, setQuotes] = useState<RecentPendingQuote[]>([]);');
          newLines.push('  const [loading, setLoading] = useState(true);');
          newLines.push('');
          newLines.push('  useEffect(() => {');
          newLines.push('    let cancelled = false;');
          newLines.push('    api.getRecentPendingQuotes(3)');
          newLines.push('      .then(data => { if (!cancelled) setQuotes(data); })');
          newLines.push('      .finally(() => { if (!cancelled) setLoading(false); });');
          newLines.push('    return () => { cancelled = true; };');
          newLines.push('  }, []);');
          newLines.push('');
          newLines.push('  return { quotes, loading };');
          newLines.push('};');
          newLines.push('');
          newLines.push('const buildNotificationMessage = (q: RecentPendingQuote, idx: number): string => {');
          newLines.push('  const alias = `Experto Local #${idx + 1}`;');
          newLines.push("  const label = q.requestTitle || q.requestDisplayId || 'tu solicitud';");
          newLines.push('  if (q.availableItems === q.totalItems) {');
          newLines.push('    return `${alias} ya envió la cotización para ${label}.`;');
          newLines.push('  }');
          newLines.push('  return `${alias} cotizó ${q.availableItems} de ${q.totalItems} productos. Algunos artículos no están en stock.`;');
          newLines.push('};');
          newLines.push('');
          skip = true; // skip remaining dangling lines until we hit "// ----"
          continue;
        }
      }
      if (skip && line.trim() === '') continue;
      if (skip && line.startsWith('// ---')) skip = false;
      if (skip && (line.trim() === '}' || line.trim() === '};' || line.trim().startsWith('return `${alias}'))) continue;
      newLines.push(line);
    }
    c = newLines.join('\n');
    console.log('Line-by-line fix applied.');
  }
}

fs.writeFileSync(path, c);
console.log('Done. Lines now:', c.split('\n').length);
