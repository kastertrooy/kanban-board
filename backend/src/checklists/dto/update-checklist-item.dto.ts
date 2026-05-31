import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  text?: string;

  @IsBoolean()
  @IsOptional()
  isDone?: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
