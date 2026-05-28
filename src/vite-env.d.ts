/// <reference types="vite/client" />

declare module 'dompurify';

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_VERSION?: string;
  /** Stesso valore di CLIENT_API_SECRET sul backend dashboard */
  readonly VITE_CLIENT_API_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}