import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateColumnDto {
  @IsUUID()
  boardId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;
}

export class UpdateColumnDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;
}

export class ReorderColumnItemDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderColumnsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderColumnItemDto)
  columns!: ReorderColumnItemDto[];
}
