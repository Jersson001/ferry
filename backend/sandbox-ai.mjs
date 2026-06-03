import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Asegúrate de correr esto desde la carpeta backend o proveer el API KEY en tu entorno
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY no encontrada en las variables de entorno.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testSmartMatch() {
  console.log('--- Iniciando prueba de Smart Match AI (Gemini 1.5 Flash) ---');
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash-latest',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const requestedItems = [
    { name: 'Cemento gris', quantity: 10, unit: 'bultos' },
    { name: 'Varilla corrugada media pulgada', quantity: 50, unit: 'varillas' },
    { name: 'Pintura vinilo roja', quantity: 2, unit: 'galones' }
  ];

  const storeCatalog = [
    { id: 'item_101', name: 'Cemento Gris Argos 50kg', price: 25000 },
    { id: 'item_102', name: 'Cemento Blanco', price: 30000 },
    { id: 'item_201', name: 'Varilla Corrugada 1/2" x 6m', price: 15000 },
    { id: 'item_301', name: 'Pintura Vinilo Pintuco Rojo 1 Galón', price: 45000 }
  ];

  const prompt = `
Eres un ferretero experto y un asistente de ventas.
Tienes un pedido de un cliente y tu catálogo de productos.
Tu objetivo es cruzar la lista de materiales solicitados con tu catálogo.

Para cada ítem solicitado, debes indicar:
1. Si hay un "EXACT_MATCH".
2. Si hay un "ALTERNATIVE".
3. Si es "NOT_FOUND".

IMPORTANTE: 
- Solo puedes sugerir productos usando el campo "id".
- Ajusta la "suggestedQuantity".

Pedido del cliente:
${JSON.stringify(requestedItems, null, 2)}

Catálogo de tu Ferretería:
${JSON.stringify(storeCatalog, null, 2)}
`;

  try {
    const result = await model.generateContent(prompt);
    console.log('\n--- Respuesta cruda de la IA ---');
    console.log(result.response.text());
  } catch (error) {
    console.error('Error llamando a Gemini:', error);
  }
}

testSmartMatch();
