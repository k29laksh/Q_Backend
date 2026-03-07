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

/** Expected document types for each category */
const EXPECTED_DOCUMENTS: Record<string, string[]> = {
  REGISTRATION_IDENTITY: [
    'PAN Card',
    'GST Certificate',
    'Udyam Registration Certificate',
    'Company Incorporation Certificate',
  ],
  FINANCIAL: [
    'Annual Turnover Certificate',
    'Balance Sheet',
    'ITR (Income Tax Return)',
    'Bank Statement',
  ],
  WORK_EXPERIENCE: [
    'Work Order Copy',
    'Completion Certificate',
    'Purchase Order',
    'Client Reference Letter',
  ],
  CERTIFICATION: [
    'ISO Certification',
    'BIS Certification',
    'Self-Certification Local Content',
    'Manufacturer Authorization Form',
  ],
};

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
      const uploadedDocs = uploaded.filter((d) => d.category === category);
      const uploadedMap = new Map(
        uploadedDocs.map((d) => [d.documentType, d]),
      );

      const expectedTypes = EXPECTED_DOCUMENTS[category] || [];
      const docs = expectedTypes.map((docType) => {
        const existing = uploadedMap.get(docType);
        if (existing) {
          return {
            documentType: existing.documentType,
            status: existing.status,
            id: existing.id,
            fileName: existing.fileName,
            fileUrl: existing.fileUrl,
            uploadedAt: existing.uploadedAt,
          };
        }
        return {
          documentType: docType,
          status: 'PENDING' as const,
          id: null,
          fileName: null,
          fileUrl: null,
          uploadedAt: null,
        };
      });

      // Also include any uploaded docs with types not in the expected list
      for (const doc of uploadedDocs) {
        if (!expectedTypes.includes(doc.documentType)) {
          docs.push({
            documentType: doc.documentType,
            status: doc.status,
            id: doc.id,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            uploadedAt: doc.uploadedAt,
          });
        }
      }

      return {
        category,
        uploadedCount: uploadedDocs.filter((d) => d.status === 'UPLOADED')
          .length,
        totalCount: docs.length,
        documents: docs,
      };
    });

    const totalDocs = categories.reduce((sum, c) => sum + c.totalCount, 0);
    const totalUploaded = categories.reduce(
      (sum, c) => sum + c.uploadedCount,
      0,
    );

    return {
      uploaded: totalUploaded,
      total: totalDocs,
      overallProgress:
        totalDocs > 0 ? Math.round((totalUploaded / totalDocs) * 100) : 0,
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
