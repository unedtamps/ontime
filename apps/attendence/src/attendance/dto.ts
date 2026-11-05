import { IsNumber, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckInDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number;
}

export class UpdateDescriptionDto {
  @IsString()
  @MaxLength(1000)
  description!: string;
}
