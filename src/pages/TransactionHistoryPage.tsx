import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Award,
  Check,
  ChevronDown,
  Loader2,
  ShoppingBag,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { HsgTransaction } from '../types';

interface TransactionHistoryPageProps {
  onBack: () => void;
  initialTab?: 'cashback' | 'points';
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function getSimpleTxLabel(
  tx: HsgTransaction,
  mode: 'cashback' | 'points'
): string {
  const t = (tx.type || '').toLowerCase();
  const title = (tx.title || '').toLowerCase();
  const cashAmt = Number(
    tx.amount_cashback ?? tx.net_cashback ?? tx.cashback_amount ?? tx.amount ?? 0
  );
  const ptsAmt = Number(tx.amount_points ?? tx.net_points ?? tx.points ?? 0);
  const isOut =
    tx.direction === 'out' ||
    (mode === 'cashback' ? cashAmt < 0 : ptsAmt < 0);

  if (mode === 'cashback') {
    if (t.includes('withdraw') || title.includes('withdraw')) {
      return 'Withdrawal';
    }
    if (
      t.includes('merch') ||
      t.includes('redeem') ||
      title.includes('shop') ||
      title.includes('redeem')
    ) {
      return 'HSG+ Shop';
    }
    if (t.includes('welcome') || title.includes('welcome')) {
      return 'Welcome Bonus';
    }
    if (t.includes('referral') || title.includes('referral')) {
      return 'Friend Referral';
    }
    if (t.includes('event') || title.includes('event')) {
      return isOut ? 'Event Join' : 'Event Cashback';
    }
    if (isOut) {
      return 'Withdrawal';
    }
    return 'Cashback Earn';
  } else {
    if (
      t.includes('merch') ||
      t.includes('redeem') ||
      title.includes('shop') ||
      title.includes('redeem')
    ) {
      return 'Points Redeem';
    }
    if (t.includes('checkin') || title.includes('check-in')) {
      return 'Event Check-In';
    }
    if (t.includes('contest') || title.includes('contest')) {
      return 'Contest Points';
    }
    if (t.includes('welcome') || title.includes('welcome')) {
      return 'Welcome Points';
    }
    if (t.includes('referral') || title.includes('referral')) {
      return 'Friend Referral';
    }
    if (isOut) {
      return 'Points Redeem';
    }
    return 'Points Earn';
  }
}

export const SimpleTransactionList: React.FC<{
  initialTab?: 'cashback' | 'points';
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}> = ({ initialTab = 'cashback', scrollContainerRef }) => {
  const { db, isAuthenticated } = useHsgData();
  const [activeTab, setActiveTab] = useState<'cashback' | 'points'>(initialTab);

  // Pagination state: First load 10 cards, +10 each pull/load
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Pull-to-load-more touch state
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const touchStartY = useRef<number | null>(null);

  // Card element refs & animation scales for bottom shrink effect
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [scales, setScales] = useState<{ [index: number]: number }>({});
  const [opacities, setOpacities] = useState<{ [index: number]: number }>({});
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Reset pagination when active tab changes
  const handleTabChange = (tab: 'cashback' | 'points') => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
    setPullDistance(0);
    setIsPulling(false);
  };

  // Deduplicate transactions by reference_id so pending -> verified stays on the exact same row
  const unifiedTransactions = useMemo(() => {
    if (!isAuthenticated) return [];
    const rawList: HsgTransaction[] =
      db.transactions && db.transactions.length > 0
        ? db.transactions
        : (db.history || []).map((h) => ({
            id: h.id,
            user_phone: db.user?.phone_number || '',
            currency:
              h.points && h.amount
                ? 'both'
                : h.points
                ? 'points'
                : 'cashback',
            direction:
              h.amount < 0 || (h.points && h.points < 0) ? 'out' : 'in',
            amount_cashback: Math.abs(h.amount || 0),
            amount_points: Math.abs(h.points || 0),
            net_cashback: h.amount || 0,
            net_points: h.points || 0,
            amount: h.amount || 0,
            points: h.points || 0,
            type: h.type || 'cashback_claim',
            status:
              h.status === 'pending_payout' || h.status === 'pending'
                ? 'pending'
                : h.status === 'rejected'
                ? 'rejected'
                : 'completed',
            title: h.title,
            created_at: h.timestamp,
            timestamp: h.timestamp,
          }));

    const byRef = new Map<string, HsgTransaction>();
    const deduped: HsgTransaction[] = [];

    for (const item of rawList) {
      const refId = String(item.reference_id || '').trim();
      if (!refId) {
        deduped.push(item);
        continue;
      }
      if (!byRef.has(refId)) {
        const copy = { ...item };
        byRef.set(refId, copy);
        deduped.push(copy);
      } else {
        const existing = byRef.get(refId)!;
        const t1 = Number(existing.created_at || existing.timestamp || 0);
        const t2 = Number(item.created_at || item.timestamp || 0);
        const earliest = t1 && t2 ? Math.min(t1, t2) : t1 || t2;
        if (existing.status === 'pending' && item.status !== 'pending') {
          Object.assign(existing, item, {
            created_at: earliest,
            timestamp: earliest,
          });
        } else {
          existing.created_at = earliest;
          existing.timestamp = earliest;
        }
      }
    }

    return deduped.sort(
      (a, b) =>
        Number(b.created_at || b.timestamp || 0) -
        Number(a.created_at || a.timestamp || 0)
    );
  }, [db.transactions, db.history, db.user?.phone_number, isAuthenticated]);

  const getPointsAmount = (tx: HsgTransaction): number => {
    const directPts = Number(tx.amount_points ?? tx.net_points ?? tx.points ?? 0);
    if (directPts > 0) return directPts;
    const desc = String(tx.description || tx.title || '');
    const match = desc.match(/\+\s*(\d+)\s*pts/i);
    if (match) return parseInt(match[1], 10);
    return 0;
  };

  const filteredRows = useMemo(() => {
    return unifiedTransactions.filter((tx) => {
      const cashAmt = Number(
        tx.amount_cashback ??
          tx.net_cashback ??
          tx.cashback_amount ??
          tx.amount ??
          0
      );
      const ptsAmt = getPointsAmount(tx);

      if (activeTab === 'cashback') {
        return cashAmt !== 0 || (tx.currency === 'cashback' && ptsAmt === 0);
      } else {
        return (
          ptsAmt > 0 ||
          tx.currency === 'points' ||
          tx.currency === 'both' ||
          (tx.type && (
            tx.type.includes('referral') ||
            tx.type.includes('welcome') ||
            tx.type.includes('checkin') ||
            tx.type.includes('contest') ||
            tx.type.includes('merch')
          ))
        );
      }
    });
  }, [unifiedTransactions, activeTab]);

  // Sliced 10-card paginated subset
  const displayedRows = useMemo(() => {
    return filteredRows.slice(0, visibleCount);
  }, [filteredRows, visibleCount]);

  const hasMore = visibleCount < filteredRows.length;

  const getScrollContainer = useCallback((): HTMLElement | null => {
    if (scrollContainerRef?.current) return scrollContainerRef.current;
    if (listContainerRef.current) {
      const mainEl = listContainerRef.current.closest('main');
      if (mainEl) return mainEl as HTMLElement;
    }
    return document.documentElement;
  }, [scrollContainerRef]);

  // Dynamic Scroll Perspective: Cards near the bottom edge scale down slightly
  const updateCardScales = useCallback(() => {
    const scrollEl = getScrollContainer();
    const containerBottom = scrollEl
      ? scrollEl.getBoundingClientRect().bottom
      : window.innerHeight;

    const newScales: { [index: number]: number } = {};
    const newOpacities: { [index: number]: number } = {};

    cardRefs.current.forEach((el, index) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distanceToBottom = containerBottom - rect.bottom;

      // When the card is within 140px of bottom, subtly scale down and soften opacity
      if (distanceToBottom < 130) {
        const factor = Math.max(0, Math.min(1.4, (130 - distanceToBottom) / 130));
        // Scale smoothly from 1.0 down to 0.92
        const s = Number((1 - factor * 0.08).toFixed(3));
        // Opacity smoothly from 1.0 down to 0.82
        const o = Number((1 - factor * 0.18).toFixed(3));
        newScales[index] = s;
        newOpacities[index] = o;
      } else {
        newScales[index] = 1;
        newOpacities[index] = 1;
      }
    });

    setScales(newScales);
    setOpacities(newOpacities);
  }, [getScrollContainer]);

  useEffect(() => {
    const scrollEl = getScrollContainer();
    if (!scrollEl) return;

    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateCardScales);
    };

    // Initial scale calculation
    handleScroll();

    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [getScrollContainer, updateCardScales, displayedRows.length]);

  // Trigger load 10 more cards
  const triggerLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setIsPulling(false);

    window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredRows.length));
      setIsLoadingMore(false);
      setPullDistance(0);
    }, 320);
  }, [isLoadingMore, hasMore, filteredRows.length]);

  // Touch Pull-Up Gesture Handlers (Active when user reaches the bottom of the list)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLoadingMore || !hasMore) return;
    const scrollEl = getScrollContainer();
    if (!scrollEl) return;

    const isNearBottom =
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 30;
    if (isNearBottom) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isLoadingMore || !hasMore) return;
    const currentY = e.touches[0].clientY;
    const diffY = touchStartY.current - currentY; // Positive when pulling UP

    if (diffY > 0) {
      setIsPulling(true);
      // Damped rubber-band resistance
      const damped = Math.min(75, Math.pow(diffY, 0.82) * 1.6);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;

    if (pullDistance >= 40 && hasMore && !isLoadingMore) {
      triggerLoadMore();
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    const datePart = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} • ${timePart}`;
  };

  return (
    <div
      ref={listContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full space-y-3"
    >
      {/* 2-TAB SWITCHER: Cashback | Points */}
      <div className="w-full grid grid-cols-2 gap-1.5 p-1 rounded-full bg-white shadow-2xs border border-slate-100">
        <button
          type="button"
          onClick={() => handleTabChange('cashback')}
          className={`h-9 rounded-full text-xs font-bold transition cursor-pointer ${
            activeTab === 'cashback'
              ? 'bg-[#141416] text-[#FFEA00]'
              : 'text-zinc-500 hover:text-[#141416]'
          }`}
        >
          Cashback
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('points')}
          className={`h-9 rounded-full text-xs font-bold transition cursor-pointer ${
            activeTab === 'points'
              ? 'bg-[#141416] text-[#FFEA00]'
              : 'text-zinc-500 hover:text-[#141416]'
          }`}
        >
          Points
        </button>
      </div>

      {/* INDIVIDUAL CARD HISTORY LIST WITH SCROLL PERSPECTIVE */}
      {filteredRows.length === 0 ? (
        <div className="w-full py-10 px-4 rounded-2xl bg-white text-center text-xs text-zinc-400 shadow-2xs border border-slate-100/80">
          No {activeTab === 'cashback' ? 'cashback' : 'points'} transactions yet.
        </div>
      ) : (
        <div className="w-full space-y-2.5">
          {displayedRows.map((tx, index) => {
            const cashAmt = Number(
              tx.amount_cashback ??
                tx.net_cashback ??
                tx.cashback_amount ??
                tx.amount ??
                0
            );
            const ptsAmt = getPointsAmount(tx);
            const rawVal =
              activeTab === 'cashback' ? cashAmt : ptsAmt > 0 ? ptsAmt : 50;
            const isOut =
              tx.direction === 'out' ||
              (activeTab === 'cashback'
                ? (tx.net_cashback ?? cashAmt) < 0
                : (tx.net_points ?? ptsAmt) < 0);
            const isPending =
              tx.status === 'pending' || tx.status === 'pending_payout';
            const isRejected = tx.status === 'rejected';
            const label = getSimpleTxLabel(tx, activeTab);
            const ts = Number(tx.created_at || tx.timestamp || Date.now());

            const scale = scales[index] ?? 1;
            const opacity = opacities[index] ?? 1;

            return (
              <div
                key={tx.id}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                style={{
                  transform: `scale(${scale})`,
                  opacity: opacity,
                  transformOrigin: 'center bottom',
                  willChange: 'transform, opacity',
                  transition:
                    'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease-out',
                }}
                className="w-full px-4 py-3.5 rounded-2xl bg-white shadow-2xs border border-slate-100/80 flex items-center justify-between gap-3 animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                    {label.includes('Shop') || label.includes('Redeem') ? (
                      <ShoppingBag className="w-4 h-4" />
                    ) : activeTab === 'points' ? (
                      <Award className="w-4 h-4" />
                    ) : isOut ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#141416] truncate">
                      {label}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-medium mt-0.5">
                      {formatDateTime(ts)}
                    </div>
                  </div>
                </div>

                {/* Right-Aligned Amount */}
                <div
                  className={`text-sm font-extrabold tracking-tight tabular-nums shrink-0 ${
                    isRejected
                      ? 'text-rose-500 line-through'
                      : isPending
                      ? 'text-amber-500'
                      : isOut
                      ? 'text-[#141416]'
                      : 'text-emerald-500'
                  }`}
                >
                  {activeTab === 'cashback'
                    ? isOut
                      ? `-$${Math.abs(rawVal).toFixed(2)}`
                      : `+$${Math.abs(rawVal).toFixed(2)}`
                    : isOut
                    ? `-${Math.abs(Math.round(rawVal))} pts`
                    : `+${Math.abs(Math.round(rawVal))} pts`}
                </div>
              </div>
            );
          })}

          {/* BOTTOM PULL / LOAD MORE INTERACTION CARD */}
          {hasMore ? (
            <div
              style={{
                transform: isPulling
                  ? `translateY(-${Math.min(pullDistance * 0.35, 20)}px)`
                  : undefined,
                transition: isPulling ? 'none' : 'transform 0.25s ease-out',
              }}
              className="pt-3 pb-6 flex flex-col items-center justify-center text-center"
            >
              <button
                type="button"
                onClick={triggerLoadMore}
                disabled={isLoadingMore}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer ${
                  pullDistance >= 40
                    ? 'bg-[#141416] text-[#FFEA00] scale-105'
                    : 'bg-white text-zinc-700 hover:text-zinc-900 border border-slate-200/80 active:scale-95'
                }`}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    <span>Loading 10 more...</span>
                  </>
                ) : isPulling ? (
                  <>
                    <ArrowUp
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        pullDistance >= 40
                          ? 'rotate-180 text-[#FFEA00]'
                          : 'text-zinc-400'
                      }`}
                    />
                    <span>
                      {pullDistance >= 40
                        ? 'Release to load 10 more'
                        : 'Pull up to load more'}
                    </span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Pull or Tap for 10 More</span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      ({displayedRows.length} of {filteredRows.length})
                    </span>
                  </>
                )}
              </button>
            </div>
          ) : filteredRows.length > 0 ? (
            <div className="pt-3 pb-6 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100/80 text-[11px] font-semibold text-zinc-400">
                <Check className="w-3 h-3 text-emerald-500" />
                <span>All {filteredRows.length} transactions loaded</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export const TransactionHistoryPage: React.FC<TransactionHistoryPageProps> = ({
  onBack,
  initialTab = 'cashback',
  scrollContainerRef,
}) => {
  return (
    <div className="w-full px-5 pt-2 pb-6 space-y-4">
      {/* Header Row */}
      <div className="relative flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          title="Back"
          className="w-9 h-9 rounded-full bg-white/90 text-[#141416] flex items-center justify-center shadow-2xs active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-[#141416] pointer-events-none">
          Transaction History
        </span>
        <div className="w-9 h-9" />
      </div>

      {/* 2-Tab Simple Transaction List with Bottom Scale & Pull-to-Load-More */}
      <SimpleTransactionList
        initialTab={initialTab}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  );
};
