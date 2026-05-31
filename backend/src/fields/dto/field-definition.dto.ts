import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { FieldType, Prisma } from '@prisma/client';

export class CreateFieldDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(FieldType)
  type!: FieldType;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsOptional()
  options?: Prisma.InputJsonValue;
}

export class UpdateFieldDefinitionDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsOptional()
  options?: Prisma.InputJsonValue | null;
}
