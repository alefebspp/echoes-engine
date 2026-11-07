import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEmail, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ErrorCode } from 'src/common/errors/error-code';
import { createValidationPipe } from './validation-pipe';

class MetadataDto {
  @IsString()
  url!: string;
}

class SampleDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(5)
  name!: string;

  @ValidateNested()
  @Type(() => MetadataDto)
  metadata!: MetadataDto;
}

describe('createValidationPipe', () => {
  it('rejects with VALIDATION_FAILED and per-field details', async () => {
    const pipe = createValidationPipe();

    const error = await pipe
      .transform(
        { email: 'nope', name: 'too long', metadata: { url: 1 }, extra: true },
        { type: 'body', metatype: SampleDto },
      )
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as {
      code: string;
      message: string[];
      details: { field: string; rules: string[] }[];
    };
    expect(body.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(body.message.length).toBeGreaterThan(0);
    expect(body.details).toEqual(
      expect.arrayContaining([
        { field: 'email', rules: ['isEmail'] },
        { field: 'name', rules: ['maxLength'] },
        { field: 'metadata.url', rules: ['isString'] },
        { field: 'extra', rules: ['whitelistValidation'] },
      ]),
    );
  });
});
