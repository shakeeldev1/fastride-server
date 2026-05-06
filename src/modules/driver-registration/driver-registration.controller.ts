import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDriverRegistrationDto } from './dto/create-driver-registration.dto';
import { DriverRegistrationService } from './services/driver-registration.service';

@Controller('api/driver-registration')
export class DriverRegistrationController {
  constructor(private readonly driverRegistrationService: DriverRegistrationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'personalPicture', maxCount: 1 },
      { name: 'frontSideOfLicense', maxCount: 1 },
      { name: 'selfieWithDriverLicense', maxCount: 1 },
      { name: 'cnicFront', maxCount: 1 },
      { name: 'cnicBack', maxCount: 1 },
      { name: 'photoOfVehicle', maxCount: 1 },
      { name: 'vehicleRegistrationCertificate', maxCount: 1 },
      { name: 'backsideOfVehicleInformation', maxCount: 1 },
    ]),
  )
  @HttpCode(201)
  async create(
    @Request() req: any,
    @Body() dto: CreateDriverRegistrationDto,
    @UploadedFiles()
    files: Record<string, Array<{ buffer: Buffer; mimetype: string; originalname: string }>>,
  ) {
    return this.driverRegistrationService.create(req.user.id, dto, files);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getMyRegistration(@Request() req: any) {
    return this.driverRegistrationService.getMyRegistration(req.user.id);
  }
}