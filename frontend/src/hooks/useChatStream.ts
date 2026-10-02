import { useState, useRef, useCallback } from 'react';
import type { Message, Citation, AppSettings } from '../types';

interface UseChatStreamProps {
  settings: AppSettings;
}

export function useChatStream({ settings }: UseChatStreamProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: "Hello! I am your **Personal AI Assistant** powered by **Ollama (Mistral)** and **MongoDB Atlas Vector Search**.\n\nI can answer questions with real-time citations from your indexed documents. Ask me anything, or upload documents using the **Knowledge Base** drawer!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorBanner, setErrorBanner] = useState<{ message: string; statusCode?: number; retryFn?: () => void } | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      // Mark latest assistant message as finished
      setMessages((prev) =>
        prev.map((msg, idx) => (idx === prev.length - 1 && msg.isStreaming ? { ...msg, isStreaming: false } : msg))
      );
    }
  }, []);

  const sendMessage = useCallback(
    async (userInput: string, retryAttempt: number = 0) => {
      if (!userInput.trim() || isStreaming) return;

      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `assistant-${Date.now()}`;
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Add user message if this is first attempt
      if (retryAttempt === 0) {
        const userMsg: Message = {
          id: userMessageId,
          role: 'user',
          content: userInput.trim(),
          timestamp,
        };

        const initialAssistantMsg: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp,
          isStreaming: true,
          citations: [],
        };

        setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
      } else {
        // Reset the assistant message during retry
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp,
            isStreaming: true,
            citations: [],
          },
        ]);
      }

      setIsStreaming(true);
      setErrorBanner(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const chatHistoryPayload = messages
          .filter((m) => m.role !== 'system')
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await fetch(`${settings.backendUrl}/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: userInput,
            model_name: settings.modelName,
            temperature: settings.temperature,
            custom_system_prompt: settings.systemPrompt || undefined,
            chat_history: chatHistoryPayload,
          }),
          signal: controller.signal,
        });

        // Intercept HTTP Error status codes
        if (!response.ok) {
          let errorMsg = `Server error (${response.status}): ${response.statusText}`;
          if (response.status === 401) {
            errorMsg = 'Authentication Error (401): Please verify your Groq API Key in Settings.';
          } else if (response.status === 429) {
            errorMsg = 'Rate Limit Exceeded (429): Groq API limit reached. Retrying with exponential backoff...';
          } else if (response.status >= 500) {
            errorMsg = 'Backend Server Error (500): RAG chain encountered an internal error.';
          }

          // Handle automatic retry with exponential backoff for 429 / 503
          if ((response.status === 429 || response.status === 503) && retryAttempt < 3) {
            const backoffMs = Math.pow(2, retryAttempt) * 1500;
            console.log(`Retrying in ${backoffMs}ms (attempt ${retryAttempt + 1})...`);
            setTimeout(() => {
              sendMessage(userInput, retryAttempt + 1);
            }, backoffMs);
            return;
          }

          throw new Error(errorMsg);
        }

        if (!response.body) {
          throw new Error('ReadableStream not supported by the browser.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedContent = '';
        let citations: Citation[] = [];
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = 'message';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.replace('event:', '').trim();
            } else if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.replace('data:', '').trim();
              try {
                const parsed = JSON.parse(dataStr);

                if (currentEvent === 'citations' && Array.isArray(parsed)) {
                  citations = parsed;
                  setMessages((prev) =>
                    prev.map((msg, idx) => (idx === prev.length - 1 ? { ...msg, citations } : msg))
                  );
                } else if (currentEvent === 'message' && parsed.chunk) {
                  accumulatedContent += parsed.chunk;
                  setMessages((prev) =>
                    prev.map((msg, idx) =>
                      idx === prev.length - 1
                        ? { ...msg, content: accumulatedContent, citations }
                        : msg
                    )
                  );
                } else if (currentEvent === 'error') {
                  throw new Error(parsed.error || 'Unknown streaming error');
                }
              } catch (parseErr) {
                // If json parsing fails, treat as raw chunk if appropriate
                console.warn('Could not parse SSE JSON:', dataStr);
              }
            }
          }
        }

        // Finish streaming
        setIsStreaming(false);
        abortControllerRef.current = null;
        setMessages((prev) =>
          prev.map((msg, idx) => (idx === prev.length - 1 ? { ...msg, isStreaming: false } : msg))
        );
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Stream aborted by user.');
        } else {
          console.error('Chat stream error:', err);
          const errorMsg = err.message || 'An unexpected connection error occurred.';
          setErrorBanner({
            message: errorMsg,
            retryFn: () => sendMessage(userInput, 0),
          });

          setMessages((prev) =>
            prev.map((msg, idx) =>
              idx === prev.length - 1
                ? {
                    ...msg,
                    content: msg.content || `⚠️ **Error occurred**: ${errorMsg}`,
                    isStreaming: false,
                    error: errorMsg,
                  }
                : msg
            )
          );
        }
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, messages, settings]
  );

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation history cleared. How can I assist you with your knowledge base today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setErrorBanner(null);
  }, []);

  return {
    messages,
    isStreaming,
    errorBanner,
    sendMessage,
    stopGeneration,
    clearChat,
    setErrorBanner,
  };
}
