interface RuntimeAppConfig {
  apiBaseUrl?: string;
  enableMockFallbacks?: boolean;
}

const runtimeConfig = typeof globalThis !== 'undefined'
  ? (globalThis as typeof globalThis & { __APP_CONFIG__?: RuntimeAppConfig }).__APP_CONFIG__
  : undefined;

export const environment = {
  production: true,
  apiBaseUrl: runtimeConfig?.apiBaseUrl ?? '',
  enableMockFallbacks: runtimeConfig?.enableMockFallbacks ?? false
};
