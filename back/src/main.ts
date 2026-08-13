import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { createServer } from 'net';
import { AppModule } from './app.module';

const MAX_PORT_ATTEMPTS = 10;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [
    'http://localhost:3000',
  ];
  const preferredPort = configService.get<number>('app.port') ?? 3001;
  const host = configService.get<string>('app.host') ?? '127.0.0.1';
  const bodyLimit = configService.get<string>('app.bodyLimit') ?? '1mb';
  const port = await resolveAvailablePort(preferredPort, host);

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.use(createSecurityHeadersMiddleware());
  app.use(createRateLimitMiddleware(configService));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origine CORS non autorisee.'));
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.listen(port, host);

  if (port !== preferredPort) {
    logger.warn(`Le port ${preferredPort} etait occupe. API demarree automatiquement sur ${port}.`);
  }

  logger.log(`API disponible sur http://${host}:${port}`);
}

async function resolveAvailablePort(startPort: number, host: string) {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const candidatePort = startPort + offset;
    const available = await isPortAvailable(candidatePort, host);

    if (available) {
      return candidatePort;
    }
  }

  throw new Error(
    `Aucun port disponible entre ${startPort} et ${startPort + MAX_PORT_ATTEMPTS - 1}.`,
  );
}

function isPortAvailable(port: number, host: string) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

function createSecurityHeadersMiddleware() {
  return (_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    next();
  };
}

function createRateLimitMiddleware(configService: ConfigService) {
  const windowMs = configService.get<number>('security.rateLimitWindowMs') ?? 60_000;
  const maxRequests = configService.get<number>('security.rateLimitMaxRequests') ?? 120;

  return (request, response, next) => {
    const now = Date.now();
    const key = `${request.ip}:${request.method}:${request.path}`;
    const bucket = rateBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      response.status(429).json({ message: 'Trop de requetes. Reessayez plus tard.' });
      return;
    }

    next();
  };
}

bootstrap();
