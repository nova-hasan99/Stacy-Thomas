'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  addEventListener(type: 'result', listener: (event: SpeechRecognitionEvent) => void): void;
  addEventListener(type: 'error', listener: (event: SpeechRecognitionErrorEvent) => void): void;
  addEventListener(type: 'start' | 'end', listener: () => void): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        const recognition = recognitionRef.current;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.addEventListener('result', (event: SpeechRecognitionEvent) => {
          let newFinalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              newFinalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Accumulate new final transcripts
          if (newFinalTranscript) {
            setFinalTranscript(prev => {
              const updated = prev + newFinalTranscript + ' ';
              console.log('Final transcript updated:', updated);
              return updated;
            });
          }
          
          // Update transcript with accumulated final + new final + current interim
          setTranscript(prevTranscript => {
            const currentFinal = finalTranscript + newFinalTranscript + ' ';
            const fullTranscript = currentFinal + interimTranscript;
            console.log('Full transcript:', fullTranscript);
            return fullTranscript;
          });
        });

        recognition.addEventListener('start', () => {
          setIsListening(true);
        });

        recognition.addEventListener('end', () => {
          // Don't automatically stop listening - let user control it
          // Only set listening to false if manually stopped
        });

        recognition.addEventListener('error', (event: SpeechRecognitionErrorEvent) => {
          // Only log actual errors, not normal 'aborted' events
          if (event.error !== 'aborted') {
            console.error('Speech recognition error:', event.error, event.message);
          }
          // Don't automatically stop on errors like 'no-speech'
          if (event.error === 'aborted') {
            setIsListening(false);
          }
        });
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      // Don't clear transcript when starting - keep accumulating
      console.log('Starting speech recognition...');
      try {
      recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      console.log('Stopping speech recognition...');
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    console.log('Resetting transcript');
    setTranscript('');
    setFinalTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}