import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as https from 'https';
import * as http from 'http';

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

  /**
   * Download a file from any HTTP(S) URL and upload it to S3.
   * Returns the S3 URL of the uploaded object.
   *
   * This is used to proxy government portal documents (e.g. GeM bid PDFs)
   * through S3 so downstream services can reliably download them.
   */
  async downloadAndUploadToS3(
    sourceUrl: string,
    folder: string,
    fallbackFilename = 'document.pdf',
  ): Promise<{ url: string; key: string }> {
    const buffer = await this.downloadAsBuffer(sourceUrl);
    const filename = this.extractFilename(sourceUrl) || fallbackFilename;
    return this.uploadBuffer(buffer, folder, filename);
  }

  private extractFilename(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const name = pathname.split('/').pop();
      return name && name.length > 0 ? name : null;
    } catch {
      return null;
    }
  }

  private downloadAsBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/pdf,*/*',
          },
          timeout: 60_000,
        },
        (res) => {
          // Follow redirects (301, 302, 307, 308)
          if (
            res.statusCode &&
            [301, 302, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            this.downloadAsBuffer(res.headers.location)
              .then(resolve)
              .catch(reject);
            return;
          }

          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${res.statusCode} downloading ${url}`,
              ),
            );
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout downloading ${url}`));
      });
    });
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
