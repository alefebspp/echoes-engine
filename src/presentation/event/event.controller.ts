import { Body, Controller, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SubmitEventUseCase } from 'src/application/event/submit-event-use-case';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from 'src/auth/strategies/jwt.strategy';
import { DomainExceptionFilter } from 'src/infrastructure/nest/domain-exception.filter';
import { SubmitEventDto } from './dto/submit-event.dto';
import { SubmitEventResponseDto } from './dto/submit-event-response.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('events')
@UseFilters(DomainExceptionFilter)
export class EventController {
  constructor(private readonly submitEventUseCase: SubmitEventUseCase) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async submit(
    @Req() request: AuthenticatedRequest,
    @Body() submitEventDto: SubmitEventDto,
  ): Promise<SubmitEventResponseDto> {
    const result = await this.submitEventUseCase.execute(
      request.user.userId,
      {
        type: submitEventDto.type,
        timestamp: submitEventDto.timestamp,
        source: submitEventDto.source,
        metadata: { ...submitEventDto.metadata },
        id: submitEventDto.id,
      },
    );
    return SubmitEventResponseDto.fromResult(result);
  }
}
