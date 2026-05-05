import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './services/user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getProfile(@Request() req: any) {
    return this.userService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async updateProfile(
    @Request() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(req.user.id, updateProfileDto);
  }

  @Post('profile-picture')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  async uploadProfilePicture(
    @Request() req: any,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    return this.userService.uploadProfilePicture(req.user.id, file);
  }

  @Delete('profile-picture')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async deleteProfilePicture(@Request() req: any) {
    return this.userService.deleteProfilePicture(req.user.id);
  }

  @Post('deactivate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async deactivateAccount(@Request() req: any) {
    return this.userService.deactivateAccount(req.user.id);
  }

  @Post('activate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async activateAccount(@Request() req: any) {
    return this.userService.activateAccount(req.user.id);
  }
}
