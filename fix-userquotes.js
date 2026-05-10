const fs = require('fs');
const path = 'c:\\Users\\Usuario\\Documents\\ferry\\frontend\\src\\views\\UserQuotesInbox.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replacement 1: Firestore comment
content = content.replace(/\/\/ Update Firestore if we have the context/g, '// Update state if we have the context');

// Replacement 2: Firebase error log
content = content.replace(/console\.error\('Detalle del error en Firebase:', e\?\.code, e\?\.message, e\);/g, "console.error('Detalle del error en API:', e?.message, e);");

// Replacement 3: sorting logic
const oldSort = `      const sorted = [...group].sort(
        (a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
      );`;
const newSort = `      const sorted = [...group].sort((a, b) => {
        const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const db = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return da - db;
      });`;

// Using a more flexible regex for sort because of possible whitespace variations
content = content.replace(/const sorted = \[\.\.\.group\]\.sort\(\s+\(a, b\) => \(a\.createdAt\?\.toMillis\?\.\(\) \?\? 0\) - \(b\.createdAt\?\.toMillis\?\.\(\) \?\? 0\)\s+\);/g, newSort);

fs.writeFileSync(path, content);
console.log('Done');
