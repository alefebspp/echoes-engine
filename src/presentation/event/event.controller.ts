import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ListEventsQueryHandler } from 'src/application/queries/list-events-query-handler';
import { SubmitEventUseCase } from 'src/application/event/submit-event-use-case';
import {
  decodeEventCursor,
  InvalidEventCursorException,
} from 'src/infrastructure/common/event-cursor';
import { JwtAuthGuard } from 'src/presentation/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from 'src/presentation/auth/strategies/jwt.strategy';
import { DomainExceptionFilter } from 'src/infrastructure/nest/domain-exception.filter';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { SubmitEventDto } from './dto/submit-event.dto';
import { SubmitEventResponseDto } from './dto/submit-event-response.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('events')
@UseFilters(DomainExceptionFilter)
export class EventController {
  constructor(
    private readonly submitEventUseCase: SubmitEventUseCase,
    private readonly listEventsQueryHandler: ListEventsQueryHandler,
  ) {}

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

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListEventsQueryDto,
  ) {
    let cursor: { occurredAt: Date; id: string } | undefined;
    if (query.cursor) {
      try {
        const decoded = decodeEventCursor(query.cursor);
        cursor = {
          occurredAt: new Date(decoded.occurredAt),
          id: decoded.id,
        };
      } catch (error) {
        if (error instanceof InvalidEventCursorException) {
          throw new BadRequestException('Invalid cursor');
        }
        throw error;
      }
    }

    return this.listEventsQueryHandler.execute({
      userId: request.user.userId,
      limit: query.limit,
      cursor,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      tag: query.tag,
    });
  }
}
