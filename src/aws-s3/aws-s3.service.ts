import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';
import * as fs from 'fs'; // Required to read the downloaded file
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
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  /**
   * Navigates to GeM portal via Playwright, searches for the Bid Number,
   * triggers the download, and uploads the buffer to S3.
   */
  async downloadAndUploadToS3(
    bidNumber: string, // Now takes bidNumber instead of URL
    folder: string,
    fallbackFilename = 'document.pdf',
  ): Promise<{ url: string; key: string }> {
    const buffer = await this.downloadBidViaSearch(bidNumber);
    return this.uploadBuffer(buffer, folder, fallbackFilename);
  }

  /**
   * The new UI-driven Playwright logic to bypass the WAF
   */
  private async downloadBidViaSearch(bidNumber: string): Promise<Buffer> {
    this.logger.log(
      `Launching Playwright to search and download bid: ${bidNumber}`,
    );

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        acceptDownloads: true,
      });

      const page = await context.newPage();

      // 1. Go to the Advanced Search page to establish a natural session
      this.logger.log(`Navigating to GeM advanced search...`);
      await page.goto('https://bidplus.gem.gov.in/advance-search', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // 2. Fill in the Bid Number
      this.logger.log(`Filling search form for: ${bidNumber}`);
      await page.waitForSelector('#bno', { timeout: 10000 });
      await page.fill('#bno', bidNumber);

      // 3. Click the Search button
      await page.click('#searchByBid');

      // 4. Wait for the result link to appear
      const exactLinkSelector = `a.bid_no_hover:has-text("${bidNumber}")`;
      await page.waitForSelector(exactLinkSelector, { timeout: 30000 });
      this.logger.log(`Bid result found! Preparing to download...`);

      // 5. Remove target="_blank" using Playwright's locator (which supports :has-text)
      const linkLocator = page.locator(exactLinkSelector).first();
      await linkLocator.evaluate((node) => node.removeAttribute('target'));

      // 6. Click the link and wait for the download to complete
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        page.click(exactLinkSelector),
      ]);

      const downloadPath = await download.path();

      if (!downloadPath) {
        throw new Error(
          'Playwright download event fired, but no file path was returned.',
        );
      }

      // 7. Read the downloaded file into memory
      const buffer = fs.readFileSync(downloadPath);

      // 8. Clean up the temporary file from the container's disk
      fs.unlinkSync(downloadPath);

      this.logger.log(
        `Successfully downloaded buffer via Playwright UI flow. Size: ${buffer.length} bytes`,
      );
      return buffer;
    } catch (error) {
      this.logger.error(
        `Playwright UI download failed for ${bidNumber}: ${error.message}`,
      );
      throw error;
    } finally {
      // Always close the browser to prevent memory leaks
      await browser.close();
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
