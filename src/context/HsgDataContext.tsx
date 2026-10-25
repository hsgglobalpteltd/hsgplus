import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  HsgDatabaseSchema,
  UserAccount,
  CashbackHistoryItem,
  CashbackCampaign,
  HsgContest,
  PostHighlight,
  MerchItem,
  HsgAnnouncement,
  HsgEvent,
  HsgSystemSettings,
  CashbackClaimRecord,
} from '../types';
const INITIAL_DATABASE: HsgDatabaseSchema = {
  settings: {
    min_withdrawal_amount: 10,
    require_points_for_withdrawal: true,
    min_points_to_unlock_withdrawal: 100,
    min_invites_to_unlock_withdrawal: 3,
    min_events_to_unlock_withdrawal: 3,
    withdrawal_rules_updated_at: Date.now(),
    withdrawal_sla_text: '24 hours',
    delivery_fee: 10,
    whatsapp_bot_number: '6584755948',
    self_collect_address: 'HSG Global HQ, Singapore',
    theme_color_1:
      (typeof window !== 'undefined' &&
        localStorage.getItem('hsg_theme_color_1')) ||
      '#FFEA00',
    theme_color_2:
      (typeof window !== 'undefined' &&
        localStorage.getItem('hsg_theme_color_2')) ||
      '#EC008C',
    referral_enabled: true,
    referral_referrer_cashback: 5.0,
    referral_referrer_points: 50,
    referral_referee_cashback: 5.0,
    referral_referee_points: 50,
  },
  brands: [],
  products: [],
  cashback_campaigns: [],
  active_campaign_id: null,
  cashback_claims: [],
  user: null,
  users_list: [],
  outlet_mappings: [],
  history: [],
  transactions: [],
  events: [],
  contests: [],
  contest_submissions: [],
  rewards: [],
  announcements: [],
  highlights: [],
  merch_catalog: [],
  achievements: [],
};

interface SubmitCashbackPayload {
  transaction_id: string;
  raw_address: string;
  items: string;
  qty: number;
  amount: number;
  cashback_earned: number;
  survey_answers: Record<string, string | number | string[]>;
  receipt_photo_name: string;
  receipt_photo_url?: string;
}

interface HsgDataContextValue {
  db: HsgDatabaseSchema;
  activeCampaign: CashbackCampaign | null;
  setActiveCampaignId: (campaignId: string | null) => void;
  isAuthenticated: boolean;
  showLoginModal: boolean;
  openLoginModal: (onSuccessAction?: () => void) => void;
  closeLoginModal: () => void;
  requireAuth: (action: () => void) => void;
  loginWithWhatsApp: (
    phoneInput?: string,
    nameInput?: string,
    liveUserObj?: UserAccount
  ) => void;
  logout: () => void;
  refreshLiveUsers: () => Promise<void>;
  submitCashbackClaim: (payload: SubmitCashbackPayload) => {
    matchedOutletId: string | null;
    matchedOutletName: string;
  };
  adminRejectCashbackClaim: (claimId: string, reason: string) => void;
  adminSaveCashbackCampaign: (campaign: CashbackCampaign, setAsActive: boolean) => void;
  adminSaveContest: (contest: HsgContest) => void;
  adminDeleteContest: (contestId: string) => void;
  adminAwardContestWinner: (submissionId: string, prizeLabel: string) => void;
  adminSaveHighlight: (item: PostHighlight) => void;
  adminDeleteHighlight: (id: string) => void;
  adminSaveEvent: (ev: HsgEvent) => void;
  adminDeleteEvent: (id: string) => void;
  adminSaveMerch: (item: MerchItem) => void;
  adminDeleteMerch: (id: string) => void;
  adminSaveAnnouncement: (ann: HsgAnnouncement) => void;
  adminDeleteAnnouncement: (id: string) => void;
  adminUpdateSettings: (settings: Partial<HsgSystemSettings>) => void;
  requestWithdrawal: (amount: number) => { ok: boolean; message: string };
  redeemMerch: (
    merchId: string,
    fulfillment: 'collect' | 'delivery',
    paymentCurrency?: 'cashback' | 'points'
  ) => { ok: boolean; message: string };
  checkoutRedeemCart: (payload: {
    items: Array<{
      merchId: string;
      qty: number;
      payWith: 'points' | 'cashback';
    }>;
    fulfillment: 'collect' | 'delivery';
    deliveryAddress?: string;
  }) => { ok: boolean; message: string };
  updateAccountProfile: (updated: Partial<UserAccount>) => void;
  rsvpEvent: (
    eventId: string,
    status: 'joined' | 'skipped',
    payMethod?: 'cashback' | 'points' | 'free'
  ) => Promise<{ ok: boolean; message: string }>;
  checkInEvent: (
    eventId: string,
    scannedCode?: string
  ) => Promise<{ ok: boolean; message: string; reward_points?: number; already_checked_in?: boolean }>;
  submitContestEntry: (
    answers: Record<string, string | number>,
    photoName?: string,
    contestId?: string
  ) => void;
  claimReward: (rewardId: string, method: 'collect' | 'delivery') => void;
  claimReferralCode: (
    code: string
  ) => Promise<{ ok: boolean; message: string; referrer_name?: string }>;
  refreshTransactions: (phone?: string) => Promise<void>;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

// 120-Day Cache-Proof First-Come, First-Served Referral Storage
export const REFERRAL_ATTR_KEY = 'hsg_referral_attribution_v1';
export const REFERRAL_TTL_MS = 120 * 24 * 60 * 60 * 1000; // 120 Days

export function getPendingReferralCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(REFERRAL_ATTR_KEY);
    if (!raw) {
      return sessionStorage.getItem('hsg_pending_referral_code') || '';
    }
    const data = JSON.parse(raw);
    if (data && data.code && data.expires_at && Date.now() < data.expires_at) {
      return String(data.code).trim().toUpperCase();
    }
    localStorage.removeItem(REFERRAL_ATTR_KEY);
    return '';
  } catch {
    return '';
  }
}

export function saveReferralAttribution(code: string): void {
  if (typeof window === 'undefined') return;
  const clean = (code || '').trim().toUpperCase();
  if (!clean) return;
  try {
    // First-come, first-served: do not overwrite active attribution
    const existing = getPendingReferralCode();
    if (existing) return;

    const now = Date.now();
    const payload = {
      code: clean,
      captured_at: now,
      expires_at: now + REFERRAL_TTL_MS,
    };
    localStorage.setItem(REFERRAL_ATTR_KEY, JSON.stringify(payload));
    sessionStorage.setItem('hsg_pending_referral_code', clean);
  } catch {}
}

export function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REFERRAL_ATTR_KEY);
    sessionStorage.removeItem('hsg_pending_referral_code');
  } catch {}
}

const HsgDataContext = createContext<HsgDataContextValue | undefined>(undefined);

const LIVE_WORKER_URL = 'https://ib-v2.hsgglobalpteltd.workers.dev';

export const HsgDataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [db, setDb] = useState<HsgDatabaseSchema>(INITIAL_DATABASE);

  // Sync Live Cashback Database from Backend
  const syncLiveCashback = async () => {
    try {
      const fetchOpts: RequestInit = { cache: 'no-store' };
      const [res, clRes, ctRes, nwRes, evRes, stRes] = await Promise.all([
        fetch(`${LIVE_WORKER_URL}/api/hsg-app/cashback/campaigns`, fetchOpts),
        fetch(
          `${LIVE_WORKER_URL}/api/hsg-app/cashback/claims?time_filter=all`,
          fetchOpts
        ),
        fetch(`${LIVE_WORKER_URL}/api/hsg-app/contests`, fetchOpts),
        fetch(`${LIVE_WORKER_URL}/api/hsg-app/news`, fetchOpts),
        fetch(`${LIVE_WORKER_URL}/api/hsg-app/events`, fetchOpts),
        fetch(`${LIVE_WORKER_URL}/api/hsg-app/settings`, fetchOpts),
      ]);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.campaigns)) {
          const liveCamps = data.campaigns;
          const liveActive =
            liveCamps.find((c: any) => c.is_active && !c.is_archived) || null;
          setDb((prev) => ({
            ...prev,
            cashback_campaigns: liveCamps,
            active_campaign_id: liveActive ? liveActive.id : null,
          }));
        }
      }

      if (clRes.ok) {
        const clData = await clRes.json();
        if (Array.isArray(clData.claims)) {
          setDb((prev) => ({ ...prev, cashback_claims: clData.claims }));
        }
      }

      // Sync Contests & Submissions
      if (ctRes.ok) {
        const ctData = await ctRes.json();
        const publishedContests = Array.isArray(ctData.contests)
          ? ctData.contests
              .filter((c: any) => c.is_published && !c.is_archived)
              .map((c: any) => ({
                ...c,
                prize_tiers: Array.isArray(c.prize_tiers) ? c.prize_tiers : [],
              }))
          : [];
        const allSubs = Array.isArray(ctData.submissions)
          ? ctData.submissions.map((s: any) => ({
              ...s,
              contest_title: s.contest_title || s.contest_id || 'Contest',
              photo_name: s.photo_name || '',
              answers_json: s.answer_json || s.answers_json || {},
              timestamp: Number(s.created_at || s.timestamp || Date.now()),
            }))
          : [];
        setDb((prev) => ({
          ...prev,
          contests: publishedContests,
          contest_submissions: allSubs,
        }));
      }

      // Sync News (Announcements & Highlights)
      if (nwRes.ok) {
        const nwData = await nwRes.json();
        setDb((prev) => ({
          ...prev,
          announcements: Array.isArray(nwData.announcements)
            ? nwData.announcements
                .filter((a: any) => !a.is_hidden)
                .map((a: any) => ({
                  id: a.id,
                  title: a.title,
                  body: a.body,
                  timestamp: a.created_at || Date.now(),
                }))
            : prev.announcements,
          highlights: Array.isArray(nwData.highlights)
            ? nwData.highlights.filter((h: any) => !h.is_hidden)
            : prev.highlights,
        }));
      }

      // Sync Events
      if (evRes.ok) {
        const evData = await evRes.json();
        if (Array.isArray(evData.events)) {
          const rsvps = Array.isArray(evData.rsvps) ? evData.rsvps : [];
          const authPhone = (localStorage.getItem('hsg_auth_phone') ) || '';
          setDb((prev) => ({
            ...prev,
            events: evData.events
              .filter((ev: any) => ev.is_active !== false)
              .map((ev: any) => {
                const evRsvps = rsvps.filter((r: any) => r.event_id === ev.id);
                const myRsvp = evRsvps.find((r: any) => r.user_phone === authPhone);
                return {
                  id: ev.id,
                  title: ev.title,
                  category: ev.category || 'Community',
                  brands_involved:
                    Array.isArray(ev.brands_involved) &&
                    ev.brands_involved.length > 0
                      ? ev.brands_involved
                      : ['HSG+'],
                  date_timestamp: Number(ev.date_timestamp || Date.now()),
                  time_label: new Date(Number(ev.date_timestamp || Date.now())).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  location: ev.location_name || ev.location_address || 'Singapore',
                  distance_or_format: ev.category || 'Community',
                  fee_amount: Number(ev.fee_amount || 0),
                  fee_points: Number(ev.fee_points || 0),
                  duration_hours: Number(ev.duration_hours || 4),
                  reward_points: Number(ev.reward_points || 0),
                  outcome_url: ev.outcome_url || '',
                  requirement_text:
                    ev.requirement_text ||
                    'Free Entry — Open to all HSG+ members',
                  joined_count: evRsvps.length,
                  max_capacity: Number(ev.max_capacity || 100),
                  checkin_mode: 'both_qr',
                  event_qr_code: `EVT-${ev.id}`,
                  user_status: myRsvp
                    ? myRsvp.checked_in_at > 0
                      ? 'checked_in'
                      : 'joined'
                    : 'none',
                  image_url: ev.banner_url || '',
                  description: ev.description || '',
                };
              }),
          }));
        }
      }

      // Sync Settings & Merch
      if (stRes.ok) {
        const stData = await stRes.json();
        if (stData.settings) {
          setDb((prev) => ({
            ...prev,
            settings: {
              min_withdrawal_amount: Number(
                stData.settings.min_withdrawal_amount ?? prev.settings.min_withdrawal_amount
              ),
              require_points_for_withdrawal:
                stData.settings.require_points_for_withdrawal !== undefined
                  ? Boolean(stData.settings.require_points_for_withdrawal)
                  : true,
              min_points_to_unlock_withdrawal: Number(
                stData.settings.min_points_to_unlock_withdrawal ?? 100
              ),
              min_invites_to_unlock_withdrawal: Number(
                stData.settings.min_invites_to_unlock_withdrawal ?? 3
              ),
              min_events_to_unlock_withdrawal: Number(
                stData.settings.min_events_to_unlock_withdrawal ?? 3
              ),
              withdrawal_rules_updated_at: Number(
                stData.settings.withdrawal_rules_updated_at ||
                  prev.settings.withdrawal_rules_updated_at ||
                  Date.now()
              ),
              withdrawal_sla_text:
                stData.settings.withdrawal_sla_text || prev.settings.withdrawal_sla_text,
              delivery_fee: Number(
                stData.settings.delivery_fee ?? prev.settings.delivery_fee
              ),
              whatsapp_bot_number:
                stData.settings.whatsapp_bot_phone || prev.settings.whatsapp_bot_number,
              self_collect_address:
                stData.settings.self_collect_address ||
                prev.settings.self_collect_address ||
                'HSG Global HQ, Singapore',
              theme_color_1:
                stData.settings.theme_color_1 || prev.settings.theme_color_1 || '#FFEA00',
              theme_color_2:
                stData.settings.theme_color_2 || prev.settings.theme_color_2 || '#EC008C',
              referral_enabled:
                stData.settings.referral_enabled !== undefined
                  ? Boolean(stData.settings.referral_enabled)
                  : true,
              referral_referrer_cashback: Number(
                stData.settings.referral_referrer_cashback ?? 5.0
              ),
              referral_referrer_points: Number(
                stData.settings.referral_referrer_points ?? 50
              ),
              referral_referee_cashback: Number(
                stData.settings.referral_referee_cashback ?? 5.0
              ),
              referral_referee_points: Number(
                stData.settings.referral_referee_points ?? 50
              ),
            },
            merch_catalog: Array.isArray(stData.merch)
              ? stData.merch.map((m: any) => ({
                  id: m.id,
                  brand_name: m.category === 'Merch' ? 'Merch' : 'Product',
                  name: m.name,
                  category: m.category === 'Merch' ? 'Merch' : 'Product',
                  redeem_mode: m.redeem_mode || 'both',
                  price: Number(m.price_cashback || 10),
                  price_points: Number(
                    m.price_points ?? Math.round(Number(m.price_cashback || 10) * 10)
                  ),
                  image_url: m.image_url || '',
                  stock: Number(m.stock_qty || 0),
                }))
              : prev.merch_catalog,
          }));
        }
      }
    } catch (e) {
      console.warn('[LiveCashback] Sync error:', e);
    }
  };

  // Sync Live Users from public.hsg_app_users in Supabase
  const syncLiveUsers = async () => {
    try {
      const fetchOpts: RequestInit = { cache: 'no-store' };
      const res = await fetch(`${LIVE_WORKER_URL}/api/hsg-app/users`, fetchOpts);
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setDb((prev) => ({ ...prev, users_list: data.users }));
        }
      }

      const authPhone = (localStorage.getItem('hsg_auth_phone') );
      const authUserId = (localStorage.getItem('hsg_auth_user_id') );
      if (authPhone || authUserId) {
        const qParam = authUserId
          ? `user_id=${encodeURIComponent(authUserId)}`
          : `phone=${encodeURIComponent(authPhone || '')}`;
        const uRes = await fetch(
          `${LIVE_WORKER_URL}/api/hsg-app/users/me?${qParam}`,
          fetchOpts
        );
        if (uRes.ok) {
          const uData = await uRes.json();
          if (uData.user) {
            if (uData.user?.paynow || uData.user?.paynow_number) {
              try {
                const pn = uData.user.paynow || uData.user.paynow_number;
                if (pn && !pn.startsWith('...')) localStorage.setItem('hsg_auth_paynow', pn);
              } catch {}
            }
            setDb((prev) => {
              const pendingFromTxs = (prev.transactions || [])
                .filter((tx) => tx.status === 'pending')
                .reduce(
                  (sum, tx) =>
                    sum +
                    (Number(
                      tx.amount_cashback ?? tx.net_cashback ?? tx.amount ?? 0
                    ) > 0
                      ? Number(
                          tx.amount_cashback ?? tx.net_cashback ?? tx.amount ?? 0
                        )
                      : 0),
                  0
                );
              const pendingPtsFromTxs = (prev.transactions || [])
                .filter((tx) => tx.status === 'pending')
                .reduce(
                  (sum, tx) =>
                    sum +
                    (Number(
                      tx.amount_points ?? tx.net_points ?? tx.points ?? 0
                    ) > 0
                      ? Number(
                          tx.amount_points ?? tx.net_points ?? tx.points ?? 0
                        )
                      : 0),
                  0
                );
              return {
                ...prev,
                user: {
                  ...uData.user,
                  pending_balance: Math.max(
                    Number(uData.user.pending_balance || 0),
                    Number(pendingFromTxs.toFixed(2))
                  ),
                  pending_points: Math.max(
                    Number(uData.user.pending_points || 0),
                    pendingPtsFromTxs
                  ),
                },
              };
            });
          } else {
            // Live user record no longer exists in database -> purge session
            try {
              localStorage.removeItem('hsg_auth_phone');
              localStorage.removeItem('hsg_auth_user_id');
              localStorage.removeItem('hsg_auth_name');
              localStorage.removeItem('hsg_auth_paynow');
            } catch {}
            setDb((prev) => ({ ...prev, user: null }));
            setIsAuthenticated(false);
          }
        }
      }
    } catch (e) {
      console.warn('[LiveUsers] Sync error:', e);
    }
  };

  // Sync Live Transactions from dedicated database ledger
  const syncLiveTransactions = async (phoneFilter?: string) => {
    try {
      const authPhone = phoneFilter || (localStorage.getItem('hsg_auth_phone') ) || '';
      const authUserId = db.user?.id || (localStorage.getItem('hsg_auth_user_id') ) || '';
      const queryParam = authUserId
        ? `?user_id=${encodeURIComponent(authUserId)}`
        : authPhone
        ? `?user_phone=${encodeURIComponent(authPhone)}`
        : '';
      const res = await fetch(`${LIVE_WORKER_URL}/api/hsg-app/transactions${queryParam}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.transactions)) {
          const txs = data.transactions.map((t: any) => ({
            ...t,
            amount: Number(t.amount_cashback ?? t.net_cashback ?? t.cashback_amount ?? t.amount ?? 0),
            points: Number(t.amount_points ?? t.net_points ?? t.points ?? 0),
            timestamp: Number(t.created_at || t.timestamp || Date.now()),
          }));

          const pendingCashFromTxs = txs
            .filter((t: any) => t.status === 'pending')
            .reduce((sum: number, t: any) => sum + (t.amount > 0 ? t.amount : 0), 0);

          const pendingPtsFromTxs = txs
            .filter((t: any) => t.status === 'pending')
            .reduce((sum: number, t: any) => sum + (t.points > 0 ? t.points : 0), 0);

          setDb((prev) => ({
            ...prev,
            transactions: txs,
            user: prev.user
              ? {
                  ...prev.user,
                  pending_balance: Math.max(
                    Number(prev.user.pending_balance || 0),
                    Number(pendingCashFromTxs.toFixed(2))
                  ),
                  pending_points: Math.max(
                    Number(prev.user.pending_points || 0),
                    pendingPtsFromTxs
                  ),
                }
              : prev.user,
          }));
        }
      }
    } catch (e) {
      console.warn('[LiveTransactions] Sync error:', e);
    }
  };

  React.useEffect(() => {
    const runFullSync = () => {
      syncLiveCashback();
      syncLiveUsers();
      syncLiveTransactions();
    };

    runFullSync();

    // 1. Live background polling every 15 seconds when tab is visible (prevents Cloudflare 429 rate limit)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        runFullSync();
      }
    }, 15000);

    // 2. Immediate sync when user switches back to the tab/window
    const handleFocus = () => runFullSync();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runFullSync();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Instant cross-tab sync via BroadcastChannel when Admin saves in iB - HSG Global
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('hsg_app_live_sync');
        bc.onmessage = () => {
          runFullSync();
        };
      } catch {}
    }

    // 4. Capture ?ref=CODE from query parameter if user arrived via referral link
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const refParam = urlParams.get('ref') || urlParams.get('referral');
        if (refParam && refParam.trim()) {
          saveReferralAttribution(refParam.trim());
        }
      } catch (e) {}
    }

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
    };
  }, []);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const EPOCH_KEY = 'hsg_auth_epoch_v5';
      if (localStorage.getItem(EPOCH_KEY) !== 'reset_zero_20261025') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('hsg_activities_') || k.startsWith('hsg_auth_') || k.startsWith('hsg_epoch_'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem('hsg_auth_phone');
        localStorage.removeItem('hsg_auth_user_id');
        localStorage.removeItem('hsg_auth_name');
        localStorage.removeItem('hsg_auth_paynow');
        localStorage.setItem(EPOCH_KEY, 'reset_zero_20261025');
        return false;
      }
      return Boolean((localStorage.getItem('hsg_auth_phone') ));
    } catch {
      return false;
    }
  });
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(
    null
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const openLoginModal = (onSuccessAction?: () => void) => {
    if (onSuccessAction) {
      setPendingAuthAction(() => onSuccessAction);
    }
    setShowLoginModal(true);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
  };

  const requireAuth = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      setPendingAuthAction(() => action);
      setShowLoginModal(true);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const activeCampaign = db.active_campaign_id
    ? db.cashback_campaigns.find((c) => c.id === db.active_campaign_id) || null
    : null;

  const setActiveCampaignId = (campaignId: string | null) => {
    setDb((prev) => ({
      ...prev,
      active_campaign_id: campaignId,
    }));
    if (!campaignId) {
      showToast('Cashback Campaign Closed ("Stay tuned" active)');
    } else {
      const found = db.cashback_campaigns.find((c) => c.id === campaignId);
      if (found) {
        showToast(`Active Cashback set to: ${found.product_name}`);
      }
    }
  };

  const loginWithWhatsApp = async (
    phoneInput?: string,
    nameInput?: string,
    liveUserObj?: UserAccount
  ) => {
    const cleanPhone = (phoneInput || '').replace(/\D/g, '');
    const finalName = nameInput || (cleanPhone ? `Member_${cleanPhone.slice(-4)}` : 'HSG Member');
    const assignedId = liveUserObj?.id || liveUserObj?.user_id || (localStorage.getItem('hsg_auth_user_id') ) || '';
    const userRecord: UserAccount = liveUserObj || {
      id: assignedId || undefined,
      user_id: assignedId || undefined,
      phone_number: cleanPhone,
      nickname: finalName,
      paynow: '',
      socials: { tt: '', fb: '', thread: '', ig: '' },
      wallet_balance: 0,
      weekly_streak: 1,
      is_online: true,
      last_active_timestamp: Date.now(),
      total_claims: 0,
      events_joined: 0,
    };

    setDb((prev) => ({
      ...prev,
      user: userRecord,
      users_list: prev.users_list.some((u) => u.phone_number === cleanPhone)
        ? prev.users_list.map((u) =>
            u.phone_number === cleanPhone ? userRecord : u
          )
        : [userRecord, ...prev.users_list],
    }));

    try {
      localStorage.setItem('hsg_auth_phone', cleanPhone);
      localStorage.setItem('hsg_auth_name', userRecord.nickname);
      if (userRecord.id) {
        localStorage.setItem('hsg_auth_user_id', userRecord.id);
      }
    } catch (e) {}

    setIsAuthenticated(true);
    setShowLoginModal(false);
    showToast(`Welcome, ${userRecord.nickname}!`);

    // Sync to live Supabase database
    try {
      const syncRes = await fetch(`${LIVE_WORKER_URL}/api/hsg-app/users/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userRecord),
      });
      if (syncRes.ok) {
        const sData = await syncRes.json();
        if (sData.user) {
          if (sData.user.id) localStorage.setItem('hsg_auth_user_id', sData.user.id);
          setDb((prev) => ({ ...prev, user: sData.user }));
        }
      }
    } catch (err) {
      console.warn('[LiveUsers] Sync user to Supabase error:', err);
    }

    // Auto-claim pending referral if member arrived with ?ref= link
    try {
      const pendingRef = sessionStorage.getItem('hsg_pending_referral_code');
      if (pendingRef && !userRecord.referred_by) {
        fetch(`${LIVE_WORKER_URL}/api/hsg-app/referral/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanPhone,
            referral_code: pendingRef,
          }),
        })
          .then((r) => r.json())
          .then((claimData) => {
            if (claimData.ok) {
              sessionStorage.removeItem('hsg_pending_referral_code');
              showToast(
                `🎉 Referral bonus credited! +$${Number(
                  claimData.reward?.referee_cashback || 0
                ).toFixed(2)} & +${claimData.reward?.referee_points || 0} pts`
              );
              syncLiveUsers();
            }
          })
          .catch(() => {});
      }
    } catch (e) {}

    if (pendingAuthAction) {
      const act = pendingAuthAction;
      setPendingAuthAction(null);
      window.setTimeout(() => {
        act();
      }, 100);
    }
  };

  // Auto-login if user tapped the "Log In to HSG+" button link in WhatsApp (?login_phone=... or ?auth_phone=...)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const autoPhone =
        urlParams.get('login_phone') ||
        urlParams.get('auth_phone') ||
        urlParams.get('phone');

      if (autoPhone && autoPhone.trim()) {
        const cleanP = autoPhone.replace(/\D/g, '');
        if (cleanP) {
          loginWithWhatsApp(cleanP);
          urlParams.delete('login_phone');
          urlParams.delete('auth_phone');
          urlParams.delete('phone');
          const newQuery = urlParams.toString();
          const newUrl = `${window.location.pathname}${
            newQuery ? `?${newQuery}` : ''
          }${window.location.hash}`;
          window.history.replaceState({}, '', newUrl);
        }
      }
    } catch (e) {}
  }, []);

  const logout = () => {
    try {
      localStorage.removeItem('hsg_auth_phone');
      localStorage.removeItem('hsg_auth_user_id');
      localStorage.removeItem('hsg_auth_name');
      localStorage.removeItem('hsg_auth_paynow');
      sessionStorage.removeItem('hsg_pending_referral_code');
    } catch (e) {}
    setDb((prev) => ({ ...prev, user: null }));
    setIsAuthenticated(false);
    showToast('Signed out of session');
  };

  const submitCashbackClaim = (payload: SubmitCashbackPayload) => {
    const normalizedInput = payload.raw_address.trim().toLowerCase();
    const matchedOutlet = db.outlet_mappings.find(
      (o) =>
        o.address.toLowerCase() === normalizedInput ||
        normalizedInput.includes(o.address.toLowerCase()) ||
        o.address.toLowerCase().includes(normalizedInput)
    );

    const matchedOutletId = matchedOutlet ? matchedOutlet.outlet_id : null;
    const matchedOutletName = matchedOutlet
      ? `${matchedOutlet.outlet_name} (${matchedOutlet.outlet_id})`
      : payload.raw_address;

    const isPointsCampaign = activeCampaign?.purchase_reward_mode === 'points';

    const newHistoryItem: CashbackHistoryItem = {
      id: 'HIST-' + Math.floor(10000 + Math.random() * 90000),
      type: 'cashback_credit',
      title: isPointsCampaign
        ? `Points Claim (Pending Verify): ${payload.items}`
        : `Cashback Claim (Pending Verify): ${payload.items}`,
      amount: isPointsCampaign ? 0 : payload.cashback_earned,
      status: 'pending',
      outlet_id: matchedOutletId || 'UNMAPPED-ADDR',
      outlet_name: matchedOutlet ? matchedOutlet.outlet_name : payload.raw_address,
      transaction_id: payload.transaction_id,
      timestamp: Date.now(),
    };

    const newClaimRecord: CashbackClaimRecord = {
      id: 'CLM-' + Math.floor(1000 + Math.random() * 9000),
      user_id: db.user?.id || (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') || '',
      campaign_id: activeCampaign?.id || 'CAMP-HSG',
      brand_name: activeCampaign?.brand_name || 'HSG+',
      product_name: payload.items,
      user_phone: db.user?.phone_number || '',
      user_nickname: db.user?.nickname || 'HSG Member',
      transaction_id: payload.transaction_id,
      raw_address: payload.raw_address,
      matched_outlet_id: matchedOutletId,
      matched_outlet_name: matchedOutlet
        ? matchedOutlet.outlet_name
        : payload.raw_address,
      qty: payload.qty,
      receipt_amount: payload.amount,
        total_purchase: payload.amount,
        total_qty: payload.qty,
        answers: payload.survey_answers,
      cashback_amount: payload.cashback_earned,
      cashier_task_qty: Number(payload.survey_answers.task_cashier_moving_qty || payload.survey_answers.task_1 || 10),
      task_answers: payload.survey_answers,
      receipt_photo_url: payload.receipt_photo_url || activeCampaign?.product_image_url || '/hsg-bottle.png',
      status: 'pending',
      timestamp: Date.now(),
    };

    const storeKey = matchedOutletId || payload.raw_address.trim() || 'STORE-NEW';

    // Submit live to Cloudflare Worker & Supabase (Live Cashback Integration)
    fetch(`${LIVE_WORKER_URL}/api/hsg-app/cashback/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: activeCampaign?.id || 'CAMP-HSG',
        user_id: db.user?.id || (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') || '',
        user_phone: db.user?.phone_number || '',
        user_nickname: db.user?.nickname || 'HSG Member',
        transaction_id: payload.transaction_id,
        raw_address: payload.raw_address,
        items: payload.items,
        qty: payload.qty,
        amount: payload.amount,
        cashback_earned: payload.cashback_earned,
        survey_answers: payload.survey_answers,
        receipt_photo_name: payload.receipt_photo_name,
        receipt_photo_url: payload.receipt_photo_url || '',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          console.log('[LiveCashback] Claim committed to Supabase:', data);
        }
      })
      .catch((err) => {
        console.warn('[LiveCashback] Submit error:', err);
      });

    setDb((prev) => ({
      ...prev,
      user: prev.user
        ? {
            ...prev.user,
            pending_balance: Number(
              ((prev.user.pending_balance || 0) + (isPointsCampaign ? 0 : payload.cashback_earned)).toFixed(2)
            ),
            pending_points: isPointsCampaign
              ? Math.round((prev.user.pending_points || 0) + payload.cashback_earned)
              : prev.user.pending_points,
          }
        : null,
      cashback_campaigns: prev.cashback_campaigns.map((camp) => {
        if (camp.id !== (activeCampaign?.id || 'CAMP-HSG')) return camp;
        const currentVisited = Array.isArray(camp.visited_store_ids)
          ? camp.visited_store_ids
          : [];
        const nextVisited = currentVisited.includes(storeKey)
          ? currentVisited
          : [...currentVisited, storeKey];
        return {
          ...camp,
          visited_store_ids: nextVisited,
        };
      }),
      history: [newHistoryItem, ...prev.history],
      cashback_claims: [newClaimRecord, ...prev.cashback_claims],
    }));

    showToast(
      isPointsCampaign
        ? `Receipt uploaded! +${payload.cashback_earned} pts pending verification.`
        : `Receipt uploaded! +$${payload.cashback_earned.toFixed(2)} cashback pending verification.`
    );

    return { matchedOutletId, matchedOutletName };
  };

  const adminRejectCashbackClaim = (claimId: string, reason: string) => {
    const target = db.cashback_claims.find(
      (c) => c.id === claimId && c.status === 'credited'
    );
    if (!target) return;

    const rejectEntry: CashbackHistoryItem = {
      id: 'HIST-REJ-' + Math.floor(1000 + Math.random() * 9000),
      type: 'cashback_rejected',
      title: `Receipt Rejected: ${target.product_name} (${target.transaction_id})`,
      amount: -Math.abs(target.cashback_amount),
      status: 'rejected',
      rejection_reason: reason,
      outlet_id: target.matched_outlet_id || 'UNMAPPED',
      outlet_name: target.matched_outlet_name,
      transaction_id: target.transaction_id,
      timestamp: Date.now(),
    };

    setDb((prev) => ({
      ...prev,
      user:
        prev.user && prev.user.phone_number === target.user_phone
          ? {
              ...prev.user,
              wallet_balance: Math.max(
                0,
                Number(
                  (prev.user.wallet_balance - target.cashback_amount).toFixed(2)
                )
              ),
            }
          : prev.user,
      cashback_claims: prev.cashback_claims.map((c) =>
        c.id === claimId
          ? { ...c, status: 'rejected' as const, rejection_reason: reason }
          : c
      ),
      history: [rejectEntry, ...prev.history],
    }));

    showToast(`Rejected claim ${claimId} and logged reason to user History`);
  };

  const adminSaveCashbackCampaign = (
    campaign: CashbackCampaign,
    setAsActive: boolean
  ) => {
    setDb((prev) => {
      const exists = prev.cashback_campaigns.some((c) => c.id === campaign.id);
      const nextList = exists
        ? prev.cashback_campaigns.map((c) => (c.id === campaign.id ? campaign : c))
        : [campaign, ...prev.cashback_campaigns];
      return {
        ...prev,
        cashback_campaigns: nextList,
        active_campaign_id: setAsActive ? campaign.id : prev.active_campaign_id,
      };
    });
    showToast(
      setAsActive
        ? `Cashback Campaign saved & set LIVE for ${campaign.product_name}`
        : `Cashback Campaign saved`
    );
  };

  const adminSaveContest = (contest: HsgContest) => {
    setDb((prev) => {
      const exists = prev.contests.some((c) => c.id === contest.id);
      return {
        ...prev,
        contests: exists
          ? prev.contests.map((c) => (c.id === contest.id ? contest : c))
          : [...prev.contests, contest],
      };
    });
    showToast(`Contest "${contest.title}" saved`);
  };

  const adminDeleteContest = (contestId: string) => {
    setDb((prev) => ({
      ...prev,
      contests: prev.contests.filter((c) => c.id !== contestId),
    }));
    showToast('Contest removed');
  };

  const adminAwardContestWinner = (submissionId: string, prizeLabel: string) => {
    const sub = db.contest_submissions.find((s) => s.id === submissionId);
    if (!sub) return;
    setDb((prev) => ({
      ...prev,
      contest_submissions: prev.contest_submissions.map((s) =>
        s.id === submissionId
          ? { ...s, status: 'winner' as const, prize_awarded: prizeLabel }
          : s
      ),
      rewards: [
        {
          id: 'REW-' + Math.floor(1000 + Math.random() * 9000),
          contest_title: sub.contest_title,
          reward_name: prizeLabel,
          worth_label: 'Winner Reward',
          claimed: false,
        },
        ...prev.rewards,
      ],
    }));
    showToast(`Awarded "${prizeLabel}" to ${sub.user_nickname}`);
  };

  const adminSaveHighlight = (item: PostHighlight) => {
    setDb((prev) => {
      const exists = prev.highlights.some((h) => h.id === item.id);
      return {
        ...prev,
        highlights: exists
          ? prev.highlights.map((h) => (h.id === item.id ? item : h))
          : [item, ...prev.highlights],
      };
    });
    showToast('Post Highlight saved');
  };

  const adminDeleteHighlight = (id: string) => {
    setDb((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((h) => h.id !== id),
    }));
    showToast('Post Highlight deleted');
  };

  const adminSaveEvent = (ev: HsgEvent) => {
    setDb((prev) => {
      const exists = prev.events.some((e) => e.id === ev.id);
      return {
        ...prev,
        events: exists
          ? prev.events.map((e) => (e.id === ev.id ? ev : e))
          : [ev, ...prev.events],
      };
    });
    showToast(`Event "${ev.title}" saved`);
  };

  const adminDeleteEvent = (id: string) => {
    setDb((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
    showToast('Event deleted');
  };

  const adminSaveMerch = (item: MerchItem) => {
    setDb((prev) => {
      const exists = prev.merch_catalog.some((m) => m.id === item.id);
      return {
        ...prev,
        merch_catalog: exists
          ? prev.merch_catalog.map((m) => (m.id === item.id ? item : m))
          : [item, ...prev.merch_catalog],
      };
    });
    showToast(`Merch "${item.name}" saved`);
  };

  const adminDeleteMerch = (id: string) => {
    setDb((prev) => ({
      ...prev,
      merch_catalog: prev.merch_catalog.filter((m) => m.id !== id),
    }));
    showToast('Merch item deleted');
  };

  const adminSaveAnnouncement = (ann: HsgAnnouncement) => {
    setDb((prev) => {
      const exists = prev.announcements.some((a) => a.id === ann.id);
      return {
        ...prev,
        announcements: exists
          ? prev.announcements.map((a) => (a.id === ann.id ? ann : a))
          : [ann, ...prev.announcements],
      };
    });
    showToast('Announcement published');
  };

  const adminDeleteAnnouncement = (id: string) => {
    setDb((prev) => ({
      ...prev,
      announcements: prev.announcements.filter((a) => a.id !== id),
    }));
    showToast('Announcement deleted');
  };

  const adminUpdateSettings = (updated: Partial<HsgSystemSettings>) => {
    setDb((prev) => {
      const nextSettings = { ...prev.settings, ...updated };
      fetch(`${LIVE_WORKER_URL}/api/hsg-app/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_withdrawal_amount: nextSettings.min_withdrawal_amount,
          require_points_for_withdrawal: nextSettings.require_points_for_withdrawal,
          min_points_to_unlock_withdrawal: nextSettings.min_points_to_unlock_withdrawal,
          withdrawal_sla_text: nextSettings.withdrawal_sla_text,
          delivery_fee: nextSettings.delivery_fee,
          whatsapp_bot_phone: nextSettings.whatsapp_bot_number,
          theme_color_1: nextSettings.theme_color_1 || '#FFEA00',
          theme_color_2: nextSettings.theme_color_2 || '#EC008C',
        }),
      }).catch(() => {});
      return {
        ...prev,
        settings: nextSettings,
      };
    });
    showToast('System settings updated');
  };

  const requestWithdrawal = (amount: number) => {
    if (!isAuthenticated) {
      requireAuth(() => requestWithdrawal(amount));
      return { ok: false, message: 'Please sign in with WhatsApp first.' };
    }
    if (!db.user) return { ok: false, message: 'Please log in first.' };

    if (db.user.is_blocked) {
      const msg = 'Your account is restricted from requesting withdrawals.';
      showToast(msg);
      return { ok: false, message: msg };
    }

    const requireRules = db.settings.require_points_for_withdrawal !== false;
    const minPts = Number(db.settings.min_points_to_unlock_withdrawal ?? 100);
    const userPts = Number(db.user.points_balance || 0);

    const minInvites = Number(db.settings.min_invites_to_unlock_withdrawal ?? 3);
    const userInvites = Math.max(
      Number(db.user.referral_count || 0),
      (db.transactions || []).filter(
        (tx) => tx.type === 'referral' || (tx.title || '').toLowerCase().includes('referral')
      ).length
    );

    const minEvents = Number(db.settings.min_events_to_unlock_withdrawal ?? 3);
    const userEvents = Math.max(
      Number(db.user.events_joined || 0),
      db.events.filter(
        (ev) =>
          ev.user_status === 'joined' ||
          ev.user_status === 'checked_in'
      ).length,
      (db.transactions || []).filter(
        (tx) =>
          tx.type === 'event_rsvp' ||
          (tx.title || '').toLowerCase().includes('event rsvp')
      ).length
    );

    if (requireRules) {
      if (userPts < minPts) {
        const msg = `Need ${minPts} pts to unlock withdrawal (current: ${userPts}/${minPts} pts).`;
        showToast(msg);
        return { ok: false, message: msg };
      }
      if (userInvites < minInvites) {
        const msg = `Need to invite ${minInvites} people to unlock withdrawal (current: ${userInvites}/${minInvites} invited).`;
        showToast(msg);
        return { ok: false, message: msg };
      }
      if (userEvents < minEvents) {
        const msg = `Need to join ${minEvents} events to unlock withdrawal (current: ${userEvents}/${minEvents} joined).`;
        showToast(msg);
        return { ok: false, message: msg };
      }
    }

    if (amount < db.settings.min_withdrawal_amount) {
      const msg = `Minimum withdrawal is $${db.settings.min_withdrawal_amount.toFixed(2)}.`;
      showToast(msg);
      return { ok: false, message: msg };
    }
    if (amount > db.user.wallet_balance) {
      const pendingAmt = Number(db.user.pending_balance || 0);
      const msg =
        pendingAmt > 0
          ? `Insufficient available balance ($${db.user.wallet_balance.toFixed(2)}). You have $${pendingAmt.toFixed(2)} pending admin receipt verification.`
          : 'Insufficient cashback balance.';
      showToast(msg);
      return { ok: false, message: msg };
    }
    if (!db.user.paynow.trim()) {
      const msg = 'Please set your PayNow number in Account details.';
      showToast(msg);
      return { ok: false, message: msg };
    }

    const withdrawalRecord: CashbackHistoryItem = {
      id: 'WD-' + Math.floor(10000 + Math.random() * 90000),
      type: 'withdrawal',
      title: `PayNow Withdrawal (${db.user.paynow}) — Manual Transfer within ${db.settings.withdrawal_sla_text}`,
      amount: -Number(amount.toFixed(2)),
      status: 'pending_payout',
      timestamp: Date.now(),
    };

    fetch(`${LIVE_WORKER_URL}/api/hsg-app/cashback/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: db.user.id || (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') || '',
        user_phone: db.user.phone_number,
        user_nickname: db.user.nickname,
        paynow_number: db.user.paynow,
        amount: Number(amount.toFixed(2)),
      }),
    }).catch((err) => console.warn('[LiveCashback] Withdrawal error:', err));

    setDb((prev) => ({
      ...prev,
      user: prev.user
        ? {
            ...prev.user,
            wallet_balance: Number((prev.user.wallet_balance - amount).toFixed(2)),
          }
        : null,
      history: [withdrawalRecord, ...prev.history],
    }));

    const msg = `Withdrawal of $${amount.toFixed(2)} submitted. Admin transfers within ${db.settings.withdrawal_sla_text}.`;
    showToast(msg);
    return { ok: true, message: msg };
  };

  const redeemMerch = (
    merchId: string,
    fulfillment: 'collect' | 'delivery',
    paymentCurrency: 'cashback' | 'points' = 'points'
  ) => {
    if (!isAuthenticated) {
      requireAuth(() => redeemMerch(merchId, fulfillment, paymentCurrency));
      return { ok: false, message: 'Please sign in with WhatsApp first.' };
    }
    if (!db.user) return { ok: false, message: 'Please log in first.' };
    const item = db.merch_catalog.find((m) => m.id === merchId);
    if (!item) return { ok: false, message: 'Product item not found.' };

    const fee = fulfillment === 'delivery' ? db.settings.delivery_fee : 0;

    if (paymentCurrency === 'points') {
      const ptsRequired = Number(
        item.price_points ?? Math.round(item.price * 10)
      );
      const userPts = Number(db.user.points_balance || 0);
      if (userPts < ptsRequired) {
        const msg = `Need ${ptsRequired} pts to redeem ${item.name} (you have ${userPts} pts).`;
        showToast(msg);
        return { ok: false, message: msg };
      }
      if (fee > 0 && db.user.wallet_balance < fee) {
        const msg = `Need $${fee.toFixed(2)} cashback balance for Delivery fee (or choose Collect Free).`;
        showToast(msg);
        return { ok: false, message: msg };
      }

      const nextPts = Math.max(0, userPts - ptsRequired);
      const nextWallet = Number((db.user.wallet_balance - fee).toFixed(2));

      const redeemRecord: CashbackHistoryItem = {
        id: 'MERCH-' + Math.floor(10000 + Math.random() * 90000),
        type: 'merch_redeem',
        title: `Redeemed (${ptsRequired} pts): ${item.name} (${fulfillment === 'delivery' ? `Delivery +$${fee}` : 'Self-Collect Free'})`,
        amount: fee > 0 ? -Number(fee.toFixed(2)) : 0,
        status: 'completed',
        fulfillment_mode: fulfillment,
        timestamp: Date.now(),
      };

      const updatedUser = {
        ...db.user,
        wallet_balance: nextWallet,
        points_balance: nextPts,
      };

      setDb((prev) => ({
        ...prev,
        user: updatedUser,
        history: [redeemRecord, ...prev.history],
      }));

      fetch(`${LIVE_WORKER_URL}/api/hsg-app/users/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      }).catch(() => {});

      const msg = `Redeemed ${item.name} using ${ptsRequired} pts!`;
      showToast(msg);
      return { ok: true, message: msg };
    }

    const totalCost = item.price + fee;
    if (db.user.wallet_balance < totalCost) {
      const msg = `Need $${totalCost.toFixed(2)} (${fulfillment === 'delivery' ? `includes $${fee} delivery fee` : 'self-collect'}). Your balance is $${db.user.wallet_balance.toFixed(2)}.`;
      showToast(msg);
      return { ok: false, message: msg };
    }

    const nextWallet = Number((db.user.wallet_balance - totalCost).toFixed(2));
    const updatedUser = {
      ...db.user,
      wallet_balance: nextWallet,
    };

    const redeemRecord: CashbackHistoryItem = {
      id: 'MERCH-' + Math.floor(10000 + Math.random() * 90000),
      type: 'merch_redeem',
      title: `Redeemed: ${item.name} (${fulfillment === 'delivery' ? `Delivery +$${fee}` : 'Self-Collect Free'})`,
      amount: -Number(totalCost.toFixed(2)),
      status: 'completed',
      fulfillment_mode: fulfillment,
      timestamp: Date.now(),
    };

    setDb((prev) => ({
      ...prev,
      user: updatedUser,
      history: [redeemRecord, ...prev.history],
    }));

    fetch(`${LIVE_WORKER_URL}/api/hsg-app/users/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch(() => {});

    const msg = `Redeemed ${item.name} via ${fulfillment === 'delivery' ? 'Delivery' : 'Self-Collect'}!`;
    showToast(msg);
    return { ok: true, message: msg };
  };

  const checkoutRedeemCart = (payload: {
    items: Array<{
      merchId: string;
      qty: number;
      payWith: 'points' | 'cashback';
    }>;
    fulfillment: 'collect' | 'delivery';
    deliveryAddress?: string;
  }) => {
    if (!isAuthenticated) {
      requireAuth(() => checkoutRedeemCart(payload));
      return { ok: false, message: 'Please sign in with WhatsApp first.' };
    }
    if (!db.user) return { ok: false, message: 'Please log in first.' };

    if (db.user.is_blocked) {
      const msg = 'Your account is restricted from redeeming rewards or using cashback and points.';
      showToast(msg);
      return { ok: false, message: msg };
    }
    if (!payload.items || payload.items.length === 0) {
      return { ok: false, message: 'Your cart is empty.' };
    }

    if (
      payload.fulfillment === 'delivery' &&
      !(payload.deliveryAddress || db.user.address || '').trim()
    ) {
      const msg = 'Please enter your delivery address to confirm.';
      showToast(msg);
      return { ok: false, message: msg };
    }

    let totalPointsRequired = 0;
    let totalCashRequired =
      payload.fulfillment === 'delivery' ? Number(db.settings.delivery_fee || 0) : 0;
    const summaryLabels: string[] = [];

    for (const row of payload.items) {
      const item = db.merch_catalog.find((m) => m.id === row.merchId);
      if (!item || row.qty <= 0) continue;
      const mode = item.redeem_mode || 'both';
      const actualPayWith: 'points' | 'cashback' =
        mode === 'points_only'
          ? 'points'
          : mode === 'cashback_only'
          ? 'cashback'
          : row.payWith;
      const ptsPrice = Number(
        item.price_points ?? Math.round(item.price * 10)
      );

      if (actualPayWith === 'points') {
        totalPointsRequired += ptsPrice * row.qty;
      } else {
        totalCashRequired += item.price * row.qty;
      }
      summaryLabels.push(`${item.name} ×${row.qty}`);
    }

    const userPts = Number(db.user.points_balance || 0);
    const userCash = Number(db.user.wallet_balance || 0);

    if (totalPointsRequired > userPts) {
      const msg = `Insufficient point balance (need ${totalPointsRequired} pts, have ${userPts} pts).`;
      showToast(msg);
      return { ok: false, message: msg };
    }

    if (totalCashRequired > userCash) {
      const pendingAmt = Number(db.user.pending_balance || 0);
      const msg =
        pendingAmt > 0
          ? `Insufficient available balance ($${userCash.toFixed(2)}). You have $${pendingAmt.toFixed(2)} pending admin receipt verification.`
          : `Insufficient cashback balance (need $${totalCashRequired.toFixed(2)}, have $${userCash.toFixed(2)}).`;
      showToast(msg);
      return { ok: false, message: msg };
    }

    const nextPts = Math.max(0, userPts - totalPointsRequired);
    const nextCash = Number(Math.max(0, userCash - totalCashRequired).toFixed(2));
    const confirmedAddress =
      payload.fulfillment === 'delivery'
        ? (payload.deliveryAddress || db.user.address || '').trim()
        : db.user.address;

    const updatedUser: UserAccount = {
      ...db.user,
      wallet_balance: nextCash,
      points_balance: nextPts,
      address: confirmedAddress,
    };

    const paymentParts: string[] = [];
    if (totalPointsRequired > 0) paymentParts.push(`${totalPointsRequired} pts`);
    if (totalCashRequired > 0)
      paymentParts.push(`$${totalCashRequired.toFixed(2)}`);

    const redeemRecord: CashbackHistoryItem = {
      id: 'MERCH-' + Math.floor(10000 + Math.random() * 90000),
      type: 'merch_redeem',
      title: `Redeemed (${paymentParts.join(' + ')}): ${summaryLabels.join(', ')} (${
        payload.fulfillment === 'delivery'
          ? `Delivery to ${confirmedAddress}`
          : `Self-Pickup at ${db.settings.self_collect_address || 'HSG Global HQ'}`
      })`,
      amount: -Number(totalCashRequired.toFixed(2)),
      status: 'completed',
      fulfillment_mode: payload.fulfillment,
      timestamp: Date.now(),
    };

    setDb((prev) => ({
      ...prev,
      user: updatedUser,
      users_list: prev.users_list.map((u) =>
        u.phone_number === updatedUser.phone_number ? updatedUser : u
      ),
      history: [redeemRecord, ...prev.history],
    }));

    fetch(`${LIVE_WORKER_URL}/api/hsg-app/users/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch(() => {});

    const msg = `Redemption confirmed! (${summaryLabels.join(', ')})`;
    showToast(msg);
    return { ok: true, message: msg };
  };

  const updateAccountProfile = async (updated: Partial<UserAccount>) => {
    if (!db.user) return;
    const resolvedPaynow = updated.paynow !== undefined
      ? updated.paynow
      : (updated.paynow_number !== undefined ? updated.paynow_number : (db.user.paynow || db.user.paynow_number || ''));

    const nextUser: UserAccount = {
      ...db.user,
      ...updated,
      paynow: resolvedPaynow,
      paynow_number: resolvedPaynow,
    };
    if (resolvedPaynow) {
      try { localStorage.setItem('hsg_auth_paynow', resolvedPaynow); } catch {}
    }
    setDb((prev) => {
      return {
        ...prev,
        user: nextUser,
        users_list: prev.users_list.map((u) =>
          u.phone_number === prev.user?.phone_number ? nextUser : u
        ),
      };
    });
    showToast('Account profile saved');

    try {
      const payload = {
        ...nextUser,
        paynow: resolvedPaynow,
        paynow_number: resolvedPaynow,
        id: nextUser.id || (localStorage.getItem('hsg_auth_user_id') ) || undefined,
        user_id: nextUser.id || (localStorage.getItem('hsg_auth_user_id') ) || undefined,
        actor: 'User in HSG+ App',
      };
      await fetch(`${LIVE_WORKER_URL}/api/hsg-app/users/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('[LiveUsers] Failed to update profile in Supabase:', err);
    }
  };

  const rsvpEvent = async (
    eventId: string,
    status: 'joined' | 'skipped',
    payMethod: 'cashback' | 'points' | 'free' = 'free'
  ): Promise<{ ok: boolean; message: string }> => {
    if (!isAuthenticated || !db.user) {
      requireAuth(() => rsvpEvent(eventId, status, payMethod));
      return { ok: false, message: 'Please sign in first.' };
    }
    const target = db.events.find((e) => e.id === eventId);
    if (!target) return { ok: false, message: 'Event not found.' };

    try {
      const res = await fetch(`${LIVE_WORKER_URL}/api/hsg-app/events/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          user_id: db.user.id || (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') || '',
          user_phone: db.user.phone_number,
          status,
          pay_method: payMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const errMsg = data.error || 'Failed to update event RSVP.';
        showToast(`⚠️ ${errMsg}`);
        return { ok: false, message: errMsg };
      }

      // Update local state
      setDb((prev) => {
        const nextUser = data.user
          ? {
              ...prev.user!,
              wallet_balance: Number(
                data.user.wallet_balance ?? prev.user!.wallet_balance
              ),
              points_balance: Number(
                data.user.points_balance ?? prev.user!.points_balance ?? 0
              ),
            }
          : prev.user;

        let nextHistory = prev.history;
        if (status === 'joined') {
          const feePaid =
            payMethod === 'cashback' && target.fee_amount > 0
              ? -Number(target.fee_amount.toFixed(2))
              : 0;
          const feeLabel =
            payMethod === 'cashback' && target.fee_amount > 0
              ? `-$${target.fee_amount.toFixed(2)} Cashback`
              : payMethod === 'points' && (target.fee_points || 0) > 0
              ? `-${target.fee_points} pts`
              : 'Free Entry';

          nextHistory = [
            {
              id: 'EVT-' + Math.floor(10000 + Math.random() * 90000),
              type: 'event_rsvp',
              title: `Event RSVP (${feeLabel}): ${target.title}`,
              amount: feePaid,
              status: 'completed',
              timestamp: Date.now(),
            },
            ...prev.history,
          ];
        }

        return {
          ...prev,
          user: nextUser,
          history: nextHistory,
          events: prev.events.map((ev) => {
            if (ev.id !== eventId) return ev;
            const wasJoined =
              ev.user_status === 'joined' || ev.user_status === 'checked_in';
            const nextCount =
              status === 'joined' && !wasJoined
                ? ev.joined_count + 1
                : status === 'skipped' && wasJoined
                ? Math.max(0, ev.joined_count - 1)
                : ev.joined_count;
            return {
              ...ev,
              user_status: status,
              joined_count: nextCount,
            };
          }),
        };
      });

      const successMsg =
        status === 'joined'
          ? '🎉 RSVP confirmed! Check-in QR is ready.'
          : 'Event marked as skipped.';
      showToast(successMsg);
      return { ok: true, message: successMsg };
    } catch (err: any) {
      const errMsg = err?.message || 'Network error updating RSVP.';
      showToast(`⚠️ ${errMsg}`);
      return { ok: false, message: errMsg };
    }
  };

  const checkInEvent = async (
    eventId: string,
    scannedCode?: string
  ): Promise<{ ok: boolean; message: string; reward_points?: number; already_checked_in?: boolean }> => {
    if (!isAuthenticated || !db.user) {
      requireAuth(() => checkInEvent(eventId, scannedCode));
      return { ok: false, message: 'Please sign in first.' };
    }
    const target = db.events.find((e) => e.id === eventId);
    try {
      const res = await fetch(`${LIVE_WORKER_URL}/api/hsg-app/events/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          user_phone: db.user.phone_number,
          scanned_code: scannedCode || eventId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const errMsg =
          data.error || 'Check-in failed. Please scan a valid event QR code.';
        showToast(`⚠️ ${errMsg}`);
        return { ok: false, message: errMsg };
      }

      const rewardPts = Number(data.reward_points || 0);

      setDb((prev) => {
        const nextUser = prev.user
          ? {
              ...prev.user,
              events_joined: (prev.user.events_joined || 0) + 1,
              points_balance: (prev.user.points_balance || 0) + rewardPts,
            }
          : prev.user;

        return {
          ...prev,
          user: nextUser,
          events: prev.events.map((ev) =>
            ev.id === eventId ? { ...ev, user_status: 'checked_in' } : ev
          ),
          history: [
            {
              id: 'EVT-CHK-' + Math.floor(1000 + Math.random() * 9000),
              type: 'event_rsvp',
              title: `Event Checked-In: ${target ? target.title : eventId}`,
              amount: 0,
              status: 'completed',
              timestamp: Date.now(),
            },
            ...(rewardPts > 0
              ? [
                  {
                    id: 'EVT-PTS-' + Math.floor(1000 + Math.random() * 9000),
                    type: 'event_rsvp' as const,
                    title: `Check-In Reward (+${rewardPts} pts): ${target ? target.title : eventId}`,
                    amount: rewardPts,
                    status: 'completed' as const,
                    timestamp: Date.now(),
                  },
                ]
              : []),
            ...prev.history,
          ],
        };
      });

      const msg = rewardPts > 0
        ? `🎉 Checked in! +${rewardPts} pts rewarded!`
        : '🎉 Event Check-In verified in database!';
      showToast(msg);
      return {
        ok: true,
        message: msg,
        reward_points: rewardPts,
        already_checked_in: Boolean(data.already_checked_in),
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Network error during check-in.';
      showToast(`⚠️ ${errMsg}`);
      return { ok: false, message: errMsg };
    }
  };

  const submitContestEntry = (
    answers: Record<string, string | number>,
    photoName?: string,
    contestId?: string
  ) => {
    if (!isAuthenticated) {
      requireAuth(() => submitContestEntry(answers, photoName, contestId));
      return;
    }
    const targetContest =
      db.contests.find((c) => c.id === contestId) || db.contests[0];
    const ptsEarned = Number(
      targetContest?.submission_limits?.points_per_submission || 0
    );
    if (targetContest) {
      const subId = 'CSUB-' + Date.now();
      const userPhone = db.user?.phone_number || (localStorage.getItem('hsg_auth_phone') ) || '';
      const userNick = db.user?.nickname || (localStorage.getItem('hsg_auth_name') ) || 'HSG Member';

      fetch(`${LIVE_WORKER_URL}/api/hsg-app/contests/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: subId,
          contest_id: targetContest.id,
          user_id: db.user?.id || (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') || '',
          user_phone: userPhone,
          user_nickname: userNick,
          answer_json: answers,
        }),
      })
        .then(() => {
          syncLiveCashback();
          syncLiveUsers();
        })
        .catch((err) => console.warn('[LiveContest] Submit error:', err));

      setDb((prev) => ({
        ...prev,
        user:
          prev.user && ptsEarned > 0
            ? {
                ...prev.user,
                points_balance: Math.round(
                  Number(prev.user.points_balance || 0) + ptsEarned
                ),
              }
            : prev.user,
        history:
          ptsEarned > 0
            ? [
                {
                  id: 'HIST-CT-' + Date.now(),
                  type: 'cashback_credit',
                  title: `Contest Entry: ${targetContest.title} — +${ptsEarned} pts`,
                  amount: 0,
                  status: 'credited',
                  timestamp: Date.now(),
                },
                ...prev.history,
              ]
            : prev.history,
        contest_submissions: [
          {
            id: subId,
            contest_id: targetContest.id,
            contest_title: targetContest.title,
            user_phone: userPhone,
            user_nickname: userNick,
            photo_name: photoName || '',
            answer_json: answers,
            answers_json: answers,
            status: 'submitted',
            created_at: Date.now(),
            timestamp: Date.now(),
          },
          ...prev.contest_submissions,
        ],
      }));
    }
    showToast(
      ptsEarned > 0
        ? `Contest entry submitted! +${ptsEarned} pts earned!`
        : 'Contest entry submitted! Good luck!'
    );
  };

  const claimReward = (rewardId: string, method: 'collect' | 'delivery') => {
    if (!isAuthenticated) {
      requireAuth(() => claimReward(rewardId, method));
      return;
    }
    setDb((prev) => ({
      ...prev,
      rewards: prev.rewards.map((r) =>
        r.id === rewardId ? { ...r, claimed: true, claim_method: method } : r
      ),
    }));
    showToast(
      `Reward claimed (${method === 'delivery' ? `Delivery +$${db.settings.delivery_fee}` : 'Self-Collect'})!`
    );
  };

  const claimReferralCode = async (
    code: string
  ): Promise<{ ok: boolean; message: string; referrer_name?: string }> => {
    if (!isAuthenticated || !db.user) {
      return { ok: false, message: 'Please log in first.' };
    }
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { ok: false, message: 'Please enter a valid referral code.' };
    }
    try {
      const res = await fetch(`${LIVE_WORKER_URL}/api/hsg-app/referral/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: db.user.id || (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') || '',
          phone: db.user.phone_number,
          referral_code: cleanCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const errMsg =
          data.error || data.message || 'Failed to claim referral code.';
        showToast(`⚠️ ${errMsg}`);
        return { ok: false, message: errMsg };
      }

      setDb((prev) => {
        if (!prev.user) return prev;
        const updated = {
          ...prev.user,
          wallet_balance: Number(
            data.referee?.wallet_balance ?? prev.user.wallet_balance
          ),
          points_balance: Number(
            data.referee?.points_balance ?? prev.user.points_balance ?? 0
          ),
          referred_by: cleanCode,
        };
        const bonusCash = Number(data.reward?.referee_cashback || 0);
        const bonusPts = Number(data.reward?.referee_points || 0);
        const refHist: CashbackHistoryItem = {
          id: 'REF-' + Math.floor(10000 + Math.random() * 90000),
          type: 'cashback_credit',
          title: `Welcome Bonus (Referral Code ${cleanCode} • +${bonusPts} pts)`,
          amount: bonusCash,
          status: 'credited',
          timestamp: Date.now(),
        };
        return {
          ...prev,
          user: updated,
          history: [refHist, ...prev.history],
          users_list: prev.users_list.map((u) =>
            u.phone_number === updated.phone_number ? updated : u
          ),
        };
      });

      try {
        clearPendingReferralCode();
      } catch (e) {}

      showToast(
        `🎉 Referral bonus claimed! +$${Number(
          data.reward?.referee_cashback || 0
        ).toFixed(2)} & +${data.reward?.referee_points || 0} pts`
      );
      syncLiveUsers();
      return {
        ok: true,
        message: data.message || 'Referral applied!',
        referrer_name: data.referrer?.nickname,
      };
    } catch (e: any) {
      const msg = e?.message || 'Network error applying referral code.';
      showToast(`⚠️ ${msg}`);
      return { ok: false, message: msg };
    }
  };

  const refreshLiveUsers = async () => {
    await syncLiveUsers();
  };

  return (
    <HsgDataContext.Provider
      value={{
        db,
        activeCampaign,
        setActiveCampaignId,
        isAuthenticated,
        showLoginModal,
        openLoginModal,
        closeLoginModal,
        requireAuth,
        loginWithWhatsApp,
        logout,
        refreshLiveUsers,
        submitCashbackClaim,
        adminRejectCashbackClaim,
        adminSaveCashbackCampaign,
        adminSaveContest,
        adminDeleteContest,
        adminAwardContestWinner,
        adminSaveHighlight,
        adminDeleteHighlight,
        adminSaveEvent,
        adminDeleteEvent,
        adminSaveMerch,
        adminDeleteMerch,
        adminSaveAnnouncement,
        adminDeleteAnnouncement,
        adminUpdateSettings,
        requestWithdrawal,
        redeemMerch,
        checkoutRedeemCart,
        updateAccountProfile,
        rsvpEvent,
        checkInEvent,
        submitContestEntry,
        claimReward,
        claimReferralCode,
        refreshTransactions: syncLiveTransactions,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </HsgDataContext.Provider>
  );
};

export const useHsgData = () => {
  const ctx = useContext(HsgDataContext);
  if (!ctx) throw new Error('useHsgData must be used inside HsgDataProvider');
  return ctx;
};
