import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class WebVisitMetadataDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  browser?: string;
}

export class SubmitEventDto {
  @IsIn(['WEB_VISIT'])
  type: 'WEB_VISIT';

  @IsISO8601()
  timestamp: string;

  @IsIn(['browser_extension'])
  source: 'browser_extension';

  @ValidateNested()
  @Type(() => WebVisitMetadataDto)
  metadata: WebVisitMetadataDto;

  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsNumber()
  attempts?: number;

  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}
