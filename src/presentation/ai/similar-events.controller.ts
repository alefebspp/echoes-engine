import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { FindSimilarEventsUseCase } from 'src/application/ai/find-similar-events-use-case';
import { DomainExceptionFilter } from 'src/infrastructure/nest/domain-exception.filter';
import { JwtAuthGuard } from 'src/presentation/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from 'src/presentation/auth/strategies/jwt.strategy';
import { SimilarEventsQueryDto } from 'src/presentation/event/dto/similar-events-query.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('events')
@UseFilters(DomainExceptionFilter)
export class SimilarEventsController {
  constructor(
    private readonly findSimilarEventsUseCase: FindSimilarEventsUseCase,
  ) {}

  @Get(':id/similar')
  @UseGuards(JwtAuthGuard)
  async similar(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Query() query: SimilarEventsQueryDto,
  ) {
    const result = await this.findSimilarEventsUseCase.execute({
      userId: request.user.userId,
      eventId,
      limit: query.limit,
    });

    if (!result) {
      throw new NotFoundException('Event not found');
    }

    return result;
  }
}
