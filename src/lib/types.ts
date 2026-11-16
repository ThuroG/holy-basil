export type DishVariantId = 'vegan' | 'chicken' | 'pork_mix';

export type SpiceLevel = 'mild' | 'leicht_scharf' | 'original_thai_spicy' | 'extra_hot';

export type DrinkId = 'thai_iced_tea' | 'coconut_water' | 'zueri_mate';

export type PaymentMethod = 'twint' | 'card' | 'cash';

export type PaymentStatus =
  | 'pending_cash'
  | 'pending_payment'
  | 'paid'
  | 'payment_error_fallback'
  | 'refunded';

/**
 * 4-Station Foodtruck Pipeline Status:
 * 1. pending_cash: Customer chose cash, needs to pay at Cashier (Kasse) first
 * 1b. pending_payment: Guest was sent to the payment provider; the signed webhook confirms the payment
 * 2. payment_error_fallback: Digital payment could not be started or failed -> Cashier manual review triggered
 * 3. received: Paid & active in Wok Demand Queue (Koch sees aggregated totals, Schöpfer sees boxes)
 * 4. in_wok: Explicitly in the pan (optional intermediate state, also covered in Wok Demand)
 * 5. plating: Schöpfer finished scooping rice/krapao/egg -> waiting for QC & Drinks
 * 6. ready: QC checked boxes & added drinks -> Called out on Public Board & Customer phone!
 * 7. completed: Handed over to customer
 * 8. cancelled: Cancelled order
 */
export type OrderStatus =
  | 'pending_cash'
  | 'pending_payment'
  | 'payment_error_fallback'
  | 'received'
  | 'in_wok'
  | 'plating'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface NutritionInfo {
  caloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface OrderPortionItem {
  portionIndex: number; // 1..10
  variant: DishVariantId;
  spiceLevel: SpiceLevel;
  addKaiDao: boolean; // + CHF 2.50
  holyGains?: boolean; // + CHF 3.50 (Extra Fleisch / Plant-Protein)
  /** Set when the cook started the wok batch that contains this portion. */
  firedAt?: string;
}

export interface OrderDrinkItem {
  drinkId: DrinkId;
  quantity: number;
}

export interface ZueriCodeAssignment {
  plz: string; // e.g. "8004"
  quarter: string; // e.g. "LANGSTRASSE"
  slang?: string; // e.g. "CHREIS CHEIB"
  formatted: string; // e.g. "8004 · LANGSTRASSE"
}

export interface Order {
  id: string;
  zueriCode: ZueriCodeAssignment;
  portions: OrderPortionItem[];
  drinks: OrderDrinkItem[];
  totalPortions: number; // 1..10
  totalChf: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  idempotencyKey?: string;
  correlationId: string;
  customerNote?: string;
  manualResolutionNote?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  platedAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  /** Tour stop that was live when the order was placed (decides the declared meat origin). */
  stopId?: string | null;
  /** Declaration the guest saw before paying (LGV / LIV evidence). */
  declaration?: OrderDeclarationSnapshot;
  /** Digital payment at the provider. Absent for cash orders. */
  payment?: OrderPaymentInfo;
  /** Money that has to go back to the guest. The cashier clears it. */
  refundDue?: RefundDue;
  /** Status before the last crew move, kept for the short undo window. */
  previousStatus?: OrderStatus;
}

export interface OrderDeclarationSnapshot {
  version: string;
  lines: string[];
}

export interface OrderPaymentInfo {
  provider: string;
  /** Checkout / payment reference at the provider. */
  providerRef: string;
  /** Where the guest pays. Only shown while the payment is open. */
  redirectUrl: string;
  expiresAt: string;
  /** Provider event that settled the payment. */
  settledEventId?: string;
  failureReason?: string;
}

export type RefundReason = 'PAID_AFTER_CANCEL' | 'DOUBLE_PAYMENT' | 'AMOUNT_MISMATCH';

export interface RefundDue {
  reason: RefundReason;
  amountChf: number;
  providerRef: string;
  flaggedAt: string;
  resolvedAt?: string;
}

/** What a guest may see about an order: no internal notes, keys or correlation ids. */
export interface PublicOrderView {
  id: string;
  zueriCode: ZueriCodeAssignment;
  portions: OrderPortionItem[];
  drinks: OrderDrinkItem[];
  totalPortions: number;
  totalChf: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: string;
  declaration?: OrderDeclarationSnapshot;
  /** Link to the payment page, only while the payment is still open. */
  paymentUrl?: string;
}

/** What the public pickup board shows: code and phase only. */
export interface BoardEntry {
  plz: string;
  quarter: string;
  phase: 'preparing' | 'ready';
  /** When the code was called (ready entries only). Lets the board flash new calls. */
  readyAt?: string;
}

export interface CreateOrderInput {
  portions: Array<{
    variant: DishVariantId;
    spiceLevel?: SpiceLevel;
    addKaiDao?: boolean;
    holyGains?: boolean;
  }>;
  drinks?: Array<{
    drinkId: DrinkId;
    quantity: number;
  }>;
  paymentMethod: PaymentMethod;
  preferredPlz?: string;
  customerNote?: string;
  idempotencyKey?: string;
  simulatePaymentFailure?: boolean; // For testing the 99.99% fallback & manual resolution workflow
}

export interface WokProteinBatch {
  variant: DishVariantId;
  variantName: string;
  /** All paid portions that are not plated yet (waiting + in the wok). */
  totalPortions: number;
  /** Portions the cook has not started yet. */
  queuedPortions: number;
  /** Portions in a started wok batch. */
  cookingPortions: number;
  /** Size of the next batch: the oldest waiting portions, at most one wok load. */
  nextBatchSize: number;
  /** Minutes the oldest waiting portion has been waiting since payment. */
  oldestWaitingMinutes: number;
  bySpice: Record<SpiceLevel, number>;
}

export interface WokDemandSummary {
  totalActivePortions: number;
  totalKaiDaoEggs: number;
  totalHolyGains: number;
  activeOrderCount: number;
  customSpiceEnabled: boolean;
  batches: Record<DishVariantId, WokProteinBatch>;
  estimatedWaitMinutes: number;
  /** Variant with the oldest waiting portion: what the cook should start next. */
  nextVariant: DishVariantId | null;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  preferredPlz: string;
  preferredQuarter: string;
  createdAt: string;
  status: NewsletterStatus;
  /** SHA-256 of the confirmation token. The token itself only exists in the e-mail. */
  confirmTokenHash?: string;
  confirmExpiresAt?: string;
  confirmedAt?: string;
  /** Token for the unsubscribe link that goes into every e-mail. */
  unsubscribeToken: string;
  /** Evidence of consent: which text the person agreed to, and when. */
  consent: { textVersion: string; text: string; requestedAt: string };
}

export type NewsletterStatus = 'pending' | 'confirmed';

export interface B2BInquiry {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  eventType: 'catering' | 'popup' | 'cooking_class';
  guestCount: number;
  preferredDate: string;
  message?: string;
  createdAt: string;
}

export interface TruckLocationStop {
  id: string;
  dayLabel: string;
  dateStr: string;
  plz: string;
  quarter: string;
  spotName: string;
  address: string;
  hours: string;
  status: 'live_now' | 'upcoming' | 'completed';
  vibeNote: string;
}

export interface ApiMeta {
  latencyMs: number;
  timestamp: string;
  correlationId: string;
  slaCompliant: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  correlationId: string;
  fallbackAction?: 'MANUAL_CASH_CONFIRMATION' | 'RETRY_REQUEST' | 'CONTACT_CREW' | 'NONE';
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface SlaMetrics {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  paymentAttempts: number;
  paymentSuccesses: number;
  paymentFallbacksTriggered: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  subSecondComplianceRate: number; // Percentage of requests < 1000ms
  availabilityRate: number; // Target >= 99.5%
  paymentReliabilityRate: number; // Share of digital payment attempts that succeeded (fallbacks count as failed)
  recentErrors: Array<{
    correlationId: string;
    code: string;
    message: string;
    timestamp: string;
  }>;
}
