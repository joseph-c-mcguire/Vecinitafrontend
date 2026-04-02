/**
 * Agent Service — API Client for the Vecinita LangGraph Agent
 *
 * Handles all communication with the backend agent service, supporting both
 * streaming (Server-Sent Events) and non-streaming request modes.
 *
 * ## Architecture
 * Requests are routed through the Unified API Gateway
 * (``VITE_GATEWAY_URL``) in normal deployments.  When the frontend is hosted
 * on ``*.onrender.com`` and the GATEWAY_URL resolves to the agent's Render
 * service directly, the client transparently adjusts path prefixes and the
 * config endpoint URL so that all calls reach the correct handler.
 *
 * ## Environment variables
 * - ``VITE_GATEWAY_URL``  — preferred gateway base URL
 * - ``VITE_BACKEND_URL`` — fallback gateway URL
 * - ``VITE_AGENT_REQUEST_TIMEOUT_MS`` — timeout for non-stream requests
 * - ``VITE_AGENT_STREAM_TIMEOUT_MS`` — overall timeout for stream requests
 * - ``VITE_AGENT_STREAM_FIRST_EVENT_TIMEOUT_MS`` — first SSE event timeout
 * - ``VITE_AGENT_DEBUG`` — set to ``'true'`` to emit debug CustomEvents
 */

import type {
  AgentResponse,
  AgentConfig,
  AskQueryParams,
  StreamEvent,
  StreamEventComplete,
} from '../types/agent';

// Get gateway URL from environment or fallback to localhost
// In development with Vite proxy, use /api prefix
const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:8004/api/v1');

/**
 * Return true when *hostname* belongs to a Render-hosted agent service.
 *
 * Detection relies on two Render naming conventions:
 * 1. The hostname ends with `.onrender.com`.
 * 2. The subdomain contains the string `"-agent"` (e.g. `vecinita-agent`).
 *
 * This is used to distinguish a frontend talking directly to the agent
 * service (no gateway prefix) from one talking through the unified gateway
 * (where `/ask/config` is the correct config path instead of `/config`).
 */
function isDirectRenderAgentHost(hostname: string): boolean {
  return hostname.endsWith('.onrender.com') && hostname.includes('-agent');
}

/**
 * Strip the gateway path prefix from a URL pathname when talking directly
 * to the agent service on Render.
 *
 * The unified gateway exposes endpoints under ``/api`` or ``/api/v1``.
 * When the frontend resolves to the agent's hostname directly (no gateway),
 * those prefixes are not valid — the agent serves ``/ask``, ``/config``,
 * etc. at the root.  This function removes the gateway prefix so that the
 * constructed URL resolves correctly against the agent.
 *
 * @param pathname - URL pathname potentially containing a gateway prefix.
 * @returns Pathname with ``/api`` or ``/api/v1`` stripped, or empty string
 *          if the pathname *was* the prefix.
 */
function stripGatewayPrefixForDirectAgent(pathname: string): string {
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (normalizedPath === '/api' || normalizedPath === '/api/v1') {
    return '';
  }
  return normalizedPath;
}

/**
 * Resolve the effective gateway URL for the current browser context.
 *
 * Handles three scenarios:
 *
 * 1. **SSR / non-browser** — returns *rawUrl* unchanged.
 * 2. **Render hosted frontend** — when the frontend is on
 *    ``<name>-frontend.onrender.com`` and *rawUrl* is a relative path,
 *    the agent hostname is inferred by replacing ``-frontend`` with
 *    ``-agent`` in the current hostname and the inappropriate gateway
 *    prefix is stripped for direct agent hosts.
 * 3. **Local dev** — relative URLs and ``localhost`` absolute URLs pass
 *    through unchanged.
 * 4. **Stale absolute URL** — when an absolute URL contains a
 *    ``localhost`` or wrong-port hostname, the current window hostname is
 *    substituted to avoid cross-origin failures after deployment.
 *
 * @param rawUrl - Raw gateway URL from an environment variable or config.
 * @returns Resolved URL string suitable for use as the fetch base.
 */
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
      const inferredBasePath = isDirectRenderAgentHost(inferredAgentHost)
        ? stripGatewayPrefixForDirectAgent(trimmedUrl)
        : trimmedUrl;
      return `${window.location.protocol}//${inferredAgentHost}${inferredBasePath}`;
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

export interface AgentServiceTimeouts {
  requestMs: number;
  streamMs: number;
  firstEventMs: number;
}

function parsePositiveTimeoutMs(rawValue: string | undefined, fallbackMs: number): number {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackMs;
  }

  return Math.floor(parsedValue);
}

export function resolveAgentServiceTimeouts(
  env: Partial<ImportMetaEnv> = (import.meta as ImportMeta).env ?? {}
): AgentServiceTimeouts {
  return {
    requestMs: parsePositiveTimeoutMs(env.VITE_AGENT_REQUEST_TIMEOUT_MS, 90000),
    streamMs: parsePositiveTimeoutMs(env.VITE_AGENT_STREAM_TIMEOUT_MS, 120000),
    firstEventMs: parsePositiveTimeoutMs(env.VITE_AGENT_STREAM_FIRST_EVENT_TIMEOUT_MS, 15000),
  };
}

const DEFAULT_AGENT_SERVICE_TIMEOUTS = resolveAgentServiceTimeouts();

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

/**
 * Normalise a raw base URL into a canonical API base path.
 *
 * Ensures the resulting URL:
 * - Has no trailing slash.
 * - Ends with `/api/v1` for standard gateway URLs (unless the host is a
 *   direct Render agent, in which case the gateway prefix is stripped).
 * - Returns `'/api'` as a safe fallback when the input is empty.
 *
 * @param baseUrl - Raw base URL (absolute or relative).
 * @returns Normalised base URL string.
 */
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
      if (isDirectRenderAgentHost(parsed.hostname)) {
        parsed.pathname = stripGatewayPrefixForDirectAgent(parsed.pathname);
      } else {
        parsed.pathname = ensureApiPrefix(parsed.pathname);
      }
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

/**
 * Normalise a raw agent config payload into the canonical {@link AgentConfig}
 * shape expected by the frontend.
 *
 * The direct agent ``GET /config`` response uses ``{ key, label }`` fields
 * for providers rather than the ``{ name, models }`` shape expected by the
 * frontend.  This function accepts either shape and maps both to the
 * canonical form so that the rest of the UI can work with one consistent
 * interface regardless of which endpoint was called.
 *
 * @param rawConfig - Untyped JSON payload from the agent or gateway config
 *                    endpoint.
 * @returns Validated and normalised {@link AgentConfig}.
 * @throws {@link AgentServiceError} when the payload is fundamentally
 *         malformed (not an object, no providers at all).
 */
function normalizeAgentConfig(rawConfig: unknown): AgentConfig {
  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new AgentServiceError('Agent config payload is malformed', 0, 'INVALID_CONFIG_PAYLOAD');
  }

  const source = rawConfig as Record<string, unknown>;
  const modelsRecord =
    source.models && typeof source.models === 'object' && !Array.isArray(source.models)
      ? (source.models as Record<string, unknown>)
      : {};

  const normalizedModels: Record<string, string[]> = {};
  for (const [providerName, providerModels] of Object.entries(modelsRecord)) {
    if (Array.isArray(providerModels)) {
      normalizedModels[providerName] = providerModels.filter(
        (entry): entry is string => typeof entry === 'string'
      );
    }
  }

  const providersSource = Array.isArray(source.providers) ? source.providers : [];
  const normalizedProviders: AgentConfig['providers'] = providersSource
    .map((provider, index) => {
      if (!provider || typeof provider !== 'object') {
        return null;
      }

      const providerRecord = provider as Record<string, unknown>;
      const providerName =
        typeof providerRecord.name === 'string'
          ? providerRecord.name
          : typeof providerRecord.key === 'string'
            ? providerRecord.key
            : '';

      if (!providerName) {
        return null;
      }

      const inlineModels = Array.isArray(providerRecord.models)
        ? providerRecord.models.filter((entry): entry is string => typeof entry === 'string')
        : undefined;
      const mappedModels = normalizedModels[providerName] ?? [];

      return {
        name: providerName,
        models: inlineModels ?? mappedModels,
        default: typeof providerRecord.default === 'boolean' ? providerRecord.default : index === 0,
      };
    })
    .filter((provider): provider is AgentConfig['providers'][number] => provider !== null);

  if (normalizedProviders.length === 0) {
    for (const [providerName, providerModels] of Object.entries(normalizedModels)) {
      normalizedProviders.push({
        name: providerName,
        models: providerModels,
        default: normalizedProviders.length === 0,
      });
    }
  }

  if (normalizedProviders.length === 0) {
    throw new AgentServiceError(
      'Agent config payload has no providers',
      0,
      'INVALID_CONFIG_PAYLOAD'
    );
  }

  return {
    providers: normalizedProviders,
    models: normalizedModels,
    defaultProvider:
      typeof source.defaultProvider === 'string'
        ? source.defaultProvider
        : normalizedProviders[0]?.name,
    defaultModel:
      typeof source.defaultModel === 'string'
        ? source.defaultModel
        : normalizedProviders[0]?.models[0],
  };
}

class AgentServiceClient {
  private baseUrl: string;
  private timeouts: AgentServiceTimeouts;

  constructor(baseUrl: string = GATEWAY_URL, timeouts: Partial<AgentServiceTimeouts> = {}) {
    this.baseUrl = normalizeApiBaseUrl(resolveGatewayUrl(baseUrl));
    this.timeouts = {
      requestMs: timeouts.requestMs ?? DEFAULT_AGENT_SERVICE_TIMEOUTS.requestMs,
      streamMs: timeouts.streamMs ?? DEFAULT_AGENT_SERVICE_TIMEOUTS.streamMs,
      firstEventMs: timeouts.firstEventMs ?? DEFAULT_AGENT_SERVICE_TIMEOUTS.firstEventMs,
    };
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
   * Build the URL for the agent configuration endpoint.
   *
   * The correct config endpoint differs depending on how the frontend
   * reaches the backend:
   *
   * - **Direct Render agent host** (``vecinita-agent.onrender.com``) —
   *   the agent exposes config at ``GET /config`` (no gateway prefix).
   * - **Unified gateway** — config is at ``GET /ask/config`` because the
   *   gateway namespaces agent routes under ``/ask``.
   *
   * @returns Fully-qualified {@link URL} for the config endpoint.
   */
  private buildConfigUrl(): URL {
    const normalizedBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;

    if (/^https?:\/\//i.test(normalizedBase)) {
      try {
        const parsed = new URL(normalizedBase);
        if (isDirectRenderAgentHost(parsed.hostname)) {
          return this.buildEndpointUrl('/config');
        }
      } catch {
        // Fall through to the default gateway-style config path.
      }
    }

    return this.buildEndpointUrl('/ask/config');
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
    if (params.context_answer) {
      url.searchParams.append('context_answer', params.context_answer);
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
    const timeoutId = setTimeout(() => controller.abort(), this.timeouts.requestMs);

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
    if (params.context_answer) {
      url.searchParams.append('context_answer', params.context_answer);
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
      }, this.timeouts.streamMs);

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
      }, this.timeouts.firstEventMs);

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

        if (data.type === 'complete') {
          const complete = data as StreamEventComplete;
          const rawSuggestions = complete.suggested_questions ?? complete.suggestedQuestions;

          if (Array.isArray(rawSuggestions)) {
            complete.suggestedQuestions = rawSuggestions.filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0
            );
          }

          data = complete;
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
    const url = this.buildConfigUrl().toString();
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

        const rawConfig = await parseJsonResponseOrThrow<unknown>(response, '/ask/config');
        return normalizeAgentConfig(rawConfig);
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
