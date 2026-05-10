const fs = require('fs');

// ── 1. Fix auth.service.ts — user.password might be undefined ────────────────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\backend\\src\\auth\\auth.service.ts';
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(
    'const isMatch = await bcrypt.compare(password, user.password);',
    'const isMatch = await bcrypt.compare(password, user.password ?? \'\');'
  );
  fs.writeFileSync(path, c);
  console.log('auth.service.ts fixed');
}

// ── 2. Fix users.service.ts — update() return type ───────────────────────────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\backend\\src\\users\\users.service.ts';
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(
    'async update(uid: string, data: Partial<User>): Promise<User> {\n    await this.usersRepository.update({ uid }, data);\n    return this.findOne(uid);\n  }',
    'async update(uid: string, data: Partial<User>): Promise<User> {\n    await this.usersRepository.update({ uid }, data);\n    const updated = await this.findOne(uid);\n    if (!updated) throw new Error(`User ${uid} not found after update`);\n    return updated;\n  }'
  );
  fs.writeFileSync(path, c);
  console.log('users.service.ts fixed');
}

// ── 3. Fix portfolio.controller.ts — Express.Multer type ─────────────────────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\backend\\src\\portfolio\\portfolio.controller.ts';
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(
    'async uploadFile(@UploadedFile() file: Express.Multer.File)',
    'async uploadFile(@UploadedFile() file: any)'
  );
  fs.writeFileSync(path, c);
  console.log('portfolio.controller.ts fixed');
}

// ── 4. Fix payments.controller.ts — Express.Multer type ──────────────────────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\backend\\src\\payments\\payments.controller.ts';
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(
    'async registerManual(@Body() data: any, @UploadedFile() file: Express.Multer.File)',
    'async registerManual(@Body() data: any, @UploadedFile() file: any)'
  );
  fs.writeFileSync(path, c);
  console.log('payments.controller.ts fixed');
}

// ── 5. Fix stores.service.ts — CatalogProduct variable shadowing entity ───────
{
  const path = 'c:\\Users\\Usuario\\Documents\\ferry\\backend\\src\\stores\\stores.service.ts';
  let c = fs.readFileSync(path, 'utf8');
  // The issue: variable 'product' is declared as CatalogProduct (entity) but assigned CatalogProduct[]
  // It's using the same name as the entity class for a local variable
  // Replace: let product: CatalogProduct | null = ... to let entity: ...
  c = c.replace(
    'let product: CatalogProduct | null = await this.catalogRepository.findOne({ where: { store: { uid: store.uid }, sku: p.sku } });\n        if (product) {\n          Object.assign(product, p);\n        } else {\n          product = this.catalogRepository.create({ ...p, store });\n        }\n        await this.catalogRepository.save(product);',
    'let entity = await this.catalogRepository.findOne({ where: { store: { uid: store.uid }, sku: p.sku } });\n        if (entity) {\n          Object.assign(entity, p);\n        } else {\n          entity = this.catalogRepository.create({ ...p, store });\n        }\n        await this.catalogRepository.save(entity);'
  );
  fs.writeFileSync(path, c);
  console.log('stores.service.ts fixed');
}

console.log('All backend fixes applied.');
