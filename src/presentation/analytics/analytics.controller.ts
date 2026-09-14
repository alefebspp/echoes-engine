import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  GetDailyStatsQueryHandler,
  GetTagStatsQueryHandler,
} from 'src/application/queries/analytics-query-handlers';
import { GetWeeklyStatsQueryHandler } from 'src/application/queries/get-weekly-stats-query-handler';
import { JwtAuthGuard } from 'src/presentation/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from 'src/presentation/auth/strategies/jwt.strategy';
import { AnalyticsPeriodQueryDto } from './dto/analytics-period-query.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly getDailyStatsQueryHandler: GetDailyStatsQueryHandler,
    private readonly getTagStatsQueryHandler: GetTagStatsQueryHandler,
    private readonly getWeeklyStatsQueryHandler: GetWeeklyStatsQueryHandler,
  ) {}

  @Get('daily')
  @UseGuards(JwtAuthGuard)
  getDaily(
    @Req() request: AuthenticatedRequest,
    @Query() query: AnalyticsPeriodQueryDto,
  ) {
    return this.getDailyStatsQueryHandler.execute(
      request.user.userId,
      query.days ?? 30,
    );
  }

  @Get('tags')
  @UseGuards(JwtAuthGuard)
  getTags(@Req() request: AuthenticatedRequest) {
    return this.getTagStatsQueryHandler.execute(request.user.userId);
  }

  @Get('weekly')
  @UseGuards(JwtAuthGuard)
  getWeekly(@Req() request: AuthenticatedRequest) {
    return this.getWeeklyStatsQueryHandler.execute(request.user.userId);
  }
}
