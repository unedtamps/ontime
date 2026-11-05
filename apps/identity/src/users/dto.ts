import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyAuthDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  position?: string;
}

export class UpdateUserDto {  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  position?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}
