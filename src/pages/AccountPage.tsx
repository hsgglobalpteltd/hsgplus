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
  Loader2,
  LogOut,
  MessageCircle,
  Receipt,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { HsgLogo } from '../components/HsgLogo';
import { MerchOrderRecord } from '../types';

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
    variant: 'amber' | 'emerald' | 'rose' | 'blue' | 'zinc' | 'purple' | 'indigo';
  };
  iconType: 'receipt' | 'settings' | 'wallet' | 'gift' | 'shield' | 'check' | 'alert' | 'order';
  orderId?: string;
  orderData?: MerchOrderRecord;
  orderProgress?: {
    step: number; // 1: Order Placed, 2: Preparing, 3: Delivered
    statusText: string;
    fulfillment: string;
    deliveryAddress?: string;
  };
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
    claimContestPrize,
    logout,
    isAuthenticated,
    openLoginModal,
    showToast,
  } = useHsgData();

  const [activeSubTab, setActiveSubTab] = useState<
    'activity' | 'account' | 'achievement'
  >('activity');
  const tabsAnchorRef = useRef<HTMLDivElement | null>(null);
  const tabsStickyRef = useRef<HTMLDivElement | null>(null);

  const handleSubTabChange = (tabId: 'activity' | 'account' | 'achievement') => {
    if (!isAuthenticated && tabId !== 'activity') {
      openLoginModal();
      return;
    }
    setActiveSubTab(tabId);

    // Keep floating pills docked at top and display the active tab from its top body
    // with exact padding so it is never covered by the 83px header + pill tab
    requestAnimationFrame(() => {
      const scrollParent = tabsStickyRef.current?.closest('main') || document.querySelector('main');
      if (scrollParent && tabsAnchorRef.current) {
        const anchorRect = tabsAnchorRef.current.getBoundingClientRect();
        const parentRect = scrollParent.getBoundingClientRect();
        const exactDockTop = Math.max(0, anchorRect.top - parentRect.top + scrollParent.scrollTop);

        // If user is scrolled down to or past the docked tabs:
        if (scrollParent.scrollTop > exactDockTop - 10) {
          scrollParent.scrollTo({
            top: exactDockTop,
            behavior: 'smooth',
          });
        }
      }
    });
  };

  const [isTabsStuck, setIsTabsStuck] = useState(false);

  useEffect(() => {
    const scrollParent =
      tabsStickyRef.current?.closest('main') || document.querySelector('main');
    if (!scrollParent) return;

    const checkSticky = () => {
      if (!tabsAnchorRef.current || !scrollParent) return;
      const anchorRect = tabsAnchorRef.current.getBoundingClientRect();
      const parentRect = scrollParent.getBoundingClientRect();
      // tabsAnchorRef is placed right above the sticky element.
      // When anchorRect.top <= parentRect.top, the sticky tabs are 100% docked at the top.
      const stuck = anchorRect.top <= parentRect.top + 1;
      setIsTabsStuck((prev) => (prev !== stuck ? stuck : prev));
    };

    checkSticky();
    scrollParent.addEventListener('scroll', checkSticky, { passive: true });
    window.addEventListener('resize', checkSticky, { passive: true });

    return () => {
      scrollParent.removeEventListener('scroll', checkSticky);
      window.removeEventListener('resize', checkSticky);
    };
  }, []);
  const [walletActionTab, setWalletActionTab] = useState<'withdraw' | null>(
    null
  );
  const [claimingWinnerId, setClaimingWinnerId] = useState<string | null>(null);

  const userWinningPrizes = useMemo(() => {
    if (!isAuthenticated) return [];
    const uid =
      db.user?.id ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('hsg_auth_user_id')
        : '') ||
      '';
    if (!uid) return [];

    return (db.contest_winners || []).filter((w) => w.user_id === uid);
  }, [isAuthenticated, db.user?.id, db.contest_winners]);

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

  // Authentication phone resolution for member WhatsApp identity
  const storedAuthPhone = typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_phone') || '') : '';

  // Account fields (Phone Number PK, Nickname, PayNow, Social Usernames, Privacy)
  const [nickname, setNickname] = useState(db.user?.nickname || '');
  const [paynow, setPaynow] = useState(() => {
    const uPn = db.user?.paynow || (db.user as any)?.paynow_number || '';
    if (uPn && uPn.length !== 64 && !uPn.startsWith('...')) return uPn;
    const localPn = typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_paynow') || '') : '';
    return localPn || '';
  });
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.user?.privacy_mode ?? db.user?.privacy?.mode ?? true);
  const [tt, setTt] = useState(db.user?.socials?.tt || '');
  const [fb, setFb] = useState(db.user?.socials?.fb || '');
  const [thread, setThread] = useState(db.user?.socials?.thread || '');
  const [ig, setIg] = useState(db.user?.socials?.ig || '');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<MerchOrderRecord | null>(null);

  // Smoothly center-scroll any focused input into the active visible window
  const handleScrollInputToCenter = (target: HTMLElement | null) => {
    if (!target) return;
    const scroll = () => {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    };
    // Immediate
    scroll();
    // After virtual keyboard pops up (animation takes 250-350ms on iOS / Android)
    setTimeout(scroll, 150);
    setTimeout(scroll, 350);
    setTimeout(scroll, 550);
  };

  // Re-scroll active input whenever mobile virtual keyboard resizes the visual viewport
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleViewportResize = () => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
        (active as HTMLInputElement).type !== 'checkbox'
      ) {
        handleScrollInputToCenter(active);
      }
    };
    const vp = window.visualViewport;
    vp.addEventListener('resize', handleViewportResize);
    return () => {
      vp.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  const handleFormFocus = (e: React.FocusEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      if ((target as HTMLInputElement).type === 'checkbox') return;
      isEditingRef.current = true;
      setIsInputFocused(true);
      handleScrollInputToCenter(target);
    }
  };

  const handleFormBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    const currentTarget = e.currentTarget;
    setTimeout(() => {
      if (!currentTarget.contains(document.activeElement)) {
        setIsInputFocused(false);
      }
    }, 200);
  };

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
        } else if (!paynow) {
          const localPn = typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_paynow') || '') : '';
          setPaynow(localPn || '');
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
    } else if (!isAuthenticated) {
      hasLoadedUserRef.current = null;
      setNickname('');
      setPaynow('');
      setTt('');
      setFb('');
      setThread('');
      setIg('');
      setLocalActivities([]);
      setActiveSubTab('activity');
    }
  }, [db.user, isAuthenticated]);

  // Activity items state from live database and current session (no stale localStorage caching)
  const [localActivities, setLocalActivities] = useState<ActivityItem[]>([]);

  const saveCustomActivity = (act: ActivityItem) => {
    setLocalActivities((prev) => [act, ...prev.filter((item) => item.id !== act.id)].slice(0, 50));
  };

  // Compile full activity feed
  const allActivities = useMemo<ActivityItem[]>(() => {
    // If guest / not logged in, include attractive sample activity entries matching teaser wallet balances
    if (!isAuthenticated) {
      return [
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
      ];
    }

    const list: ActivityItem[] = [...localActivities];
    const currentUserId =
      db.user?.id ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('hsg_auth_user_id') || ''
        : '');

    // 1. Claims activity (submitted, approved, rejected) — strictly filtered by user_id
    (db.cashback_claims || [])
      .filter((c) => !currentUserId || !c.user_id || c.user_id === currentUserId)
      .forEach((c) => {
        const claimAmt = Number(c.cashback_amount ?? c.receipt_amount ?? 0);
        const isApproved = c.status === 'approved' || c.status === 'credited';
        const isRejected = c.status === 'rejected';

        if (isApproved) {
          list.push({
            id: `claim-approved-${c.id}`,
            category: 'Receipt Claim',
            title: `Receipt Claim #${c.id.slice(-6).toUpperCase()} Approved`,
            description: `Cashback +$${claimAmt.toFixed(2)} verified and credited to wallet balance.`,
            timestamp: Number(c.timestamp || Date.now() - 3600000),
            badge: { label: 'Verified', variant: 'emerald' },
            iconType: 'check',
          });
        } else if (isRejected) {
          list.push({
            id: `claim-rejected-${c.id}`,
            category: 'Receipt Claim',
            title: `Receipt Claim #${c.id.slice(-6).toUpperCase()} Declined`,
            description:
              c.rejection_reason ||
              'Receipt could not be verified. Please check retail receipt clarity.',
            timestamp: Number(c.timestamp || Date.now() - 3600000),
            badge: { label: 'Declined', variant: 'rose' },
            iconType: 'alert',
          });
        } else {
          list.push({
            id: `claim-pending-${c.id}`,
            category: 'Receipt Claim',
            title: `Receipt Claim #${c.id.slice(-6).toUpperCase()} Submitted`,
            description: `Receipt uploaded for verification (Est. +$${claimAmt.toFixed(2)} cashback).`,
            timestamp: Number(c.timestamp || Date.now() - 7200000),
            badge: { label: 'Pending Verify', variant: 'amber' },
            iconType: 'receipt',
          });
        }
      });

    // 2. Transactions activity from hsgplus_ledger (withdrawals, referrals, contests, events, shop redemptions)
    (db.transactions || []).forEach((tx) => {
      const amt = Number(
        tx.net_cashback ?? tx.amount_cashback ?? tx.cashback_amount ?? tx.amount ?? 0
      );
      const pts = Number(tx.net_points ?? tx.amount_points ?? tx.points ?? 0);
      const txType = String(tx.type || '').toLowerCase();
      const txStatus = String(tx.status || 'completed').toLowerCase();
      const titleLower = (tx.title || tx.description || '').toLowerCase();

      if (
        (txType === 'withdrawal' ||
          (titleLower.includes('withdraw') && !titleLower.includes('fee'))) &&
        txType !== 'withdrawal_fee' &&
        (Math.abs(amt) > 0 || Math.abs(pts) > 0)
      ) {
        const isPending =
          txStatus === 'pending' ||
          txStatus === 'requested' ||
          txStatus === 'pending_payout';
        const isRejected = txStatus === 'rejected' || txStatus === 'declined';
        list.push({
          id: `tx-withdraw-${tx.id}`,
          category: 'Withdrawal',
          title: isRejected ? 'PayNow Withdrawal Declined' : 'PayNow Withdrawal',
          description: isRejected
            ? tx.description ||
              `Withdrawal request of $${Math.abs(amt).toFixed(2)} was declined and refunded.`
            : isPending
            ? `Withdrawal request of $${Math.abs(amt).toFixed(2)} is pending Admin review.`
            : `PayNow transfer of $${Math.abs(amt).toFixed(2)} successfully sent.`,
          timestamp: Number(tx.created_at || Date.now() - 86400000),
          badge: isRejected
            ? { label: 'Declined', variant: 'rose' }
            : isPending
            ? { label: 'Processing', variant: 'amber' }
            : { label: 'Completed', variant: 'emerald' },
          iconType: isRejected ? 'alert' : 'wallet',
        });
      } else if (txType.startsWith('referral') || titleLower.includes('referral')) {
        const isWelcome = txType === 'referral_welcome' || titleLower.includes('welcome');
        const rewardParts: string[] = [];
        if (amt > 0) rewardParts.push(`+$${amt.toFixed(2)}`);
        if (pts > 0) rewardParts.push(`+${pts} pts`);
        list.push({
          id: `tx-referral-${tx.id}`,
          category: 'Reward',
          title: isWelcome ? 'Referral Welcome Bonus' : 'Friend Referral Bonus',
          description:
            tx.description ||
            `Reward credited (${rewardParts.join(' & ') || 'Bonus'}) in HSG+ Community.`,
          timestamp: Number(tx.created_at || Date.now() - 86400000),
          badge: { label: 'Rewarded', variant: 'emerald' },
          iconType: 'gift',
        });
      } else if (
        txType === 'contest_entry' ||
        txType === 'contest_prize' ||
        titleLower.includes('contest')
      ) {
        const isPrize = txType === 'contest_prize' || titleLower.includes('prize');
        const isRejected = txStatus === 'rejected' || txStatus === 'declined';
        const isPending = txStatus === 'pending' || txStatus === 'submitted';
        list.push({
          id: `tx-contest-${tx.id}`,
          category: 'Reward',
          title: isPrize
            ? tx.title || 'Contest Winner Prize Claimed'
            : tx.title || 'Contest Entry',
          description:
            tx.description ||
            (pts > 0
              ? `Earned +${pts} pts from contest participation.`
              : amt > 0
              ? `Earned +$${amt.toFixed(2)} from contest prize.`
              : 'Contest participation recorded.'),
          timestamp: Number(tx.created_at || Date.now() - 86400000),
          badge: isRejected
            ? { label: 'Declined', variant: 'rose' }
            : isPending
            ? { label: 'Pending Verify', variant: 'amber' }
            : { label: isPrize ? 'Winner' : 'Verified', variant: 'emerald' },
          iconType: isRejected ? 'alert' : 'gift',
        });
      } else if (
        txType === 'event_rsvp' ||
        txType === 'event_reward' ||
        titleLower.includes('event')
      ) {
        const isCheckin = txType === 'event_reward' || titleLower.includes('check-in');
        list.push({
          id: `tx-event-${tx.id}`,
          category: isCheckin ? 'Reward' : 'Account',
          title: tx.title || (isCheckin ? 'Event Check-In Reward' : 'Event RSVP'),
          description:
            tx.description ||
            (pts > 0
              ? `Earned +${pts} pts for event check-in.`
              : 'Event activity recorded.'),
          timestamp: Number(tx.created_at || Date.now() - 86400000),
          badge: { label: isCheckin ? 'Checked-In' : 'Joined', variant: isCheckin ? 'emerald' : 'blue' },
          iconType: 'check',
        });
      } else if (
        txType === 'shop_order' ||
        titleLower.includes('redeem') ||
        titleLower.includes('order') ||
        titleLower.includes('shop')
      ) {
        // Will be matched and rendered from live merch_orders below
      }
    });

    // 2b. Merch Orders Progress (Order Placed -> Preparing -> Delivered)
    const userPhoneClean = (db.user?.phone_number || '').replace(/\D/g, '');
    const userPhoneHash = typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_phone_hash') || '') : '';
    const userOrders = (db.merch_orders || []).filter((o) => {
      if (currentUserId && o.user_id && o.user_id === currentUserId) return true;
      if (userPhoneClean && o.user_phone && (o.user_phone === userPhoneClean || o.user_phone.endsWith(userPhoneClean))) return true;
      if (userPhoneHash && o.user_phone && o.user_phone === userPhoneHash) return true;
      return false;
    });

    const processedOrderIds = new Set<string>();

    userOrders.forEach((ord) => {
      processedOrderIds.add(ord.id);
      const st = String(ord.status || 'pending').toLowerCase();
      const isDelivered = st === 'delivered' || st === 'completed' || st === 'fulfilled';
      const isDispatched = st === 'shipped' || st === 'out_for_delivery' || st === 'delivering';
      const isReady = st === 'ready' || st === 'ready_for_pickup';
      const isPreparing = st === 'preparing' || st === 'prepare' || st === 'processing';
      const isCancelled = st === 'cancelled' || st === 'rejected';
      const isDelivery = ord.fulfillment === 'delivery' || ord.fulfillment_method === 'delivery';

      let step = 1;
      let badgeLabel = 'Order Placed';
      let badgeVariant: 'blue' | 'amber' | 'emerald' | 'rose' | 'purple' | 'indigo' = 'blue';

      if (isDelivered) {
        step = 3;
        badgeLabel = isDelivery ? 'Delivered' : 'Collected';
        badgeVariant = 'emerald';
      } else if (isDispatched) {
        step = 2;
        badgeLabel = 'Out for Delivery';
        badgeVariant = 'purple';
      } else if (isReady) {
        step = 2;
        badgeLabel = 'Ready for Pickup';
        badgeVariant = 'indigo';
      } else if (isPreparing) {
        step = 2;
        badgeLabel = 'Preparing';
        badgeVariant = 'amber';
      } else if (isCancelled) {
        step = 0;
        badgeLabel = 'Cancelled';
        badgeVariant = 'rose';
      } else {
        step = 1;
        badgeLabel = 'Order Placed';
        badgeVariant = 'blue';
      }

      const itemsSummary = Array.isArray(ord.items) && ord.items.length > 0
        ? ord.items.map((i: any) => `${i.qty}x ${i.name || 'Merch'}`).join(', ')
        : 'Merch Item';

      const desc = isDelivered
        ? (isDelivery ? `Order delivered to ${ord.delivery_address || 'your address'}.` : `Order collected successfully.`)
        : isDispatched
        ? `Out for delivery to ${ord.delivery_address || 'your address'}.`
        : isReady
        ? `Ready for pickup at ${db.settings.self_collect_address || 'HSG Global HQ'}.`
        : isPreparing
        ? (isDelivery ? 'Your order is currently being prepared and packed for delivery.' : 'Your order is being packed and prepared for pickup.')
        : isCancelled
        ? 'Order has been cancelled.'
        : (isDelivery ? `Order placed. Awaiting warehouse preparation for delivery.` : `Order placed. Preparing for self-pickup.`);

      const cleanId = ord.id.replace(/^LDG-/, '');
      list.push({
        id: `mord-${ord.id}`,
        category: 'Order',
        title: 'Order Placed to HSG+',
        orderId: cleanId,
        orderData: ord,
        description: `#${cleanId}`,
        timestamp: Number(ord.created_at || Date.now()),
        badge: { label: badgeLabel, variant: badgeVariant },
        iconType: 'order',
        orderProgress: {
          step,
          statusText: badgeLabel,
          fulfillment: isDelivery ? 'delivery' : 'collect',
          deliveryAddress: ord.delivery_address,
        },
      });
    });

    // Also include any standalone shop_order transactions not in merch_orders
    (db.transactions || [])
      .filter((tx) => {
        const txType = String(tx.type || '');
        const titleLower = String(tx.title || '').toLowerCase();
        return txType === 'shop_order' || titleLower.includes('redeem') || titleLower.includes('shop order');
      })
      .forEach((tx) => {
        const fullTxText = `${tx.id} ${tx.title || ''} ${tx.description || ''}`;
        const ordMatch = fullTxText.match(/ORD-\d+-\d+/i);
        const resolvedOrdId = ordMatch ? ordMatch[0] : '';

        // If this order is already in processedOrderIds, skip
        if (resolvedOrdId && processedOrderIds.has(resolvedOrdId)) {
          return;
        }

        // Check if db.merch_orders has this order
        const existingMerchOrder = resolvedOrdId
          ? (db.merch_orders || []).find((o) => o.id === resolvedOrdId || o.id.includes(resolvedOrdId) || resolvedOrdId.includes(o.id))
          : null;

        if (existingMerchOrder) {
          processedOrderIds.add(existingMerchOrder.id);
          const st = String(existingMerchOrder.status || 'pending').toLowerCase();
          const isDelivered = st === 'delivered' || st === 'completed' || st === 'fulfilled';
          const isDispatched = st === 'shipped' || st === 'out_for_delivery' || st === 'delivering';
          const isReady = st === 'ready' || st === 'ready_for_pickup';
          const isPreparing = st === 'preparing' || st === 'prepare' || st === 'processing';
          const isCancelled = st === 'cancelled' || st === 'rejected';
          const isDelivery = String(existingMerchOrder.fulfillment_method || existingMerchOrder.fulfillment || '').toLowerCase() === 'delivery';

          let step = 1;
          let badgeLabel = 'Order Placed';
          let badgeVariant: 'blue' | 'amber' | 'emerald' | 'rose' | 'purple' | 'indigo' = 'blue';

          if (isDelivered) {
            step = 3;
            badgeLabel = 'Delivered';
            badgeVariant = 'emerald';
          } else if (isDispatched || isReady || isPreparing) {
            step = 2;
            badgeLabel = 'Preparing';
            badgeVariant = 'amber';
          } else if (isCancelled) {
            step = 0;
            badgeLabel = 'Cancelled';
            badgeVariant = 'rose';
          } else {
            step = 1;
            badgeLabel = 'Order Placed';
            badgeVariant = 'blue';
          }

          const cleanId = existingMerchOrder.id.replace(/^LDG-/, '');
          list.push({
            id: `mord-${existingMerchOrder.id}`,
            category: 'Order',
            title: 'Order Placed to HSG+',
            orderId: cleanId,
            orderData: existingMerchOrder,
            description: `#${cleanId}`,
            timestamp: Number(existingMerchOrder.created_at || tx.created_at || Date.now()),
            badge: { label: badgeLabel, variant: badgeVariant },
            iconType: 'order',
            orderProgress: {
              step,
              statusText: badgeLabel,
              fulfillment: isDelivery ? 'delivery' : 'collect',
              deliveryAddress: existingMerchOrder.delivery_address,
            },
          });
          return;
        }

        const cleanOrdId = resolvedOrdId || tx.id.replace(/^LDG-/, '');
        processedOrderIds.add(cleanOrdId);

        // Parse description: "Shop Order: 9x BOOM+ RUNNING CAP (Delivery ORD-1793164277529-1944)"
        let parsedText = (tx.description || tx.title || '').replace(/^Shop Order:\s*/i, '');
        const isDelivery = /delivery/i.test(parsedText) || /delivery/i.test(tx.title || '');
        parsedText = parsedText.replace(/\s*\((Delivery|Self-Pickup|Pickup)[^)]*\)/i, '').trim();

        let parsedQty = 1;
        let parsedName = parsedText || 'Merch Item';
        const qm = parsedText.match(/^(\d+)x\s+(.+)$/i);
        if (qm) {
          parsedQty = parseInt(qm[1], 10);
          parsedName = qm[2].trim();
        }

        const ptsAmt = Math.abs(Number((tx as any).point ?? tx.amount_points ?? tx.points ?? 0));
        const cashAmt = Math.abs(Number((tx as any).cashback ?? tx.amount_cashback ?? tx.amount ?? 0));
        const fee = isDelivery ? (Number(db.settings.delivery_fee) || 4.5) : 0;

        const syntheticOrder: MerchOrderRecord = {
          id: cleanOrdId,
          user_id: currentUserId,
          user_phone: storedAuthPhone || db.user?.phone_number || '',
          user_nickname: db.user?.nickname || 'Member',
          items: [
            {
              name: parsedName,
              qty: parsedQty,
              points: ptsAmt,
              cash: cashAmt > fee ? Number((cashAmt - fee).toFixed(2)) : 0,
              payWith: ptsAmt > 0 ? 'points' : 'cashback',
            },
          ],
          fulfillment: isDelivery ? 'delivery' : 'collect',
          fulfillment_method: isDelivery ? 'delivery' : 'collect',
          delivery_address: isDelivery ? (db.user?.address || 'Hantar di sini') : undefined,
          delivery_fee: fee,
          total_points: ptsAmt,
          total_cash: cashAmt,
          status: 'pending',
          created_at: Number(tx.created_at || Date.now() - 86400000),
        };

        const cleanId = cleanOrdId.replace(/^LDG-/, '');
        list.push({
          id: `tx-shop-${tx.id}`,
          category: 'Order',
          title: 'Order Placed to HSG+',
          orderId: cleanId,
          orderData: syntheticOrder,
          description: `#${cleanId}`,
          timestamp: Number(tx.created_at || Date.now() - 86400000),
          badge: { label: 'Order Placed', variant: 'blue' },
          iconType: 'order',
          orderProgress: {
            step: 1,
            statusText: 'Order Placed',
            fulfillment: isDelivery ? 'delivery' : 'collect',
          },
        });
      });

    // 3. Contest Submissions (for entries that have 0 points or are not yet in ledger)
    (db.contest_submissions || [])
      .filter((s) => currentUserId && s.user_id === currentUserId)
      .forEach((s) => {
        const hasTx = list.some((it) => it.id === `tx-contest-LDG-${s.id}`);
        if (hasTx) return;
        const st = String(s.status || 'submitted').toLowerCase();
        const isWinner = st === 'winner' || st === 'approved' || st === 'verified';
        const isRejected = st === 'rejected';
        list.push({
          id: `csub-${s.id}`,
          category: 'Reward',
          title: `Contest Entry: ${s.contest_title || 'HSG+ Contest'}`,
          description: isWinner
            ? `Contest entry verified${s.prize_awarded ? ` (${s.prize_awarded})` : ''}.`
            : isRejected
            ? `Contest entry declined${(s as any).rejection_reason ? `: ${(s as any).rejection_reason}` : ''}.`
            : 'Contest entry submitted for verification.',
          timestamp: Number(s.created_at || s.timestamp || Date.now()),
          badge: isRejected
            ? { label: 'Declined', variant: 'rose' }
            : isWinner
            ? { label: 'Verified', variant: 'emerald' }
            : { label: 'Submitted', variant: 'amber' },
          iconType: isRejected ? 'alert' : 'gift',
        });
      });

    // 4. Event Join & Check-in (from user's joined/checked-in events)
    (db.events || [])
      .filter(
        (ev) => ev.user_status === 'joined' || ev.user_status === 'checked_in'
      )
      .forEach((ev) => {
        const isCheckedIn = ev.user_status === 'checked_in';
        const evTitleLower = (ev.title || '').toLowerCase().trim();
        const alreadyAdded = list.some((it) => {
          const itTitle = (it.title || '').toLowerCase();
          const itDesc = (it.description || '').toLowerCase();
          const itId = (it.id || '').toLowerCase();
          return (
            itId.includes(ev.id.toLowerCase()) ||
            (evTitleLower && (itTitle.includes(evTitleLower) || itDesc.includes(evTitleLower)))
          );
        });
        if (alreadyAdded) return;

        list.push({
          id: `ev-status-${ev.id}-${ev.user_status}`,
          category: isCheckedIn ? 'Reward' : 'Account',
          title: isCheckedIn
            ? `Event Checked-In: ${ev.title}`
            : `Event Joined: ${ev.title}`,
          description: isCheckedIn
            ? `Checked in at ${ev.location || 'Event Venue'}${
                Number(ev.reward_points || 0) > 0 ? ` (+${ev.reward_points} pts)` : ''
              }.`
            : `RSVP confirmed for ${ev.title}. Check in at venue to earn +${ev.reward_points || 0} pts.`,
          timestamp: Number(ev.date_timestamp || Date.now()),
          badge: {
            label: isCheckedIn ? 'Checked-In' : 'Joined',
            variant: isCheckedIn ? 'emerald' : 'blue',
          },
          iconType: isCheckedIn ? 'check' : 'receipt',
        });
      });

    // 5. User account audit logs directly from database (Register + profile updates)
    const userLogs = Array.isArray(db.user?.logs) ? db.user!.logs : [];
    let hasRegisterLog = false;
    userLogs.forEach((logItem: any, idx: number) => {
      if (String(logItem?.action || '').toLowerCase().includes('register')) {
        hasRegisterLog = true;
      }
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

    if (!hasRegisterLog && db.user) {
      list.push({
        id: `account-register-${db.user.id || db.user.phone_number || 'me'}`,
        category: 'Account',
        title: 'Account Registered',
        description: 'Account created and verified via WhatsApp.',
        timestamp: Number(
          db.user.created_at || db.user.last_active_timestamp || Date.now()
        ),
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
  }, [
    localActivities,
    db.cashback_claims,
    db.transactions,
    db.contest_submissions,
    db.events,
    db.user,
    isAuthenticated,
  ]);

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState<string>(
    String(db.settings.min_withdrawal_amount)
  );
  const [showWithdrawConfirmModal, setShowWithdrawConfirmModal] = useState<boolean>(false);

  // Check if there is an active pending withdrawal in history or transactions
  const hasPendingWithdrawal = useMemo(() => {
    return (
      (db.transactions || []).some(
        (tx) => tx.type === 'withdrawal' && (tx.status === 'pending' || tx.status === 'requested' || tx.status === 'pending_payout')
      ) ||
      (db.history || []).some(
        (h) => h.type === 'withdrawal' && (h.status === 'pending' || h.status === 'pending_payout')
      )
    );
  }, [db.transactions, db.history]);

  const requireRules = db.settings.require_points_for_withdrawal !== false;
  const minPts = Number(db.settings.min_points_to_unlock_withdrawal ?? 100);
  const userPts = Math.max(Number(db.user?.points_balance || 0), totalPts, availablePts);
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

  const formatCompactPoints = (n: number) => {
    return Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  };

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
    if (isNaN(amt) || amt <= 0) {
      return;
    }
    const resolvedPaynow = paynow.trim() || (typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_paynow') || '') : '') || '';
    if (!resolvedPaynow) {
      showToast('Please enter your Singapore PayNow number to withdraw.');
      handleSubTabChange('account');
      return;
    }
    // Open explicit confirmation modal (includes privacy consent & point charges preview)
    setShowWithdrawConfirmModal(true);
  };

  const handleConfirmWithdrawSubmit = () => {
    setShowWithdrawConfirmModal(false);
    const amt = Number(withdrawAmount);
    const resolvedPaynow = paynow.trim() || (typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_paynow') || '') : '') || '';
    requestWithdrawal(amt, resolvedPaynow);
    // Hide withdrawal form box after request
    setWalletActionTab(null);
  };

  // Lazy load activities: first display is 8, load 8 on scroll down
  const [visibleActivityCount, setVisibleActivityCount] = useState<number>(8);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeSubTab !== 'activity') return;
    if (visibleActivityCount >= allActivities.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          setVisibleActivityCount((prev) => Math.min(prev + 8, allActivities.length));
        }
      },
      {
        root: null,
        rootMargin: '120px',
        threshold: 0.1,
      }
    );

    const el = loadMoreRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [activeSubTab, visibleActivityCount, allActivities.length]);

  const visibleActivities = useMemo(() => {
    return allActivities.slice(0, visibleActivityCount);
  }, [allActivities, visibleActivityCount]);

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

  const getBadgeClass = (variant?: 'amber' | 'emerald' | 'rose' | 'blue' | 'zinc' | 'purple' | 'indigo') => {
    switch (variant) {
      case 'amber':
        return 'bg-amber-50 text-amber-600 border border-amber-200';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
      case 'rose':
        return 'bg-rose-50 text-rose-600 border border-rose-200';
      case 'blue':
        return 'bg-blue-50 text-blue-600 border border-blue-200';
      case 'purple':
        return 'bg-purple-50 text-purple-600 border border-purple-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-600 border border-indigo-200';
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
        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            title="Sign Out"
            className="w-9 h-9 rounded-full bg-white/90 text-zinc-600 flex items-center justify-center shadow-2xs active:scale-95 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="w-9 h-9" />
        )}
      </div>

      {/* MODERN WALLET CARD */}
      <div className="w-full p-5 rounded-3xl bg-hsg-wallet-card text-white shadow-md relative z-10">
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
            onClick={() => onOpenTransactions ? onOpenTransactions('cashback') : handleSubTabChange('activity')}
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
            onClick={() => onOpenTransactions ? onOpenTransactions('points') : handleSubTabChange('activity')}
            className="text-right group cursor-pointer transition active:scale-[0.98]"
            title="View Points Transaction History"
          >
            <div className="text-[11px] text-zinc-300 font-medium group-hover:text-white transition flex items-center justify-end gap-1">
              <span>Reward Points</span>
              <span className="opacity-60 group-hover:opacity-100">→</span>
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mt-0.5 whitespace-nowrap">
              {formatCompactPoints(totalPts)}{' '}
              <span className="text-xs font-bold text-[#FFEA00]">pts</span>
            </div>
            <div className="text-[11px] text-zinc-300 font-medium mt-1">
              Available to use: <strong className="text-white font-bold">{formatCompactPoints(availablePts)} pts</strong>
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

          {/* Withdrawal Input & Submit Button */}
          {hasPendingWithdrawal ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-center space-y-1">
              <div className="text-xs font-bold text-amber-900">Withdrawal Request in Progress</div>
              <div className="text-[11px] text-amber-700">Your pending payout is being processed by Admin within {db.settings.withdrawal_sla_text}.</div>
            </div>
          ) : isWithdrawalUnlocked ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.50"
                  min={db.settings.min_withdrawal_amount}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  onFocus={(e) => handleScrollInputToCenter(e.currentTarget)}
                  placeholder={`Min ${db.settings.min_withdrawal_amount}`}
                  className="flex-1 h-10 px-3.5 rounded-full bg-[#F6F6F9] text-[#141416] font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20"
                />
                <button
                  type="submit"
                  className="px-5 h-10 rounded-full font-bold text-xs shrink-0 shadow-xs transition bg-[#EC008C] text-white active:scale-95 cursor-pointer"
                >
                  Withdraw
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                <span>PayNow: <strong className="text-zinc-800 font-semibold">{paynow.trim() || 'Not set'}</strong></span>
                {Number(db.settings.withdrawal_points_fee ?? 0) > 0 ? (
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80 text-[10px]">
                    Fee: {db.settings.withdrawal_points_fee} pts
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-400">Within {db.settings.withdrawal_sla_text}</span>
                )}
              </div>
            </div>
          ) : null}
        </form>
      )}

      {/* ZERO-HEIGHT ANCHOR FOR PRECISE DOCKING (Immune to sticky offsets & header heights) */}
      <div ref={tabsAnchorRef} className="w-full h-0 -mb-5 pointer-events-none" />

      {/* FLOATING PILL TABS WITH SOFT FADE TO ZERO AT BOTTOM EDGE */}
      <div
        ref={tabsStickyRef}
        className="sticky top-0 z-20 -mx-5 px-5 pt-2 pb-3 pointer-events-auto"
      >
        {/* Soft fading backdrop: dynamically matches theme color, covers scrolling body content, and appears only when 100% stuck */}
        <div
          className={`absolute inset-x-0 top-0 bottom-0 pointer-events-none -z-10 transition-opacity duration-200 ${
            isTabsStuck ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background:
              'linear-gradient(to bottom, var(--hsg-color-1, #FFEA00) 0%, color-mix(in srgb, var(--hsg-color-1, #FFEA00) 60%, transparent) 55%, transparent 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            maskImage:
              'linear-gradient(to bottom, black 0%, black 65%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 0%, black 65%, transparent 100%)',
          }}
        />

        <div className="w-full grid grid-cols-3 gap-2">
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
              onClick={() => handleSubTabChange(tab.id)}
              className={`h-10 rounded-full text-xs font-bold transition shadow-xs cursor-pointer select-none ${
                activeSubTab === tab.id
                  ? 'bg-[#141416] text-[#FFEA00] shadow-sm'
                  : 'bg-white/95 hover:bg-white text-[#141416] shadow-2xs'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. ACCOUNT ACTIVITY HISTORY (All claims, settings, security & balance events) */}
      {activeSubTab === 'activity' && (
        <div className="w-full space-y-3 min-h-[calc(100dvh-180px)] pt-2 pb-12 animate-in fade-in duration-200">
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
              {visibleActivities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => {
                    if (act.category === 'Order' && act.orderData) {
                      setSelectedReceiptOrder(act.orderData);
                    }
                  }}
                  className={`w-full p-3.5 rounded-2xl bg-white shadow-2xs flex items-start gap-3 transition ${
                    act.category === 'Order' ? 'cursor-pointer hover:bg-zinc-50/80 active:scale-[0.99]' : ''
                  }`}
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

              {/* Lazy Load Sentinel & Load More Trigger */}
              {visibleActivityCount < allActivities.length ? (
                <div ref={loadMoreRef} className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleActivityCount((prev) => Math.min(prev + 8, allActivities.length))}
                    className="w-full h-10 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200/80 text-xs font-bold text-zinc-700 shadow-2xs active:scale-[0.99] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                    <span>Loading more activities...</span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      ({visibleActivities.length} of {allActivities.length})
                    </span>
                  </button>
                </div>
              ) : allActivities.length > 8 ? (
                <div className="pt-2 text-center text-[11px] text-zinc-400 font-medium">
                  All {allActivities.length} activities loaded
                </div>
              ) : null}
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
          onFocus={handleFormFocus}
          onBlur={handleFormBlur}
          className={`w-full p-5 rounded-3xl bg-white shadow-xs space-y-4 transition-all duration-200 min-h-[calc(100dvh-180px)] animate-in fade-in mt-2 ${
            isInputFocused ? 'mb-80' : 'mb-36'
          }`}
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
                  ? (storedAuthPhone.startsWith('+') ? storedAuthPhone : `+${storedAuthPhone}`)
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
              onFocus={(e) => { isEditingRef.current = true; setIsInputFocused(true); handleScrollInputToCenter(e.currentTarget); }}
              className="w-full h-10 px-3.5 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700">
              PayNow Number
            </label>
            <input
              type="text"
              value={paynow}
              placeholder="e.g. 83494429 or UEN"
              onChange={(e) => { isEditingRef.current = true; setPaynow(e.target.value); }}
              onFocus={(e) => { isEditingRef.current = true; setIsInputFocused(true); handleScrollInputToCenter(e.currentTarget); }}
              className="w-full h-10 px-3.5 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:bg-white transition"
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
                  onFocus={(e) => { isEditingRef.current = true; setIsInputFocused(true); handleScrollInputToCenter(e.currentTarget); }}
                  placeholder="@username"
                  className="w-full h-9 px-3 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:bg-white transition"
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
                  onFocus={(e) => { isEditingRef.current = true; setIsInputFocused(true); handleScrollInputToCenter(e.currentTarget); }}
                  placeholder="@username"
                  className="w-full h-9 px-3 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:bg-white transition"
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
                  onFocus={(e) => { isEditingRef.current = true; setIsInputFocused(true); handleScrollInputToCenter(e.currentTarget); }}
                  placeholder="username"
                  className="w-full h-9 px-3 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:bg-white transition"
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
                  onFocus={(e) => { isEditingRef.current = true; setIsInputFocused(true); handleScrollInputToCenter(e.currentTarget); }}
                  placeholder="@username"
                  className="w-full h-9 px-3 mt-1 rounded-xl bg-[#F6F6F9] text-[#141416] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/20 focus:bg-white transition"
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
        <div className="w-full space-y-4 min-h-[calc(100dvh-180px)] pt-2 pb-12 animate-in fade-in duration-200">
          {/* 1. CONTEST WINNER PRIZES TO CLAIM */}
          {userWinningPrizes.length > 0 && (
            <div className="w-full space-y-2.5">
              <div className="flex items-center gap-1.5 px-1">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold text-[#141416] uppercase tracking-wide">
                  Contest Winner Rewards
                </h3>
              </div>

              {userWinningPrizes.map((win) => {
                const contestObj = db.contests.find((c) => c.id === win.contest_id);
                const isClaimed = Boolean(win.claimed);
                const winPhoto = win.product_image || win.prize_photo_url;
                const winTitle = win.prize_title || win.product_name || 'Contest Prize';

                const botPhone = (
                  db.settings?.whatsapp_bot_number ||
                  (db.settings as any)?.whatsapp_number ||
                  '6584755948'
                ).replace(/\D/g, '');
                const claimText = `Hi HSG+ Team! I would like to claim my contest prize:\n\nContest: ${
                  contestObj?.frontpage_title || contestObj?.title || 'Contest'
                }\nPrize: ${winTitle}\nCode: CLAIM-WIN-${win.id}\n\nPlease verify and credit my prize. Thank you!`;
                const waClaimUrl = `https://wa.me/${botPhone}?text=${encodeURIComponent(
                  claimText
                )}`;

                const rewardParts: string[] = [];
                if (win.reward_cash && Number(win.reward_cash) > 0) {
                  rewardParts.push(`+$${Number(win.reward_cash).toFixed(2)} Cash`);
                }
                if (win.reward_points && Number(win.reward_points) > 0) {
                  rewardParts.push(`+${win.reward_points} pts`);
                }
                if (win.product_name) {
                  rewardParts.push(`🎁 ${win.product_name}`);
                }
                const rewardSummary =
                  rewardParts.length > 0
                    ? rewardParts.join(' • ')
                    : win.reward_type === 'point'
                    ? `+${win.reward_points || 0} pts`
                    : `+$${Number(win.reward_cash || 0).toFixed(2)} Cash`;

                return (
                  <div
                    key={win.id}
                    className="w-full p-4 rounded-3xl bg-white shadow-xs border border-amber-200/60 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      {winPhoto ? (
                        <img
                          src={winPhoto}
                          alt={winTitle}
                          className="w-14 h-14 rounded-2xl object-cover bg-amber-50 border border-amber-200 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                          <Trophy className="w-7 h-7" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold uppercase text-amber-600">
                          {contestObj?.frontpage_title || contestObj?.title || 'Contest Reward'}
                        </div>
                        <h4 className="text-sm font-extrabold text-[#141416] truncate">
                          {winTitle}
                        </h4>
                        {win.prize_description && (
                          <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                            {win.prize_description}
                          </p>
                        )}
                        <div className="text-xs font-extrabold text-[#0B57D0] mt-1">
                          Reward: {rewardSummary}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      {isClaimed ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 w-fit">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Prize Claimed &amp; Credited</span>
                          </div>
                          {win.delivery_address && (
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-left">
                              <div className="text-[10px] font-bold uppercase text-zinc-500">
                                Delivery Address (Saved)
                              </div>
                              <div className="text-xs text-zinc-800 whitespace-pre-line mt-0.5 font-medium leading-relaxed">
                                {win.delivery_address}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <a
                          href={waClaimUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full h-11 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-extrabold shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4 fill-white" />
                          <span>Claim Prize via WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. ACHIEVEMENTS LIST */}
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
              <div className="w-full py-16 px-6 rounded-3xl bg-white text-center space-y-3 shadow-2xs border border-zinc-200/60">
                <div className="w-14 h-14 mx-auto rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <Trophy className="w-7 h-7 text-zinc-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-900">No achievements yet</div>
                  <div className="text-xs text-zinc-500 max-w-xs mx-auto mt-1 leading-relaxed">
                    Complete challenges, attend events, and refer friends to unlock badges and bonus points!
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* PAYNOW WITHDRAWAL CONFIRMATION POPUP MODAL */}
      {showWithdrawConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-zinc-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EC008C]/10 flex items-center justify-center text-[#EC008C]">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Confirm PayNow Withdrawal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdrawConfirmModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payout Breakdown Card */}
            <div className="bg-[#F8F9FA] rounded-2xl p-4 border border-slate-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Cash Withdrawal</span>
                <span className="text-base font-black text-zinc-900">
                  ${Number(withdrawAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">PayNow Destination</span>
                <span className="font-mono font-bold text-zinc-800">
                  {paynow.trim() || (typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_paynow') || '') : '') || 'Not set'}
                </span>
              </div>
              {Number(db.settings.withdrawal_points_fee ?? 0) > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-zinc-500 font-medium">Processing Fee</span>
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[11px] border border-amber-200/60">
                    -${db.settings.withdrawal_points_fee} pts
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className="text-zinc-500 font-medium">Transfer SLA</span>
                <span className="font-semibold text-zinc-700">
                  Within {db.settings.withdrawal_sla_text}
                </span>
              </div>
            </div>

            {/* PRIVACY MODE EXTRA TEXT VS STANDARD CONFIRMATION */}
            {(privacyMode ?? db.user?.privacy_mode ?? db.user?.privacy?.mode ?? true) ? (
              <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Privacy Mode</span>
                </div>
                <p className="text-[11px] text-emerald-800 font-medium leading-normal">
                  You authorize HSG+ to view your PayNow number (<strong>{paynow.trim() || (typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_paynow') || '') : '') || 'Not set'}</strong>) to send this payout.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                  <CheckCircle2 className="w-4 h-4 text-zinc-600 shrink-0" />
                  <span>Confirm PayNow</span>
                </div>
                <p className="text-[11px] text-zinc-600 font-medium leading-normal">
                  Payout will be transferred to <strong>{paynow.trim() || (typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_paynow') || '') : '') || 'Not set'}</strong>.
                </p>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowWithdrawConfirmModal(false)}
                className="flex-1 h-11 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 font-bold text-xs text-zinc-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWithdrawSubmit}
                className="flex-1 h-11 rounded-full bg-[#EC008C] hover:bg-[#d6007e] text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                Confirm & Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAILS RECEIPT MODAL */}
      {selectedReceiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-zinc-200 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Store Receipt Header */}
            <div className="text-center pb-2.5 border-b-2 border-dashed border-zinc-200">
              <div className="text-[10px] font-extrabold tracking-widest text-zinc-400 uppercase">
                HSG+ Official Store
              </div>
              <h3 className="text-base font-black text-[#141416] mt-0.5 tracking-tight">
                PURCHASE RECEIPT
              </h3>
              <div className="text-[11px] font-mono font-bold text-zinc-500 mt-0.5">
                #{selectedReceiptOrder.id.replace(/^LDG-/, '')}
              </div>
            </div>

            {/* Order Details Metadata */}
            <div className="text-xs space-y-1.5 py-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Order Date:</span>
                <span className="font-semibold text-zinc-800">
                  {new Date(Number(selectedReceiptOrder.created_at || Date.now())).toLocaleString('en-SG', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Status:</span>
                <span className="font-bold uppercase text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {selectedReceiptOrder.status || 'Order Placed'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Customer Phone:</span>
                <span className="font-mono font-bold text-zinc-800">
                  {(() => {
                    const raw = selectedReceiptOrder.user_phone || storedAuthPhone || db.user?.phone_number || '';
                    const c = raw.replace(/\D/g, '');
                    if (c.length === 10 && c.startsWith('65')) return `+65 ${c.slice(2, 6)} ${c.slice(6)}`;
                    if (c.length === 8) return `+65 ${c.slice(0, 4)} ${c.slice(4)}`;
                    return raw || '-';
                  })()}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 pt-1 border-t border-zinc-100">
                <span className="text-zinc-500 font-medium shrink-0">Fulfillment:</span>
                <div className="text-right">
                  <div className="font-bold text-zinc-800">
                    {String(selectedReceiptOrder.fulfillment_method || selectedReceiptOrder.fulfillment || '').toLowerCase() === 'delivery'
                      ? 'Home Delivery'
                      : 'Self-Pickup'}
                  </div>
                  {String(selectedReceiptOrder.fulfillment_method || selectedReceiptOrder.fulfillment || '').toLowerCase() === 'delivery' ? (
                    <div className="text-[11px] text-zinc-600 max-w-[200px] leading-tight mt-0.5">
                      {selectedReceiptOrder.delivery_address || 'Address provided'}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-600 max-w-[200px] leading-tight mt-0.5">
                      {db.settings.self_collect_address || 'HSG Global HQ, Singapore'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3-Step Order Progress Tracker */}
            {(() => {
              const st = String(selectedReceiptOrder.status || 'pending').toLowerCase();
              const isDelivered = st === 'delivered' || st === 'completed' || st === 'fulfilled';
              const isPreparing = st === 'preparing' || st === 'processing' || st === 'prepare' || st === 'shipped' || st === 'ready';
              const step = isDelivered ? 3 : isPreparing ? 2 : 1;
              return (
                <div className="py-2.5 px-3 rounded-2xl bg-[#F6F6F9] border border-zinc-200/60">
                  <div className="flex items-center justify-between relative px-2 pt-1 pb-1">
                    <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-zinc-200 z-0" />
                    <div
                      className={`absolute top-3.5 left-6 h-0.5 z-0 transition-all duration-300 ${
                        step >= 3 ? 'right-6 bg-emerald-500' : step >= 2 ? 'w-1/2 bg-amber-500' : 'w-0'
                      }`}
                    />

                    {/* Step 1 */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step >= 1 ? 'bg-[#0B57D0] text-white shadow-xs' : 'bg-zinc-200 text-zinc-400'
                      }`}>
                        {step > 1 ? '✓' : '1'}
                      </div>
                      <span className="text-[9px] font-bold text-zinc-600 mt-1">Order Placed</span>
                    </div>

                    {/* Step 2 */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step > 2 ? 'bg-emerald-500 text-white' : step === 2 ? 'bg-amber-500 text-white ring-2 ring-amber-200' : 'bg-zinc-200 text-zinc-400'
                      }`}>
                        {step > 2 ? '✓' : '2'}
                      </div>
                      <span className="text-[9px] font-bold text-zinc-600 mt-1">Preparing</span>
                    </div>

                    {/* Step 3 */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step >= 3 ? 'bg-emerald-500 text-white shadow-xs' : 'bg-zinc-200 text-zinc-400'
                      }`}>
                        {step >= 3 ? '✓' : '3'}
                      </div>
                      <span className="text-[9px] font-bold text-zinc-600 mt-1">Delivered</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Itemized Items Table: item name | qty | amount | pts */}
            <div className="py-2.5 border-t-2 border-b-2 border-dashed border-zinc-200 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Purchased Items
              </div>

              {/* Table Column Headers */}
              <div className="grid grid-cols-12 text-[10px] font-black text-zinc-400 uppercase pb-1 border-b border-zinc-100">
                <span className="col-span-6">Item Name</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-2 text-right">Pts</span>
              </div>

              {/* Table Rows */}
              <div className="space-y-2 pt-0.5">
                {(selectedReceiptOrder.items && selectedReceiptOrder.items.length > 0) ? (
                  selectedReceiptOrder.items.map((item: any, idx: number) => {
                    const pts = Number(item.points || 0);
                    const cash = Number(item.cash || item.price || 0);
                    const qty = Number(item.qty || 1);
                    return (
                      <div key={idx} className="grid grid-cols-12 text-xs items-center gap-1">
                        <div className="col-span-6 min-w-0 pr-1">
                          <div className="font-bold text-zinc-900 leading-snug line-clamp-2">
                            {item.name || 'Merch Item'}
                          </div>
                        </div>
                        <div className="col-span-2 text-center font-bold text-zinc-700">
                          {qty}
                        </div>
                        <div className="col-span-2 text-right font-bold text-[#EC008C]">
                          {cash > 0 ? `$${(cash * qty).toFixed(2)}` : '$0.00'}
                        </div>
                        <div className="col-span-2 text-right font-bold text-zinc-900">
                          {pts > 0 ? `${(pts * qty).toLocaleString()}` : '0'}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-zinc-400 italic">Merchandise Item</div>
                )}
              </div>
            </div>

            {/* Totals Summary */}
            <div className="space-y-1.5 text-xs py-1">
              <div className="flex items-center justify-between text-zinc-600">
                <span>Delivery Fee:</span>
                <span className="font-semibold text-zinc-800">
                  {Number(selectedReceiptOrder.delivery_fee || 0) > 0
                    ? `$${Number(selectedReceiptOrder.delivery_fee).toFixed(2)}`
                    : '$0.00 (Free)'}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm font-black text-zinc-950 pt-1.5 border-t border-zinc-100">
                <span>Total Paid:</span>
                <span className="text-[#EC008C]">
                  {Number(selectedReceiptOrder.total_points || 0) > 0
                    ? `${Number(selectedReceiptOrder.total_points).toLocaleString()} pts`
                    : ''}
                  {Number(selectedReceiptOrder.total_points || 0) > 0 && Number(selectedReceiptOrder.total_cash || 0) > 0
                    ? ' + '
                    : ''}
                  {Number(selectedReceiptOrder.total_cash || 0) > 0
                    ? `$${Number(selectedReceiptOrder.total_cash).toFixed(2)}`
                    : ''}
                  {Number(selectedReceiptOrder.total_points || 0) === 0 && Number(selectedReceiptOrder.total_cash || 0) === 0
                    ? '$0.00'
                    : ''}
                </span>
              </div>
            </div>

            {/* Receipt Footer Message */}
            <div className="text-center pt-2 border-t border-zinc-100 text-[10px] text-zinc-400">
              Thank you for shopping with HSG+!
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedReceiptOrder(null)}
              className="w-full h-11 rounded-full bg-[#141416] hover:bg-zinc-800 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center mt-1"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};