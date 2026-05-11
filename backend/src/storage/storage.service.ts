import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;  // 15MB antes de comprimir
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50MB

@Injectable()
export class StorageService {
  private readonly uploadsPath: string;
  private readonly uploadsBaseUrl: string;

  constructor() {
    this.uploadsPath = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
    this.uploadsBaseUrl = process.env.UPLOADS_BASE_URL || 'http://localhost:3000/uploads';
    // Asegurar que el directorio de uploads existe al iniciar
    if (!fs.existsSync(this.uploadsPath)) {
      fs.mkdirSync(this.uploadsPath, { recursive: true });
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

    // Crear carpeta del usuario si no existe
    const userDir = path.join(this.uploadsPath, subfolder, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const timestamp = Date.now();
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);

    if (isImage) {
      return this.saveAsWebP(file.buffer, userDir, userId, timestamp, subfolder);
    } else {
      return this.saveVideo(file.buffer, file.originalname, userDir, userId, timestamp, subfolder);
    }
  }

  /**
   * Comprime la imagen a WebP (máx 1000px ancho) y la guarda de forma asíncrona.
   * Esto NO bloquea el Event Loop de Node.js porque sharp usa libuv internamente.
   */
  private async saveAsWebP(
    buffer: Buffer,
    userDir: string,
    userId: string,
    timestamp: number,
    subfolder: string,
  ): Promise<string> {
    const filename = `${timestamp}.webp`;
    const filePath = path.join(userDir, filename);

    await sharp(buffer)
      .resize({ width: 1000, withoutEnlargement: true }) // Nunca aumenta el tamaño
      .webp({ quality: 80 })                              // Calidad 80% = excelente balance tamaño/nitidez
      .toFile(filePath);

    return `${this.uploadsBaseUrl}/${subfolder}/${userId}/${filename}`;
  }

  private async saveVideo(
    buffer: Buffer,
    originalName: string,
    userDir: string,
    userId: string,
    timestamp: number,
    subfolder: string,
  ): Promise<string> {
    const ext = path.extname(originalName) || '.mp4';
    const filename = `${timestamp}${ext}`;
    const filePath = path.join(userDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `${this.uploadsBaseUrl}/${subfolder}/${userId}/${filename}`;
  }

  /**
   * Elimina un archivo del disco dado su URL pública.
   * Nunca lanza un error si el archivo no existe (ya fue borrado o la URL es inválida).
   */
  deleteFile(fileUrl: string): void {
    try {
      // Convertir URL pública a ruta de disco
      const relativePath = fileUrl.replace(this.uploadsBaseUrl, '');
      const filePath = path.join(this.uploadsPath, relativePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Silencioso: el archivo no existe, no es crítico
    }
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
