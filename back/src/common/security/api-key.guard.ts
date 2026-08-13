import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

const PUBLIC_PATHS = new Set(['/health']);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.method === 'OPTIONS' || PUBLIC_PATHS.has(request.path)) {
      return true;
    }

    const security = this.configService.get('security');
    if (!security?.requireApiKey) {
      return true;
    }

    const expectedApiKey = security.apiKey;
    if (!expectedApiKey) {
      throw new ServiceUnavailableException(
        "La cle API serveur n'est pas configuree. Definissez API_KEY dans l'environnement.",
      );
    }

    const providedApiKey = this.extractApiKey(request);
    if (!providedApiKey || !this.matches(providedApiKey, expectedApiKey)) {
      throw new UnauthorizedException('Cle API manquante ou invalide.');
    }

    return true;
  }

  private extractApiKey(request: Request) {
    const headerValue = request.headers['x-api-key'];
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }

    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }

    const authorization = request.headers.authorization;
    const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
    return bearerMatch?.[1]?.trim();
  }

  private matches(value: string, expected: string) {
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);

    return (
      valueBuffer.length === expectedBuffer.length &&
      timingSafeEqual(valueBuffer, expectedBuffer)
    );
  }
}
