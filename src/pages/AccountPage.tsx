import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Gift,
  LogOut,
  Receipt,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { HsgLogo } from '../components/HsgLogo';

interface AccountPageProps {
  onBack: () => void;
  onOpenRedeemShop: () => void;
  onOpenInvite: () => void;
  onOpenTransactions?: (initialTab?: 'cashback' | 'points') => void;
}

interface ActivityItem {
  id: string;
  category: 'Receipt Claim' | 'Profile & Settings' | 'Withdrawal' | 'Reward' | 'Account' | 'Order';
  title: string;
  description: string;
  timestamp: number;
  badge?: {
    label: string;
    variant: 'amber' | 'emerald' | 'rose' | 'blue' | 'zinc';
  };
  iconType: 'receipt' | 'settings' | 'wallet' | 'gift' | 'shield' | 'check' | 'alert' | 'order';
}

export const AccountPage: React.FC<AccountPageProps> = ({
  onBack,
  onOpenRedeemShop,
  onOpenInvite,
  onOpenTransactions,
}) => {
  const {
    db,
    updateAccountProfile,
    requestWithdrawal,
    logout,
    isAuthenticated,
    openLoginModal,
  } = useHsgData();

  const [activeSubTab, setActiveSubTab] = useState<
    'activity' | 'account' | 'achievement'
  >('activity');
  const [walletActionTab, setWalletActionTab] = useState<'withdraw' | null>(
    null
  );

  const MOCK_AVAILABLE_CASH = 55.0;
  const MOCK_TOTAL_CASH = 88.9;
  const MOCK_AVAILABLE_PTS = 50;
  const MOCK_TOTAL_PTS = 50;

  const availableCash = isAuthenticated && db.user
    ? Number(db.user.wallet_balance || 0)
    : MOCK_AVAILABLE_CASH;

  // Always include pending verify transactions in total amount
  const pendingCashFromTxs = (db.transactions || [])
    .filter((tx) => tx.status === 'pending')
    .reduce((sum, tx) => {
      const amt = Number(
        tx.amount_cashback ?? tx.net_cashback ?? tx.cashback_amount ?? tx.amount ?? 0
      );
      return sum + (amt > 0 ? amt : 0);
    }, 0);

  const pendingCash = isAuthenticated && db.user
    ? Math.max(
        Number(db.user?.pending_balance || 0),
        Number(pendingCashFromTxs.toFixed(2))
      )
    : Number((MOCK_TOTAL_CASH - MOCK_AVAILABLE_CASH).toFixed(2));

  const totalCash = isAuthenticated && db.user
    ? Number((availableCash + pendingCash).toFixed(2))
    : MOCK_TOTAL_CASH;

  const availablePts = isAuthenticated && db.user
    ? Number(db.user?.points_balance || 0)
    : MOCK_AVAILABLE_PTS;

  const pendingPtsFromTxs = (db.transactions || [])
    .filter((tx) => tx.status === 'pending')
    .reduce((sum, tx) => {
      const pts = Number(
        tx.amount_points ?? tx.net_points ?? tx.points ?? 0
      );
      return sum + (pts > 0 ? pts : 0);
    }, 0);

  const pendingPts = isAuthenticated && db.user
    ? Math.max(
        Number(db.user?.pending_points || 0),
        pendingPtsFromTxs
      )
    : 0;

  const totalPts = isAuthenticated && db.user
    ? availablePts + pendingPts
    : MOCK_TOTAL_PTS;

  // Account fields (Phone Number PK, Nickname, PayNow, Social Usernames, Privacy)
  const [nickname, setNickname] = useState(db.user?.nickname || '');
  const [paynow, setPaynow] = useState(
    db.user?.paynow ||
    (db.user as any)?.paynow_number ||
    (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_paynow') || '' : '')
  );
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.user?.privacy_mode ?? db.user?.privacy?.mode ?? true);
  const [tt, setTt] = useState(db.user?.socials?.tt || '');
  const [fb, setFb] = useState(db.user?.socials?.fb || '');
  const [thread, setThread] = useState(db.user?.socials?.thread || '');
  const [ig, setIg] = useState(db.user?.socials?.ig || '');

  // Track if user has touched/edited form inputs to prevent background 15s sync from wiping typing
  const isEditingRef = useRef(false);
  const hasLoadedUserRef = useRef<string | null>(null);

  // Only auto-fill from db.user on initial login/mount; NEVER overwrite while user is editing
  useEffect(() => {
    if (db.user) {
      const userKey = db.user.id || db.user.phone_number || 'loaded';
      if (hasLoadedUserRef.current !== userKey && !isEditingRef.current) {
        hasLoadedUserRef.current = userKey;
        if (db.user.nickname) setNickname(db.user.nickname);
        const uPn = db.user.paynow || (db.user as any)?.paynow_number || '';
        if (uPn && uPn.length !== 64 && !uPn.startsWith('...')) {
          setPaynow(uPn);
        }
        if (db.user.privacy_mode !== undefined) {
          setPrivacyMode(db.user.privacy_mode);
        } else if (db.user.privacy?.mode !== undefined) {
          setPrivacyMode(db.user.privacy.mode);
        }
        if (db.user.socials?.tt) setTt(db.user.socials.tt);
        if (db.user.socials?.fb) setFb(db.user.socials.fb);
        if (db.user.socials?.thread) setThread(db.user.socials.thread);
        if (db.user.socials?.ig) setIg(db.user.socials.ig);
      }
    }
  }, [db.user]);

  // Activity items state from live database and current session (no stale localStorage caching)
  const [localActivities, setLocalActivities] = useState<ActivityItem[]>([]);

  const saveCustomActivity = (act: ActivityItem) => {
    setLocalActivities((prev) => [act, ...prev.filter((item) => item.id !== act.id)].slice(0, 50));
  };

  // Compile full activity feed
  const allActivities = useMemo<ActivityItem[]>(() => {
    const list: ActivityItem[] = [...localActivities];

    // If guest / not logged in, include attractive sample activity entries matching teaser wallet balances
    if (!isAuthenticated) {
      list.push(
        {
          id: 'mock-claim-approved',
          category: 'Receipt Claim',
          title: 'Receipt Claim #SS8890 Approved',
          description: 'Cashback +$55.00 verified and credited to available wallet balance.',
          timestamp: Date.now() - 3600000 * 3,
          badge: { label: 'Verified', variant: 'emerald' },
          iconType: 'check',
        },
        {
          id: 'mock-claim-pending',
          category: 'Receipt Claim',
          title: 'Receipt Claim #SS3390 Submitted',
          description: 'Receipt uploaded for verification (Est. +$33.90 cashback).',
          timestamp: Date.now() - 3600000 * 12,
          badge: { label: 'Pending Verify', variant: 'amber' },
          iconType: 'receipt',
        },
        {
          id: 'mock-welcome',
          category: 'Account',
          title: 'Welcome Bonus Credited',
          description: 'Welcome to HSG+ Community! Log in with WhatsApp to access full wallet features.',
          timestamp: Date.now() - 86400000 * 2,
          badge: { label: 'Reward', variant: 'blue' },
          iconType: 'shield',
        }
      );
    }

    // 1. Claims activity (submitted, approved, rejected)
    (db.cashback_claims || []).forEach((c) => {
      const claimAmt = Number(c.cashback_amount ?? c.receipt_amount ?? 0);
      const isApproved = c.status === 'approved' || c.status === 'credited';
      const isRejected = c.status === 'rejected';

      if (isApproved) {
        list.push({
          id: `claim-approved-${c.id}`,
          category: 'Receipt Claim',
          title: `Receipt Claim #${c.id.slice(-6).toUpperCase()} Approved`,
          description: `Cashback +${claimAmt.toFixed(2)} verified and credited to wallet balance.`,
          timestamp: Number(c.timestamp || Date.now() - 3600000),
          badge: { label: 'Verified', variant: 'emerald' },
          iconType: 'check',
        });
      } else if (isRejected) {
        list.push({
          id: `claim-rejected-${c.id}`,
          category: 'Receipt Claim',
          title: `Receipt Claim #${c.id.slice(-6).toUpperCase()} Declined`,
          description: c.rejection_reason || 'Receipt could not be verified. Please check retail receipt clarity.',
          timestamp: Number(c.timestamp || Date.now() - 3600000),
          badge: { label: 'Declined', variant: 'rose' },
          iconType: 'alert',
        });
      } else {
        list.push({
          id: `claim-pending-${c.id}`,
          category: 'Receipt Claim',
          title: `Receipt Claim #${c.id.slice(-6).toUpperCase()} Submitted`,
          description: `Receipt uploaded for verification (Est. +${claimAmt.toFixed(2)} cashback).`,
          timestamp: Number(c.timestamp || Date.now() - 7200000),
          badge: { label: 'Pending Verify', variant: 'amber' },
          iconType: 'receipt',
        });
      }
    });

    // 2. Transactions activity (withdrawals, shop redemptions, referral bonuses)
    (db.transactions || []).forEach((tx) => {
      const amt = Number(tx.amount_cashback ?? tx.cashback_amount ?? tx.amount ?? 0);
      const titleLower = (tx.title || tx.description || '').toLowerCase();

      if (titleLower.includes('withdraw') || tx.type === 'withdrawal') {
        list.push({
          id: `tx-withdraw-${tx.id}`,
          category: 'Withdrawal',
          title: 'PayNow Withdrawal',
          description: tx.status === 'pending'
            ? `Withdrawal request of $${Math.abs(amt).toFixed(2)} is pending Admin review.`
            : `PayNow transfer of $${Math.abs(amt).toFixed(2)} successfully sent.`,
          timestamp: Number(tx.created_at || Date.now() - 86400000),
          badge: tx.status === 'pending'
            ? { label: 'Processing', variant: 'amber' }
            : { label: 'Completed', variant: 'emerald' },
          iconType: 'wallet',
        });
      } else if (titleLower.includes('referral') || tx.type === 'referral') {
        list.push({
          id: `tx-referral-${tx.id}`,
          category: 'Reward',
          title: 'Friend Referral Bonus',
          description: `Reward credited for inviting friends to HSG+ Community.`,
          timestamp: Number(tx.created_at || Date.now() - 86400000),
          badge: { label: 'Rewarded', variant: 'emerald' },
          iconType: 'gift',
        });
      } else if (titleLower.includes('redeem') || titleLower.includes('order') || titleLower.includes('shop')) {
        list.push({
          id: `tx-shop-${tx.id}`,
          category: 'Order',
          title: 'HSG+ Merch Redemption',
          description: `${tx.title || 'Redeemed merchandise item'} using reward points.`,
          timestamp: Number(tx.created_at || Date.now() - 86400000),
          badge: { label: 'Order Placed', variant: 'blue' },
          iconType: 'order',
        });
      }
    });

    // 3. User account audit logs directly from database
    if (Array.isArray(db.user?.logs)) {
      db.user.logs.forEach((logItem: any, idx: number) => {
        list.push({
          id: `db-log-${logItem.timestamp || idx}`,
          category: 'Account',
          title: logItem.action || 'Account Activity',
          description: logItem.note || 'Account event verified.',
          timestamp: Number(logItem.timestamp || Date.now()),
          badge: { label: 'Verified', variant: 'blue' },
          iconType: 'shield',
        });
      });
    } else if (db.user?.phone_number) {
      list.push({
        id: `account-auth-${db.user.phone_number}`,
        category: 'Account',
        title: 'Account Verified',
        description: 'WhatsApp phone number successfully authenticated.',
        timestamp: Number(db.user.last_active_timestamp || Date.now()),
        badge: { label: 'Verified', variant: 'emerald' },
        iconType: 'shield',
      });
    }

    // Sort newest first & deduplicate by ID
    const seen = new Set<string>();
    return list
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [localActivities, db.cashback_claims, db.transactions, db.user]);

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState<string>(
    String(db.settings.min_withdrawal_amount)
  );

  const requireRules = db.settings.require_points_for_withdrawal !== false;
  const minPts = Number(db.settings.min_points_to_unlock_withdrawal ?? 100);
  const userPts = Number(db.user?.points_balance || 0);
  const ptsSatisfied = userPts >= minPts;
  const ptsPct = Math.min(100, Math.round((userPts / Math.max(1, minPts)) * 100));

  const minInvites = Number(db.settings.min_invites_to_unlock_withdrawal ?? 3);
  const userInvites = Math.max(
    Number(db.user?.referral_count || 0),
    (db.transactions || []).filter(
      (tx) => tx.type === 'referral' || (tx.title || '').toLowerCase().includes('referral')
    ).length
  );
  const invitesSatisfied = userInvites >= minInvites;
  const invitesPct = Math.min(100, Math.round((userInvites / Math.max(1, minInvites)) * 100));

  const minEvents = Number(db.settings.min_events_to_unlock_withdrawal ?? 3);
  const userEvents = Math.max(
    Number(db.user?.events_joined || 0),
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
  const eventsSatisfied = userEvents >= minEvents;
  const eventsPct = Math.min(100, Math.round((userEvents / Math.max(1, minEvents)) * 100));

  const isWithdrawalUnlocked =
    !requireRules || (ptsSatisfied && invitesSatisfied && eventsSatisfied);

  const formatRuleDate = (ts?: number) => {
    const d = ts ? new Date(ts) : new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const storedAuthPhone = typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_phone') || '') : '';
  const resolvedPhoneLast4 =
    (storedAuthPhone && storedAuthPhone.length >= 4 ? storedAuthPhone.slice(-4) : '') ||
    (db.user?.privacy?.phone && !db.user.privacy.phone.endsWith('0000') ? db.user.privacy.phone.replace(/\D/g, '').slice(-4) : '') ||
    (db.user?.phone_last4 && db.user.phone_last4 !== '0000' ? db.user.phone_last4 : '') ||
    '4429';

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    isEditingRef.current = false;
    hasLoadedUserRef.current = null;
    const storedPhone = typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_phone') || '') : '';
    const fullPhone = storedPhone ? (storedPhone.startsWith('65') ? storedPhone : `65${storedPhone}`) : '';

    updateAccountProfile({
      nickname,
      paynow: paynow.trim(),
      paynow_number: paynow.trim(),
      socials: { tt, fb, thread, ig },
      privacy_mode: privacyMode,
      privacy: {
        mode: privacyMode,
        phone: privacyMode ? `*******${resolvedPhoneLast4}` : (fullPhone || `*******${resolvedPhoneLast4}`),
        paynow_last4: paynow.trim() ? paynow.trim().replace(/\D/g, '').slice(-4) : '',
      },
    });
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    requestWithdrawal(amt);

    // Record withdrawal request activity
    saveCustomActivity({
      id: `act-withdraw-${Date.now()}`,
      category: 'Withdrawal',
      title: 'PayNow Withdrawal Submitted',
      description: `Requested $${amt.toFixed(2)} transfer to PayNow ${db.user?.paynow || paynow}.`,
      timestamp: Date.now(),
      badge: { label: 'Processing', variant: 'amber' },
      iconType: 'wallet',
    });
  };

  const formatActivityTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString('en-SG', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });

    return `${dateStr}, ${timeStr}`;
  };

  const renderActivityIcon = (iconType: ActivityItem['iconType']) => {
    switch (iconType) {
      case 'receipt':
        return <FileText className="w-4 h-4 text-amber-500" />;
      case 'check':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'settings':
        return <Settings className="w-4 h-4 text-blue-600" />;
      case 'wallet':
        return <ArrowUpRight className="w-4 h-4 text-zinc-700" />;
      case 'gift':
        return <Gift className="w-4 h-4 text-[#EC008C]" />;
      case 'shield':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-indigo-600" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getBadgeClass = (variant?: 'amber' | 'emerald' | 'rose' | 'blue' | 'zinc') => {
    switch (variant) {
      case 'amber':
        return 'bg-amber-50 text-amber-600 border border-amber-200';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
      case 'rose':
        return 'bg-rose-50 text-rose-600 border border-rose-200';
      case 'blue':
        return 'bg-blue-50 text-blue-600 border border-blue-200';
      case 'zinc':
      default:
        return 'bg-zinc-100 text-zinc-600 border border-zinc-200';
    }
  };

  return (
    <div className="w-full px-5 pt-2 pb-6 space-y-5">
      {/* Header Row */}
      <div className="relative flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          title="Back"
          className="w-9 h-9 rounded-full bg-white/90 text-[#141416] flex items-center justify-center shadow-2xs active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-[#141416] pointer-events-none">
          Wallet & Account
        </span>
        <button
          type="button"
          onClick={logout}
          title="Sign Out"
          className="w-9 h-9 rounded-full bg-white/90 text-zinc-600 flex items-center justify-center shadow-2xs active:scale-95 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* MODERN WALLET CARD */}
      <div className="w-full p-5 rounded-3xl bg-hsg-wallet-card text-white shadow-md">
        <div className="flex items-center justify-between">
          <HsgLogo size="sm" />
          <button
            type="button"
            onClick={onOpenInvite}
            className="h-7 px-3 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition flex items-center gap-1.5 text-xs font-bold text-white border border-white/20 shadow-2xs"
            title="Invite Friends & Earn Rewards"
          >
            <Gift className="w-3.5 h-3.5 text-[#FFEA00]" />
            <span>Invite Friend</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 items-start">
          <button
            type="button"
            onClick={() => onOpenTransactions ? onOpenTransactions('cashback') : setActiveSubTab('activity')}
            className="text-left group cursor-pointer transition active:scale-[0.98]"
            title="View Cashback Transaction History"
          >
            <div className="text-[11px] text-zinc-300 font-medium group-hover:text-white transition flex items-center gap-1">
              <span>Total Cashback</span>
              <span className="opacity-60 group-hover:opacity-100">→</span>
            </div>
            <div className="text-3xl font-extrabold text-[#FFEA00] tracking-tight mt-0.5">
              ${totalCash.toFixed(2)}
            </div>
            <div className="text-[11px] text-zinc-300 font-medium mt-1">
              Available to use: <strong className="text-white font-bold">${availableCash.toFixed(2)}</strong>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpenTransactions ? onOpenTransactions('points') : setActiveSubTab('activity')}
            className="text-right group cursor-pointer transition active:scale-[0.98]"
            title="View Points Transaction History"
          >
            <div className="text-[11px] text-zinc-300 font-medium group-hover:text-white transition flex items-center justify-end gap-1">
              <span>Reward Points</span>
              <span className="opacity-60 group-hover:opacity-100">→</span>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mt-0.5">
              {totalPts}{' '}
              <span className="text-xs font-bold text-[#FFEA00]">pts</span>
            </div>
            <div className="text-[11px] text-zinc-300 font-medium mt-1">
              Available to use: <strong className="text-white font-bold">{availablePts} pts</strong>
            </div>
          </button>
        </div>

        {/* Switch between Withdraw Cashback & Redeem Point */}
        <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/15">
          <button
            type="button"
            onClick={() =>
              setWalletActionTab((prev) =>
                prev === 'withdraw' ? null : 'withdraw'
              )
            }
            className={`h-9 rounded-full text-xs font-bold transition ${
              walletActionTab === 'withdraw'
                ? 'bg-[#FFEA00] text-[#141416]'
                : 'bg-white/10 text-white'
            }`}
          >
            Withdraw Cash
          </button>
          <button
            type="button"
            onClick={onOpenRedeemShop}
            className="h-9 rounded-full text-xs font-bold transition bg-white/10 text-white active:scale-95"
          >
            HSG+ Shop
          </button>
        </div>
      </div>

      {/* WALLET ACTION BOX (HIDDEN BY DEFAULT UNTIL BUTTON CLICKED) */}
      {walletActionTab === 'withdraw' && (
        <form
          onSubmit={handleWithdraw}
          className="w-full p-4 rounded-3xl bg-white shadow-xs animate-in fade-in duration-200 space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#141416]">
              Cash Withdrawal
            </span>
          </div>

          {requireRules && (
            <div className="p-3 rounded-2xl bg-[#F6F6F9] space-y-2.5">
              {/* Rule 1: Points */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-zinc-700">
                    Achieve {minPts} pts to Withdraw
                  </span>
                  <span
                    className={`font-extrabold ${
                      ptsSatisfied ? 'text-emerald-600' : 'text-[#EC008C]'
                    }`}
                  >
                    {userPts} / {minPts} pts {ptsSatisfied ? '✓' : ''}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ptsSatisfied ? 'bg-emerald-500' : 'bg-[#EC008C]'
                    }`}
                    style={{ width: `${ptsPct}%` }}
                  />
                </div>
              </div>

              {/* Rule 2: Invites */}
              {minInvites > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-zinc-700">
                      Invite {minInvites} friends to Withdraw
                    </span>
                    <span
                      className={`font-extrabold ${
                        invitesSatisfied ? 'text-emerald-600' : 'text-[#EC008C]'
                      }`}
                    >
                      {userInvites} / {minInvites} invited {invitesSatisfied ? '✓' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        invitesSatisfied ? 'bg-emerald-500' : 'bg-[#EC008C]'
                      }`}
                      style={{ width: `${invitesPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Rule 3: Events */}
              {minEvents > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-zinc-700">
                      Join {minEvents} events to Withdraw
                    </span>
                    <span
                      className={`font-extrabold ${
                        eventsSatisfied ? 'text-emerald-600' : 'text-[#EC008C]'
                      }`}
                    >
                      {userEvents} / {minEvents} joined {eventsSatisfied ? '✓' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        eventsSatisfied ? 'bg-emerald-500' : 'bg-[#EC008C]'
                      }`}
                      style={{ width: `${eventsPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Terms & Conditions update date centered small below criteria */}
              <p className="text-[10px] text-zinc-400 text-center font-medium pt-1">
                Terms & Conditions updated on {formatRuleDate(db.settings.withdrawal_rules_updated_at)}
              </p>
            </div>
          )}

          {/* Withdrawal Input & Submit Button (Only displays when all criteria rules are fulfilled) */}
          {isWithdrawalUnlocked && (
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.50"
                  min={db.settings.min_withdrawal_amount}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Min ${db.settings.min_withdrawal_amount}`}
                  className="flex-1 h-10 px-3.5 rounded-full bg-[#F6F6F9] text-[#141416] font-bold text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-5 h-10 rounded-full font-bold text-xs shrink-0 shadow-xs transition bg-[#EC008C] text-white active:scale-95 cursor-pointer"
                >
                  Withdraw
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Manual transfer by Admin within {db.settings.withdrawal_sla_text} (min ${db.settings.min_withdrawal_amount}).
              </p>
            </div>
          )}
        </form>
      )}

      {/* SUB-TABS PILL SWITCHER: Activity | Account | Achievements */}
      <div className="w-full grid grid-cols-3 gap-1.5 p-1 rounded-full bg-white shadow-2xs">
        {(
          [
            { id: 'activity', label: 'Activity' },
            { id: 'account', label: 'Account' },
            { id: 'achievement', label: 'Achievements' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`h-9 rounded-full text-xs font-bold transition cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-[#141416] text-[#FFEA00]'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. ACCOUNT ACTIVITY HISTORY (All claims, settings, security & balance events) */}
      {activeSubTab === 'activity' && (
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-xs font-bold text-zinc-900">Activity History</h3>
              <p className="text-[11px] text-zinc-500">Updates, receipt claims & settings</p>
            </div>
            {onOpenTransactions && (
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    openLoginModal();
                    return;
                  }
                  onOpenTransactions('cashback');
                }}
                className="text-xs font-bold text-[#EC008C] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Transactions</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {allActivities.length > 0 ? (
            <div className="w-full space-y-2.5">
              {allActivities.map((act) => (
                <div
                  key={act.id}
                  className="w-full p-3.5 rounded-2xl bg-white shadow-2xs flex items-start gap-3 transition"
                >
                  {/* Left Icon */}
                  <div className="w-9 h-9 rounded-full shrink-0 bg-[#F6F6F9] flex items-center justify-center mt-0.5">
                    {renderActivityIcon(act.iconType)}
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#141416] truncate">
                        {act.title}
                      </span>
                      {act.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${getBadgeClass(
                            act.badge.variant
                          )}`}
                        >
                          {act.badge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-1 leading-snug">
                      {act.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-400 font-medium">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{formatActivityTime(act.timestamp)}</span>
                      <span className="text-zinc-300">•</span>
                      <span className="text-zinc-500 font-semibold">{act.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full p-8 rounded-3xl bg-white text-center text-xs text-zinc-400">
              No account activity recorded yet.
            </div>
          )}
        </div>
      )}

      {/* 2. ACCOUNT DETAILS SUB-VIEW (Phone PK, Nickname, PayNow, Social Usernames) */}
      {activeSubTab === 'account' && (
        <form
          onSubmit={handleSaveProfile}
          className="w-full p-5 rounded-3xl bg-white shadow-xs space-y-4"
        >
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500">
              Phone Number
            </label>
            <input
              type="text"
              disabled
              value={
                !isAuthenticated
                  ? '(Not signed in — Tap to Log In)'
                  : storedAuthPhone
                  ? (storedAuthPhone.startsWith('65') ? `+65 ${storedAuthPhone.slice(2)}` : storedAuthPhone)
                  : resolvedPhoneLast4
                  ? `...${resolvedPhoneLast4}`
                  : (db.user?.phone_number && !db.user.phone_number.includes('0000') ? db.user.phone_number : '••••••••••••')
              }
              className="w-full h-10 px-3.5 mt-1 rounded-xl bg-[#F6F6F9] text-zinc-600 font-mono text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700">
              Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => { isEditingRef.current = true; setNickname(e.target.value); }}
              className="w-full h-10 px-3.5 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs font-bold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700">
              PayNow Number
            </label>
            <input
              type="text"
              value={paynow}
              onChange={(e) => { isEditingRef.current = true; setPaynow(e.target.value); }}
              className="w-full h-10 px-3.5 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs font-bold focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-zinc-100">
            <div className="text-xs font-bold text-[#141416] mb-2.5">
              Social Usernames
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500">
                  TikTok
                </label>
                <input
                  type="text"
                  value={tt}
                  onChange={(e) => { isEditingRef.current = true; setTt(e.target.value); }}
                  placeholder="@username"
                  className="w-full h-9 px-3 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500">
                  Instagram
                </label>
                <input
                  type="text"
                  value={ig}
                  onChange={(e) => { isEditingRef.current = true; setIg(e.target.value); }}
                  placeholder="@username"
                  className="w-full h-9 px-3 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500">
                  Facebook
                </label>
                <input
                  type="text"
                  value={fb}
                  onChange={(e) => { isEditingRef.current = true; setFb(e.target.value); }}
                  placeholder="username"
                  className="w-full h-9 px-3 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500">
                  Threads
                </label>
                <input
                  type="text"
                  value={thread}
                  onChange={(e) => { isEditingRef.current = true; setThread(e.target.value); }}
                  placeholder="@username"
                  className="w-full h-9 px-3 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs"
                />
              </div>
            </div>
          </div>

          {/* Privacy Mode Option */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-zinc-200/80 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="privacy_mode_toggle"
              checked={privacyMode}
              onChange={(e) => { isEditingRef.current = true; setPrivacyMode(e.target.checked); }}
              className="mt-0.5 w-4 h-4 rounded text-[#0B57D0] focus:ring-[#0B57D0]/30 accent-[#0B57D0] cursor-pointer shrink-0"
            />
            <label
              htmlFor="privacy_mode_toggle"
              className="text-xs text-zinc-600 leading-snug cursor-pointer select-none"
            >
              <span className="font-bold text-zinc-900 block mb-0.5">Privacy Mode (Active)</span>
              Keeps your contact details hidden. Unchecking this allows HSG+ to access your personal information.
            </label>
          </div>

          <button
            type="submit"
            className="w-full h-11 rounded-full bg-[#141416] text-[#FFEA00] font-bold text-xs shadow-xs"
          >
            Save Profile
          </button>
        </form>
      )}

      {/* 3. ACHIEVEMENTS SUB-VIEW */}
      {activeSubTab === 'achievement' && (
        <div className="w-full space-y-2.5">
          {db.achievements.length > 0 ? (
            db.achievements.map((ach) => {
              const pct = Math.min(
                100,
                Math.round((ach.progress_current / ach.progress_target) * 100)
              );
              return (
                <div
                  key={ach.id}
                  className="w-full p-4 rounded-2xl bg-white shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#141416]">
                        {ach.title}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {ach.description}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#EC008C]">
                      {ach.progress_current}/{ach.progress_target}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F6F6F9] mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        ach.unlocked ? 'bg-emerald-500' : 'bg-[#FFEA00]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="w-full p-6 rounded-3xl bg-white text-center text-xs text-zinc-400">
              No achievements available.
            </div>
          )}
        </div>
      )}
    </div>
  );
};