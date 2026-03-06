import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class AwsS3Service implements OnModuleInit {
  private readonly logger = new Logger(AwsS3Service.name);
  private s3Client: S3Client;
  private bucket: string;
  private region: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.region = this.config.get<string>('AWS_REGION', 'ap-south-1');
    this.bucket = this.config.get<string>('AWS_S3_BUCKET')!;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY')!,
        secretAccessKey: this.config.get<string>('AWS_SECRET_KEY')!,
      },
    });

    this.logger.log(
      `AWS S3 configured — bucket: ${this.bucket}, region: ${this.region}`,
    );
  }

  /**
   * Upload a file buffer to S3. Returns the public URL of the uploaded object.
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    originalName: string,
  ): Promise<{ url: string; key: string }> {
    const safeName = originalName.replace(/\s+/g, '_');
    const key = `${folder}/${Date.now()}-${safeName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: this.getMimeType(originalName),
      }),
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    this.logger.log(`Uploaded to S3: ${key}`);
    return { url, key };
  }

  /**
   * Delete an object from S3 by its key.
   */
  async deleteByKey(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    this.logger.log(`Deleted from S3: ${key}`);
  }

  /**
   * Extract the S3 object key from a full S3 URL.
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      txt: 'text/plain',
    };
    return mimeMap[ext ?? ''] ?? 'application/octet-stream';
  }
}
