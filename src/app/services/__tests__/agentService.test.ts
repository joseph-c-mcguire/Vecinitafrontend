/**
 * Tests for agentService.ts
 *
 * Tests agent API client functionality including requests, streaming, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { agentService, AgentServiceClient, AgentServiceError } from '../agentService';
import type { AskQueryParams, AgentResponse, AgentConfig, StreamEvent } from '../../types/agent';

// Mock fetch
globalThis.fetch = vi.fn();

// Mock EventSource
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  close() {}
}

globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

const fetchMock = vi.mocked(globalThis.fetch);

function createMessageEvent(data: string): MessageEvent<string> {
  return new MessageEvent('message', { data });
}

function installMockEventSource() {
  class TestEventSource {
    static latestInstance: TestEventSource | null = null;

    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    url: string;
    closed = false;

    constructor(url: string) {
      this.url = url;
      TestEventSource.latestInstance = this;
    }

    close() {
      this.closed = true;
    }
  }

  globalThis.EventSource = TestEventSource as unknown as typeof EventSource;
  return TestEventSource;
}

describe('AgentServiceClient', () => {
  let client: AgentServiceClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AgentServiceClient('http://localhost:8002');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ask', () => {
    it('should make successful request', async () => {
      const mockResponse: AgentResponse = {
        answer: 'Test answer',
        sources: [],
        thread_id: 'thread-123',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const params: AskQueryParams = {
        question: 'What is testing?',
      };

      const result = await client.ask(params);

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ask'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should include all query parameters', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'test', sources: [] }),
      } as Response);

      const params: AskQueryParams = {
        question: 'Test question',
        thread_id: 'thread-123',
        lang: 'es',
        provider: 'groq',
        model: 'llama-3.1',
      };

      await client.ask(params);

      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      // URLSearchParams encodes spaces as + or %20, both are valid
      expect(callUrl).toContain('question=Test');
      expect(callUrl).toContain('thread_id=thread-123');
      expect(callUrl).toContain('lang=es');
      expect(callUrl).toContain('provider=groq');
      expect(callUrl).toContain('model=llama-3.1');
      expect(callUrl).not.toContain('/ask/question');
    });

    it('should support relative proxy base URLs', async () => {
      const relativeClient = new AgentServiceClient('/api');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'ok', sources: [] }),
      } as Response);

      await relativeClient.ask({ question: 'hello' });

      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(callUrl).toContain('/api/ask');
      expect(callUrl).toContain('question=hello');
    });

    it('should normalize absolute base URL without API prefix', async () => {
      const absoluteClient = new AgentServiceClient('http://localhost:8004');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'ok', sources: [] }),
      } as Response);

      await absoluteClient.ask({ question: 'hello' });

      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(callUrl).toContain('http://localhost:8004/api/v1/ask');
      expect(callUrl).toContain('question=hello');
    });

    it('should rewrite localhost API base to public host in browser context', async () => {
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        hostname: '34.55.88.67',
        origin: 'http://34.55.88.67:15173',
      } as Location);

      const publicClient = new AgentServiceClient('http://localhost:18004/api/v1');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'ok', sources: [] }),
      } as Response);

      await publicClient.ask({ question: 'hello' });

      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(callUrl).toContain('http://34.55.88.67:18004/api/v1/ask');
      expect(callUrl).toContain('question=hello');

      locationSpy.mockRestore();
    });

    it('should keep localhost API base when browser host is localhost', async () => {
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        hostname: 'localhost',
        origin: 'http://localhost:15173',
      } as Location);

      const localClient = new AgentServiceClient('http://localhost:18004/api/v1');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'ok', sources: [] }),
      } as Response);

      await localClient.ask({ question: 'hello' });

      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(callUrl).toContain('http://localhost:18004/api/v1/ask');
      expect(callUrl).toContain('question=hello');

      locationSpy.mockRestore();
    });

    it('should rewrite stale public gateway host to current browser host', async () => {
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        hostname: '34.170.200.11',
        origin: 'http://34.170.200.11:15173',
      } as Location);

      const staleHostClient = new AgentServiceClient('http://34.55.88.67:18004/api/v1');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'ok', sources: [] }),
      } as Response);

      await staleHostClient.ask({ question: 'hello' });

      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(callUrl).toContain('http://34.170.200.11:18004/api/v1/ask');
      expect(callUrl).toContain('question=hello');

      locationSpy.mockRestore();
    });

    it('should infer Render agent host when configured with relative /api path', async () => {
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        hostname: 'vecinita-frontend.onrender.com',
        origin: 'https://vecinita-frontend.onrender.com',
        protocol: 'https:',
      } as Location);

      const renderClient = new AgentServiceClient('/api/v1');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null,
        },
        json: async () => ({ answer: 'ok', sources: [] }),
      } as Response);

      await renderClient.ask({ question: 'hello' });

      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(callUrl).toContain('https://vecinita-agent.onrender.com/ask');
      expect(callUrl).toContain('question=hello');

      locationSpy.mockRestore();
    });

    it('should strip gateway prefix for absolute Render agent hosts', async () => {
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        hostname: 'vecinita-frontend.onrender.com',
        origin: 'https://vecinita-frontend.onrender.com',
        protocol: 'https:',
      } as Location);

      const renderClient = new AgentServiceClient('https://vecinita-agent.onrender.com/api/v1');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'ok', sources: [] }),
      } as Response);

      await renderClient.ask({ question: 'hello' });

      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(callUrl).toContain('https://vecinita-agent.onrender.com/ask');
      expect(callUrl).not.toContain('/api/v1/ask');

      locationSpy.mockRestore();
    });

    it('should handle HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      } as Response);

      await expect(client.ask({ question: 'test' })).rejects.toThrow(AgentServiceError);
    });

    it('should handle timeout', async () => {
      // Create proper AbortError with correct name
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      vi.mocked(fetch).mockRejectedValueOnce(abortError);

      try {
        await client.ask({ question: 'test' });
        throw new Error('Should have thrown AgentServiceError');
      } catch (error) {
        if (error instanceof AgentServiceError) {
          expect(error.code).toBe('TIMEOUT');
          expect(error.statusCode).toBe(504);
        } else {
          throw error;
        }
      }
    });

    it('should handle network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network error'));

      await expect(client.ask({ question: 'test' })).rejects.toThrow(AgentServiceError);
    });

    it('should surface clear error when /ask returns HTML instead of JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null,
        },
        json: async () => ({}) as AgentResponse,
      } as Response);

      await expect(client.ask({ question: 'test' })).rejects.toMatchObject({
        code: 'INVALID_RESPONSE_FORMAT',
      });
    });
  });

  describe('askStream', () => {
    it('should handle streaming events', async () => {
      const MockES = installMockEventSource();

      const events: StreamEvent[] = [];

      const streamPromise = client.askStream({ question: 'test' }, (event) => events.push(event));

      // Simulate EventSource events
      setTimeout(() => {
        if (MockES.latestInstance?.onmessage) {
          MockES.latestInstance.onmessage(
            createMessageEvent('{"type":"thinking","message":"Searching..."}')
          );
          MockES.latestInstance.onmessage(
            createMessageEvent('{"type":"complete","answer":"Done","sources":[]}')
          );
        }
      }, 10);

      await streamPromise;

      expect(events.length).toBeGreaterThan(0);
    });

    it('should build stream URL from relative proxy base URL', async () => {
      const MockES = installMockEventSource();

      const relativeClient = new AgentServiceClient('/api');

      const streamPromise = relativeClient.askStream({ question: 'test' }, () => {});

      setTimeout(() => {
        if (MockES.latestInstance?.onmessage) {
          MockES.latestInstance.onmessage(
            createMessageEvent('{"type":"complete","answer":"Done","sources":[]}')
          );
        }
      }, 10);

      await streamPromise;
      expect(MockES.latestInstance?.url).toContain('/api/ask/stream');
      expect(MockES.latestInstance?.url).not.toContain('/ask/question');
    });

    it('should normalize stream URL when absolute base has no API prefix', async () => {
      const MockES = installMockEventSource();

      const absoluteClient = new AgentServiceClient('http://localhost:8004');
      const streamPromise = absoluteClient.askStream({ question: 'test' }, () => {});

      setTimeout(() => {
        if (MockES.latestInstance?.onmessage) {
          MockES.latestInstance.onmessage(
            createMessageEvent('{"type":"complete","answer":"Done","sources":[]}')
          );
        }
      }, 10);

      await streamPromise;
      expect(MockES.latestInstance?.url).toContain('http://localhost:8004/api/v1/ask/stream');
    });

    it('should handle malformed SSE data', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const MockES = installMockEventSource();

      const events: StreamEvent[] = [];

      const streamPromise = client.askStream({ question: 'test' }, (event) => events.push(event));

      setTimeout(() => {
        if (MockES.latestInstance?.onmessage) {
          // Invalid JSON should be caught and skipped
          MockES.latestInstance.onmessage(createMessageEvent('invalid json'));
          // Valid event after invalid one
          MockES.latestInstance.onmessage(
            createMessageEvent('{"type":"complete","answer":"Done","sources":[]}')
          );
        }
      }, 10);

      await streamPromise;

      // Should only have 1 valid event
      expect(events.length).toBeGreaterThan(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle stream error', async () => {
      const MockES = installMockEventSource();

      const streamPromise = client.askStream({ question: 'test' }, () => {});

      setTimeout(() => {
        if (MockES.latestInstance?.onerror) {
          MockES.latestInstance.onerror(new Event('error'));
        }
      }, 10);

      await expect(streamPromise).rejects.toThrow();
    });

    it('should reject when stream callback throws AgentServiceError', async () => {
      const MockES = installMockEventSource();

      const streamPromise = client.askStream({ question: 'test' }, () => {
        throw new AgentServiceError('Connection failed: incomplete chunked read');
      });

      setTimeout(() => {
        if (MockES.latestInstance?.onmessage) {
          MockES.latestInstance.onmessage(
            createMessageEvent(
              '{"type":"error","message":"Connection failed: incomplete chunked read"}'
            )
          );
        }
      }, 10);

      await expect(streamPromise).rejects.toThrow(AgentServiceError);
    });

    it('should close stream on complete event', async () => {
      const MockES = installMockEventSource();

      const streamPromise = client.askStream({ question: 'test' }, () => {});

      setTimeout(() => {
        if (MockES.latestInstance?.onmessage) {
          MockES.latestInstance.onmessage(
            createMessageEvent('{"type":"complete","answer":"Done","sources":[]}')
          );
        }
      }, 10);

      await streamPromise;

      expect(MockES.latestInstance?.closed).toBe(true);
    });

    it('should reject when stream stalls before first event', async () => {
      vi.useFakeTimers();
      const MockES = installMockEventSource();

      try {
        const streamPromise = client.askStream({ question: 'test' }, () => {});
        const capturedErrorPromise = streamPromise.catch((error) => error);

        await vi.advanceTimersByTimeAsync(16000);

        const error = await capturedErrorPromise;
        expect(error).toMatchObject({ code: 'STREAM_STALLED' });
        expect(MockES.latestInstance).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getConfig', () => {
    it('should fetch configuration', async () => {
      const mockConfig: AgentConfig = {
        providers: [{ name: 'groq', models: ['llama-3.1'], default: true }],
        models: { groq: ['llama-3.1'] },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfig,
      } as Response);

      const result = await client.getConfig();

      expect(result).toEqual(mockConfig);
    });

    it('should handle config fetch error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getConfig()).rejects.toThrow(AgentServiceError);
    });

    it('should use /config for direct Render agent hosts', async () => {
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        hostname: 'vecinita-frontend.onrender.com',
        origin: 'https://vecinita-frontend.onrender.com',
        protocol: 'https:',
      } as Location);

      const renderClient = new AgentServiceClient('https://vecinita-agent.onrender.com/api/v1');
      const mockConfig: AgentConfig = {
        providers: [{ name: 'ollama', models: ['llama3.1:8b'], default: true }],
        models: { ollama: ['llama3.1:8b'] },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null,
        },
        json: async () => mockConfig,
      } as Response);

      const result = await renderClient.getConfig();

      expect(result).toEqual(mockConfig);
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://vecinita-agent.onrender.com/config');

      locationSpy.mockRestore();
    });

    it('should retry getConfig on transient network error', async () => {
      const mockConfig: AgentConfig = {
        providers: [{ name: 'deepseek', models: ['deepseek-chat'], default: true }],
        models: { deepseek: ['deepseek-chat'] },
      };

      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfig,
        } as Response);

      const result = await client.getConfig();

      expect(result).toEqual(mockConfig);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should fail fast with clear error when config endpoint returns HTML', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null,
        },
        json: async () => ({}),
      } as Response);

      await expect(client.getConfig()).rejects.toMatchObject({
        code: 'INVALID_RESPONSE_FORMAT',
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
      } as Response);

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection failed'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });
});

describe('AgentServiceError', () => {
  it('should create error with message', () => {
    const error = new AgentServiceError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('AgentServiceError');
  });

  it('should include status code', () => {
    const error = new AgentServiceError('Test error', 404);

    expect(error.statusCode).toBe(404);
  });

  it('should include error code', () => {
    const error = new AgentServiceError('Test error', 500, 'INTERNAL_ERROR');

    expect(error.code).toBe('INTERNAL_ERROR');
  });
});

describe('singleton instance', () => {
  it('should export a singleton instance', () => {
    expect(agentService).toBeInstanceOf(AgentServiceClient);
  });
});
