'use client';

import React from 'react';
import { User, Bot, Copy, Check, ExternalLink, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  isLoading?: boolean;
  timestamp?: Date;
}

export function ChatMessage({
  message,
  isUser,
  isLoading,
  timestamp,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Custom components for ReactMarkdown
  const markdownComponents = {
    // Custom link renderer
    a: ({ href, children, ...props }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline decoration-blue-600/30 hover:decoration-blue-800 transition-colors duration-200 inline-flex items-center gap-1"
        {...props}
      >
        {children}
        <ExternalLink className="w-3 h-3 flex-shrink-0" />
      </a>
    ),
    // Custom paragraph renderer
    p: ({ children, ...props }: any) => (
      <p className="mb-3 last:mb-0 leading-relaxed" {...props}>
        {children}
      </p>
    ),
    // Custom strong/bold renderer
    strong: ({ children, ...props }: any) => (
      <strong className="font-bold text-black" {...props}>
        {children}
      </strong>
    ),
    // Custom emphasis/italic renderer
    em: ({ children, ...props }: any) => (
      <em className="italic text-gray-700" {...props}>
        {children}
      </em>
    ),
    // Custom list renderers
    ul: ({ children, ...props }: any) => (
      <ul className="list-none space-y-2 my-3" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-none space-y-2 my-3" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="flex items-start gap-2" {...props}>
        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
        <span className="flex-1">{children}</span>
      </li>
    ),
    // Custom code renderer
    code: ({ children, className, ...props }: any) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code
            className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto my-3">
          <code className="text-sm font-mono text-gray-800" {...props}>
            {children}
          </code>
        </pre>
      );
    },
    // Custom heading renderers
    h1: ({ children, ...props }: any) => (
      <h1
        className="text-xl font-bold text-gray-800 mb-3 mt-4 first:mt-0"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2
        className="text-lg font-semibold text-gray-800 mb-2 mt-3 first:mt-0"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3
        className="text-base font-semibold text-gray-800 mb-2 mt-3 first:mt-0"
        {...props}
      >
        {children}
      </h3>
    ),
    // Custom blockquote renderer
    blockquote: ({ children, ...props }: any) => (
      <blockquote
        className="border-l-4 border-blue-300 pl-4 py-2 my-3 bg-blue-50 rounded-r-lg"
        {...props}
      >
        {children}
      </blockquote>
    ),
  };

  
  return (
    <div
      className={`group flex gap-4 mb-8 ${
        isUser ? 'justify-end' : 'justify-start'
      } animate-in slide-in-from-bottom-2 duration-300`}
    >
      {!isUser && (
        <div className="w-12 h-12 bg-transparent flex items-center justify-center shadow-lg rounded-full overflow-hidden">
          {/* <Bot className="w-6 h-6 text-white" /> */}
          <img src="/images/profile.jpg" alt="" className="h-full w-full" />
        </div>
      )}

      <div
        className={`relative max-w-[80%] px-6 py-5 rounded-3xl shadow-lg ${
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-auto shadow-blue-200/50 ring-1 ring-blue-300/20'
            : 'bg-white border border-gray-100 text-gray-800 mr-auto shadow-gray-200/50 ring-1 ring-gray-100'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <div
                className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></div>
              <div
                className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              ></div>
              <div
                className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              ></div>
            </div>
            <span className="text-sm text-gray-500 font-medium">
              AI is thinking...
            </span>
          </div>
        ) : (
          <>
            <div className="text-sm leading-relaxed">
              {isUser ? (
                // For user messages, display as plain text with line breaks
                message.split('\n').map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < message.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))
              ) : (
                // For AI messages, use ReactMarkdown for rich formatting
                <div className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-black prose-strong:font-bold prose-a:text-blue-600 prose-code:text-gray-800 prose-code:bg-gray-100">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {message}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Message footer with timestamp and actions */}
            <div
              className={`flex items-center justify-between mt-4 pt-3 border-t ${
                isUser ? 'border-blue-400/30' : 'border-gray-200'
              }`}
            >
              <div
                className={`text-xs font-medium ${
                  isUser ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {timestamp && formatTime(timestamp)}
              </div>

              {!isUser && (
                <div className="flex gap-1">
                  <button
                    onClick={handleCopy}
                    className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                    title="Copy message"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-green-500 font-medium">
                          Copied!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-blue-100">
          <User className="w-6 h-6 text-white" />
        </div>
      )}
    </div>
  );
}
