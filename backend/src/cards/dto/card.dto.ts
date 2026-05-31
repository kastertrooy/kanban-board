import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCardDto {
  @IsUUID()
  boardId!: string;

  @IsUUID()
  columnId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateCardDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class MoveCardDto {
  @IsUUID()
  columnId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;
}
