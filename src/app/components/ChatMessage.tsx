import React from 'react';
import { Bot, User } from 'lucide-react';
import { SourceCard } from './SourceCard';
import { MessageFeedback, Feedback } from './MessageFeedback';
import { useLanguage } from '../context/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';
import type { Message as ConversationMessage } from '../hooks/useConversationStorage';

interface ChatMessageProps {
  message: ConversationMessage;
  onFeedbackSubmit?: (feedback: Feedback) => void;
}

export function ChatMessage({ message, onFeedbackSubmit }: ChatMessageProps) {
  const { t } = useLanguage();
  const { settings, speak } = useAccessibility();
  const isUser = message.role === 'user';
  const isToolSummary = !isUser && message.content.startsWith('Tool Summary');

  // Automatically read message when screen reader is enabled and it's an assistant message
  React.useEffect(() => {
    if (settings.screenReader && !isUser) {
      speak(message.content);
    }
  }, [message.id, settings.screenReader]);

  const handleTextClick = () => {
    if (settings.screenReader) {
      speak(message.content);
    }
  };

  return (
    <div
      className={`flex gap-2 sm:gap-3 p-3 sm:p-4 ${!isUser ? 'bg-muted/30' : ''}`}
      role="article"
      aria-label={`${isUser ? 'User' : 'Assistant'} message`}
    >
      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-secondary' : 'bg-primary'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-foreground" aria-hidden="true" />
        ) : (
          <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {isToolSummary ? (
            <div
              className="rounded-md border bg-background/60 p-3 text-sm text-foreground whitespace-pre-wrap break-words"
              onClick={handleTextClick}
            >
              {message.content}
            </div>
          ) : (
            <p
              className="text-sm sm:text-base text-foreground whitespace-pre-wrap break-words"
              onClick={handleTextClick}
            >
              {message.content}
            </p>
          )}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs sm:text-sm text-muted-foreground" id={`sources-${message.id}`}>
              {t('sources')}:
            </h3>
            <div className="space-y-2" aria-labelledby={`sources-${message.id}`}>
              {message.sources.map((source, index) => (
                <SourceCard key={index} source={source} index={index} />
              ))}
            </div>
          </div>
        )}
        {!isUser && onFeedbackSubmit && (
          <MessageFeedback
            messageId={message.id}
            initialFeedback={message.feedback}
            onFeedbackSubmit={onFeedbackSubmit}
          />
        )}
      </div>
    </div>
  );
}