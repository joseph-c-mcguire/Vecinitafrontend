/**
 * Agent Service - API Client for Backend Agent
 *
 * Handles communication with the LangGraph agent via the unified gateway.
 * Supports both streaming (SSE) and non-streaming requests.
 */

import type { AgentResponse, AgentConfig, AskQueryParams, StreamEvent } from '../types/agent';

// Get gateway URL from environment or fallback to localhost
// In development with Vite proxy, use /api prefix
const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:8004/api/v1');

function resolveGatewayUrl(rawUrl: string): string {
  if (typeof window === 'undefined') {
    return rawUrl;
  }

  const trimmedUrl = (rawUrl || '').trim();
  const currentHost = window.location.hostname;
  const isCurrentHostLocal =
    currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '::1';

  // On hosted environments, a relative /api URL can hit the static frontend server
  // (returning HTML) instead of the agent API. Infer agent host on Render domains.
  if (!isCurrentHostLocal && trimmedUrl.startsWith('/')) {
    if (currentHost.endsWith('.onrender.com') && currentHost.includes('-frontend')) {
      const inferredAgentHost = currentHost.replace('-frontend', '-agent');
      return `${window.location.protocol}//${inferredAgentHost}${trimmedUrl}`;
    }
    return trimmedUrl;
  }

  if (isCurrentHostLocal) {
    return trimmedUrl;
  }

  try {
    const parsed = new URL(trimmedUrl);
    const isConfiguredLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';
    const isGatewayPort = parsed.port === '8004' || parsed.port === '18004';
    const isStaleAbsoluteHost = parsed.hostname !== currentHost;

    if (isConfiguredLocal || (isGatewayPort && isStaleAbsoluteHost)) {
      parsed.hostname = currentHost;
      return parsed.toString();
    }
  } catch {
    return trimmedUrl;
  }

  return trimmedUrl;
}

// Timeout configurations
const REQUEST_TIMEOUT = 30000; // 30 seconds for standard requests
const STREAM_TIMEOUT = 120000; // 120 seconds for streaming
const STREAM_FIRST_EVENT_TIMEOUT = 15000;

const isAgentDebugEnabled = (): boolean => {
  if ((import.meta as ImportMeta).env?.VITE_AGENT_DEBUG === 'true') {
    return true;
  }

  if (typeof window !== 'undefined' && window.localStorage.getItem('vecinita_debug_chat') === '1') {
    return true;
  }

  return false;
};

function emitAgentDebugEvent(scope: string, message: string, data?: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('vecinita:agent-debug', {
      detail: { scope, message, data },
    })
  );
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const normalizedInput = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalizedInput) {
    return '/api';
  }

  const ensureApiPrefix = (pathname: string): string => {
    const sanitizedPath = pathname.replace(/\/+$/, '');

    if (!sanitizedPath || sanitizedPath === '/') {
      return '/api/v1';
    }

    if (sanitizedPath === '/api') {
      return '/api/v1';
    }

    return sanitizedPath;
  };

  if (/^https?:\/\//i.test(normalizedInput)) {
    try {
      const parsed = new URL(normalizedInput);
      parsed.pathname = ensureApiPrefix(parsed.pathname);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return normalizedInput;
    }
  }

  return normalizedInput;
}

export class AgentServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AgentServiceError';
  }
}

async function parseJsonResponseOrThrow<T>(response: Response, endpointLabel: string): Promise<T> {
  const contentType = response.headers?.get?.('content-type')?.toLowerCase() || '';
  const hasContentType = contentType.length > 0;
  const looksJson = contentType.includes('application/json');

  if (hasContentType && !looksJson) {
    throw new AgentServiceError(
      `${endpointLabel} returned non-JSON response (content-type: ${contentType || 'unknown'}). ` +
        'This usually indicates a gateway URL/proxy misconfiguration.',
      response.status,
      'INVALID_RESPONSE_FORMAT'
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new AgentServiceError(
      `${endpointLabel} returned malformed JSON. This usually indicates a gateway URL/proxy misconfiguration.`,
      response.status,
      'INVALID_JSON'
    );
  }
}

class AgentServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string = GATEWAY_URL) {
    this.baseUrl = normalizeApiBaseUrl(resolveGatewayUrl(baseUrl));
  }

  private debugLog(message: string, data?: unknown): void {
    if (!isAgentDebugEnabled()) {
      return;
    }

    emitAgentDebugEvent('agentService', message, data);
  }

  private buildEndpointUrl(path: string): URL {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;

    if (/^https?:\/\//i.test(normalizedBase)) {
      return new URL(`${normalizedBase}${normalizedPath}`);
    }

    const fallbackOrigin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    return new URL(`${normalizedBase}${normalizedPath}`, fallbackOrigin);
  }

  /**
   * Ask a question and get a complete response (non-streaming).
   */
  async ask(params: AskQueryParams): Promise<AgentResponse> {
    const url = this.buildEndpointUrl('/ask');

    // Add query parameters
    url.searchParams.append('question', params.question);
    if (params.thread_id) {
      url.searchParams.append('thread_id', params.thread_id);
    }
    if (params.lang) {
      url.searchParams.append('lang', params.lang);
    }
    if (params.provider) {
      url.searchParams.append('provider', params.provider);
    }
    if (params.model) {
      url.searchParams.append('model', params.model);
    }
    if (params.clarification_response) {
      url.searchParams.append('clarification_response', params.clarification_response);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new AgentServiceError(`Agent request failed: ${errorText}`, response.status);
      }

      return await parseJsonResponseOrThrow<AgentResponse>(response, '/ask');
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AgentServiceError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AgentServiceError('Request timeout - please try again', 504, 'TIMEOUT');
        }
        throw new AgentServiceError(`Network error: ${error.message}`, 0, 'NETWORK_ERROR');
      }

      throw new AgentServiceError('Unknown error occurred', 0, 'UNKNOWN');
    }
  }

  /**
   * Ask a question and stream the response via Server-Sent Events.
   *
   * @param params Query parameters
   * @param onEvent Callback for each streaming event
   * @returns Promise that resolves when stream completes
   */
  async askStream(params: AskQueryParams, onEvent: (event: StreamEvent) => void): Promise<void> {
    const url = this.buildEndpointUrl('/ask/stream');

    // Add query parameters
    url.searchParams.append('question', params.question);
    if (params.thread_id) {
      url.searchParams.append('thread_id', params.thread_id);
    }
    if (params.lang) {
      url.searchParams.append('lang', params.lang);
    }
    if (params.provider) {
      url.searchParams.append('provider', params.provider);
    }
    if (params.model) {
      url.searchParams.append('model', params.model);
    }
    if (params.clarification_response) {
      url.searchParams.append('clarification_response', params.clarification_response);
    }

    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(url.toString());
      const timeoutId = setTimeout(() => {
        eventSource.close();
        reject(
          new AgentServiceError('Stream timeout - request took too long', 504, 'STREAM_TIMEOUT')
        );
      }, STREAM_TIMEOUT);

      let firstEventReceived = false;
      let firstEventTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let eventCount = 0;
      const clearFirstEventTimeout = () => {
        if (firstEventTimeoutId) {
          clearTimeout(firstEventTimeoutId);
          firstEventTimeoutId = null;
        }
      };

      firstEventTimeoutId = setTimeout(() => {
        if (firstEventReceived) {
          return;
        }
        this.debugLog('askStream:first_event_timeout', {
          thread_id: params.thread_id,
          questionLength: (params.question || '').length,
        });
        clearTimeout(timeoutId);
        eventSource.close();
        reject(new AgentServiceError('Stream stalled before first event', 408, 'STREAM_STALLED'));
      }, STREAM_FIRST_EVENT_TIMEOUT);

      eventSource.onmessage = (event) => {
        let data: StreamEvent;
        try {
          data = JSON.parse(event.data) as StreamEvent;
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
          return;
        }

        eventCount += 1;
        if (!firstEventReceived) {
          firstEventReceived = true;
          clearFirstEventTimeout();
          this.debugLog('askStream:first_event_received', {
            thread_id: params.thread_id,
            eventCount,
          });
        }

        try {
          onEvent(data);
        } catch (callbackError) {
          clearTimeout(timeoutId);
          clearFirstEventTimeout();
          eventSource.close();

          if (callbackError instanceof AgentServiceError) {
            reject(callbackError);
            return;
          }

          reject(
            new AgentServiceError(
              callbackError instanceof Error ? callbackError.message : 'Stream callback failed',
              0,
              'STREAM_CALLBACK_ERROR'
            )
          );
          return;
        }

        // Close stream on completion or error
        if (data.type === 'complete') {
          clearTimeout(timeoutId);
          clearFirstEventTimeout();
          eventSource.close();
          this.debugLog('askStream:complete', {
            thread_id: params.thread_id,
            eventCount,
          });
          resolve();
          return;
        }

        if (data.type === 'error') {
          clearTimeout(timeoutId);
          clearFirstEventTimeout();
          eventSource.close();
          reject(new AgentServiceError(data.message, undefined, data.code));
        }
      };

      eventSource.onerror = (error) => {
        clearTimeout(timeoutId);
        clearFirstEventTimeout();
        eventSource.close();
        this.debugLog('askStream:error', {
          thread_id: params.thread_id,
          eventCount,
          firstEventReceived,
          error,
        });
        reject(new AgentServiceError('Stream connection failed', 0, 'STREAM_ERROR'));
      };
    });
  }

  /**
   * Get agent configuration (available providers and models).
   */
  async getConfig(): Promise<AgentConfig> {
    const url = this.buildEndpointUrl('/ask/config').toString();
    const CONFIG_RETRY_ATTEMPTS = 3;
    const CONFIG_RETRY_DELAY_MS = 800;
    let lastError: unknown;

    for (let attempt = 1; attempt <= CONFIG_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new AgentServiceError('Failed to fetch agent configuration', response.status);
        }

        return await parseJsonResponseOrThrow<AgentConfig>(response, '/ask/config');
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === CONFIG_RETRY_ATTEMPTS;
        const isRetriableNetworkError = !(error instanceof AgentServiceError);

        if (isLastAttempt || !isRetriableNetworkError) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, CONFIG_RETRY_DELAY_MS));
      }
    }

    if (lastError instanceof AgentServiceError) {
      throw lastError;
    }

    throw new AgentServiceError('Failed to connect to agent service', 0, 'NETWORK_ERROR');
  }

  /**
   * Check if agent service is available.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.buildEndpointUrl('/health').toString(), {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const agentService = new AgentServiceClient();

// Export class for testing
export { AgentServiceClient };
