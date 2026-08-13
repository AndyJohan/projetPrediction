export default () => ({
  app: {
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '127.0.0.1',
    corsOrigins: parseCsv(process.env.CORS_ORIGIN ?? 'http://localhost:3000'),
    bodyLimit: process.env.BODY_LIMIT ?? '1mb',
  },
  security: {
    apiKey: process.env.API_KEY,
    requireApiKey:
      process.env.NODE_ENV === 'test' ? false : process.env.API_KEY_REQUIRED !== 'false',
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
  },
});

function parseCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
