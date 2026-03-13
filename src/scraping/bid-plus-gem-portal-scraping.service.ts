import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { chromium, Page, Browser } from 'playwright';
import { BidPlusGemPortalMinistryMaster } from '../entity/bid-plus-gem-portal-ministry-master.entity';
import { BidPlusGemPortalOrganizationMaster } from '../entity/bid-plus-gem-portal-organization-master.entity';
import { GemBidData } from '../entity/bid-data.entity';

interface ScrapedBidData {
  ministry: string;
  organization: string;
  bidNumber: string;
  bidUrl: string;
  raNumber: string;
  raUrl: string;
  items: string;
  quantity: string;
  department: string;
  startDate: string;
  endDate: string;
}

@Injectable()
export class BidPlusGemPortalScrapingService {
  readonly logger = new Logger(BidPlusGemPortalScrapingService.name);

  private readonly BASE_URL = 'https://bidplus.gem.gov.in';
  private readonly ADVANCED_SEARCH_URL = `${this.BASE_URL}/advance-search`;
  private readonly MAX_PAGES_PER_SEARCH = 5;
  private readonly SLEEP_BETWEEN_SEARCHES = 2000;
  private readonly SLEEP_BETWEEN_MINISTRIES = 3000;

  constructor(
    @InjectRepository(BidPlusGemPortalMinistryMaster)
    private readonly ministryRepository: Repository<BidPlusGemPortalMinistryMaster>,

    @InjectRepository(BidPlusGemPortalOrganizationMaster)
    private readonly organizationRepository: Repository<BidPlusGemPortalOrganizationMaster>,

    @InjectRepository(GemBidData)
    private readonly bidDataRepository: Repository<GemBidData>,
  ) {}

  async initiateScrapingRun(): Promise<any> {
    this.logger.log(`Starting scraping run on Bid Plus GEM Portal...`);

    let browser: Browser | null = null;
    const stats = {
      totalMinistries: 0,
      totalOrganizations: 0,
      totalBidsScraped: 0,
      totalBidsInserted: 0,
      totalBidsUpdated: 0,
      totalBidsDuplicate: 0,
      errors: [] as string[],
    };

    try {
      // Fetch all ministries with their organizations
      const ministries = await this.ministryRepository.find({
        relations: ['bidPlusGemPortalOrganizationMasters'],
        order: { ministryName: 'ASC' },
      });

      if (ministries.length === 0) {
        this.logger.warn(
          'No ministries found in database. Please populate BidPlusGemPortalMinistryMaster table.',
        );
        return { success: false, message: 'No ministries to scrape' };
      }

      stats.totalMinistries = ministries.length;
      this.logger.log(`Found ${ministries.length} ministries to process`);

      // Launch browser
      browser = await chromium.launch({
        headless: true,
        timeout: 60000,
      });

      const page = await browser.newPage();
      page.setDefaultTimeout(30000);

      // Process each ministry
      for (let i = 0; i < ministries.length; i++) {
        const ministry = ministries[i];
        this.logger.log(`\n[${'='.repeat(80)}]`);
        this.logger.log(
          `Processing Ministry ${i + 1}/${ministries.length}: ${ministry.ministryName}`,
        );
        this.logger.log(`[${'='.repeat(80)}]\n`);

        try {
          // Get organizations for this ministry
          const organizations = await this.organizationRepository.find({
            where: { bidPlusGemPortalMinistryMaster: { id: ministry.id } },
            order: { organizationName: 'ASC' },
          });

          if (organizations.length === 0) {
            this.logger.warn(
              `No organizations found for ministry: ${ministry.ministryName}`,
            );
            continue;
          }

          stats.totalOrganizations += organizations.length;
          this.logger.log(
            `Found ${organizations.length} organizations under ${ministry.ministryName}`,
          );

          // Process each organization
          for (let j = 0; j < organizations.length; j++) {
            const organization = organizations[j];
            this.logger.log(
              `\n[${j + 1}/${organizations.length}] Processing: ${organization.organizationName}`,
            );

            try {
              const scrapedBids = await this.searchByMinistryAndOrg(
                page,
                ministry.ministryName,
                organization.organizationName,
              );

              stats.totalBidsScraped += scrapedBids.length;

              // Save scraped bids to database
              const insertStats = await this.saveBidsToDatabase(scrapedBids);

              stats.totalBidsInserted += insertStats.inserted;
              stats.totalBidsUpdated += insertStats.updated;
              stats.totalBidsDuplicate += insertStats.duplicates;

              this.logger.log(
                `✓ Scraped ${scrapedBids.length} bids (${insertStats.inserted} new, ${insertStats.updated} updated, ${insertStats.duplicates} duplicates)`,
              );

              // Delay between organization searches
              await this.sleep(this.SLEEP_BETWEEN_SEARCHES);
            } catch (error) {
              const errorMsg = `Error processing organization ${organization.organizationName}: ${error.message}`;
              this.logger.error(errorMsg);
              stats.errors.push(errorMsg);
            }
          }

          // Delay between ministries
          await this.sleep(this.SLEEP_BETWEEN_MINISTRIES);
        } catch (error) {
          const errorMsg = `Error processing ministry ${ministry.ministryName}: ${error.message}`;
          this.logger.error(errorMsg);
          stats.errors.push(errorMsg);
        }
      }

      await browser.close();

      // Log final statistics
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log('SCRAPING COMPLETE - SUMMARY');
      this.logger.log('='.repeat(80));
      this.logger.log(`Total Ministries Processed: ${stats.totalMinistries}`);
      this.logger.log(
        `Total Organizations Processed: ${stats.totalOrganizations}`,
      );
      this.logger.log(`Total Bids Scraped: ${stats.totalBidsScraped}`);
      this.logger.log(`Total Bids Inserted: ${stats.totalBidsInserted}`);
      this.logger.log(`Total Bids Updated: ${stats.totalBidsUpdated}`);
      this.logger.log(`Total Bids Duplicate: ${stats.totalBidsDuplicate}`);
      this.logger.log(`Total Errors: ${stats.errors.length}`);
      this.logger.log('='.repeat(80));

      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error(
        `Fatal error during scraping run: ${error.message}`,
        error.stack,
      );
      if (browser) {
        await browser.close();
      }
      return {
        success: false,
        error: error.message,
        stats,
      };
    }
  }

  private async searchByMinistryAndOrg(
    page: Page,
    ministry: string,
    organization: string,
  ): Promise<ScrapedBidData[]> {
    this.logger.debug(`Searching for: ${ministry} -> ${organization}`);

    await page.goto(this.ADVANCED_SEARCH_URL, {
      waitUntil: 'domcontentloaded',
    });
    await this.sleep(1500);

    // Click on "Search by Ministry / Organization" tab
    try {
      await page.click('text=Search by Ministry / Organization', {
        timeout: 5000,
      });
      await this.sleep(1000);
    } catch (e) {
      this.logger.debug('Ministry tab already selected or not found');
    }

    // Select Ministry
    try {
      await page.waitForSelector('#select2-ministry-container', {
        timeout: 10000,
      });
      await page.click('#select2-ministry-container');
      await this.sleep(800);

      await page.waitForSelector('.select2-search__field', { timeout: 5000 });
      await page.fill('.select2-search__field', ministry);
      await this.sleep(1000);

      await page.click(`.select2-results__option:has-text("${ministry}")`, {
        timeout: 5000,
      });
      await this.sleep(1000);

      this.logger.debug(`✓ Selected Ministry: ${ministry}`);
    } catch (e) {
      throw new Error(`Failed to select ministry: ${e.message}`);
    }

    // Select Organization
    try {
      await page.waitForSelector('#select2-organization-container', {
        timeout: 10000,
      });
      await page.click('#select2-organization-container');
      await this.sleep(800);

      await page.waitForSelector('.select2-search__field', { timeout: 5000 });
      await page.fill('.select2-search__field', organization);
      await this.sleep(1500);

      // Try exact match first, then partial match
      try {
        await page.click(
          `.select2-results__option:has-text("${organization}")`,
          { timeout: 3000 },
        );
      } catch {
        await page.keyboard.press('Enter');
      }
      await this.sleep(1000);

      this.logger.debug(`✓ Selected Organization: ${organization}`);
    } catch (e) {
      throw new Error(`Failed to select organization: ${e.message}`);
    }

    // Click Search button
    try {
      await page.click('a#searchByBid[onclick*="ministry-search"]', {
        timeout: 5000,
      });
      await this.sleep(2000);
      this.logger.debug('✓ Clicked Search button');
    } catch (e) {
      throw new Error(`Failed to click search: ${e.message}`);
    }

    // Scrape results
    return await this.scrapeResults(page, ministry, organization);
  }

  private async scrapeResults(
    page: Page,
    ministry: string,
    organization: string,
  ): Promise<ScrapedBidData[]> {
    const results: ScrapedBidData[] = [];
    let pageIndex = 1;

    while (pageIndex <= this.MAX_PAGES_PER_SEARCH) {
      this.logger.debug(`  Scraping page ${pageIndex}...`);

      // Check for "No data found" message
      const noDataFound = await page.$('text=No data found').catch(() => null);
      if (noDataFound) {
        this.logger.debug(`  No data found for ${organization}`);
        break;
      }

      await page
        .waitForSelector('div.panel, .bid-row, .card', { timeout: 10000 })
        .catch(() => {});
      await this.sleep(1000);

      const cards = await page.$$('div.panel, .card, .bid-row');
      this.logger.debug(
        `  Found ${cards.length} bid cards on page ${pageIndex}`,
      );

      for (const card of cards) {
        const bidData = await this.extractBidDataFromCard(
          card,
          ministry,
          organization,
        );
        if (bidData) {
          results.push(bidData);
        }
      }

      // Try to go to next page
      const hasNextPage = await this.goToNextPage(page);
      if (!hasNextPage) {
        this.logger.debug('  No more pages');
        break;
      }

      pageIndex++;
      await this.sleep(2000);
    }

    return results;
  }

  private async extractBidDataFromCard(
    card: any,
    ministry: string,
    organization: string,
  ): Promise<ScrapedBidData | null> {
    let bidNumber = '';
    let bidUrl = '';
    let raNumber = '';
    let raUrl = '';
    let items = '';
    let quantity = '';
    let department = '';
    let startDate = '';
    let endDate = '';

    // Extract Bid Number and URL
    try {
      const a = await card.$("a.bid_no_hover, a[href*='showbidDocument']");
      if (a) {
        const txt = (await a.innerText()).trim();
        if (txt && /GEM\/\d{4}/i.test(txt)) {
          bidNumber = txt;
          const href = await a.getAttribute('href');
          if (href) {
            bidUrl = href.startsWith('http') ? href : this.BASE_URL + href;
          }
        }
      }
    } catch (e) {
      this.logger.debug(`Error extracting bid number: ${e.message}`);
    }

    // Extract RA Number and URL
    try {
      const raLink = await card.$(
        "a[href*='/showradocumentPdf/'], a[href*='/showRADocument/']",
      );
      if (raLink) {
        raNumber = (await raLink.innerText()).trim();
        const href = await raLink.getAttribute('href');
        if (href) {
          raUrl = href.startsWith('http') ? href : this.BASE_URL + href;
        }
      }

      // Fallback: construct RA URL from bid URL
      if (!raUrl && bidUrl) {
        const idMatch = bidUrl.match(/\/showBidDocument\/(\d+)/);
        if (idMatch) {
          const docId = idMatch[1];
          raUrl = `${this.BASE_URL}/showradocumentPdf/${docId}`;
        }
      }

      // Extract RA number from card text if not found
      if (!raNumber) {
        const fullCardText = await card.innerText();
        const raMatch = fullCardText.match(/RA\s*NO[:\s]*([A-Z0-9\/]+)/i);
        if (raMatch) {
          raNumber = raMatch[1].trim();
        }
      }
    } catch (e) {
      this.logger.debug(`Error extracting RA info: ${e.message}`);
    }

    // Extract Items
    try {
      const itemsPopover = await card.$('a[data-content]');
      if (itemsPopover) {
        const dataContent = await itemsPopover.getAttribute('data-content');
        if (dataContent) {
          items = dataContent.trim();
        }
      }
      if (!items) {
        const inner = await card.innerText();
        const mItems = inner.match(/Items[:\s]*([^\n\r]+)/i);
        if (mItems) {
          items = mItems[1].trim();
        }
      }
    } catch (e) {
      this.logger.debug(`Error extracting items: ${e.message}`);
    }

    // Extract Quantity
    try {
      const inner = await card.innerText();
      const mQty = inner.match(/Quantity[:\s]*([^\n\r]+)/i);
      if (mQty) {
        quantity = mQty[1].trim();
      }
    } catch (e) {
      this.logger.debug(`Error extracting quantity: ${e.message}`);
    }

    // Extract Department
    try {
      const inner = await card.innerText();
      const mDept = inner.match(
        /Department Name And Address:([\s\S]*?)(?:Start Date|End Date|$)/i,
      );
      if (mDept) {
        department = mDept[1].replace(/\n+/g, ' ').trim();
      }
    } catch (e) {
      this.logger.debug(`Error extracting department: ${e.message}`);
    }

    // Extract Start and End Dates
    try {
      const inner = await card.innerText();
      const mStart = inner.match(/Start Date[:\s]*([^\n\r]+)/i);
      const mEnd = inner.match(/End Date[:\s]*([^\n\r]+)/i);
      if (mStart) startDate = mStart[1].trim();
      if (mEnd) endDate = mEnd[1].trim();
    } catch (e) {
      this.logger.debug(`Error extracting dates: ${e.message}`);
    }

    // Only return if we have at least a bid number or meaningful data
    if (bidNumber || raNumber || items) {
      return {
        ministry,
        organization,
        bidNumber: bidNumber || '',
        bidUrl: bidUrl || '',
        raNumber: raNumber || '',
        raUrl: raUrl || '',
        items: items || '',
        quantity: quantity || '',
        department: department || '',
        startDate: startDate || '',
        endDate: endDate || '',
      };
    }

    return null;
  }

  private async goToNextPage(page: Page): Promise<boolean> {
    const nextSelectors = [
      "a[rel='next']",
      'ul.pagination li.next a',
      '.pagination li.active + li a',
      "a:has-text('Next')",
      "a:has-text('›')",
    ];

    for (const selector of nextSelectors) {
      const el = await page.$(selector).catch(() => null);
      if (el) {
        const disabled = await el.getAttribute('aria-disabled');
        const className = await el.getAttribute('class');

        if (
          disabled === 'true' ||
          (className && className.includes('disabled'))
        ) {
          continue;
        }

        try {
          await el.click();
          await this.sleep(2000);
          return true;
        } catch (e) {
          this.logger.debug(
            `Failed to click next button with selector ${selector}: ${e.message}`,
          );
        }
      }
    }

    return false;
  }

  private async saveBidsToDatabase(
    scrapedBids: ScrapedBidData[],
  ): Promise<{ inserted: number; duplicates: number; updated: number }> {
    let inserted = 0;
    let duplicates = 0;
    let updated = 0;

    for (const bid of scrapedBids) {
      if (!bid.bidNumber) {
        continue; // Skip if no bid number
      }

      try {
        // Check if bid already exists
        const existingBid = await this.bidDataRepository.findOne({
          where: { bidNumber: bid.bidNumber },
        });

        if (existingBid) {
          // Check if end date has changed
          const endDateChanged = existingBid.endDateRaw !== bid.endDate;
          const startDateChanged = existingBid.startDateRaw !== bid.startDate;

          if (endDateChanged || startDateChanged) {
            // Update the dates
            if (endDateChanged) {
              existingBid.endDateRaw = bid.endDate || '';
              this.logger.log(
                `Bid ${bid.bidNumber}: End date changed from ${existingBid.endDateRaw} to ${bid.endDate}`,
              );
            }

            if (startDateChanged) {
              existingBid.startDateRaw = bid.startDate || '';
            }

            // Recalculate isActive based on new end date
            if (bid.endDate) {
              const endDate = this.parseIndianDateFormat(bid.endDate);

              if (endDate && !isNaN(endDate.getTime())) {
                const currentDate = new Date();
                const isExpired = currentDate > endDate;

                existingBid.isActive = !isExpired;

                this.logger.log(
                  `Bid ${bid.bidNumber}: isActive set to ${existingBid.isActive} (expired: ${isExpired})`,
                );
              } else {
                this.logger.warn(
                  `Could not parse end date for bid ${bid.bidNumber}: ${bid.endDate}`,
                );
              }
            }

            await this.bidDataRepository.save(existingBid);
            updated++;
          } else {
            duplicates++;
          }

          continue;
        }

        // Parse quantity to integer if possible
        let quantityInt: number | null = null;
        if (bid.quantity) {
          const parsed = parseInt(bid.quantity.replace(/[^\d]/g, ''), 10);
          if (!isNaN(parsed)) {
            quantityInt = parsed;
          }
        }

        // Determine initial isActive status based on end date
        let isActive = true;
        if (bid.endDate) {
          const endDate = this.parseIndianDateFormat(bid.endDate);
          if (endDate && !isNaN(endDate.getTime())) {
            const currentDate = new Date();
            isActive = currentDate <= endDate;
          } else {
            this.logger.warn(
              `Could not parse end date for bid ${bid.bidNumber}: ${bid.endDate}`,
            );
          }
        }

        // Create new bid data entity
        const bidData = this.bidDataRepository.create({
          bidNumber: bid.bidNumber,
          bidUrl: bid.bidUrl || undefined,
          items: bid.items || undefined,
          ministryName: bid.ministry || undefined,
          organisationName: bid.organization || undefined,
          departmentName: bid.department || undefined,
          startDateRaw: bid.startDate || undefined,
          endDateRaw: bid.endDate || undefined,
          quantity: quantityInt,
          scrapingPortalId: 1,
          isActive: isActive,
        } as Partial<GemBidData>);

        await this.bidDataRepository.save(bidData);
        inserted++;
      } catch (error) {
        this.logger.error(
          `Error saving bid ${bid.bidNumber}: ${error.message}`,
        );
      }
    }

    return { inserted, duplicates, updated };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Helper function to parse DD-MM-YYYY format
  private parseIndianDateFormat(dateStr: string): Date | null {
    if (!dateStr) return null;

    try {
      // Match DD-MM-YYYY HH:MM AM/PM format
      const match = dateStr.match(
        /(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i,
      );

      if (match) {
        const [, day, month, year, hour, minute, meridiem] = match;
        let hours = parseInt(hour, 10);

        // Convert to 24-hour format
        if (meridiem) {
          if (meridiem.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
          } else if (meridiem.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
          }
        }

        return new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1, // Month is 0-indexed
          parseInt(day, 10),
          hours,
          parseInt(minute, 10),
        );
      }

      // Fallback to native parsing
      return new Date(dateStr);
    } catch (error) {
      this.logger.error(`Failed to parse date: ${dateStr}`, error);
      return null;
    }
  }
}
