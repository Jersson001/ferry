import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StorageService } from './storage.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET', 'UPLOADS_PATH', 'UPLOADS_BASE_URL'];

async function pngDataUrl(): Promise<string> {
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f97316' } }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

describe('StorageService', () => {
  const saved: Record<string, string | undefined> = {};
  const realFetch = global.fetch;

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    global.fetch = realFetch;
  });

  describe('sin Supabase configurado: disco local', () => {
    let dir: string;
    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ferry-uploads-'));
      process.env.UPLOADS_PATH = dir;
      process.env.UPLOADS_BASE_URL = 'http://localhost:3000/uploads';
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('guarda la imagen comprimida a WebP y la borra por su URL', async () => {
      const storage = new StorageService();
      const url = await storage.saveBase64Image(await pngDataUrl(), 'user-1', 'catalog');

      expect(url).toMatch(/^http:\/\/localhost:3000\/uploads\/catalog\/user-1\/\d+\.webp$/);
      const file = path.join(dir, url.replace('http://localhost:3000/uploads/', ''));
      expect(fs.existsSync(file)).toBe(true);
      // Leído a memoria: sharp(ruta) deja el archivo abierto en Windows y
      // después no se podría borrar.
      expect((await sharp(fs.readFileSync(file)).metadata()).format).toBe('webp');

      expect(storage.isStoredFile(url)).toBe(true);
      await storage.deleteFile(url);
      expect(fs.existsSync(file)).toBe(false);
    });
  });

  describe('con Supabase configurado', () => {
    type Call = { url: string; init: RequestInit };
    let calls: Call[];

    /** Simula la API de Storage: el bucket existe o no, y todo lo demás responde bien. */
    function mockSupabase({ bucketExists, bucketPublic = true }: { bucketExists: boolean; bucketPublic?: boolean }) {
      calls = [];
      global.fetch = jest.fn(async (input: any, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.endsWith('/storage/v1/bucket/uploads') && (init.method ?? 'GET') === 'GET') {
          return bucketExists
            ? new Response(JSON.stringify({ id: 'uploads', public: bucketPublic }), { status: 200 })
            : new Response(JSON.stringify({ error: 'Bucket not found' }), { status: 404 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }) as any;
    }

    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://proyecto.supabase.co/';
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_abc123';
    });

    it('sube a Supabase y devuelve la URL pública', async () => {
      mockSupabase({ bucketExists: true });
      const url = await new StorageService().saveBase64Image(await pngDataUrl(), 'user-1', 'catalog');

      expect(url).toMatch(
        /^https:\/\/proyecto\.supabase\.co\/storage\/v1\/object\/public\/uploads\/catalog\/user-1\/\d+\.webp$/,
      );
      const upload = calls.find((c) => c.init.method === 'POST' && c.url.includes('/storage/v1/object/uploads/'))!;
      expect(upload.url).toMatch(/\/storage\/v1\/object\/uploads\/catalog\/user-1\/\d+\.webp$/);
      expect((upload.init.headers as any)['Content-Type']).toBe('image/webp');
    });

    it('con una clave sb_secret_ usa solo el encabezado apikey, sin Bearer', async () => {
      mockSupabase({ bucketExists: true });
      await new StorageService().saveBase64Image(await pngDataUrl(), 'user-1');

      for (const { init } of calls) {
        const headers = init.headers as Record<string, string>;
        expect(headers.apikey).toBe('sb_secret_abc123');
        expect(headers.Authorization).toBeUndefined();
      }
    });

    it('con la clave service_role vieja (JWT) manda también Authorization', async () => {
      process.env.SUPABASE_SECRET_KEY = 'eyJhbGciOiJIUzI1NiJ9.x.y';
      mockSupabase({ bucketExists: true });
      await new StorageService().saveBase64Image(await pngDataUrl(), 'user-1');

      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.x.y');
    });

    it('crea el bucket como público si no existe, una sola vez', async () => {
      mockSupabase({ bucketExists: false });
      const storage = new StorageService();
      await storage.saveBase64Image(await pngDataUrl(), 'user-1');
      await storage.saveBase64Image(await pngDataUrl(), 'user-1');

      const creations = calls.filter((c) => c.init.method === 'POST' && c.url.endsWith('/storage/v1/bucket'));
      expect(creations).toHaveLength(1);
      expect(JSON.parse(creations[0].init.body as string)).toMatchObject({ id: 'uploads', public: true });
    });

    it('borra de Supabase por la URL pública', async () => {
      mockSupabase({ bucketExists: true });
      const storage = new StorageService();
      const url = 'https://proyecto.supabase.co/storage/v1/object/public/uploads/portfolio/user-1/123.webp';

      expect(storage.isStoredFile(url)).toBe(true);
      await storage.deleteFile(url);

      const del = calls.find((c) => c.init.method === 'DELETE')!;
      expect(del.url).toBe('https://proyecto.supabase.co/storage/v1/object/uploads');
      expect(JSON.parse(del.init.body as string)).toEqual({ prefixes: ['portfolio/user-1/123.webp'] });
    });

    it('no considera propias las URLs de otros sitios', () => {
      mockSupabase({ bucketExists: true });
      expect(new StorageService().isStoredFile('https://youtube.com/watch?v=abc')).toBe(false);
    });

    it('si Supabase rechaza la subida, falla con un error explicativo', async () => {
      mockSupabase({ bucketExists: true });
      const base = global.fetch as jest.Mock;
      global.fetch = jest.fn(async (input: any, init: RequestInit = {}) =>
        init.method === 'POST' ? new Response('Payload too large', { status: 413 }) : base(input, init),
      ) as any;

      await expect(new StorageService().saveBase64Image(await pngDataUrl(), 'user-1')).rejects.toThrow(
        /Supabase Storage rechazó la subida \(413\)/,
      );
    });
  });
});
