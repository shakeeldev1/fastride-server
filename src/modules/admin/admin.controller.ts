import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards, Patch, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { CreditDriverWalletDto } from './dto/credit-driver-wallet.dto';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async listUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers({ role, status, search, page, limit });
  }

  @Get('rides')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async listRides(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listRides({ status, search, page, limit });
  }

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

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async changeUserRole(
    @Param('id') userId: string,
    @Body() changeRoleDto: ChangeUserRoleDto,
  ) {
    return this.adminService.changeUserRole(userId, changeRoleDto);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async deleteUser(@Param('id') userId: string) {
    return this.adminService.deleteUser(userId);
  }

  @Get('wallet/withdrawals')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async listWithdrawals(@Query('status') status?: string) {
    return this.adminService.listWithdrawals(status);
  }

  @Post('wallet/withdrawals/:id/complete')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async completeWithdrawal(@Param('id') id: string) {
    return this.adminService.completeWithdrawal(id);
  }

  @Post('wallet/withdrawals/:id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async rejectWithdrawal(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.adminService.rejectWithdrawal(id, body?.reason);
  }

  @Post('wallet/drivers/:id/credit')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async creditDriverWallet(
    @Param('id') id: string,
    @Body() creditDto: CreditDriverWalletDto,
  ) {
    return this.adminService.creditDriverWallet(id, creditDto.amount, creditDto.description);
  }
}
