/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_WS_BASE_DOMAIN?: string;
    readonly VITE_WS_BASE_URL?: string; // e.g. ws://localhost:3001 or wss://{replId}.itexecutes.me
    readonly VITE_RUNNER_PORT?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
