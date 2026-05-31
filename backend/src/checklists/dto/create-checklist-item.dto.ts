import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
