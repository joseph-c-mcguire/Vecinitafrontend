import { useEffect } from 'react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SourceCard } from './SourceCard';
import { MessageFeedback, Feedback } from './MessageFeedback';
import { useLanguage } from '../context/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';
import type { Message as ConversationMessage } from '../hooks/useConversationStorage';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { cn } from './ui/utils';
export type Message = ConversationMessage;

interface ChatMessageProps {
  message: ConversationMessage;
  onFeedbackSubmit?: (feedback: Feedback) => void;
}

export function ChatMessage({ message, onFeedbackSubmit }: ChatMessageProps): JSX.Element {
  const { t } = useLanguage();
  const { settings, speak } = useAccessibility();
  const isUser = message.role === 'user';
  const isToolSummary = !isUser && message.content.startsWith('Tool Summary');

  // Automatically read message when screen reader is enabled and it's an assistant message
  useEffect(() => {
    if (settings.screenReader && !isUser) {
      speak(message.content);
    }
  }, [isUser, message.content, settings.screenReader, speak]);

  const initialFeedback = message.feedback
    ? {
        messageId: message.id,
        rating: message.feedback.rating,
        comment: message.feedback.comment,
        timestamp: message.timestamp,
      }
    : undefined;

  const handleTextClick = (): void => {
    if (settings.screenReader) {
      speak(message.content);
    }
  };

  return (
    <div
      className={cn('flex gap-2 p-3 sm:gap-3 sm:p-4', !isUser && 'bg-muted/30')}
      role="article"
      aria-label={`${isUser ? 'User' : 'Assistant'} message`}
      data-testid="chat-message"
      data-message-role={message.role}
    >
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8',
          isUser ? 'bg-secondary' : 'bg-primary'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-foreground" aria-hidden="true" />
        ) : (
          <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {isToolSummary ? (
            <Card
              className="rounded-md border bg-background/60 p-3 text-sm text-foreground whitespace-pre-wrap break-words"
              onClick={handleTextClick}
            >
              {message.content}
            </Card>
          ) : !isUser ? (
            <div
              className="text-sm sm:text-base text-foreground break-words"
              onClick={handleTextClick}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 mb-2 last:mb-0">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 mb-2 last:mb-0">{children}</ol>
                  ),
                  li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
                  code: ({ children }) => (
                    <code className="rounded bg-muted px-1 py-0.5 text-xs sm:text-sm">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="mb-2 overflow-x-auto rounded-md border bg-background/60 p-3 text-xs sm:text-sm">
                      {children}
                    </pre>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline break-all"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
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
            <Separator />
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
            initialFeedback={initialFeedback}
            onFeedbackSubmit={onFeedbackSubmit}
          />
        )}
      </div>
    </div>
  );
}
