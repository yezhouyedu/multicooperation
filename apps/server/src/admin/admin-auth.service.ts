import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

type AdminTokenPayload = {
  purpose: 'admin';
  exp: number;
  iat: number;
};

@Injectable()
export class AdminAuthService {
  private readonly tokenTtlSeconds = 12 * 60 * 60;

  constructor(private readonly config: ConfigService) {}

  login(password: string) {
    if (!this.verifyPassword(password)) {
      throw new UnauthorizedException('Invalid admin password');
    }
    return {
      ok: true,
      token: this.signToken(),
      expiresInSeconds: this.tokenTtlSeconds,
    };
  }

  verifyToken(token: string) {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return false;

    const expected = this.sign(encodedPayload);
    if (!this.safeEquals(signature, expected)) return false;

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AdminTokenPayload;
      return payload.purpose === 'admin' && payload.exp > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  }

  private verifyPassword(password: string) {
    return this.safeEquals(password, this.getPassword());
  }

  private signToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload: AdminTokenPayload = {
      purpose: 'admin',
      iat: now,
      exp: now + this.tokenTtlSeconds,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  private sign(value: string) {
    return createHmac('sha256', this.getSecret()).update(value).digest('base64url');
  }

  private getPassword() {
    const password = this.config.get<string>('ADMIN_PASSWORD')?.trim();
    if (!password) {
      throw new InternalServerErrorException('ADMIN_PASSWORD is not configured');
    }
    return password;
  }

  private getSecret() {
    return this.config.get<string>('ADMIN_TOKEN_SECRET') || this.getPassword();
  }

  private safeEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
