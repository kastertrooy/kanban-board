import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty()
  title!: string;
}

export class UpdateBoardDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;
}
