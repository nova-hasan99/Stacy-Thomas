'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { sendMessage } from '../lib/api';
import { generateUUID } from '../lib/uuid';
import {
  saveSession,
  loadSession,
  clearSession,
  getOrCreateSessionId,
  StoredMessage,
} from '../lib/storage';
import {
  MessageCircle,
  RefreshCw,
  Trash2,
  HeartCrack,
  Handshake,
  Youtube,
  Bot,
  Sparkles,
} from 'lucide-react';


interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLiveChatMode, setIsLiveChatMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Get or create session ID from cookie
    const currentSessionId = getOrCreateSessionId();
    setSessionId(currentSessionId);
    
    // Load existing session data for this session ID
    const storedSession = loadSession(currentSessionId);

    if (storedSession) {
      const restoredMessages = storedSession.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(restoredMessages);
      console.log(`Restored ${restoredMessages.length} messages for session ${currentSessionId}`);
    }

    setIsInitialized(true);
  }, []);

  // Save session whenever messages change
  useEffect(() => {
    if (isInitialized && sessionId && messages.length > 0) {
      const storedMessages: StoredMessage[] = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }));
      saveSession(sessionId, storedMessages);
      console.log(`Saved ${messages.length} messages for session ${sessionId}`);
    }
  }, [messages, sessionId, isInitialized]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (messageText: string, files?: File[]) => {
    if (!sessionId) {
      setError('Session not initialized');
      return;
    }

    // Handle file attachments
    let fullMessage = messageText;
    if (files && files.length > 0) {
      const fileList = files.map((f) => `📎 ${f.name} (${f.type})`).join('\n');
      fullMessage = messageText
        ? `${messageText}\n\nAttached files:\n${fileList}`
        : `Attached files:\n${fileList}`;
    }

    // Add user message
    const userMessage: Message = {
      id: generateUUID(),
      text: fullMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Use N8N webhook
      const response = await sendMessage(sessionId, messageText);

      // Add AI response
      const aiMessage: Message = {
        id: generateUUID(),
        text: response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setError('Failed to send message. Please try again.');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMessage = (messageText: string, isUser: boolean) => {
    const newMessage: Message = {
      id: generateUUID(),
      text: messageText,
      isUser: isUser,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleImageAnalysis = async (analysis: string, imageUrl: string) => {
    // Add the image analysis as both user message (with image) and AI response
    const userMessage: Message = {
      id: generateUUID(),
      text: `[Image uploaded for analysis]`,
      isUser: true,
      timestamp: new Date(),
    };

    const aiMessage: Message = {
      id: generateUUID(),
      text: `**Image Analysis:**\n\n${analysis}`,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, aiMessage]);
  };

  const handleNewChat = () => {
    // Create a new session ID and clear current messages
    const newSessionId = generateUUID();
    setSessionId(newSessionId);
    setMessages([]);
    setError(null);
    
    // Update cookie with new session ID
    const storedMessages: StoredMessage[] = [];
    saveSession(newSessionId, storedMessages);
    console.log(`Started new chat with session ${newSessionId}`);
  };

  const handleClearHistory = () => {
    if (
      confirm(
        'Are you sure you want to clear this chat session? This action cannot be undone.'
      )
    ) {
      // Clear current session data
      clearSession(sessionId);
      handleNewChat();
    }
  };

  const handleExportChat = () => {
    const chatData = {
      sessionId,
      messages: messages.map((msg) => ({
        text: msg.text,
        isUser: msg.isUser,
        timestamp: msg.timestamp.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${sessionId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 pb-1">
            <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shadow-lg">
              <img
                src="/images/profile.jpg"
                alt=""
                className="h-full w-full object-cover rounded-full"
              />
            </div>


            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Stacy Thomas's Public KnowledgeBot
              </h1>
              {isInitialized && (
                <p className="text-sm text-gray-500">
                  {/* {messages.length > 0 ? `${messages.length} messages • Session: ${sessionId.slice(-8)}` : `Session: ${sessionId.slice(-8)}`} */}
                  {messages.length > 0 && `${messages.length} messages`}

                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              New Chat
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {!isInitialized ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-6 shadow-lg">
                <img
                  src="/images/profile.jpg"
                  alt=""
                  className="h-full w-full object-cover rounded-full"
                />
              </div>

              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-96 mx-auto"></div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-6 shadow-lg">
                {/* <MessageCircle className="w-10 h-10 text-emerald-600" /> */}
                <img
                  src="/images/profile.jpg"
                  alt=""
                  className="h-full w-full object-cover rounded-full"
                />
              </div>

              <h2 className="text-3xl font-bold text-gray-800 mb-3">
                Welcome to Stacy Thomas's Public KnowledgeBot
              </h2>
              <p className="text-gray-600 mb-8 max-w-lg mx-auto leading-relaxed">
                This assistant is based on Stacy Thomas's public content.
                Responses are for informational purposes only and may not be
                100% accurate. All intellectual property belongs to Stacy Thomas.
              </p>

              {/* Feature highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto mb-8">
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">
                    Smart Conversations
                  </h3>
                  <p className="text-sm text-gray-600">
                    Engage in natural, intelligent conversations
                  </p>
                </div>

                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">
                    Life Design
                  </h3>
                  <p className="text-sm text-gray-600">
                    Clinical psychologist leading Design Your Life, teaching resilience via CBT, mindfulness, hypnosis globally.
                  </p>
                </div>

                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Youtube className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1">
                    Video Resources
                  </h3>
                  <p className="text-sm text-gray-600">
                    Get specific video guidance from Stacy's content library
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Always show welcome section at the top */}
              <div className="text-center py-8 border-b border-gray-200/50 mb-8">
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <img
                    src="/images/profile.jpg"
                    alt=""
                    className="h-full w-full object-cover rounded-full"
                  />
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Stacy Thomas's Public KnowledgeBot
                </h3>
                <p className="text-gray-600 mb-6 max-w-lg mx-auto text-sm leading-relaxed">
                  This assistant is based on Stacy Thomas's public content.
                  Responses are for informational purposes only and may not be
                  100% accurate. All intellectual property belongs to Stacy Thomas.
                </p>

                {/* Feature highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl mx-auto">
                  <div className="text-center p-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <MessageCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1 text-sm">
                      Smart Conversations
                    </h4>
                    <p className="text-xs text-gray-600">
                      Engage in natural, intelligent conversations
                    </p>
                  </div>

                  <div className="text-center p-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Sparkles className="w-5 h-5 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1 text-sm">
                      Life Design
                    </h4>
                    <p className="text-xs text-gray-600">
                      Clinical psychologist leading Design Your Life, teaching resilience via CBT, mindfulness, hypnosis globally.
                    </p>
                  </div>

                  <div className="text-center p-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Youtube className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1 text-sm">
                      Video Resources
                    </h4>
                    <p className="text-xs text-gray-600">
                      Get specific video guidance from Stacy's content library
                    </p>
                  </div>
                </div>
              </div>

              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message.text}
                  isUser={message.isUser}
                  timestamp={message.timestamp}
                />
              ))}

              {isLoading && (
                <ChatMessage message="" isUser={false} isLoading={true} />
              )}
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 text-sm font-bold">!</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-red-800">
                    Something went wrong
                  </div>
                  <div className="text-sm text-red-600">{error}</div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {isInitialized && (
        <div>
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            showSuggestions={messages.length === 0}
            onAddMessage={handleAddMessage}
            onLiveChatModeChange={setIsLiveChatMode}
            isLiveChatMode={isLiveChatMode}
          />
        </div>
      )}
    </div>
  );
}