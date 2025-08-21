'use client';

import React, { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Loader2,
  Paperclip,
  X,
  FileText,
  Image,
  Mic,
  MicOff,
  Camera,
  Plus,
  Square,
  Phone,
  PhoneOff,
} from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { VoiceIndicator } from './VoiceIndicator';
import { sendMessage } from '../lib/api';
import { generateUUID } from '../lib/uuid';

interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => void;
  isLoading: boolean;
  showSuggestions: boolean;
  onAddMessage?: (message: string, isUser: boolean) => void;
  onLiveChatModeChange?: (isLiveChat: boolean) => void;
  isLiveChatMode?: boolean;
}

export function ChatInput({
  onSendMessage,
  isLoading,
  showSuggestions,
  onAddMessage,
  onLiveChatModeChange,
  isLiveChatMode: externalLiveChatMode,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLiveChatMode, setIsLiveChatMode] = useState(externalLiveChatMode || false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [liveChatTranscript, setLiveChatTranscript] = useState('');
  const [sessionId] = useState(() => generateUUID());
  const [thinkingAudio, setThinkingAudio] = useState<HTMLAudioElement | null>(null);
  const [thinkingInterval, setThinkingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPlayingResponse, setIsPlayingResponse] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isListening,
    transcript,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const {
    isRecording,
    audioBlob,
    duration,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  // Voice level detection for microphone animation
  const startVoiceLevelDetection = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyserNode = context.createAnalyser();
      const source = context.createMediaStreamSource(stream);
      
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      
      setAudioContext(context);
      setAnalyser(analyserNode);
      
      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
      
      const updateVoiceLevel = () => {
        if (!analyserNode) return;
        
        analyserNode.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = Math.min(average / 50, 1); // Normalize to 0-1
        
        setVoiceLevel(normalizedLevel);
        animationFrameRef.current = requestAnimationFrame(updateVoiceLevel);
      };
      
      updateVoiceLevel();
    } catch (error) {
      console.error('Error setting up voice level detection:', error);
    }
  }, []);

  const stopVoiceLevelDetection = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
    
    setAnalyser(null);
    setVoiceLevel(0);
  }, [audioContext]);
  // Handle regular speech recognition (not live chat mode)
  useEffect(() => {
    if (transcript && !isLiveChatMode && !isProcessingVoice) {
      setMessage(transcript);
    }
  }, [transcript]);

  // Handle live chat mode transcript with better detection
  useEffect(() => {
    if (isLiveChatMode && transcript && !isProcessingVoice && !isPlayingResponse) {
      setLiveChatTranscript(transcript);
      // setLiveChatTranscript(prev => prev + ' ' + transcript);
      
      // Debounce: wait for user to stop talking
      const timeoutId = setTimeout(async () => {
        const finalText = transcript.trim();
        console.log('Live chat transcript:', finalText);
        
        if (finalText && finalText.length > 2) { // Minimum 3 characters
          console.log('Sending to backend:', finalText);
          await handleLiveChatMessage(finalText);
          resetTranscript();
          setLiveChatTranscript('');
        }
      }, 1500); // Wait 1.5 seconds after user stops talking

      return () => clearTimeout(timeoutId);
    }
  }, [transcript, isLiveChatMode, isProcessingVoice, isPlayingResponse, resetTranscript]);

  // Handle voice interruption - if user starts speaking while AI is talking
  useEffect(() => {
    if (isLiveChatMode && isListening && isPlayingResponse) {
      console.log('User interrupted AI response, stopping playback');

      // ✅ Stop AI voice immediately
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }

      stopContinuousThinking();
      setIsPlayingResponse(false);
      setIsProcessingVoice(false);

      // ✅ VERY IMPORTANT:
      resetTranscript();
      setLiveChatTranscript(''); // ✅ এটাও যোগ করো

      console.log('Ready for new user input after interruption');
    }
  }, [isLiveChatMode, isListening, isPlayingResponse, currentAudio, resetTranscript]);


  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

const handleLiveChatMessage = async (messageText: string) => {
  // Stop any current voice/audio before starting new one
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    setCurrentAudio(null);
  }

  stopContinuousThinking();
  setIsPlayingResponse(false);

  if (!messageText.trim() || isProcessingVoice) {
    console.log('Skipping message - empty or already processing');
    return;
  }

  setIsProcessingVoice(true);

  console.log('Processing live chat message:', messageText);

  try {
    const simpleGreetings = [
      'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
      'how are you', 'what\'s up', 'greetings', 'howdy', 'yo', 'thanks', 'thank you',
      'stop', 'cancel', 'quit', 'exit', 'bye', 'goodbye', 'see you later',
      'who are you', 'what is your name', 'tell me about yourself',
      'help', 'assist', 'support', 'can you help me', 'can you assist me'
    ];

    const isSimpleGreeting = simpleGreetings.some(greeting =>
      messageText.toLowerCase().includes(greeting) && messageText.length < 20
    );

    if (!isSimpleGreeting) {
      const thinkingMessages = [
      "Let me think about that for a moment... I want to give you the most thoughtful response I can.",
      "Hmm... I'm carefully going through everything you just said... making sure I don't miss anything important.",
      "Hold on a second... I'm searching my knowledge to find something that truly helps you.",
      "Just a little moment please... I'm organizing my thoughts before giving you the best answer I can.",
      "I'm still thinking about that... it's a great question, and I want to be sure I understand it fully.",
      "Let me look into that for you... this might take a few more seconds, but I'm on it.",
      "I’m reflecting on what you just said... trying to connect the dots before I speak.",
      "Give me just a bit more time... I want to be accurate, clear, and truly helpful in my reply.",
      "Alright... I’m close to finishing your answer... just reviewing the last piece of information.",
      "Thanks for your patience... I'm working carefully so I can support you the best way possible."
    ];


      const randomThinking = thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
      console.log('Playing thinking message:', randomThinking);

      // 🔊 Play initial one-time thinking message
      await speakText(randomThinking).catch(err => console.log('Thinking voice failed:', err));

      // 🔁 Start continuous background thinking loop
      startContinuousThinking();
    }

    // 🔄 Send to backend
    console.log('Sending to n8n endpoint...');
    const response = await sendMessage(sessionId, messageText);
    console.log('Received response from backend:', response);

    // 🛑 Stop thinking loop
    stopContinuousThinking();

    if (onAddMessage) {
      onAddMessage(messageText, true); // User message
      onAddMessage(response, false);   // AI response
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    setIsPlayingResponse(true);

    const voiceText = filterUrlsFromText(response);
    console.log('Converting to speech...');
    await speakText(voiceText);

  } catch (error) {
    console.error('Error in live chat:', error);
    stopContinuousThinking();
    await speakText("Sorry, I couldn't process your message. Please try again.");
  } finally {
    console.log('Live chat message processing complete');
    stopContinuousThinking(); // ✅ fallback stop
    setIsProcessingVoice(false);
    setIsPlayingResponse(false);
  }
};


  const filterUrlsFromText = (text: string): string => {
    // Remove URLs (http, https, www, and basic domain patterns)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s]*|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
    return text.replace(urlRegex, '').replace(/\s+/g, ' ').trim();
  };
  const speakText = async (text: string) => {
    if (!text || text.trim().length === 0) {
      console.error('Cannot speak empty text');
      return;
    }
    
    console.log('Speaking text:', text);
    
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      console.log('TTS API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('TTS API error:', errorText);
        throw new Error(`Failed to generate speech: ${response.status} ${errorText}`);
      }

      const audioBlob = await response.blob();
      console.log('Audio blob size:', audioBlob.size);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      setCurrentAudio(audio);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setCurrentAudio(null);
        setIsPlayingResponse(false);
        console.log('Voice response finished playing');
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setCurrentAudio(null);
        setIsPlayingResponse(false);
      };
      
      await audio.play();
      console.log('Audio playback started');
      
    } catch (error) {
      console.error('Error speaking text:', error);
    }
  };

  const startContinuousThinking = () => {
    // Create subtle background thinking sounds to keep user engaged
    const thinkingSounds = [
      "Hmm...",
      "Let me see...",
      "Still thinking...",
      "One moment...",
      "Processing...",
      "Almost there...",
      "Just a bit more...",
      "Working on it...",
      "Getting the information...",
      "Analyzing your question..."
    ];
    
    const playRandomThinkingSound = async () => {
      // Check if we should continue thinking
      if (!isProcessingVoice || !isLiveChatMode) {
        return;
      }
      
      const sound = thinkingSounds[Math.floor(Math.random() * thinkingSounds.length)];
      console.log('Playing thinking sound:', sound);
      
      try {
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: sound }),
        });

        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          setThinkingAudio(audio);
          
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setThinkingAudio(null);
            
            // Schedule next thinking sound if still processing
            if (isProcessingVoice && isLiveChatMode) {
              setTimeout(() => {
                playRandomThinkingSound();
              }, 1000 + Math.random() * 2000); // 1-3 seconds delay
            }
          };
          
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            setThinkingAudio(null);
            
            // Try again after error if still processing
            if (isProcessingVoice && isLiveChatMode) {
              setTimeout(() => {
                playRandomThinkingSound();
              }, 2000);
            }
          };
          
          await audio.play();
        }
      } catch (error) {
        console.log('Background thinking sound failed:', error);
        
        // Try again after error if still processing
        if (isProcessingVoice && isLiveChatMode) {
          setTimeout(() => {
            playRandomThinkingSound();
          }, 2000);
        }
      }
    };
    
    // Start the first thinking sound immediately
    playRandomThinkingSound();
  };
  
  const stopContinuousThinking = () => {
    if (thinkingAudio) {
      thinkingAudio.pause();
      thinkingAudio.currentTime = 0;
      setThinkingAudio(null);
    }
  };

  const handleSubmit = () => {
    if ((message.trim() || selectedFiles.length > 0) && !isLoading && !isLiveChatMode) {
      onSendMessage(message.trim(), selectedFiles);
      setMessage('');
      setSelectedFiles([]);
      setShowTools(false);
      // Reset transcript and stop listening when message is sent
      resetTranscript();
      if (isListening) {
        stopListening();
      }
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLiveChatMode) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleLiveChatToggle = () => {
    if (isLiveChatMode) {
      // Exit live chat mode
      console.log('Exiting live chat mode');
      
      // Stop all audio immediately
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
      
      if (thinkingAudio) {
        thinkingAudio.pause();
        thinkingAudio.currentTime = 0;
        setThinkingAudio(null);
      }
      
      // Stop voice level detection
      stopVoiceLevelDetection();
      
      setIsLiveChatMode(false);
      onLiveChatModeChange?.(false);
      if (isListening) {
        stopListening();
      }
      stopContinuousThinking();
      resetTranscript();
      setIsProcessingVoice(false);
      setIsPlayingResponse(false);
      setLiveChatTranscript('');
    } else {
      // Enter live chat mode
      console.log('Entering live chat mode');
      setIsLiveChatMode(true);
      onLiveChatModeChange?.(true);
      setLiveChatTranscript('');
      setMessage('');
      setSelectedFiles([]);
      setShowTools(false);
      if (speechSupported) {
        startListening();
        startVoiceLevelDetection();
      }
    }
  };

  const handleVoiceToggle = async () => {
    if (isLiveChatMode) return; // Don't allow manual voice toggle in live chat mode
    
    if (isListening) {
      // User manually stopping - stop listening
      stopListening();
    } else if (isRecording) {
      stopRecording();
    } else {
      if (speechSupported) {
        // Don't reset transcript when starting - keep accumulating
        startListening();
      } else {
        resetRecording();
        await startRecording();
      }
    }
  };

  // Remove transcribeAudio functionality safely
  useEffect(() => {
    const handleTranscription = async () => {
      if (audioBlob && !isRecording) {
        setIsTranscribing(true);
        try {
          // Transcription removed — you can integrate your own later
          resetRecording();
        } catch (error) {
          console.error('Transcription failed:', error);
        } finally {
          setIsTranscribing(false);
        }
      }
    };

    handleTranscription();
  }, [audioBlob, isRecording]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLiveChatMode) return; // Don't allow file uploads in live chat mode
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    setShowTools(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLiveChatMode) return; // Don't allow image uploads in live chat mode
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    setShowTools(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // If in live chat mode, render full-screen interface
  if (isLiveChatMode) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center z-50 animate-in fade-in duration-500">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4 animate-in slide-in-from-top duration-700">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg overflow-hidden animate-in zoom-in duration-500 delay-200">
                <img src="/images/assistnat.webp" alt="" className="h-full w-full" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 animate-in slide-in-from-left duration-500 delay-300">Live Chat Mode</h1>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="animate-in slide-in-from-left duration-500 delay-400">Active</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLiveChatToggle}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg animate-in slide-in-from-right duration-500 delay-300 hover:scale-105"
            >
              <PhoneOff className="w-4 h-4" />
              End Chat
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-32 animate-in fade-in duration-700 delay-200">
          <div className="text-center mb-12 animate-in slide-in-from-bottom duration-700 delay-400">
            <h2 className="text-4xl font-bold text-gray-800 mb-4 animate-in slide-in-from-bottom duration-700 delay-500">
              Let's end the pain, together.
            </h2>
            <p className="text-xl text-gray-600 mb-8 animate-in slide-in-from-bottom duration-700 delay-600">
              Start understanding your symptoms not fearing them...
            </p>
          </div>

          {/* Large Microphone Button */}
          <div className="relative mb-8 animate-in zoom-in duration-700 delay-700">
            <div className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              isListening && voiceLevel > 0.1
                ? 'bg-gradient-to-br from-blue-400 to-blue-600 scale-110' 
                : isListening
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 scale-105'
                : 'bg-gradient-to-br from-blue-500 to-blue-700 hover:scale-105 hover:shadow-3xl'
            }`}>
              <div className={`w-40 h-40 bg-white rounded-full flex items-center justify-center transition-all duration-200 ${
                isListening && voiceLevel > 0.1 ? 'scale-110' : ''
              }`}>
                <Mic className={`w-16 h-16 transition-all duration-200 ${
                  isListening && voiceLevel > 0.1 
                    ? 'text-blue-600 scale-125' 
                    : isListening 
                    ? 'text-blue-600 scale-110' 
                    : 'text-blue-500'
                }`} />
              </div>
            </div>
            
            {/* Voice-Responsive Listening Animation - Only when actually speaking */}
            {isListening && voiceLevel > 0.1 && (
              <>
                {/* Multiple animated rings for voice response */}
                <div 
                  className="absolute inset-0 rounded-full border-4 border-blue-300 animate-ping"
                  style={{ opacity: voiceLevel }}
                ></div>
                <div 
                  className="absolute inset-2 rounded-full border-2 border-blue-400 animate-ping" 
                  style={{ animationDelay: '0.2s', opacity: voiceLevel * 0.8 }}
                ></div>
                <div 
                  className="absolute inset-4 rounded-full border-2 border-blue-500 animate-ping" 
                  style={{ animationDelay: '0.4s', opacity: voiceLevel * 0.6 }}
                ></div>
                
                {/* Voice bars animation - responsive to voice level */}
                {/* <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 flex items-end gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-blue-500 rounded-full animate-pulse"
                      style={{
                        height: `${8 + (voiceLevel * 30) + (Math.random() * voiceLevel * 15)}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: `${0.3 + (voiceLevel * 0.4)}s`,
                      }}
                    />
                  ))}
                </div> */}
              </>
            )}
            
            {/* Subtle listening indicator when not speaking */}
            {isListening && voiceLevel <= 0.1 && (
              <div className="absolute inset-0 rounded-full border-2 border-blue-300 opacity-50 animate-pulse"></div>
            )}
            
            {/* Processing Animation */}
            {isProcessingVoice && (
              <div className="absolute inset-0 rounded-full border-4 border-orange-300 animate-spin"></div>
            )}
            
            {/* Speaking Animation */}
            {/* {currentAudio && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-green-300 animate-pulse"></div>
                <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 flex items-center gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 bg-green-500 rounded-full animate-bounce"
                      style={{
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </>
            )} */}
          </div>

          {/* Status Text */}
          {/* <div className="text-center mb-8 animate-in slide-in-from-bottom duration-700 delay-800">
            <p className="text-lg text-gray-600 mb-2">
              {isListening && liveChatTranscript 
                ? `"${liveChatTranscript.slice(0, 50)}${liveChatTranscript.length > 50 ? '...' : ''}"`
                : isProcessingVoice 
                ? "Processing your request..."
                : currentAudio 
                ? "Speaking... (speak to interrupt)"
                : thinkingAudio
                ? "Thinking..."
                : isListening && voiceLevel > 0.1
                ? "I can hear you..."
                : isListening
                ? "Listening... (start speaking)"
                : "Tap the circle to start recording"
              }
            </p>
          </div> */}

          <div className="text-center mb-8 animate-in slide-in-from-bottom duration-700 delay-800">
            <p className="text-lg text-gray-600 mb-2">
              {isListening && liveChatTranscript
                ? `"${liveChatTranscript.slice(0, 50)}${liveChatTranscript.length > 50 ? '...' : ''}"`
                : isProcessingVoice
                ? "Processing your request..."
                : currentAudio
                ? "Speaking..."
                : isListening
                ? "I'm hearing you..."
                : "Tap the circle to start recording"
              }
            </p>
          </div>



          {/* Control Buttons */}
          <div className="flex gap-4 animate-in slide-in-from-bottom duration-700 delay-900">
            <button
              onClick={handleLiveChatToggle}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 transform"
            >
              Stop
            </button>
            <button
              onClick={() => {
                if (currentAudio) {
                  currentAudio.pause();
                  setCurrentAudio(null);
                  setIsPlayingResponse(false);
                }
                if (thinkingAudio) {
                  thinkingAudio.pause();
                  setThinkingAudio(null);
                }
                stopContinuousThinking();
              }}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 transform"
              disabled={!currentAudio && !thinkingAudio}
            >
              Mute
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        {(isListening || isProcessingVoice || currentAudio || thinkingAudio) && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center gap-4 bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/20">
              {isListening && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className={`flex items-center gap-1 ${voiceLevel > 0.1 ? 'animate-pulse' : ''}`}>
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-blue-500 rounded-full animate-pulse"
                        style={{
                          height: voiceLevel > 0.1 ? `${8 + (voiceLevel * 16)}px` : '8px',
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: voiceLevel > 0.1 ? `${0.4 + (voiceLevel * 0.4)}s` : '1s',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">
                    {/* {voiceLevel > 0.1 ? 'Hearing you...' : 'Listening'} */}
                    {isListening && 'Hearing you...'}
                  </span>
                </div>
              )}
              {isProcessingVoice && (
                <div className="flex items-center gap-2 text-orange-600">
                  <div className="relative">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <div className="absolute inset-0 w-4 h-4 border-2 border-orange-300 rounded-full animate-ping"></div>
                  </div>
                  <span className="text-sm font-medium">Processing</span>
                </div>
              )}
              {currentAudio && (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="flex items-center gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                        style={{
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">Speaking</span>
                </div>
              )}
              {thinkingAudio && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <div className="flex items-center gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"
                        style={{
                          animationDelay: `${i * 0.3}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">Thinking</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`border-t shadow-lg transition-all duration-300 ${
      isLiveChatMode 
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
        : 'bg-white/80 backdrop-blur-sm'
    }`}>
      <div className="max-w-4xl mx-auto p-4">
        {isLiveChatMode && (
          <div className="mb-4 flex items-center justify-center gap-3 text-green-700 bg-green-100 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <Phone className="w-5 h-5" />
              <span className="font-medium">Live Chat Mode Active</span>
            </div>
            {isListening && (
              <div className="flex items-center gap-2">
                <VoiceIndicator isListening={true} />
                <span className="text-sm">
                  Listening... {liveChatTranscript && `"${liveChatTranscript.slice(0, 30)}${liveChatTranscript.length > 30 ? '...' : ''}"`}
                </span>
              </div>
            )}
            {isProcessingVoice && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
            {/* {currentAudio && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Speaking... (speak to interrupt)</span>
              </div>
            )} */}
            {thinkingAudio && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm"
              >
                {getFileIcon(file)}
                <span className="text-gray-700 truncate max-w-32">
                  {file.name}
                </span>
                <span className="text-gray-500 text-xs">
                  ({formatFileSize(file.size)})
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {(isListening || isRecording || isTranscribing) && !isLiveChatMode && (
          <div className="mb-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
            {isListening && (
              <>
                <VoiceIndicator isListening={true} />
                <span>Listening...</span>
              </>
            )}
            {isRecording && (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Recording... {formatDuration(duration)}
              </>
            )}
            {isTranscribing && (
              <>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Transcribing audio...
              </>
            )}
          </div>
        )}

        <div className={`relative rounded-3xl border shadow-sm focus-within:shadow-md transition-all duration-200 ${
          isLiveChatMode 
            ? 'bg-white border-green-300 focus-within:border-green-400' 
            : 'bg-white border-gray-200 focus-within:border-gray-300'
        }`}>
          <div className="flex items-end gap-2 p-3">
            {/* <div className="relative">
              <button
                onClick={() => !isLiveChatMode && setShowTools(!showTools)}
                className={`p-2 rounded-full transition-colors duration-200 ${
                  showTools && !isLiveChatMode
                    ? 'bg-gray-200 text-gray-700'
                    : isLiveChatMode
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                } ${isLiveChatMode ? 'opacity-50' : ''}`}
                title="Tools"
                disabled={isLiveChatMode}
              >
                <Plus className={`w-5 h-5 transition-transform duration-200 ${showTools && !isLiveChatMode ? 'rotate-45' : ''}`} />
              </button>

              {showTools && !isLiveChatMode && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-lg border border-gray-200 p-2 min-w-48">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                    Attach files
                  </button>
                  
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Take photo
                  </button>
                </div>
              )}
            </div> */}

            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isLiveChatMode ? "Live chat mode - speak to chat" : "Ask anything"}
              className={`flex-1 bg-transparent resize-none focus:outline-none text-gray-800 placeholder-gray-500 min-h-[24px] max-h-[120px] py-1 ${
                isLiveChatMode ? 'cursor-not-allowed opacity-50' : ''
              }`}
              rows={1}
              disabled={isLoading || isLiveChatMode}
              readOnly={isLiveChatMode}
            />

            {/* Live Chat Toggle Button */}
            <button
              onClick={handleLiveChatToggle}
              disabled={isLoading || isTranscribing}
              className={`p-2 rounded-full transition-all duration-200 ${
                isLiveChatMode
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isLiveChatMode ? 'Exit live chat' : 'Start live chat'}
            >
              {isLiveChatMode ? (
                <PhoneOff className="w-5 h-5" />
              ) : (
                <Phone className="w-5 h-5" />
              )}
            </button>

            {(speechSupported || typeof navigator !== 'undefined') && !isLiveChatMode && (
              <button
                onClick={handleVoiceToggle}
                disabled={isLoading || isTranscribing}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isListening || isRecording
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isListening ? 'Stop listening' : isRecording ? 'Stop recording' : 'Voice input'}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" />
                ) : isRecording ? (
                  <Square className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            )}

            {!isLiveChatMode && (
              <button
              onClick={handleSubmit}
              disabled={
                (!message.trim() && selectedFiles.length === 0) || 
                isLoading || 
                isTranscribing ||
                isLiveChatMode
              }
              className="p-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-full transition-all duration-200 text-gray-600 hover:text-gray-800 disabled:text-gray-400"
            >
              {isListening && (
                <div className="absolute -top-1 -right-1">
                  <VoiceIndicator isListening={true} className="scale-75" />
                </div>
              )}
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
            )}
          </div>
        </div>

        {showSuggestions && !isLiveChatMode && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {[
              'Hello! 👋',
              'How can Dr. Stacy’s Design Your Life approach help with infertility?',
              'What can you do? 🤔',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSendMessage(suggestion)}
                className="flex-shrink-0 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-all duration-200 shadow-sm hover:shadow-md"
                disabled={isLoading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {showTools && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowTools(false)}
        />
      )}
    </div>
  );
}