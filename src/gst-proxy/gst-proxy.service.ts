import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GstProxyService {
  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly apiSecret: string;

  constructor(private config: ConfigService) {
    this.apiUrl = this.config.get<string>('RPACPC_API_URL', 'https://api.rpacpc.com/services/pan-to-gstin');
    this.apiToken = this.config.getOrThrow<string>('RPACPC_API_TOKEN');
    this.apiSecret = this.config.getOrThrow<string>('RPACPC_API_SECRET');
  }

  /** PAN → list of GST numbers */
  async panToGst(pan: string, consent = 'Y') {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: this.apiToken,
        secretkey: this.apiSecret,
      },
      body: JSON.stringify({ pan, consent }),
    });

    if (!res.ok) {
      throw new HttpException(
        `Upstream API error: ${res.statusText}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return res.json();
  }

  /** GST number → basic company details */
  async getGstDetails(gstNumber: string, consent = 'Y') {
    const res = await fetch('https://api.rpacpc.com/services/get-gst-details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: this.apiToken,
        secretkey: this.apiSecret,
      },
      body: JSON.stringify({ gstNumber, consent }),
    });

    if (!res.ok) {
      throw new HttpException(
        `Upstream API error: ${res.statusText}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return res.json();
  }

  /** GST number → advanced details (HSN codes) */
  async getGstDetailsAdvance(gstNumber: string, hsnDetails = true, consent = 'Y') {
    const res = await fetch('https://api.rpacpc.com/services/bv010', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: this.apiToken,
        secretkey: this.apiSecret,
      },
      body: JSON.stringify({ gstNumber, hsnDetails, consent }),
    });

    if (!res.ok) {
      throw new HttpException(
        `Upstream API error: ${res.statusText}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return res.json();
  }
}
