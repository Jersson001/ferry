import { GoogleGenAI, Type } from "@google/genai";
import { MaterialItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeMaterialImage = async (base64Image: string): Promise<MaterialItem[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Extract a list of construction materials from this image. Return a clean JSON array.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the material (e.g., Cemento Gris, Tubo PVC)" },
              quantity: { type: Type.STRING, description: "Quantity required (e.g., 5, 10kg)" },
              unit: { type: Type.STRING, description: "Unit of measurement if applicable (bultos, metros, und)" },
            },
            required: ["name", "quantity", "unit"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as MaterialItem[];
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback/Mock data in case of error (or empty API key in dev)
    return [
      { name: "Error leyendo imagen", quantity: "0", unit: "N/A" }
    ];
  }
};
