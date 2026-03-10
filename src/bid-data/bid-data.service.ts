import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GemBidData } from '../entity/bid-data.entity';
import { Customer } from '../entity/customer.entity';
import { CustomerHsn } from '../entity/customer-hsn-codes.entity';

import { deduplicate } from '../../utils/deduplicate';
import { calculateFuzzyScore } from '../../utils/fuzzyMatch';
import { calculateTokenScore } from '../../utils/tokenMatch';

export interface TenderResult {
  id: number;
  bidNumber: string;
  bidUrl: string;
  items: string;
  ministryName: string;
  organisationName: string;
  departmentName: string;
  startDate: string;
  endDate: string;
  quantity: number;
  hsn: string;
  isActive: boolean;
}

export interface PaginatedTenders {
  data: TenderResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BidResult {
  id: number;
  bidNumber: string;
  ministry: string;
  organization: string;
  items: string;
  bestMatchingSegment: string;
  hsnCode: string;
  bidUrl: string;
  quantity?: number;
  department?: string;
  startDate?: string;
  endDate?: string;
  matchedHSN: string;
  matchedKeyword: string;
  hsnScore: number;
  tokenScore: number;
  fuzzyScore: number;
  semanticScore: number;
  finalScore: number;
  isFallback: boolean;
  matchingDigits?: number;
}

@Injectable()
export class BidDataService {
  private readonly logger = new Logger(BidDataService.name);

  constructor(
    @InjectRepository(GemBidData)
    private readonly bidDataRepo: Repository<GemBidData>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerHsn)
    private readonly customerHsnRepo: Repository<CustomerHsn>,
  ) {}

  private getMatchingHSNDigits(hsn1: string, hsn2: string): number {
    let matchCount = 0;
    const minLength = Math.min(hsn1.length, hsn2.length);

    for (let i = 0; i < minLength; i++) {
      if (hsn1[i] === hsn2[i]) {
        matchCount++;
      } else {
        break;
      }
    }
    return matchCount;
  }

  private isBidExpired(endDateRaw: string): boolean {
    if (!endDateRaw) return false;

    try {
      // Split the string into date and time parts (e.g., "04-02-2026" and "1:00 PM")
      const dateTimeParts = endDateRaw.trim().split(' ');
      const datePart = dateTimeParts[0];

      // Check if it matches a DD-MM-YYYY or DD/MM/YYYY format
      if (datePart && (datePart.includes('-') || datePart.includes('/'))) {
        const dateSegments = datePart.split(/[-/]/);

        // If it successfully split into 3 parts and the year is at the end
        if (dateSegments.length === 3 && dateSegments[2].length === 4) {
          const day = parseInt(dateSegments[0], 10);
          const month = parseInt(dateSegments[1], 10) - 1; // JS months are 0-indexed (0 = Jan)
          const year = parseInt(dateSegments[2], 10);

          let hours = 0;
          let minutes = 0;

          // Parse the time part if it exists (e.g., "1:00 PM")
          const timePart = dateTimeParts.slice(1).join(' ');
          if (timePart) {
            const timeMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (timeMatch) {
              hours = parseInt(timeMatch[1], 10);
              minutes = parseInt(timeMatch[2], 10);
              const ampm = timeMatch[3]?.toUpperCase();

              // Convert to 24-hour time for the Date object
              if (ampm === 'PM' && hours !== 12) hours += 12;
              if (ampm === 'AM' && hours === 12) hours = 0;
            }
          }

          const endDate = new Date(year, month, day, hours, minutes);
          const currentDate = new Date();

          return currentDate > endDate;
        }
      }

      // Safe fallback if the date is already in standard ISO format (e.g., 2026-02-04T13:00)
      const endDate = new Date(endDateRaw);
      const currentDate = new Date();
      return currentDate > endDate;
    } catch (error) {
      this.logger.error(`Error parsing end date: ${endDateRaw}`, error);
      return false; // If parsing fails entirely, keep it in the results to be safe
    }
  }

  async getAllTenders(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedTenders> {
    const skip = (page - 1) * limit;

    const [bids, total] = await this.bidDataRepo.findAndCount({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const data: TenderResult[] = bids.map((bid) => ({
      id: bid.id,
      bidNumber: bid.bidNumber,
      bidUrl: bid.bidUrl || '',
      items: bid.items || '',
      ministryName: bid.ministryName || '',
      organisationName: bid.organisationName || '',
      departmentName: bid.departmentName || '',
      startDate: bid.startDateRaw || '',
      endDate: bid.endDateRaw || '',
      quantity: bid.quantity,
      hsn: bid.hsn || '',
      isActive: bid.isActive,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBidsForCustomer(customerId: string): Promise<BidResult[]> {
    // 1. Validate Customer
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException(
        `Invalid customer id: ${customerId}. Unable to resolve customer.`,
      );
    }

    // 2. Fetch Customer's HSN Codes
    const customerHsnCodes = await this.customerHsnRepo.find({
      where: { customerId: customerId },
    });

    if (customerHsnCodes.length === 0) {
      this.logger.debug(
        `Customer ${customerId} has no HSN codes configured. Skipping.`,
      );
      return [];
    }

    // 3. Build customerHsnMap mapping HSN codes to keyword arrays
    const customerHsnMap: Record<string, string[]> = {};

    for (const hsnRecord of customerHsnCodes) {
      const hsnCode = hsnRecord.hsnCode;

      // Since we use 'simple-array' in the entity, hsnRecord.keywords is already a string[]
      const keywords = hsnRecord.keywords || [];

      if (keywords.length > 0) {
        customerHsnMap[hsnCode] = keywords;
      }
    }

    if (Object.keys(customerHsnMap).length === 0) {
      this.logger.debug(
        `Customer ${customerId} has no valid HSN codes with keywords. Skipping.`,
      );
      return [];
    }

    // 4. Run Bid Matching Engine (keyword-only)
    const startTime = Date.now();
    this.logger.log('=== Bid Matching Started (keyword-only) ===');

    // Collect all unique keywords from the customer's HSN records
    const allKeywords = [
      ...new Set(
        Object.values(customerHsnMap).flat().map((k) => k.trim()).filter(Boolean),
      ),
    ];

    this.logger.debug(
      `Customer ${customerId} keywords: ${allKeywords.join(', ')}`,
    );

    try {
      const queryStartTime = Date.now();
      const bids = await this.bidDataRepo.find({
        where: { isActive: true },
      });

      const queryTime = Date.now() - queryStartTime;
      this.logger.debug(
        `Database query completed in ${queryTime}ms - Found ${bids.length} active bids`,
      );

      if (bids.length === 0) {
        this.logger.debug('No active bids found');
        return [];
      }

      const results: BidResult[] = [];
      let processedCount = 0;
      let skippedLowScores = 0;

      for (const bid of bids) {
        if (!bid.items) continue;

        for (const keyword of allKeywords) {
          processedCount++;

          // Split bid items into segments and find the best matching one
          const segments = bid.items
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          let bestTokenScore = 0;
          let bestFuzzyScore = 0;
          let bestSegment = bid.items;

          if (segments.length <= 1 || bid.items.length < 50) {
            bestTokenScore = calculateTokenScore(keyword, bid.items);
            bestFuzzyScore = calculateFuzzyScore(keyword, bid.items);
            bestSegment = bid.items;
          } else {
            let bestCombined = 0;
            for (const segment of segments) {
              const ts = calculateTokenScore(keyword, segment);
              const fs = calculateFuzzyScore(keyword, segment);
              const combined = ts * 0.7 + fs * 0.3;
              if (combined > bestCombined) {
                bestCombined = combined;
                bestTokenScore = ts;
                bestFuzzyScore = fs;
                bestSegment = segment;
              }
            }
          }

          // Final score = token (70%) + fuzzy (30%)
          const finalScore = parseFloat(
            (bestTokenScore * 0.7 + bestFuzzyScore * 0.3).toFixed(2),
          );

          if (finalScore < 20) {
            skippedLowScores++;
            continue;
          }

          results.push({
            id: bid.id,
            bidNumber: bid.bidNumber,
            ministry: bid.ministryName || '',
            organization: bid.organisationName || '',
            items: bid.items || '',
            bestMatchingSegment: bestSegment,
            hsnCode: bid.hsn || '',
            bidUrl: bid.bidUrl || '',
            quantity: bid.quantity,
            department: bid.departmentName,
            startDate: bid.startDateRaw,
            endDate: bid.endDateRaw,
            matchedHSN: '',
            matchedKeyword: keyword,
            hsnScore: 0,
            tokenScore: parseFloat(bestTokenScore.toFixed(2)),
            fuzzyScore: parseFloat(bestFuzzyScore.toFixed(2)),
            semanticScore: 0,
            finalScore,
            isFallback: false,
          });
        }
      }

      this.logger.log(
        `Matching completed - Processed ${processedCount} combinations`,
      );
      this.logger.log(
        `Generated ${results.length} results, skipped ${skippedLowScores}`,
      );

      const filtered = deduplicate(results).sort(
        (a, b) => b.finalScore - a.finalScore,
      );
      const totalTime = Date.now() - startTime;

      this.logger.log(`Final results: ${filtered.length} unique matches`);
      this.logger.log(`=== Total Processing Time: ${totalTime}ms ===`);

      return filtered;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error(
        `Error in findBidsForCustomer after ${totalTime}ms`,
        error.stack,
      );
      throw error;
    }
  }
}
