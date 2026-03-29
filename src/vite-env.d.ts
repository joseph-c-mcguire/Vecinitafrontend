/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_GATEWAY_PROXY_TARGET?: string;
  readonly VITE_AGENT_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_AGENT_STREAM_TIMEOUT_MS?: string;
  readonly VITE_AGENT_STREAM_FIRST_EVENT_TIMEOUT_MS?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DEV_ADMIN_ENABLED?: string;
  readonly VITE_DEV_ADMIN_EMAIL?: string;
  readonly VITE_DEV_ADMIN_PASSWORD?: string;
  readonly VITE_DEV_ADMIN_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
