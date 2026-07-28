import type { SubmitEventResult } from 'src/application/event/submit-event-use-case';

export class SubmitEventResponseDto {
  id: string;
  status: 'accepted';

  static fromResult(result: SubmitEventResult): SubmitEventResponseDto {
    const dto = new SubmitEventResponseDto();
    dto.id = result.id;
    dto.status = result.status;
    return dto;
  }
}
