import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { GetDashboardStatsUseCase } from 'src/application/dashboard/get-dashboard-stats-use-case';
import type { DashboardStats } from 'src/domain/ports/dashboard-stats-query';
import { JwtAuthGuard } from 'src/presentation/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from 'src/presentation/auth/strategies/jwt.strategy';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly getDashboardStatsUseCase: GetDashboardStatsUseCase,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getStats(
    @Req() request: AuthenticatedRequest,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardStats> {
    return this.getDashboardStatsUseCase.execute(
      request.user.userId,
      query.days ?? 30,
    );
  }
}
