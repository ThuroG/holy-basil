import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOrder,
  confirmOrderPaymentAtCashier,
  advanceOrderStatus,
  getWokDemand,
  resetOrderStore,
} from '../../src/lib/orderStore.js';
import { setCustomSpiceLevelsEnabled, resetFeatureFlags } from '../../src/config/features.js';

describe('Zero-Click Wok Demand Aggregator (Cook Cockpit)', () => {
  beforeEach(() => {
    resetFeatureFlags();
    resetOrderStore();
  });

  it('excludes unpaid pending_cash orders from Wok Demand until Cashier confirms payment', async () => {
    const cashOrder = await createOrder({
      portions: [
        { variant: 'chicken', addKaiDao: true },
        { variant: 'vegan', addKaiDao: false },
      ],
      paymentMethod: 'cash',
    });

    // Before Cashier confirmation: Wok Demand must be 0 so the cook does not cook unpaid food
    let demand = getWokDemand();
    expect(demand.totalActivePortions).toBe(0);
    expect(demand.totalKaiDaoEggs).toBe(0);

    // Cashier confirms cash payment
    confirmOrderPaymentAtCashier(cashOrder.id, 'CHF 28.50 bar kassiert');

    demand = getWokDemand();
    expect(demand.totalActivePortions).toBe(2);
    expect(demand.totalKaiDaoEggs).toBe(1);
    expect(demand.batches.chicken.totalPortions).toBe(1);
    expect(demand.batches.vegan.totalPortions).toBe(1);
  });

  it('aggregates up to 10 portions across multiple orders with default spice when toggle is false', async () => {
    setCustomSpiceLevelsEnabled(false);

    await createOrder({
      portions: [
        { variant: 'chicken', spiceLevel: 'extra_hot', addKaiDao: true },
        { variant: 'chicken', spiceLevel: 'mild', addKaiDao: true },
        { variant: 'pork_mix', addKaiDao: false },
      ],
      paymentMethod: 'twint',
    });

    await createOrder({
      portions: [
        { variant: 'chicken', addKaiDao: false },
        { variant: 'vegan', addKaiDao: true },
      ],
      paymentMethod: 'card',
    });

    const demand = getWokDemand();
    expect(demand.customSpiceEnabled).toBe(false);
    expect(demand.activeOrderCount).toBe(2);
    expect(demand.totalActivePortions).toBe(5);
    expect(demand.totalKaiDaoEggs).toBe(3);

    // All 3 chicken portions are grouped into default 'leicht_scharf'
    expect(demand.batches.chicken.totalPortions).toBe(3);
    expect(demand.batches.chicken.bySpice.leicht_scharf).toBe(3);
    expect(demand.batches.pork_mix.totalPortions).toBe(1);
    expect(demand.batches.vegan.totalPortions).toBe(1);
  });

  it('splits Wok Demand by custom spice levels when feature toggle is enabled', async () => {
    setCustomSpiceLevelsEnabled(true);

    const ord = await createOrder({
      portions: [
        { variant: 'chicken', spiceLevel: 'mild', addKaiDao: true },
        { variant: 'chicken', spiceLevel: 'original_thai_spicy', addKaiDao: true },
        { variant: 'chicken', spiceLevel: 'original_thai_spicy', addKaiDao: false },
      ],
      paymentMethod: 'twint',
    });

    let demand = getWokDemand();
    expect(demand.customSpiceEnabled).toBe(true);
    expect(demand.batches.chicken.totalPortions).toBe(3);
    expect(demand.batches.chicken.bySpice.mild).toBe(1);
    expect(demand.batches.chicken.bySpice.original_thai_spicy).toBe(2);

    // Once Schöpfer plates the order, it leaves the Wok Demand queue
    advanceOrderStatus(ord.id, 'plating');
    demand = getWokDemand();
    expect(demand.totalActivePortions).toBe(0);
  });
});
