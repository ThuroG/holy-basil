import { Order, WokDemandSummary, DishVariantId, SpiceLevel, WokProteinBatch } from './types.js';
import { getFeatureFlags, MENU_DISHES } from '../config/features.js';

function createEmptySpiceMap(): Record<SpiceLevel, number> {
  return {
    mild: 0,
    leicht_scharf: 0,
    original_thai_spicy: 0,
    extra_hot: 0,
  };
}

function createEmptyBatch(variant: DishVariantId): WokProteinBatch {
  return {
    variant,
    variantName: MENU_DISHES[variant].name,
    totalPortions: 0,
    queuedPortions: 0,
    cookingPortions: 0,
    nextBatchSize: 0,
    oldestWaitingMinutes: 0,
    bySpice: createEmptySpiceMap(),
  };
}

/**
 * Computes the real-time Wok Demand Summary for the foodtruck cook (Wok Cockpit).
 *
 * Only orders that are PAID and not yet scooped/plated ('received' or 'in_wok') count.
 * Unpaid orders are held back until the cashier or the payment webhook confirms them.
 *
 * Per variant the summary splits the portions into
 * - queued:  paid, the cook has not started them yet
 * - cooking: in a wok batch the cook started (`firedAt` is set)
 * and names the variant with the oldest waiting portion as the next batch.
 */
export function getWokDemandSummary(
  orders: readonly Order[],
  now: number = Date.now()
): WokDemandSummary {
  const flags = getFeatureFlags();
  const batches: Record<DishVariantId, WokProteinBatch> = {
    vegan: createEmptyBatch('vegan'),
    chicken: createEmptyBatch('chicken'),
    pork_mix: createEmptyBatch('pork_mix'),
  };
  const oldestQueuedAt: Partial<Record<DishVariantId, number>> = {};

  let totalActivePortions = 0;
  let totalKaiDaoEggs = 0;
  let activeOrderCount = 0;

  for (const order of orders) {
    // Only include paid orders currently waiting for or inside the wok
    if (order.status !== 'received' && order.status !== 'in_wok') {
      continue;
    }

    activeOrderCount += 1;
    const waitingSince = Date.parse(order.paidAt || order.createdAt);

    for (const portion of order.portions) {
      const batch = batches[portion.variant];
      if (!batch) continue;

      batch.totalPortions += 1;
      totalActivePortions += 1;

      if (portion.firedAt) {
        batch.cookingPortions += 1;
      } else {
        batch.queuedPortions += 1;
        const known = oldestQueuedAt[portion.variant];
        if (known === undefined || waitingSince < known) {
          oldestQueuedAt[portion.variant] = waitingSince;
        }
      }

      const effectiveSpice: SpiceLevel = flags.enableCustomSpiceLevels
        ? portion.spiceLevel
        : flags.defaultSpiceLevel;

      batch.bySpice[effectiveSpice] = (batch.bySpice[effectiveSpice] || 0) + 1;

      if (portion.addKaiDao) {
        totalKaiDaoEggs += 1;
      }
    }
  }

  let nextVariant: DishVariantId | null = null;
  let nextSince = Infinity;
  for (const variant of Object.keys(batches) as DishVariantId[]) {
    const batch = batches[variant];
    batch.nextBatchSize = Math.min(batch.queuedPortions, flags.wokBatchSize);
    const since = oldestQueuedAt[variant];
    if (since !== undefined && !Number.isNaN(since)) {
      batch.oldestWaitingMinutes = Math.max(0, Math.floor((now - since) / 60000));
      // Oldest waiting portion wins; on a tie the variant with more waiting portions.
      const tieWithMore =
        since === nextSince && nextVariant !== null && batch.queuedPortions > batches[nextVariant].queuedPortions;
      if (since < nextSince || tieWithMore) {
        nextSince = since;
        nextVariant = variant;
      }
    }
  }

  // Wok throughput: one batch of `wokBatchSize` portions every `wokBatchMinutes`.
  const estimatedWaitMinutes =
    totalActivePortions === 0
      ? 3
      : Math.max(3, Math.ceil((totalActivePortions / flags.wokBatchSize) * flags.wokBatchMinutes));

  return {
    totalActivePortions,
    totalKaiDaoEggs,
    activeOrderCount,
    customSpiceEnabled: flags.enableCustomSpiceLevels,
    batches,
    estimatedWaitMinutes,
    nextVariant,
  };
}
