import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CompanyDocument,
  DocumentCategory,
} from '../entity/company-document.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { AwsS3Service } from '../aws-s3/aws-s3.service';

const CATEGORIES = Object.values(DocumentCategory);

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(CompanyDocument)
    private readonly documentRepo: Repository<CompanyDocument>,
    private readonly awsS3Service: AwsS3Service,
  ) {}

  // Upload or replace a document
  async uploadDocument(
    companyId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File,
  ): Promise<CompanyDocument> {
    // Upload file to AWS S3
    const folder = `qistonpe/documents/${companyId}`;
    const result = await this.awsS3Service.uploadBuffer(
      file.buffer,
      folder,
      file.originalname,
    );

    // Check if a document of this type already exists for the company
    let doc = await this.documentRepo.findOne({
      where: { companyId, documentType: dto.documentType },
    });

    if (doc) {
      // Delete old file from S3 if it exists
      if (doc.fileUrl) {
        const oldKey = this.awsS3Service.extractKeyFromUrl(doc.fileUrl);
        if (oldKey) {
          await this.awsS3Service.deleteByKey(oldKey);
        }
      }
      doc.fileName = file.originalname;
      doc.fileUrl = result.url;
      doc.status = 'UPLOADED';
    } else {
      doc = this.documentRepo.create({
        companyId,
        category: dto.category,
        documentType: dto.documentType,
        fileName: file.originalname,
        fileUrl: result.url,
        status: 'UPLOADED',
      });
    }

    return this.documentRepo.save(doc);
  }

  // Delete a document (revert to PENDING)
  async deleteDocument(companyId: string, documentId: string): Promise<void> {
    const doc = await this.documentRepo.findOne({
      where: { id: documentId, companyId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    // Remove from S3
    if (doc.fileUrl) {
      const key = this.awsS3Service.extractKeyFromUrl(doc.fileUrl);
      if (key) {
        await this.awsS3Service.deleteByKey(key);
      }
    }
    await this.documentRepo.remove(doc);
  }

  // Get repository status — documents grouped by category
  async getRepositoryStatus(companyId: string) {
    const uploaded = await this.documentRepo.find({ where: { companyId } });

    const categories = CATEGORIES.map((category) => {
      const docs = uploaded
        .filter((d) => d.category === category)
        .map((d) => ({
          documentType: d.documentType,
          status: d.status,
          id: d.id,
          fileName: d.fileName,
          fileUrl: d.fileUrl,
          uploadedAt: d.uploadedAt,
        }));

      return {
        category,
        uploadedCount: docs.length,
        documents: docs,
      };
    });

    return {
      uploaded: uploaded.length,
      categories,
    };
  }

  // Get document file URL for redirect/download
  async getDocumentFile(companyId: string, documentId: string) {
    const doc = await this.documentRepo.findOne({
      where: { id: documentId, companyId },
    });
    if (!doc || !doc.fileUrl) throw new NotFoundException('File not found');
    return doc;
  }
}
