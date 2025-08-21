'use client';

import React from 'react';

interface VoiceIndicatorProps {
  isListening: boolean;
  className?: string;
}

export function VoiceIndicator({ isListening, className = '' }: VoiceIndicatorProps) {
  if (!isListening) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-blue-500 rounded-full animate-pulse"
          style={{
            height: '8px',
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );
}