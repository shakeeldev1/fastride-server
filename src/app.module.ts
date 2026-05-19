import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import * as dotenv from 'dotenv';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { DriverRegistrationModule } from './modules/driver-registration/driver-registration.module';
import { AdminModule } from './modules/admin/admin.module';
import { RideRequestModule } from './modules/ride-request/ride-request.module';
import { UserModule } from './modules/user/user.module';
import { getBaseDatabaseConfig } from './config/database.config';

dotenv.config();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      ...(getBaseDatabaseConfig() as TypeOrmModuleOptions),
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    AuthModule,
    UserModule,
    DriverRegistrationModule,
    AdminModule,
    RideRequestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
