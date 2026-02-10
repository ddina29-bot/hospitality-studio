
import { GoogleGenAI, Type } from "@google/genai";

export interface AIAuditResult {
  status: 'pass' | 'fail';
  feedback: string;
}

/**
 * Analyzes a hospitality cleaning photo using Gemini Vision.
 * Detects quality standards with a witty, slightly cynical, but fair personality.
 */
export const analyzeCleaningPhoto = async (photoUrl: string, taskLabel: string): Promise<AIAuditResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Ensure the URL is absolute if it's an uploaded file
    const absoluteUrl = photoUrl.startsWith('/') ? window.location.origin + photoUrl : photoUrl;

    const imageResponse = await fetch(absoluteUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }
    
    const blob = await imageResponse.blob();
    const mimeType = blob.type || 'image/jpeg';

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.includes(',')) {
          resolve(result.split(',')[1]);
        } else {
          reject(new Error("Invalid base64 conversion"));
        }
      };
      reader.onerror = () => reject(new Error("Error reading image data"));
      reader.readAsDataURL(blob);
    });

    const prompt = `You are a sophisticated, slightly cynical, and highly particular Hospitality Quality Inspector for RESET STUDIO. 
    You have incredibly high standards and a dry sense of humor, but you aren't mean-spirited.

    Task: Audit this photo for the cleaning task: "${taskLabel}".
    
    PERSONALITY RULES:
    1. If the work is perfect: Be pleasantly surprised and perhaps a bit suspicious. Use lines like "I'm almost impressed. Did a professional do this, or was it a lucky accident?" or "Functional AND aesthetic. You're actually making the standard look achievable."
    2. If the work fails: Be witty and dry. Point out the flaws with a "tired mentor" tone. Compare a wrinkled bed to a "modern art installation of a mountain range" or a missed spot to "an interesting design choice that we definitely shouldn't repeat."
    3. Be brief, professional, and charmingly sarcastic. Avoid being cruel or insulting.
    
    CRITERIA: Check symmetry, pillow fluffing, straight runners, and surface shine.
    
    Response format: JSON with "status" (pass/fail) and "feedback" (the sarcastic but fair critique).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ['pass', 'fail'] },
            feedback: { type: Type.STRING }
          },
          required: ['status', 'feedback']
        }
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("AI returned empty response");

    return JSON.parse(jsonStr);

  } catch (error: any) {
    console.error("Gemini Audit Detailed Error:", error);
    throw error;
  }
};
