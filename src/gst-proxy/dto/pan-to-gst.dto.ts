import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PanToGstDto {
  @ApiProperty({ example: 'AABCU9603R' })
  @IsString()
  @IsNotEmpty()
  pan: string;

  @ApiProperty({ example: 'Y', required: false })
  @IsString()
  @IsOptional()
  consent?: string;
}
