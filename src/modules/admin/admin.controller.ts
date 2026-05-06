import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('driver-registrations')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async listDriverRegistrations(@Query('status') status?: string) {
    return this.adminService.listDriverRegistrations(status);
  }

  @Get('driver-registrations/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async getDriverRegistration(@Param('id') id: string) {
    return this.adminService.getDriverRegistration(id);
  }

  @Post('driver-registrations/:id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async approve(@Param('id') id: string) {
    return this.adminService.approveDriverRegistration(id);
  }

  @Post('driver-registrations/:id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async reject(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.adminService.rejectDriverRegistration(id, body.reason);
  }
}
