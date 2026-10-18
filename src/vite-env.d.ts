/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL проекта Supabase (публичный, browser-safe). */
  readonly VITE_SUPABASE_URL?: string
  /** Публичный publishable/anon ключ Supabase (browser-safe). Никогда не использовать service_role! */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}