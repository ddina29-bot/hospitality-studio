
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Interface for AI quality audits.
 */
export interface AIAuditResult {
  status: 'pass' | 'fail';
  feedback: string;
}

/**
 * Provides property-specific operational tips for the cleaner.
 */
export const getPropertyIntel = async (propertyName: string, propertyType: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `You are a helpful Operations AI for RESET STUDIO. 
    A cleaner is starting a shift at "${propertyName}" (Type: ${propertyType}).
    Provide ONE high-impact "Pro-Tip" for this unit. 
    It should sound like it comes from historical maintenance records (e.g., mention a tricky lock, a specific light switch, or a balcony drain check).
    Keep it to exactly one sentence. Be professional and helpful.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    return response.text || "Ensure the standard Studio quality protocol is strictly followed.";
  } catch (error) {
    console.error("AI Intel Error:", error);
    return "Standard operational checks active. Please proceed with the assigned protocol.";
  }
};

/**
 * Dynamic "Pulse" update for field staff on their dashboard.
 */
export const getCleanerBriefing = async (data: {
  pendingShifts: number,
  completedToday: number,
  reportedIssues: number
}): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `You are the AI Operations Director for RESET STUDIO. 
    Speak to a Field Operator (Cleaner) based on their current progress:
    - Pending Tasks Today: ${data.pendingShifts}
    - Completed Successfully: ${data.completedToday}
    - Reported Incidents/Issues: ${data.reportedIssues}

    PERSONALITY: Encouraging, authoritative, and efficient.
    GOAL: Acknowledge their hard work or motivate them to clear the remaining queue. 
    Mention that quality evidence is our most valuable asset. 
    Max 2-3 sentences. No lists. Single paragraph.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    return response.text || "Operational queue active. Ensure high-quality evidence is captured for all deployments.";
  } catch (error) {
    return "Operations stable. Please proceed with your assigned deployment queue.";
  }
};

/**
 * Strategic operational analysis for the Management Dashboard.
 */
export const getOperationalBriefing = async (data: {
  activeShifts: any[],
  pendingAudits: any[],
  supplyDebtCount: number,
  anomalies: any[]
}): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `You are the AI Operations Director for RESET STUDIO. 
    Analyze this real-time data and provide a concise, 3-sentence "Strategic Executive Brief".
    
    DATA:
    - Active Shifts: ${data.activeShifts.length}
    - Shifts Awaiting Audit: ${data.pendingAudits.length}
    - Units with Supply Debt: ${data.supplyDebtCount}
    - Recent Anomalies: ${data.anomalies.length}

    PERSONALITY: Professional, efficient, slightly futuristic, and commanding. 
    GOAL: Point out the highest risk factor immediately. If everything is clear, be briefly encouraging.
    
    Do not use lists. Just a single paragraph of max 3 sentences.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    return response.text || "Operations stable. No critical interventions required at this moment.";
  } catch (error) {
    console.error("Briefing Engine Error:", error);
    return "The AI Analysis engine is currently recalibrating. Please monitor the live boards for any urgent anomalies.";
  }
};

/**
 * Analyzes a hospitality cleaning photo using Gemini Vision.
 */
export const analyzeCleaningPhoto = async (photoUrl: string, taskLabel: string): Promise<AIAuditResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const absoluteUrl = photoUrl.startsWith('/') ? window.location.origin + photoUrl : photoUrl;
    const imageResponse = await fetch(absoluteUrl);
    if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    
    const blob = await imageResponse.blob();
    const mimeType = blob.type || 'image/jpeg';

    // Fix: Correctly extract base64 data by splitting at the comma of the data URI
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.includes(',')) {
          resolve(result.split(',')[1]);
        } else {
          reject(new Error("Failed to read image as base64 data URI"));
        }
      };
      reader.onerror = () => reject(new Error("Error reading image data"));
      reader.readAsDataURL(blob);
    });

    const prompt = `You are a sophisticated Hospitality Quality Inspector for RESET STUDIO.
    Audit this photo for task: "${taskLabel}". Check for symmetry, detail, and brand standards.
    Response format: JSON with "status" (pass/fail) and "feedback" (professional critique).`;

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
            status: { type: Type.STRING },
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
    console.error("Gemini Audit Error:", error);
    throw error;
  }
};
