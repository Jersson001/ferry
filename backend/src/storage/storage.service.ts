import { Injectable, Logger, UnsupportedMediaTypeException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;  // 15MB antes de comprimir
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB
const MAX_PDF_SIZE = 10 * 1024 * 1024;    // 10MB, adjuntos del chat

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

/**
 * Guarda las fotos y videos que suben los usuarios.
 *
 * Tiene dos destinos y elige según la configuración:
 *
 * - **Supabase Storage**, si están SUPABASE_URL y SUPABASE_SECRET_KEY. Es el
 *   de producción: Render tiene disco efímero y borra lo que se guarde en él
 *   con cada despliegue o reinicio.
 * - **Disco local** (`uploads/`, servido por main.ts), si no lo están. Para
 *   desarrollo, sin depender de una cuenta externa.
 *
 * Quien lo usa solo recibe y entrega URLs; no sabe cuál de los dos es.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private readonly supabase: { url: string; key: string; bucket: string } | null;
  private bucketReady: Promise<void> | null = null;

  private readonly uploadsPath: string;
  private readonly uploadsBaseUrl: string;

  constructor() {
    const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
    const key = process.env.SUPABASE_SECRET_KEY;
    this.supabase =
      url && key ? { url, key, bucket: process.env.SUPABASE_STORAGE_BUCKET || 'uploads' } : null;

    this.uploadsPath = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
    this.uploadsBaseUrl = process.env.UPLOADS_BASE_URL || 'http://localhost:3000/uploads';

    if (this.supabase) {
      this.logger.log(`Archivos en Supabase Storage, bucket "${this.supabase.bucket}"`);
    } else {
      this.logger.log(`Archivos en disco local: ${this.uploadsPath}`);
      if (!fs.existsSync(this.uploadsPath)) {
        fs.mkdirSync(this.uploadsPath, { recursive: true });
      }
    }
  }

  /**
   * Guarda un archivo subido. Si es imagen, comprime a WebP.
   * Si es video, guarda tal cual (ya viene comprimido del cliente).
   * Retorna la URL pública del archivo guardado.
   */
  async saveFile(
    file: Express.Multer.File,
    userId: string,
    subfolder: string = 'general',
  ): Promise<string> {
    this.validateFile(file);

    const timestamp = Date.now();
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return this.saveAsWebP(file.buffer, `${subfolder}/${userId}/${timestamp}.webp`);
    }

    const ext = (path.extname(file.originalname) || '.mp4').toLowerCase();
    return this.put(
      `${subfolder}/${userId}/${timestamp}${ext}`,
      file.buffer,
      VIDEO_CONTENT_TYPES[ext] || file.mimetype,
    );
  }

  /**
   * Decodifica una imagen en formato Data URL base64, la comprime a WebP y la guarda.
   * Retorna la URL pública del archivo guardado.
   */
  async saveBase64Image(
    base64DataUrl: string,
    userId: string,
    subfolder: string = 'catalog',
  ): Promise<string> {
    // Extraer los bytes de la cadena Data URL (data:image/jpeg;base64,XXXX)
    const matches = base64DataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Formato de imagen base64 inválido.');
    }
    const mimeType = matches[1];
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new Error(`Tipo de archivo no permitido: ${mimeType}. Solo JPG, PNG o WebP.`);
    }
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error('La imagen no puede superar 15 MB.');
    }

    return this.saveAsWebP(buffer, `${subfolder}/${userId}/${Date.now()}.webp`);
  }

  /**
   * Adjunto del chat de una cotización: una imagen (se comprime a WebP) o un PDF (se guarda tal cual).
   * Nada más: ni documentos de Office ni ZIP. Recibe un Data URL base64.
   */
  async saveChatAttachment(dataUrl: string, userId: string): Promise<{ url: string; type: 'image' | 'pdf'; size: number }> {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/.]+);base64,(.+)$/);
    if (!matches) throw new Error('Archivo inválido.');
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      if (buffer.length > MAX_IMAGE_SIZE) throw new Error('La imagen no puede superar 15 MB.');
      const url = await this.saveAsWebP(buffer, `chat/${userId}/${nombre}.webp`);
      return { url, type: 'image', size: buffer.length };
    }
    if (mimeType === 'application/pdf') {
      if (buffer.length > MAX_PDF_SIZE) throw new Error('El PDF no puede superar 10 MB.');
      // Se mira el contenido, no solo lo que dice el navegador: un PDF empieza con "%PDF".
      if (buffer.subarray(0, 4).toString('latin1') !== '%PDF') throw new Error('El archivo no es un PDF válido.');
      const url = await this.put(`chat/${userId}/${nombre}.pdf`, buffer, 'application/pdf');
      return { url, type: 'pdf', size: buffer.length };
    }
    throw new Error('Solo se pueden enviar imágenes (JPG, PNG, WebP) o PDF.');
  }

  /** Si la URL apunta a un archivo guardado por este servicio. */
  isStoredFile(fileUrl: string): boolean {
    return fileUrl.startsWith(this.publicBaseUrl()) || fileUrl.startsWith(this.uploadsBaseUrl);
  }

  /**
   * Elimina un archivo dado su URL pública.
   * Nunca falla: si el archivo no existe o el borrado no se puede hacer, solo
   * lo registra. Un archivo huérfano no justifica romper la operación que lo
   * pidió.
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      if (this.supabase && fileUrl.startsWith(this.publicBaseUrl())) {
        const objectPath = fileUrl.slice(this.publicBaseUrl().length + 1);
        const res = await fetch(`${this.supabase.url}/storage/v1/object/${this.supabase.bucket}`, {
          method: 'DELETE',
          headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: [objectPath] }),
        });
        if (!res.ok) this.logger.warn(`No se pudo borrar ${objectPath}: ${res.status} ${await res.text()}`);
        return;
      }

      // Archivos en disco: los de desarrollo, o los viejos de antes de Supabase.
      const relativePath = fileUrl.replace(this.uploadsBaseUrl, '');
      const filePath = path.join(this.uploadsPath, relativePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn(`No se pudo borrar ${fileUrl}: ${error}`);
    }
  }

  /**
   * Comprime la imagen a WebP (máx 1000px ancho).
   * Esto NO bloquea el Event Loop de Node.js porque sharp usa libuv internamente.
   */
  private async saveAsWebP(buffer: Buffer, objectPath: string): Promise<string> {
    const webp = await sharp(buffer)
      .resize({ width: 1000, withoutEnlargement: true }) // Nunca aumenta el tamaño
      .webp({ quality: 80 })                              // Calidad 80% = excelente balance tamaño/nitidez
      .toBuffer();
    return this.put(objectPath, webp, 'image/webp');
  }

  /** Guarda los bytes en el destino configurado y devuelve la URL pública. */
  private async put(objectPath: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.supabase) {
      const filePath = path.join(this.uploadsPath, objectPath);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, body);
      return `${this.uploadsBaseUrl}/${objectPath}`;
    }

    await this.ensureBucket();
    const res = await fetch(`${this.supabase.url}/storage/v1/object/${this.supabase.bucket}/${objectPath}`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': contentType, 'x-upsert': 'false' },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      throw new Error(`Supabase Storage rechazó la subida (${res.status}): ${await res.text()}`);
    }
    return `${this.publicBaseUrl()}/${objectPath}`;
  }

  /**
   * Crea el bucket la primera vez, como público: las fotos se muestran con
   * una URL directa en <img>, sin firmar. Se hace una sola vez por proceso.
   */
  private ensureBucket(): Promise<void> {
    this.bucketReady ??= (async () => {
      const { url, bucket } = this.supabase!;
      const existing = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers: this.authHeaders() });

      if (existing.ok) {
        const info = await existing.json();
        if (!info.public) {
          this.logger.error(
            `El bucket "${bucket}" existe pero es privado: las fotos no se verán. Márcalo como público en Supabase.`,
          );
        }
        // El bucket se creó aceptando solo imágenes y video; los PDF del chat necesitan su tipo.
        const tipos: string[] | null = Array.isArray(info.allowed_mime_types) ? info.allowed_mime_types : null;
        if (tipos && tipos.length > 0 && !tipos.includes('application/pdf')) {
          const res = await fetch(`${url}/storage/v1/bucket/${bucket}`, {
            method: 'PUT',
            headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ public: info.public, file_size_limit: info.file_size_limit, allowed_mime_types: [...tipos, 'application/pdf'] }),
          });
          if (res.ok) this.logger.log(`Bucket "${bucket}" ahora acepta PDF`);
          else this.logger.error(`No se pudo habilitar PDF en el bucket "${bucket}" (${res.status}): ${await res.text()}`);
        }
        return;
      }

      const created = await fetch(`${url}/storage/v1/bucket`, {
        method: 'POST',
        headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bucket,
          name: bucket,
          public: true,
          file_size_limit: MAX_VIDEO_SIZE,
          allowed_mime_types: ['image/webp', 'application/pdf', ...ALLOWED_VIDEO_TYPES],
        }),
      });
      if (!created.ok) {
        throw new Error(`No se pudo crear el bucket "${bucket}" (${created.status}): ${await created.text()}`);
      }
      this.logger.log(`Bucket "${bucket}" creado en Supabase Storage`);
    })().catch((error) => {
      this.bucketReady = null; // que el próximo intento vuelva a probar
      throw error;
    });
    return this.bucketReady;
  }

  /**
   * Las claves nuevas de Supabase (sb_secret_…) no son JWT: van solo en el
   * encabezado apikey, y en Authorization fallan. La service_role vieja sí
   * es un JWT y necesita ambos.
   */
  private authHeaders(): Record<string, string> {
    const key = this.supabase!.key;
    return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
  }

  private publicBaseUrl(): string {
    return this.supabase
      ? `${this.supabase.url}/storage/v1/object/public/${this.supabase.bucket}`
      : this.uploadsBaseUrl;
  }

  private validateFile(file: Express.Multer.File): void {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);

    if (!isImage && !isVideo) {
      throw new UnsupportedMediaTypeException(
        `Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan imágenes (JPG, PNG, WebP) y videos (MP4, MOV, WebM).`,
      );
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      throw new UnsupportedMediaTypeException('La imagen no puede superar 15MB.');
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      throw new UnsupportedMediaTypeException('El video no puede superar 50MB.');
    }
  }
}
