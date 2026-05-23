import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return {
      name: 'multi-cooperation-server',
      status: 'ok',
      message: 'server is running',
    };
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'server',
      timestamp: new Date().toISOString(),
    };
  }
}
