// Frontend Service for AI
// Strictly proxies requests to the Node.js backend to keep the API_KEY secure.

export const askHRAssistant = async (query: string): Promise<string> => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Studio Intelligence connection interrupted');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("AI Service Error:", error);
    return "Studio Intelligence is initializing or offline. Please check your admin configuration.";
  }
};