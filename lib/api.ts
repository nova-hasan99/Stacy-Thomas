export interface ChatMessage {
  sessionId: string;
  action: string;
  chatInput: string;
}

export interface ChatResponse {
  output: string;
}

export async function sendMessage(sessionId: string, message: string): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_CHATBOT_API_URL;
  
  if (!apiUrl) {
    throw new Error('Chatbot API URL not configured');
  }

  const payload: ChatMessage = {
    sessionId,
    action: "sendMessage",
    chatInput: message
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ChatResponse = await response.json();
    
    if (data && typeof data === 'object' && data.output) {
      return data.output;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}