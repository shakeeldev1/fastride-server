import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from '../user/entities/user.entity';
import { AuthService } from './services/auth.service';
import { EmailService } from './services/email.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
  ],
  providers: [AuthService, EmailService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, EmailService],
})
export class AuthModule {}
