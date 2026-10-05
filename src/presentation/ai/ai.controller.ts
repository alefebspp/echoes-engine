import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { seconds, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AskQuestionUseCase } from 'src/application/ai/ask-question-use-case';
import { DomainExceptionFilter } from 'src/infrastructure/nest/domain-exception.filter';
import { JwtAuthGuard } from 'src/presentation/auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from 'src/presentation/auth/strategies/jwt.strategy';
import { AskQuestionDto } from './dto/ask-question.dto';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('ai')
@UseFilters(DomainExceptionFilter)
export class AiController {
  constructor(private readonly askQuestionUseCase: AskQuestionUseCase) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async ask(
    @Req() request: AuthenticatedRequest,
    @Body() body: AskQuestionDto,
  ) {
    return this.askQuestionUseCase.execute({
      userId: request.user.userId,
      question: body.question,
      limit: body.limit,
      from: body.from ? new Date(body.from) : undefined,
      to: body.to ? new Date(body.to) : undefined,
      tags: body.tags,
    });
  }
}
