import { DataSource } from 'typeorm';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { BidPlusGemPortalMinistryMaster } from '../entity/bid-plus-gem-portal-ministry-master.entity';
import { BidPlusGemPortalOrganizationMaster } from '../entity/bid-plus-gem-portal-organization-master.entity';
import { GemBidData } from '../entity/bid-data.entity';
import 'dotenv/config';

interface CsvRow {
  [key: string]: string;
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [
    BidPlusGemPortalMinistryMaster,
    BidPlusGemPortalOrganizationMaster,
    GemBidData,
  ],
  synchronize: true,
});

function readCsv(filename: string): CsvRow[] {
  const filePath = path.join(__dirname, '..', 'temp', filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
  });
}

async function seed() {
  await dataSource.initialize();
  console.log('Database connected.');

  // --- 1. Seed Ministry Master ---
  const ministryRepo = dataSource.getRepository(BidPlusGemPortalMinistryMaster);
  const ministryCsvRows = readCsv(
    'qp_bid_plus_gem_portal_ministry_master_202602261615.csv',
  );

  // Map old CSV id -> new DB entity so we can link organisations later
  const ministryOldIdToEntity = new Map<
    number,
    BidPlusGemPortalMinistryMaster
  >();

  for (const row of ministryCsvRows) {
    const name = (row['ministry_name'] ?? '').trim();
    if (!name) continue;

    let entity = await ministryRepo.findOne({
      where: { ministryName: name },
    });
    if (!entity) {
      entity = ministryRepo.create({ ministryName: name });
      entity = await ministryRepo.save(entity);
    }
    ministryOldIdToEntity.set(Number(row['id']), entity);
  }
  console.log(`Seeded ${ministryOldIdToEntity.size} ministry master records.`);

  // --- 2. Seed Organisation Master ---
  const orgRepo = dataSource.getRepository(BidPlusGemPortalOrganizationMaster);
  const orgCsvRows = readCsv(
    'qp_bid_plus_gem_portal_organization_master_202602261615.csv',
  );

  let orgCount = 0;
  for (const row of orgCsvRows) {
    const name = (row['organization_name'] ?? '').trim();
    if (!name) continue;

    const ministryOldId = Number(
      row['bid_plus_gem_portal_ministry_master_id_id'],
    );
    const ministry = ministryOldIdToEntity.get(ministryOldId);
    if (!ministry) {
      console.warn(
        `Skipping org "${name}" — ministry with old id ${ministryOldId} not found.`,
      );
      continue;
    }

    const existing = await orgRepo.findOne({
      where: {
        organizationName: name,
        bidPlusGemPortalMinistryMaster: { id: ministry.id },
      },
    });
    if (!existing) {
      const entity = orgRepo.create({
        organizationName: name,
        bidPlusGemPortalMinistryMaster: ministry,
      });
      await orgRepo.save(entity);
      orgCount++;
    }
  }
  console.log(`Seeded ${orgCount} organisation master records.`);

  // --- 3. Seed Bid Data ---
  const bidRepo = dataSource.getRepository(GemBidData);
  const bidCsvRows = readCsv('qp_bid_data_202602261614.csv');

  const BATCH_SIZE = 500;
  let bidCount = 0;
  const batchBuffer: GemBidData[] = [];

  for (const row of bidCsvRows) {
    const bidNumber = (row['bid_number'] ?? '').trim();
    if (!bidNumber) continue;

    const entity = bidRepo.create({
      bidNumber,
      bidUrl: row['bid_url'] || undefined,
      items: row['items'] || undefined,
      ministryName: row['ministry_name'] || undefined,
      organisationName: row['organisation_name'] || undefined,
      departmentName: row['department_name'] || undefined,
      startDateRaw: row['start_date_raw'] || undefined,
      endDateRaw: row['end_date_raw'] || undefined,
      quantity: row['quantity'] ? Number(row['quantity']) : undefined,
      hsn: row['hsn'] || undefined,
      scrapingPortalId: row['scraping_portal_id_id']
        ? Number(row['scraping_portal_id_id'])
        : undefined,
      isActive: row['is_active'] === 'true',
    });

    batchBuffer.push(entity);

    if (batchBuffer.length >= BATCH_SIZE) {
      await bidRepo
        .createQueryBuilder()
        .insert()
        .into(GemBidData)
        .values(batchBuffer)
        .orIgnore()
        .execute();
      bidCount += batchBuffer.length;
      batchBuffer.length = 0;
    }
  }

  // flush remaining
  if (batchBuffer.length > 0) {
    await bidRepo
      .createQueryBuilder()
      .insert()
      .into(GemBidData)
      .values(batchBuffer)
      .orIgnore()
      .execute();
    bidCount += batchBuffer.length;
  }

  console.log(`Seeded ${bidCount} bid data records.`);

  await dataSource.destroy();
  console.log('Seed complete. Connection closed.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
