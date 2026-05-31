import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpsertFieldValueDto {
  @IsString()
  @IsOptional()
  valueText?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  valueNumber?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  valueDate?: Date;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  userIds?: string[];
}
