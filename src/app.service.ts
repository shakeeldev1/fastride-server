import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      message: 'Welcome to Fastride API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
