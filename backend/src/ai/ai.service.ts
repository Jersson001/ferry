import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY no está configurado en el .env');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async parseMaterialsList(text: string): Promise<any[]> {
    if (!this.genAI) {
      throw new HttpException('El servicio de IA no está configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      // Definimos el esquema esperado para forzar a Gemini a devolver JSON válido
      const responseSchema: Schema = {
        type: SchemaType.ARRAY,
        description: 'Lista de materiales de construcción extraídos del texto.',
        items: {
          type: SchemaType.OBJECT,
          properties: {
            name: {
              type: SchemaType.STRING,
              description: 'El nombre genérico o comercial del material (ej: "Cemento Gris", "Varilla corrugada")',
            },
            quantity: {
              type: SchemaType.INTEGER,
              description: 'La cantidad solicitada. Solo el número.',
            },
            unit: {
              type: SchemaType.STRING,
              description: 'La unidad de medida (ej: "bultos", "unidades", "metros", "kg")',
            },
          },
          required: ['name', 'quantity', 'unit'],
        },
      };

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const prompt = `Analiza el siguiente texto y extrae una lista de materiales de construcción con su nombre, cantidad numérica y unidad de medida. Texto: "${text}"`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const jsonText = response.text();
      
      // Parseamos la respuesta segura
      const parsedItems = JSON.parse(jsonText);
      return Array.isArray(parsedItems) ? parsedItems : [];
      
    } catch (error) {
      this.logger.error('Error al procesar con Gemini', error);
      throw new HttpException('No se pudo procesar la lista con Inteligencia Artificial', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async analyzeImage(base64Image: string): Promise<any[]> {
    if (!this.genAI) {
      throw new HttpException('El servicio de IA no está configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const responseSchema: Schema = {
        type: SchemaType.ARRAY,
        description: 'Lista de materiales de construcción extraídos de la imagen.',
        items: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING, description: 'Nombre del material' },
            quantity: { type: SchemaType.INTEGER, description: 'Cantidad necesaria (solo el número entero)' },
            unit: { type: SchemaType.STRING, description: 'Unidad de medida (ej: bultos, metros, und)' },
          },
          required: ['name', 'quantity', 'unit'],
        },
      };

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const prompt = "Extrae la lista de materiales de construcción de esta imagen. Devuelve un arreglo de objetos con 'name' (nombre), 'quantity' (cantidad entera), y 'unit' (unidad de medida, si no es clara usa 'und').";

      // Limpiar prefijo base64 y detectar mimeType real desde el header del Data URL
      let base64Data: string;
      let mimeType = 'image/jpeg'; // fallback seguro
      if (base64Image.includes(',')) {
        const parts = base64Image.split(',');
        base64Data = parts[1];
        const mimeMatch = parts[0].match(/data:([^;]+);/);
        if (mimeMatch) mimeType = mimeMatch[1];
      } else {
        base64Data = base64Image;
      }

      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType,
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const jsonText = result.response.text();
      
      const parsedItems = JSON.parse(jsonText);
      return Array.isArray(parsedItems) ? parsedItems : [];
      
    } catch (error) {
      this.logger.error('Error al analizar imagen con Gemini', error);
      throw new HttpException('No se pudo analizar la imagen con Inteligencia Artificial', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
