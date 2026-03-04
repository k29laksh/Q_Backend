import { IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FindBidsDto {
  @ApiProperty({
    description:
      'A map of HSN codes to their associated keywords. Keys are HSN codes, values are arrays of keywords.',
    example: {
      '8501': ['electric motor', 'generator'],
      '8544': ['cable', 'wire', 'conductor'],
    },
  })
  @IsNotEmpty()
  @IsObject()
  customerHsnMap: Record<string, string[]>;
}
