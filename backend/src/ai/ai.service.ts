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
        model: 'gemini-3.6-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const prompt = `Analiza el siguiente texto y extrae una lista de artículos o materiales solicitados con su nombre, cantidad numérica y unidad de medida. IMPORTANTE: NO descartes NINGÚN artículo mencionado, incluso si no parece un material de construcción tradicional (ej: canecas, escobas, herramientas, elementos de limpieza, misceláneos). Todo lo que el usuario pida debe incluirse. Texto: "${text}"`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const jsonText = response.text();
      
      // Parseamos la respuesta segura
      const parsedItems = JSON.parse(jsonText);
      return Array.isArray(parsedItems) ? parsedItems : [];
      
    } catch (error) {
      this.logger.error('Error al procesar con Gemini', error);
      this.handleGeminiError(error, 'No se pudo procesar la lista con Inteligencia Artificial');
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
        model: 'gemini-3.6-flash',
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
      this.handleGeminiError(error, 'No se pudo analizar la imagen con Inteligencia Artificial');
    }
  }

  async smartMatch(requestedItems: any[], storeCatalog: any[]): Promise<any> {
    if (!this.genAI) {
      throw new HttpException('El servicio de IA no está configurado', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const responseSchema: Schema = {
        type: SchemaType.OBJECT,
        description: 'Resultado del emparejamiento entre los ítems solicitados y el catálogo de la tienda.',
        properties: {
          matches: {
            type: SchemaType.ARRAY,
            description: 'Lista de ítems analizados.',
            items: {
              type: SchemaType.OBJECT,
              properties: {
                requestedName: { type: SchemaType.STRING, description: 'El nombre del ítem solicitado originalmente' },
                status: { type: SchemaType.STRING, description: 'Debe ser "EXACT_MATCH", "ALTERNATIVE", o "NOT_FOUND"' },
                suggestedCatalogId: { type: SchemaType.STRING, description: 'El ID del producto en el catálogo de la tienda (en blanco si NOT_FOUND)' },
                suggestedQuantity: { type: SchemaType.NUMBER, description: 'La cantidad sugerida basada en la presentación del producto' },
                reasoning: { type: SchemaType.STRING, description: 'Breve justificación de por qué se sugirió este producto o por qué no se encontró.' },
              },
              required: ['requestedName', 'status', 'suggestedCatalogId', 'suggestedQuantity', 'reasoning'],
            }
          }
        },
        required: ['matches'],
      };

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3.6-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const prompt = `
Eres un ferretero experto y un asistente de ventas.
Tienes un pedido de un cliente y tu catálogo de productos.
Tu objetivo es cruzar la lista de materiales solicitados con tu catálogo.

Para cada ítem solicitado, debes indicar:
1. Si hay un "EXACT_MATCH" (tienes el producto exacto o muy similar).
2. Si hay un "ALTERNATIVE" (no tienes la marca exacta o medida, pero tienes un reemplazo válido).
3. Si es "NOT_FOUND" (no manejas nada que sirva).

IMPORTANTE: 
- Solo puedes sugerir productos usando el campo "id" que viene en el catálogo. No inventes IDs ni productos.
- Ajusta la "suggestedQuantity" si la unidad de venta del catálogo es diferente a la solicitada (ej. si piden 10 kg y vendes bultos de 50 kg, sugiere 1 bulto).

Pedido del cliente:
${JSON.stringify(requestedItems, null, 2)}

Catálogo de tu Ferretería:
${JSON.stringify(storeCatalog, null, 2)}
`;

      const result = await model.generateContent(prompt);
      const jsonText = result.response.text();
      return JSON.parse(jsonText);
      
    } catch (error) {
      this.logger.error('Error al realizar Smart Match con Gemini', error);
      this.handleGeminiError(error, 'No se pudo analizar el pedido con Inteligencia Artificial');
    }
  }

  private handleGeminiError(error: any, defaultMessage: string): never {
    const errorMessage = error?.message?.toLowerCase() || '';
    const status = error?.status;

    if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('too many requests')) {
      throw new HttpException(
        'El servicio de IA está temporalmente saturado o sin cuota. Por favor, intenta de nuevo en unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 503 de Google: el modelo está sobrecargado. Es transitorio y se resuelve
    // reintentando, así que lo tratamos como saturación y no como fallo de config.
    if (
      status === 503 ||
      errorMessage.includes('high demand') ||
      errorMessage.includes('overloaded') ||
      errorMessage.includes('service unavailable')
    ) {
      throw new HttpException(
        'El servicio de IA está saturado en este momento. Por favor, intenta de nuevo en unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 401/403: la credencial de Gemini es inválida o el proyecto no tiene acceso.
    // No es un fallo transitorio: reintentar no sirve, hay que revisar la configuración.
    if (
      status === 401 ||
      status === 403 ||
      errorMessage.includes('permission_denied') ||
      errorMessage.includes('denied access') ||
      errorMessage.includes('api key not valid')
    ) {
      throw new HttpException(
        'El servicio de IA no está disponible por un problema de configuración. Puedes agregar los materiales a mano mientras se resuelve.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw new HttpException(defaultMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
