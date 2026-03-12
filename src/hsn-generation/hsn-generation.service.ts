import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { GemBidData, HsnStatus } from '../entity/bid-data.entity'; // Adjust path

@Injectable()
export class HsnGenerationService {
  private readonly logger = new Logger(HsnGenerationService.name);

  private readonly BATCH_SIZE = 20;
  private readonly MAX_BIDS_PER_RUN = 100;

  constructor(
    @InjectRepository(GemBidData)
    private readonly bidDataRepo: Repository<GemBidData>,
    @Inject('RABBITMQ_HSN_SERVICE') private readonly rabbitClient: ClientProxy,
  ) {}

  /**
   * Fetches PENDING bids using Cursor Pagination, marks them PROCESSING,
   * and sends them to RabbitMQ for FastAPI to process.
   */
  async recoverStuckBids(): Promise<void> {
    // Calculate the time 30 minutes ago
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    try {
      const result = await this.bidDataRepo.update(
        {
          hsnStatus: HsnStatus.PROCESSING,
          updatedAt: LessThan(thirtyMinutesAgo), // Assumes your BaseEntity has @UpdateDateColumn() updatedAt
        },
        {
          hsnStatus: HsnStatus.PENDING,
        },
      );

      if (result.affected > 0) {
        this.logger.warn(
          `🧹 Sweeper: Recovered ${result.affected} stuck PROCESSING bids back to PENDING.`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to run stuck bid sweeper: ${error.message}`);
    }
  }
  async dispatchPendingBids(): Promise<void> {
    this.logger.log('Starting HSN cursor-based dispatch job...');

    let processedCount = 0;
    let lastId = 0; // The cursor

    while (processedCount < this.MAX_BIDS_PER_RUN) {
      // 1. Fetch using the cursor (id > lastId)
      const bids = await this.bidDataRepo.find({
        where: {
          hsnStatus: HsnStatus.PENDING,
          id: MoreThan(lastId),
        },
        order: { id: 'ASC' }, // Crucial for cursor pagination to work
        take: this.BATCH_SIZE,
      });

      if (bids.length === 0) {
        this.logger.log('No more PENDING bids found. Exiting loop.');
        break;
      }

      const bidIds = bids.map((bid) => bid.id);

      // 2. Lock them immediately by updating to PROCESSING
      await this.bidDataRepo.update(
        { id: In(bidIds) },
        { hsnStatus: HsnStatus.PROCESSING },
      );

      // 3. Format payload for FastAPI
      const payload = {
        batchId: `hsn_batch_${Date.now()}_${bidIds[0]}`,
        bids: bids.map((bid) => ({
          bidId: bid.id,
          bidNumber: bid.bidNumber,
          items: bid.items,
        })),
      };

      // 4. Publish to RabbitMQ
      this.rabbitClient.emit('hsn_generation_request', payload);
      this.logger.log(`Dispatched batch of ${bids.length} bids to AI queue.`);

      // 5. Update loop variables for the next batch
      processedCount += bids.length;
      lastId = bids[bids.length - 1].id;
    }

    this.logger.log(`Job complete. Total bids dispatched: ${processedCount}`);
  }

  /**
   * Updates DB when FastAPI returns the processed results.
   *
   * The payload arrives as the full response from the Python service:
   *   { status, meta_data, data: { results: [...] }, error_code, error_messages }
   */
  async handleAiResults(payload: any): Promise<void> {
    if (payload?.status === 'failed' || payload?.status === 'error') {
      this.logger.error(
        `HSN AI worker returned error: ${payload.error_code} – ${payload.error_messages?.join(', ')}`,
      );
      return;
    }

    // Results are nested under payload.data.results
    const results =
      payload?.data?.results ||
      payload?.results ||
      payload?.data?.hsn_codes ||
      [];

    this.logger.log(`Received ${results.length} HSN results from AI worker.`);

    for (const item of results) {
      // Python sends both bidId (numeric) and bid_id (string)
      const bidId = item.bidId ?? item.bid_id;

      if (bidId) {
        const newStatus = item.hsn ? HsnStatus.COMPLETED : HsnStatus.FAILED;

        try {
          await this.bidDataRepo.update(
            { id: Number(bidId) },
            {
              hsn: item.hsn || null,
              hsnStatus: newStatus,
            },
          );
          this.logger.log(
            `Updated Bid ID ${bidId}: hsn=${item.hsn}, status=${newStatus}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update Bid ID ${bidId}: ${error.message}`,
          );
        }
      } else {
        this.logger.warn(
          `HSN result item missing bidId: ${JSON.stringify(item)}`,
        );
      }
    }
  }
}
