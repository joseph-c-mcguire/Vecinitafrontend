import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'vecinita-dev-admin-session';

type SupabaseMockOptions = {
  configured: boolean;
  session?: unknown;
  signInError?: Error | null;
  signUpError?: Error | null;
};

async function loadAuthModule(options: SupabaseMockOptions) {
  vi.resetModules();

  const unsubscribe = vi.fn();
  const onAuthStateChange = vi.fn((_callback: unknown) => ({
    data: { subscription: { unsubscribe } },
  }));

  const signInWithPassword = vi.fn().mockResolvedValue({ error: options.signInError ?? null });
  const signUp = vi.fn().mockResolvedValue({ error: options.signUpError ?? null });
  const signOut = vi.fn().mockResolvedValue({});

  const supabaseMock = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: options.session ?? null } }),
      onAuthStateChange,
      signInWithPassword,
      signUp,
      signOut,
    },
  };

  vi.doMock('@/lib/supabase', () => ({
    isSupabaseConfigured: options.configured,
    supabase: options.configured ? supabaseMock : null,
    supabaseConfigError:
      'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  }));

  const mod = await import('../AuthContext');

  return {
    ...mod,
    mocks: {
      supabaseMock,
      signInWithPassword,
      signUp,
      signOut,
      onAuthStateChange,
      unsubscribe,
    },
  };
}

function createWrapper(AuthProvider: ({ children }: { children: ReactNode }) => JSX.Element) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('returns anonymous state when Supabase is not configured', async () => {
    vi.stubEnv('VITE_DEV_ADMIN_ENABLED', 'false');

    const { AuthProvider, useAuth } = await loadAuthModule({ configured: false });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(AuthProvider),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAnonymous).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('hydrates initial session and subscribes/unsubscribes auth listener', async () => {
    const session = {
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        app_metadata: { role: 'admin' },
      },
    };

    const { AuthProvider, useAuth, mocks } = await loadAuthModule({
      configured: true,
      session,
    });

    const { result, unmount } = renderHook(() => useAuth(), {
      wrapper: createWrapper(AuthProvider),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user?.email).toBe('admin@example.com');
    expect(result.current.isAdmin).toBe(true);
    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1);

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('supports dev-admin local sign-in flow', async () => {
    vi.stubEnv('VITE_DEV_ADMIN_ENABLED', 'true');
    vi.stubEnv('VITE_DEV_ADMIN_EMAIL', 'dev-admin@example.com');
    vi.stubEnv('VITE_DEV_ADMIN_PASSWORD', 'password123');
    vi.stubEnv('VITE_DEV_ADMIN_TOKEN', 'dev-token');

    const { AuthProvider, useAuth } = await loadAuthModule({ configured: false });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(AuthProvider),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const response = await result.current.signIn('dev-admin@example.com', 'password123');
      expect(response.error).toBeNull();
    });

    expect(result.current.user?.email).toBe('dev-admin@example.com');
    expect(result.current.isAdmin).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('dev-token');

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns local dev sign-in error on invalid credentials', async () => {
    vi.stubEnv('VITE_DEV_ADMIN_ENABLED', 'true');
    vi.stubEnv('VITE_DEV_ADMIN_EMAIL', 'dev-admin@example.com');
    vi.stubEnv('VITE_DEV_ADMIN_PASSWORD', 'password123');
    vi.stubEnv('VITE_DEV_ADMIN_TOKEN', 'dev-token');

    const { AuthProvider, useAuth } = await loadAuthModule({ configured: false });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(AuthProvider),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const response = await result.current.signIn('dev-admin@example.com', 'bad-password');
      expect(response.error).toBeTruthy();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it('uses Supabase signIn/signUp/signOut when configured', async () => {
    const { AuthProvider, useAuth, mocks } = await loadAuthModule({ configured: true });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(AuthProvider),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const signInResult = await result.current.signIn('user@example.com', 'pass');
      expect(signInResult.error).toBeNull();
    });

    await act(async () => {
      const signUpResult = await result.current.signUp('user@example.com', 'pass');
      expect(signUpResult.error).toBeNull();
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(mocks.signUp).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('throws when useAuth is called outside provider', async () => {
    const { useAuth } = await loadAuthModule({ configured: false });

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
  });
});
