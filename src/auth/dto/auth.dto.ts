import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class SignupStep1Dto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class SignupStep2Dto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN must be in format: ABCDE1234F',
  })
  pan: string;

  @IsString()
  @IsNotEmpty()
  legalName: string;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
