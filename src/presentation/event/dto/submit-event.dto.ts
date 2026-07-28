import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
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

class AppVisitMetadataDto {
  @IsString()
  @IsNotEmpty()
  appName: string;

  @IsString()
  @IsOptional()
  packageName?: string;

  @IsString()
  @IsOptional()
  title?: string;
}

export class SubmitEventDto {
  @IsIn(['WEB_VISIT', 'APP_VISIT'])
  type: 'WEB_VISIT' | 'APP_VISIT';

  @IsISO8601()
  timestamp: string;

  @IsIn(['browser_extension', 'mobile_sdk'])
  source: 'browser_extension' | 'mobile_sdk';

  @IsObject()
  @ValidateNested()
  @Type((typeHelpOptions) => {
    const object = typeHelpOptions?.object as SubmitEventDto | undefined;
    return object?.type === 'APP_VISIT'
      ? AppVisitMetadataDto
      : WebVisitMetadataDto;
  })
  metadata: WebVisitMetadataDto | AppVisitMetadataDto;

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
