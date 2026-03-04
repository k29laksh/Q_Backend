import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GemBidData } from '../entity/bid-data.entity';
import { Customer } from '../entity/customer.entity';
import { CustomerHsn } from '../entity/customer-hsn-codes.entity';

import { deduplicate } from '../../utils/deduplicate';
import { calculateBestSegmentScore } from '../../utils/finalScore';
import { calculateFuzzyScore } from '../../utils/fuzzyMatch';
import { calculateHSNScore } from '../../utils/hsnMatch';
import { calculateTokenScore } from '../../utils/tokenMatch';

export interface BidResult {
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
      const endDate = new Date(endDateRaw);
      const currentDate = new Date();
      return currentDate > endDate;
    } catch (error) {
      this.logger.error(`Error parsing end date: ${endDateRaw}`, error);
      return false;
    }
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

    // 4. Run Bid Matching Engine
    const startTime = Date.now();
    this.logger.log('=== Bid Matching Started ===');
    this.logger.debug(
      `Customer ${customerId} HSN Map: ${JSON.stringify(customerHsnMap, null, 2)}`,
    );

    try {
      const hsnPrefixes = Object.keys(customerHsnMap).map((hsn) =>
        hsn.slice(0, 2),
      );
      const uniquePrefixes = [...new Set(hsnPrefixes)];

      this.logger.debug(
        `Unique HSN prefixes to search: ${uniquePrefixes.join(', ')}`,
      );

      const queryStartTime = Date.now();
      const bids = await this.bidDataRepo
        .createQueryBuilder('b')
        .where('SUBSTRING(b.hsn, 1, 2) IN (:...prefixes)', {
          prefixes: uniquePrefixes,
        })
        .andWhere('b.isActive = :isActive', { isActive: true })
        .getMany();

      const queryTime = Date.now() - queryStartTime;
      this.logger.debug(
        `Database query completed in ${queryTime}ms - Found ${bids.length} bids`,
      );

      const activeBids = bids.filter(
        (bid) => !this.isBidExpired(bid.endDateRaw),
      );
      const expiredCount = bids.length - activeBids.length;

      if (expiredCount > 0) {
        this.logger.debug(
          `Filtered out ${expiredCount} expired bids based on end date`,
        );
      }

      if (activeBids.length === 0) {
        this.logger.debug('No active bids found matching HSN prefixes');
        return [];
      }

      const bidsByHSNPrefix = new Map<string, GemBidData[]>();
      for (const bid of activeBids) {
        if (!bid.hsn) continue;
        const prefix = bid.hsn.slice(0, 2);
        if (!bidsByHSNPrefix.has(prefix)) {
          bidsByHSNPrefix.set(prefix, []);
        }
        bidsByHSNPrefix.get(prefix)!.push(bid);
      }

      const results: BidResult[] = [];
      let processedCount = 0;
      let skippedLowScores = 0;
      let fallbackCount = 0;

      for (const [hsnCode, keywords] of Object.entries(customerHsnMap)) {
        const hsnPrefix = hsnCode.slice(0, 2);
        const relevantBids = bidsByHSNPrefix.get(hsnPrefix) || [];

        const resultsBeforeThisHSN = results.length;

        for (const bid of relevantBids) {
          try {
            for (const keyword of keywords) {
              processedCount++;

              const scores = calculateBestSegmentScore(
                hsnCode,
                keyword,
                { hsn_code: bid.hsn, bid_items: bid.items },
                calculateHSNScore,
                calculateTokenScore,
                calculateFuzzyScore,
              );

              if (scores.finalScore < 20) {
                skippedLowScores++;
                continue;
              }

              results.push({
                bidNumber: bid.bidNumber,
                ministry: bid.ministryName || '',
                organization: bid.organisationName || '',
                items: bid.items || '',
                bestMatchingSegment: scores.bestSegment,
                hsnCode: bid.hsn || '',
                bidUrl: bid.bidUrl || '',
                quantity: bid.quantity,
                department: bid.departmentName,
                startDate: bid.startDateRaw,
                endDate: bid.endDateRaw,
                matchedHSN: hsnCode,
                matchedKeyword: keyword,
                hsnScore: parseFloat(scores.hsnScore.toFixed(2)),
                tokenScore: parseFloat(scores.tokenScore.toFixed(2)),
                fuzzyScore: parseFloat(scores.fuzzyScore.toFixed(2)),
                semanticScore: 0,
                finalScore: parseFloat(scores.finalScore.toFixed(2)),
                isFallback: false,
              });
            }
          } catch (bidError) {
            this.logger.error(
              `Error processing bid ${bid.bidNumber}:`,
              bidError.message,
            );
            continue;
          }
        }

        const resultsAddedForThisHSN = results.length - resultsBeforeThisHSN;

        if (resultsAddedForThisHSN === 0 && relevantBids.length > 0) {
          const fallbackResults = relevantBids
            .map((bid) => {
              const hsnScore = calculateHSNScore(hsnCode, bid.hsn);
              const matchingDigits = this.getMatchingHSNDigits(
                hsnCode,
                bid.hsn,
              );
              return { bid, hsnScore, matchingDigits };
            })
            .sort((a, b) => {
              if (b.matchingDigits !== a.matchingDigits) {
                return b.matchingDigits - a.matchingDigits;
              }
              return b.hsnScore - a.hsnScore;
            })
            .slice(0, 5)
            .map(({ bid, hsnScore, matchingDigits }) => ({
              bidNumber: bid.bidNumber,
              ministry: bid.ministryName || '',
              organization: bid.organisationName || '',
              items: bid.items || '',
              bestMatchingSegment: bid.items || '',
              hsnCode: bid.hsn || '',
              bidUrl: bid.bidUrl || '',
              quantity: bid.quantity,
              department: bid.departmentName,
              startDate: bid.startDateRaw,
              endDate: bid.endDateRaw,
              matchedHSN: hsnCode,
              matchedKeyword: keywords[0],
              hsnScore: parseFloat(hsnScore.toFixed(2)),
              tokenScore: 0,
              fuzzyScore: 0,
              semanticScore: 0,
              finalScore: parseFloat(hsnScore.toFixed(2)),
              isFallback: true,
              matchingDigits: matchingDigits,
            }));

          results.push(...fallbackResults);
          fallbackCount += fallbackResults.length;
        }
      }

      this.logger.log(
        `Matching completed - Processed ${processedCount} combinations`,
      );
      this.logger.log(
        `Generated ${results.length} results (${fallbackCount} fallback), skipped ${skippedLowScores}`,
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
