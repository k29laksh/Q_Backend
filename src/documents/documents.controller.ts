import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('companies/:companyId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // GET /companies/:companyId/documents — full repository status (powers the UI)
  @Get()
  getRepositoryStatus(@Param('companyId') companyId: string) {
    return this.documentsService.getRepositoryStatus(companyId);
  }

  // POST /companies/:companyId/documents — upload a document
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadDocument(
    @Param('companyId') companyId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documentsService.uploadDocument(companyId, dto, file);
  }

  // GET /companies/:companyId/documents/:documentId/file — download the file
  @Get(':documentId/file')
  async getFile(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const doc = await this.documentsService.getDocumentFile(
      companyId,
      documentId,
    );
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `inline; filename="${doc.fileName}"`,
    });
    res.send(doc.fileData);
  }

  // DELETE /companies/:companyId/documents/:documentId
  @Delete(':documentId')
  deleteDocument(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.deleteDocument(companyId, documentId);
  }
}
