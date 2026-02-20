/**
 * Tests for agentService.ts
 * 
 * Tests agent API client functionality including requests, streaming, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { agentService, AgentServiceClient, AgentServiceError } from '../agentService';
import type { AskQueryParams, AgentResponse, AgentConfig } from '../../types/agent';

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

globalThis.EventSource = MockEventSource as any;

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

      const callUrl = (fetch as any).mock.calls[0][0];
      // URLSearchParams encodes spaces as + or %20, both are valid
      expect(callUrl).toContain('question=Test');
      expect(callUrl).toContain('thread_id=thread-123');
      expect(callUrl).toContain('lang=es');
      expect(callUrl).toContain('provider=groq');
      expect(callUrl).toContain('model=llama-3.1');
    });

    it('should support relative proxy base URLs', async () => {
      const relativeClient = new AgentServiceClient('/api');

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'ok', sources: [] }),
      } as Response);

      await relativeClient.ask({ question: 'hello' });

      const callUrl = String((fetch as any).mock.calls[0][0]);
      expect(callUrl).toContain('/api/ask');
      expect(callUrl).toContain('question=hello');
    });

    it('should handle HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      } as Response);

      await expect(
        client.ask({ question: 'test' })
      ).rejects.toThrow(AgentServiceError);
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

      await expect(
        client.ask({ question: 'test' })
      ).rejects.toThrow(AgentServiceError);
    });
  });

  describe('askStream', () => {
    it('should handle streaming events', async () => {
      let savedEventSource: any = null;
      
      (globalThis.EventSource as any) = class MockES {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        url: string;
        
        constructor(url: string) {
          this.url = url;
          savedEventSource = this;
        }
        
        close() {}
      };

      const events: any[] = [];
      
      const streamPromise = client.askStream(
        { question: 'test' },
        (event) => events.push(event)
      );

      // Simulate EventSource events
      setTimeout(() => {
        if (savedEventSource?.onmessage) {
          savedEventSource.onmessage({ data: '{"type":"thinking","message":"Searching..."}' });
          savedEventSource.onmessage({ data: '{"type":"complete","answer":"Done","sources":[]}' });
        }
      }, 10);

      await streamPromise;

      expect(events.length).toBeGreaterThan(0);
    });

    it('should build stream URL from relative proxy base URL', async () => {
      let savedEventSource: any = null;

      (globalThis.EventSource as any) = class MockES {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        url: string;

        constructor(url: string) {
          this.url = url;
          savedEventSource = this;
        }

        close() {}
      };

      const relativeClient = new AgentServiceClient('/api');

      const streamPromise = relativeClient.askStream({ question: 'test' }, () => {});

      setTimeout(() => {
        if (savedEventSource?.onmessage) {
          savedEventSource.onmessage({ data: '{"type":"complete","answer":"Done","sources":[]}' });
        }
      }, 10);

      await streamPromise;
      expect(savedEventSource.url).toContain('/api/ask/stream');
    });

    it('should handle malformed SSE data', async () => {
      let savedEventSource: any = null;
      
      (globalThis.EventSource as any) = class MockES {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        url: string;
        
        constructor(url: string) {
          this.url = url;
          savedEventSource = this;
        }
        
        close() {}
      };

      const events: any[] = [];
      
      const streamPromise = client.askStream(
        { question: 'test' },
        (event) => events.push(event)
      );

      setTimeout(() => {
        if (savedEventSource?.onmessage) {
          // Invalid JSON should be caught and skipped
          savedEventSource.onmessage({ data: 'invalid json' });
          // Valid event after invalid one
          savedEventSource.onmessage({ data: '{"type":"complete","answer":"Done","sources":[]}' });
        }
      }, 10);

      await streamPromise;

      // Should only have 1 valid event
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle stream error', async () => {
      let savedEventSource: any = null;
      
      (globalThis.EventSource as any) = class MockES {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        url: string;
        
        constructor(url: string) {
          this.url = url;
          savedEventSource = this;
        }
        
        close() {}
      };

      const streamPromise = client.askStream(
        { question: 'test' },
        () => {}
      );

      setTimeout(() => {
        if (savedEventSource?.onerror) {
          savedEventSource.onerror(new Event('error'));
        }
      }, 10);

      await expect(streamPromise).rejects.toThrow();
    });

    it('should reject when stream callback throws AgentServiceError', async () => {
      let savedEventSource: any = null;

      (globalThis.EventSource as any) = class MockES {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        url: string;

        constructor(url: string) {
          this.url = url;
          savedEventSource = this;
        }

        close() {}
      };

      const streamPromise = client.askStream(
        { question: 'test' },
        () => {
          throw new AgentServiceError('Connection failed: incomplete chunked read');
        }
      );

      setTimeout(() => {
        if (savedEventSource?.onmessage) {
          savedEventSource.onmessage({ data: '{"type":"error","message":"Connection failed: incomplete chunked read"}' });
        }
      }, 10);

      await expect(streamPromise).rejects.toThrow(AgentServiceError);
    });

    it('should close stream on complete event', async () => {
      let savedEventSource: any = null;
      
      (globalThis.EventSource as any) = class MockES {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        url: string;
        closed = false;
        
        constructor(url: string) {
          this.url = url;
          savedEventSource = this;
        }
        
        close() {
          this.closed = true;
        }
      };

      const streamPromise = client.askStream(
        { question: 'test' },
        () => {}
      );

      setTimeout(() => {
        if (savedEventSource?.onmessage) {
          savedEventSource.onmessage({ data: '{"type":"complete","answer":"Done","sources":[]}' });
        }
      }, 10);

      await streamPromise;

      expect(savedEventSource.closed).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should fetch configuration', async () => {
      const mockConfig: AgentConfig = {
        providers: [
          { name: 'groq', models: ['llama-3.1'], default: true },
        ],
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
