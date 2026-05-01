import { mkdirSync, writeFileSync } from 'node:fs';

const rawApiBaseUrl = process.env.API_URL ?? process.env.APP_API_BASE_URL ?? process.env.NG_APP_API_BASE_URL ?? '';
const apiBaseUrl = normalizeApiBaseUrl(rawApiBaseUrl);
const enableMockFallbacks = process.env.APP_ENABLE_MOCK_FALLBACKS === 'true';
const publicDir = new URL('../public/', import.meta.url);

mkdirSync(publicDir, { recursive: true });
writeFileSync(
  new URL('app-config.js', publicDir),
  `window.__APP_CONFIG__ = ${JSON.stringify({ apiBaseUrl, enableMockFallbacks }, null, 2)};\n`
);

function normalizeApiBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}
