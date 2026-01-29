
// Frontend Service for AI
// Proxies requests to the Node.js backend to keep the API_KEY secure.

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
      throw new Error('Failed to communicate with Studio Intelligence');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("AI Service Error:", error);
    return "Studio Intelligence is currently offline. Please check your internet connection.";
  }
};
