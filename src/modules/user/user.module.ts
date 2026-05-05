import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './services/user.service';
import { CloudinaryService } from './services/cloudinary.service';
import { UserController } from './user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService, CloudinaryService],
  controllers: [UserController],
  exports: [UserService, CloudinaryService],
})
export class UserModule {}
