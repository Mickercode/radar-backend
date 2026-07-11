// Coverage audit job.
// Counts how many content items each topic+type pair has in the last 30 days,
// then updates content_coverage with a status: ok | sparse | gap | scarce.
//
// Run on a schedule (e.g. nightly at 03:00 UTC) or trigger via
// POST /admin/coverage/audit (admin only).
//
// Usage as a standalone script:
//   node dist/jobs/coverageAudit.js

import { PrismaClient } from '@prisma/client';
import { COVERAGE_THRESHOLDS } from './feeds';

const prisma = new PrismaClient();

const CONTENT_TYPES = ['news', 'podcast', 'clip'] as const;
// A topic is marked 'scarce' (real supply shortage, stop retrying) after this
// many consecutive audit cycles where gap-fill added 0 items.
const SCARCE_THRESHOLD = 5;

export async function runCoverageAudit(): Promise<{
  audited: number;
  gaps: number;
  sparse: number;
  scarce: number;
  ok: number;
}> {
  console.log('[coverage-audit] starting');

  // 1. Ensure rows exist for every topic + type pair.
  const topics = await prisma.topic.findMany({ select: { slug: true } });

  for (const topic of topics) {
    for (const ct of CONTENT_TYPES) {
      const threshold =
        COVERAGE_THRESHOLDS[topic.slug]?.[ct as 'news' | 'podcast' | 'clip'] ?? 5;
      await prisma.contentCoverage.upsert({
        where: { topicSlug_contentType: { topicSlug: topic.slug, contentType: ct } },
        create: { topicSlug: topic.slug, contentType: ct, minThreshold: threshold },
        update: { minThreshold: threshold }, // keep threshold in sync if we change COVERAGE_THRESHOLDS
      });
    }
  }

  // 2. Count recent content per topic+type (last 30 days).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const counts = await prisma.$queryRaw<
    { slug: string; type: string; count: bigint }[]
  >`
    SELECT t.slug, c.type, COUNT(c.id) AS count
    FROM topics t
    LEFT JOIN content c
      ON c.topic_id = t.id
      AND c.created_at > ${since}
    GROUP BY t.slug, c.type
  `;

  // Build a lookup: slug → type → count
  const countMap: Record<string, Record<string, number>> = {};
  for (const row of counts) {
    if (!row.type) continue; // LEFT JOIN null row (topic has no content at all)
    (countMap[row.slug] ??= {})[row.type] = Number(row.count);
  }

  // 3. Update status for every row.
  let audited = 0, gaps = 0, sparse = 0, scarce = 0, ok = 0;

  const allRows = await prisma.contentCoverage.findMany();
  for (const row of allRows) {
    const itemCount = countMap[row.topicSlug]?.[row.contentType] ?? 0;
    let status: string;

    if (itemCount === 0) {
      status = row.failCycles + 1 >= SCARCE_THRESHOLD ? 'scarce' : 'gap';
    } else if (itemCount < row.minThreshold) {
      status = row.failCycles + 1 >= SCARCE_THRESHOLD ? 'scarce' : 'sparse';
    } else {
      status = 'ok';
    }

    await prisma.contentCoverage.update({
      where: { topicSlug_contentType: { topicSlug: row.topicSlug, contentType: row.contentType } },
      data: {
        itemCount,
        status,
        lastChecked: new Date(),
        // Reset fail cycle on improvement; increment on continued gap.
        failCycles: status === 'ok' ? 0 : row.failCycles + 1,
      },
    });

    audited++;
    if (status === 'gap') gaps++;
    else if (status === 'sparse') sparse++;
    else if (status === 'scarce') scarce++;
    else ok++;
  }

  // 4. Persist summary to SystemSetting so admin dashboard can surface it.
  const summary = { gaps, sparse, scarce, ok, total: audited, auditedAt: new Date().toISOString() };
  await prisma.systemSetting.upsert({
    where: { key: 'last_coverage_audit' },
    create: { key: 'last_coverage_audit', value: JSON.stringify(summary) },
    update: { value: JSON.stringify(summary) },
  });

  console.log(`[coverage-audit] done — audited=${audited} ok=${ok} sparse=${sparse} gaps=${gaps} scarce=${scarce}`);
  return { audited, gaps, sparse, scarce, ok };
}

if (require.main === module) {
  runCoverageAudit()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (e) => {
      console.error('[coverage-audit] fatal', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
