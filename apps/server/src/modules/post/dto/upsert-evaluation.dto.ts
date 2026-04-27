import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { UpsertEvaluationInputDto } from '@momoya/shared';
import { EVALUATION_MAX, EVALUATION_MIN } from '@momoya/shared';

export class UpsertEvaluationDto implements UpsertEvaluationInputDto {
  @ApiProperty({
    example: '真乖，记得按时休息。',
    minLength: EVALUATION_MIN,
    maxLength: EVALUATION_MAX,
  })
  @IsString()
  @MinLength(EVALUATION_MIN)
  @MaxLength(EVALUATION_MAX)
  text!: string;
}
