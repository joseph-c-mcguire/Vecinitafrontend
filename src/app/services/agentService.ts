/**
 * Agent Service - API Client for Backend Agent
 *
 * Handles communication with the LangGraph agent via the unified gateway.
 * Supports both streaming (SSE) and non-streaming requests.
 */

import type {
  AgentResponse,
  AgentConfig,
  AskQueryParams,
  StreamEvent,
} from '../types/agent';

// Get gateway URL from environment or fallback to localhost
// In development with Vite proxy, use /api prefix
const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:8004/api/v1');

// Timeout configurations
const REQUEST_TIMEOUT = 30000; // 30 seconds for standard requests
const STREAM_TIMEOUT = 120000; // 120 seconds for streaming

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

class AgentServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string = GATEWAY_URL) {
    this.baseUrl = baseUrl;
  }

  private buildEndpointUrl(path: string): URL {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedBase = this.baseUrl.endsWith('/')
      ? this.baseUrl.slice(0, -1)
      : this.baseUrl;

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
        throw new AgentServiceError(
          `Agent request failed: ${errorText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AgentServiceError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AgentServiceError(
            'Request timeout - please try again',
            504,
            'TIMEOUT'
          );
        }
        throw new AgentServiceError(
          `Network error: ${error.message}`,
          0,
          'NETWORK_ERROR'
        );
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
  async askStream(
    params: AskQueryParams,
    onEvent: (event: StreamEvent) => void
  ): Promise<void> {
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
          new AgentServiceError(
            'Stream timeout - request took too long',
            504,
            'STREAM_TIMEOUT'
          )
        );
      }, STREAM_TIMEOUT);

      eventSource.onmessage = (event) => {
        let data: StreamEvent;
        try {
          data = JSON.parse(event.data) as StreamEvent;
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
          return;
        }

        try {
          onEvent(data);
        } catch (callbackError) {
          clearTimeout(timeoutId);
          eventSource.close();

          if (callbackError instanceof AgentServiceError) {
            reject(callbackError);
            return;
          }

          reject(
            new AgentServiceError(
              callbackError instanceof Error
                ? callbackError.message
                : 'Stream callback failed',
              0,
              'STREAM_CALLBACK_ERROR'
            )
          );
          return;
        }

        // Close stream on completion or error
        if (data.type === 'complete') {
          clearTimeout(timeoutId);
          eventSource.close();
          resolve();
          return;
        }

        if (data.type === 'error') {
          clearTimeout(timeoutId);
          eventSource.close();
          reject(new AgentServiceError(data.message, undefined, data.code));
        }
      };

      eventSource.onerror = (error) => {
        clearTimeout(timeoutId);
        eventSource.close();
        reject(
          new AgentServiceError(
            'Stream connection failed',
            0,
            'STREAM_ERROR'
          )
        );
      };
    });
  }

  /**
   * Get agent configuration (available providers and models).
   */
  async getConfig(): Promise<AgentConfig> {
    const url = this.buildEndpointUrl('/ask/config').toString();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new AgentServiceError(
          'Failed to fetch agent configuration',
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AgentServiceError) {
        throw error;
      }

      throw new AgentServiceError(
        'Failed to connect to agent service',
        0,
        'NETWORK_ERROR'
      );
    }
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
