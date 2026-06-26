import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubmitEventDto } from './dto/submit-event.dto';
import { EventsService, SubmitEventResult } from './events.service';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  submit(
    @Req() request: AuthenticatedRequest,
    @Body() submitEventDto: SubmitEventDto,
  ): Promise<SubmitEventResult> {
    return this.eventsService.submit(request.user.userId, submitEventDto);
  }
}
