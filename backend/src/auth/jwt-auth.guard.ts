import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verify } from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedUser extends JwtPayload {
  id: string;
}

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export function verifyJwtToken(token: string, secret: string): AuthenticatedUser {
  const normalizedToken = token.startsWith('Bearer ') ? token.slice(7) : token;
  const payload = verify(normalizedToken, secret);

  if (!isJwtPayload(payload)) {
    throw new UnauthorizedException('Invalid token payload');
  }

  return {
    ...payload,
    id: payload.sub,
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    const secret = this.configService.get<string>('jwtSecret')
      ?? this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    try {
      request.user = verifyJwtToken(token, secret);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(request: Request): string {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    return token;
  }
}

function isJwtPayload(payload: string | object): payload is JwtPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const candidate = payload as Partial<JwtPayload>;
  return typeof candidate.sub === 'string' && typeof candidate.email === 'string';
}
