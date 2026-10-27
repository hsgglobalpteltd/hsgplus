export type QuestionType = 'scale' | 'text' | 'number' | 'image';

export interface DynamicQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
}

export interface HsgBrand {
  id: string;
  name: string;
  category: 'Drink' | 'Snack' | 'Paste';
  tagline: string;
}

export interface HsgProduct {
  id: string;
  brand_id: string;
  brand_name: string;
  category: 'Drink' | 'Snack' | 'Paste';
  name: string;
  unit_label: string;
  image_url: string;
}

export type MilestoneRewardType =
  | 'extra_cash'
  | 'extra_percent'
  | 'extra_points'
  | 'free_merch';
export type CashbackPurchaseMode = 'flat' | 'percentage' | 'points';
export type CashbackTaskType =
  | 'range_number'
  | 'text'
  | 'radio_select'
  | 'multi_select';

export interface CashbackTaskItem {
  id: string;
  title: string; // e.g. "Task #1" or "Survey Q1"
  question: string;
  type: CashbackTaskType;
  options?: string[]; // for radio_select & multi_select
  min_range?: number; // for range_number (default 1)
  max_range?: number; // for range_number (default 10)
  note?: string;
  required?: boolean;
}

export interface StoreVisitMilestone {
  step: number; // 1, 2, 3, 4, 5
  target_stores: number; // e.g. 1, 2, 3, 4, 5 shops
  reward_type: MilestoneRewardType;
  reward_value?: number;
  reward_label: string; // e.g. "+$2.00 Bonus", "+1% All Week", "+$5.00 or Free Merch"
}

export interface CashbackCampaign {
  id: string;
  is_active: boolean;
  is_archived?: boolean;
  display_order?: number;
  campaign_name?: string;
  display_title?: string;
  display_description?: string;
  cta_text?: string;
  banner_image_url?: string;
  brand_id: string;
  brand_name: string;
  product_id: string;
  product_name: string;
  product_image_url: string;
  unit_label: string;
  // Cash-In #1: Each Purchase (Flat Rate OR Percentage of Purchase)
  purchase_reward_mode: CashbackPurchaseMode;
  cashback_amount: number; // if flat: $1.00; if percentage: e.g. 10 (%)
  min_qty: number;
  where_to_buy: string;
  start_timestamp: number;
  end_timestamp: number;
  // Cash-In #2: Extra Store Visit Milestones
  enable_milestones?: boolean;
  store_visit_milestones: StoreVisitMilestone[];
  visited_store_ids: string[]; // unique outlets visited by user in this campaign
  tasks?: CashbackTaskItem[]; // Max 3 dynamic tasks or survey questions
  task_title: string;
  task_question: string;
  task_note: string;
}

export interface OutletMapping {
  outlet_id: string;
  retailer_name: string;
  outlet_name: string;
  address: string;
}

export interface UserMetrics {
  wallet_balance?: number;
  points_balance: number;
  weekly_streak?: number;
  events_joined: number;
  contests_joined: number;
  referral_count: number;
  referral_code?: string;
  referred_by?: string;
}

export interface UserPrivacy {
  mode: boolean;
  phone: string;
  phone_last4?: string;
  paynow_last4?: string;
}

export interface UserAccount {
  id?: string;
  user_id?: string;
  phone_number: string; // PK
  nickname: string;
  paynow: string;
  paynow_number?: string;
  wallet_balance: number;
  is_blocked?: boolean;
  logs?: any[];
  metrics?: UserMetrics;
  socials: {
    tt: string;
    fb: string;
    thread: string;
    ig: string;
  };
  privacy?: UserPrivacy;
  pending_balance?: number;
  points_balance?: number;
  cashback_balance?: number;
  pending_points?: number;
  address?: string;
  weekly_streak: number; // Week streak counter shown at top-right profile icon
  is_online?: boolean;
  last_active_timestamp?: number;
  total_claims?: number;
  events_joined?: number;
  contests_joined?: number;
  referral_code?: string;
  referred_by?: string;
  referral_count?: number;
  privacy_mode?: boolean;
  phone_hash?: string;
  phone_last4?: string;
  paynow_hash?: string;
  paynow_last4?: string;
  created_at?: number;
}

export interface CashbackClaimRecord {
  id: string;
  user_id?: string;
  campaign_id: string;
  brand_name: string;
  product_name: string;
  user_phone: string;
  user_nickname: string;
  transaction_id: string;
  raw_address: string;
  matched_outlet_id: string | null;
  matched_outlet_name: string;
  qty: number;
  total_qty?: number;
  receipt_amount: number;
  total_purchase?: number;
  cashback_amount: number;
  cashier_task_qty: number;
  task_answers?: Record<string, string | number | string[]>;
  answers?: Record<string, any>;
  diagnose_status?: string;
  receipt_photo_url: string;
  status: 'credited' | 'rejected' | 'pending' | 'approved';
  rejection_reason?: string;
  timestamp: number;
}

export interface CashbackHistoryItem {
  id: string;
  type: 'cashback_credit' | 'cashback_rejected' | 'withdrawal' | 'merch_redeem' | 'event_rsvp';
  title: string;
  amount: number;
  points?: number;
  status: 'credited' | 'rejected' | 'pending_payout' | 'completed' | 'pending';
  rejection_reason?: string;
  outlet_id?: string;
  outlet_name?: string;
  transaction_id?: string;
  fulfillment_mode?: 'collect' | 'delivery';
  timestamp: number;
}

export interface HsgTransaction {
  id: string;
  user_phone: string;
  user_nickname?: string;
  currency: 'cashback' | 'points' | 'both' | 'free';
  direction: 'in' | 'out';
  amount_cashback: number;
  amount_points: number;
  net_cashback: number;
  net_points: number;
  amount?: number;
  points?: number;
  cashback_amount?: number;
  balance_after_cashback?: number | null;
  balance_after_points?: number | null;
  type: string;
  status: string;
  title: string;
  description?: string;
  reference_id?: string;
  reference_type?: string;
  outlet_id?: string;
  outlet_name?: string;
  metadata?: Record<string, any>;
  created_at: number;
  timestamp?: number;
}

export type EventCategory =
  | 'Running'
  | 'Tasting'
  | 'Roadshow'
  | 'Cooking'
  | 'Community';

export interface HsgEvent {
  id: string;
  title: string;
  category: EventCategory;
  brands_involved: string[];
  date_timestamp: number;
  time_label: string;
  location: string;
  distance_or_format: string;
  fee_amount: number;
  fee_points?: number;
  duration_hours?: number;
  reward_points?: number;
  outcome_url?: string;
  requirement_text: string;
  joined_count: number;
  max_capacity: number;
  checkin_mode: 'both_qr' | 'user_qr' | 'event_qr' | 'none';
  event_qr_code: string;
  user_status: 'none' | 'joined' | 'skipped' | 'checked_in';
  image_url: string;
  description: string;
}

export interface ContestPrizeTier {
  rank: string;
  amount: string;
}

export interface ContestPrizeItem {
  id: string;
  title: string;
  description?: string;
  photo_url?: string;
  reward_type: 'point' | 'cashback' | 'both';
  reward_cash?: number;
  reward_points?: number;
  product_id?: string;
  product_name?: string;
  product_image?: string;
  max_pax: number;
}

export interface ContestWinnerRecord {
  id: string;
  contest_id: string;
  prize_id: string;
  prize_title: string;
  prize_description?: string;
  prize_photo_url?: string;
  reward_type: 'point' | 'cashback' | 'both';
  reward_cash?: number;
  reward_points?: number;
  product_id?: string;
  product_name?: string;
  product_image?: string;
  delivery_address?: string;
  claim_channel?: string;
  awaiting_address?: boolean;
  user_id: string;
  user_phone: string;
  user_nickname: string;
  submission_id?: string;
  status: 'pending_claim' | 'claimed';
  claimed: boolean;
  claimed_at?: number;
  created_at: number;
}

export interface ContestQuestionItem {
  id: string;
  label: string;
  type:
    | 'text'
    | 'photo_upload'
    | 'radio_select'
    | 'multi_select'
    | 'range_number'
    | 'scale'
    | 'number';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface HsgContest {
  id: string;
  title: string;
  internal_title?: string;
  frontpage_title?: string;
  frontpage_description?: string;
  frontpage_poster_url?: string;
  start_timestamp?: number;
  end_timestamp: number;
  is_published?: boolean;
  is_archived?: boolean;
  required_event_id?: string | null;
  requirement_note?: string;
  poster_images?: string[];
  inside_posters?: string[];
  inside_description?: string;
  inside_instruction?: string;
  reward_points?: number;
  max_per_user?: number;
  max_total?: number;
  extra_questions?: Array<{
    id: string;
    question: string;
    type?: 'text' | 'radio';
    options?: string[];
    required?: boolean;
  }>;
  prizes?: ContestPrizeItem[];
  winners_announced?: boolean;
  frontpage_config?: {
    title?: string;
    description?: string;
    cover_photo_url?: string;
  };
  submission_limits?: {
    max_per_user?: number;
    total_cap?: number;
    points_per_submission?: number;
  };
  submission_questions?: ContestQuestionItem[];
  code_number?: string;
  brand_name?: string;
  subtitle?: string;
  highlights?: {
    title: string;
    detail: string;
  }[];
  winners_header?: string;
  prize_tiers: ContestPrizeTier[];
  prize_type_label?: string;
  extra_prize_note?: string;
  footer_note?: string;
  questions?: DynamicQuestion[];
  require_photo?: boolean;
  photo_upload_label?: string;
}

export interface ContestSubmissionRecord {
  id: string;
  contest_id: string;
  contest_title: string;
  user_id?: string;
  user_phone: string;
  user_nickname: string;
  photo_name?: string;
  receipt_photo_url?: string;
  amount_paid?: number;
  items_count?: number;
  extra_answers?: Record<string, any>;
  answer_json?: Record<string, any>;
  answers_json?: Record<string, any>;
  status: 'submitted' | 'approved' | 'winner' | 'rejected';
  winner_data?: {
    is_winner?: boolean;
    prize_note?: string;
    awarded_at?: number;
  };
  prize_awarded?: string;
  created_at?: number;
  timestamp?: number;
}

export interface ContestReward {
  id: string;
  contest_title: string;
  reward_name: string;
  worth_label: string;
  claimed: boolean;
  claim_method?: 'collect' | 'delivery';
}

export interface HsgAnnouncement {
  id: string;
  title: string;
  body: string;
  timestamp: number;
}

export interface PostHighlight {
  id: string;
  brand_name: string;
  title: string;
  subtitle: string;
  image_url: string;
  external_link?: string;
}

export interface MerchItem {
  id: string;
  brand_name: string;
  name: string;
  category?: 'Product' | 'Merch';
  redeem_mode?: 'both' | 'points_only' | 'cashback_only';
  price: number;
  price_points?: number;
  image_url: string;
  stock: number;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  progress_current: number;
  progress_target: number;
  unlocked: boolean;
}

export interface HsgSystemSettings {
  min_withdrawal_amount: number;
  require_points_for_withdrawal?: boolean;
  min_points_to_unlock_withdrawal?: number;
  min_invites_to_unlock_withdrawal?: number;
  min_events_to_unlock_withdrawal?: number;
  withdrawal_rules_updated_at?: number;
  withdrawal_points_fee?: number;
  withdrawal_sla_text: string;
  delivery_fee: number;
  whatsapp_bot_number: string;
  self_collect_address?: string;
  theme_color_1?: string;
  theme_color_2?: string;
  referral_enabled?: boolean;
  referral_referrer_cashback?: number;
  referral_referrer_points?: number;
  referral_referee_cashback?: number;
  referral_referee_points?: number;
}

export interface HsgDatabaseSchema {
  settings: HsgSystemSettings;
  brands: HsgBrand[];
  products: HsgProduct[];
  cashback_campaigns: CashbackCampaign[];
  active_campaign_id: string | null;
  cashback_claims: CashbackClaimRecord[];
  user: UserAccount | null;
  users_list: UserAccount[];
  outlet_mappings: OutletMapping[];
  history: CashbackHistoryItem[];
  transactions: HsgTransaction[];
  events: HsgEvent[];
  contests: HsgContest[];
  contest_submissions: ContestSubmissionRecord[];
  contest_winners: ContestWinnerRecord[];
  rewards: ContestReward[];
  announcements: HsgAnnouncement[];
  highlights: PostHighlight[];
  merch_catalog: MerchItem[];
  achievements: AchievementItem[];
}

