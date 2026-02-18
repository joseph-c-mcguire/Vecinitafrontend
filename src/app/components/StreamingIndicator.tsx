/**
 * Streaming Indicator Component
 *
 * Displays a visual indicator when the agent is "thinking" or processing a request.
 * Shows streaming messages and animated loading states.
 */

import { Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface StreamingIndicatorProps {
  message?: string;
  className?: string;
}

export function StreamingIndicator({
  message,
  className = '',
}: StreamingIndicatorProps) {
  const { t } = useLanguage();

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border ${className}`}
      role="status"
      aria-live="polite"
      aria-label={t('assistant.thinking')}
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground mb-1">
          {t('assistant.thinking')}
        </p>
        {message && (
          <p className="text-sm text-muted-foreground break-words">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Simple three-dot loading indicator for inline use.
 */
export function TypingIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`flex gap-1 ${className}`} role="status" aria-label="Typing">
      <span
        className="w-2 h-2 bg-current rounded-full animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-2 h-2 bg-current rounded-full animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="w-2 h-2 bg-current rounded-full animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}
