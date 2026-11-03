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
    bySpice: createEmptySpiceMap(),
  };
}

/**
 * Computes real-time Wok Demand Summary for the foodtruck cook (Zero-Click Wok Cockpit).
 *
 * Only orders that are PAID and not yet scooped/plated ('received' or 'in_wok')
 * are included in the active wok pan demand!
 * Unpaid cash orders ('pending_cash') or payment fallback orders ('payment_error_fallback')
 * are held back until confirmed by the Cashier (Kasse).
 */
export function getWokDemandSummary(orders: readonly Order[]): WokDemandSummary {
  const flags = getFeatureFlags();
  const batches: Record<DishVariantId, WokProteinBatch> = {
    vegan: createEmptyBatch('vegan'),
    chicken: createEmptyBatch('chicken'),
    pork_mix: createEmptyBatch('pork_mix'),
  };

  let totalActivePortions = 0;
  let totalKaiDaoEggs = 0;
  let activeOrderCount = 0;

  for (const order of orders) {
    // Only include paid orders currently waiting for or inside the wok
    if (order.status !== 'received' && order.status !== 'in_wok') {
      continue;
    }

    activeOrderCount += 1;

    for (const portion of order.portions) {
      const batch = batches[portion.variant];
      if (!batch) continue;

      batch.totalPortions += 1;
      totalActivePortions += 1;

      const effectiveSpice: SpiceLevel = flags.enableCustomSpiceLevels
        ? portion.spiceLevel
        : flags.defaultSpiceLevel;

      batch.bySpice[effectiveSpice] = (batch.bySpice[effectiveSpice] || 0) + 1;

      if (portion.addKaiDao) {
        totalKaiDaoEggs += 1;
      }
    }
  }

  // Wok throughput is roughly 4 portions per 2.5 minutes batch
  const estimatedWaitMinutes =
    totalActivePortions === 0 ? 3 : Math.max(3, Math.ceil((totalActivePortions / 4) * 2.5));

  return {
    totalActivePortions,
    totalKaiDaoEggs,
    activeOrderCount,
    customSpiceEnabled: flags.enableCustomSpiceLevels,
    batches,
    estimatedWaitMinutes,
  };
}
