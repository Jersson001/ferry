import { GoogleGenAI, Type } from "@google/genai";
import { MaterialItem } from "../types";

const getApiKey = () => {
  const key = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!key) {
    console.error("No VITE_GEMINI_API_KEY found. Add it to your .env file.");
  }
  return key || "";
};

export const analyzeMaterialImage = async (base64Image: string): Promise<MaterialItem[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Image,
              },
            },
            {
              text: "Extract the list of construction materials from this image. Return an array of objects with 'name', 'quantity', and 'unit'. If the unit is not clear, use 'und'.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the material" },
              quantity: { type: Type.STRING, description: "Quantity needed" },
              unit: { type: Type.STRING, description: "Unit of measurement (e.g., bultos, metros, und)" },
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
    console.error("Error analyzing material image:", error);
    // Fallback to empty list or basic error handling
    return [];
  }
};

export const extractMaterialsFromText = async (textInput: string): Promise<MaterialItem[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `Extract the list of construction materials from the following text: "${textInput}". Return an array of objects with 'name', 'quantity', and 'unit'. If the unit is not clear, use 'und'.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.STRING },
              unit: { type: Type.STRING },
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
    console.error("Error extracting materials from text:", error);
    return [];
  }
};
