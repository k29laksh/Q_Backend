import { IsEnum, IsString } from 'class-validator';
import { DocumentCategory } from '../../entity/company-document.entity';

export class UploadDocumentDto {
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsString()
  documentType: string; // e.g., 'Company Incorporation Certificate'
}