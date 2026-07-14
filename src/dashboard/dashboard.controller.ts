import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../presentation/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../presentation/auth/strategies/jwt.strategy';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService, DashboardStats } from './dashboard.service';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getStats(
    @Req() request: AuthenticatedRequest,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardStats> {
    return this.dashboardService.getStats(
      request.user.userId,
      query.days ?? 30,
    );
  }
}
