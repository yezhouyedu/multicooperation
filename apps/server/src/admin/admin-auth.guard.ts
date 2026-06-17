import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const token = Array.isArray(header) ? header[0] : header;
    const value = token.startsWith('Bearer ') ? token.slice('Bearer '.length).trim() : '';
    if (!value || !this.auth.verifyToken(value)) {
      throw new UnauthorizedException('Admin authentication required');
    }
    return true;
  }
}
