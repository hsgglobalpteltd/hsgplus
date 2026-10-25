import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Award,
  ShoppingBag,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { HsgTransaction } from '../types';

interface TransactionHistoryPageProps {
  onBack: () => void;
  initialTab?: 'cashback' | 'points';
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
}> = ({ initialTab = 'cashback' }) => {
  const { db } = useHsgData();
  const [activeTab, setActiveTab] = useState<'cashback' | 'points'>(initialTab);

  // Deduplicate transactions by reference_id so pending -> verified stays on the exact same row
  const unifiedTransactions = useMemo(() => {
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
  }, [db.transactions, db.history, db.user?.phone_number]);

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
    <div className="w-full space-y-3">
      {/* 2-TAB SWITCHER: Cashback | Points */}
      <div className="w-full grid grid-cols-2 gap-1.5 p-1 rounded-full bg-white shadow-2xs border border-slate-100">
        <button
          type="button"
          onClick={() => setActiveTab('cashback')}
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
          onClick={() => setActiveTab('points')}
          className={`h-9 rounded-full text-xs font-bold transition cursor-pointer ${
            activeTab === 'points'
              ? 'bg-[#141416] text-[#FFEA00]'
              : 'text-zinc-500 hover:text-[#141416]'
          }`}
        >
          Points
        </button>
      </div>

      {/* SIMPLE CLEAN LIST CARD */}
      {filteredRows.length === 0 ? (
        <div className="w-full py-10 px-4 rounded-2xl bg-white text-center text-xs text-zinc-400 shadow-2xs border border-slate-100/80">
          No {activeTab === 'cashback' ? 'cashback' : 'points'} transactions yet.
        </div>
      ) : (
        <div className="w-full rounded-2xl bg-white shadow-2xs border border-slate-100/80 divide-y divide-slate-100 overflow-hidden">
          {filteredRows.map((tx) => {
            const cashAmt = Number(
              tx.amount_cashback ??
                tx.net_cashback ??
                tx.cashback_amount ??
                tx.amount ??
                0
            );
            const ptsAmt = getPointsAmount(tx);
            const rawVal = activeTab === 'cashback' ? cashAmt : (ptsAmt > 0 ? ptsAmt : 50);
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

            return (
              <div
                key={tx.id}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3"
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

                {/* Right-Aligned Amount: Orange when pending, Green once verified, Dark when withdrawal/out */}
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
        </div>
      )}
    </div>
  );
};

export const TransactionHistoryPage: React.FC<TransactionHistoryPageProps> = ({
  onBack,
  initialTab = 'cashback',
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

      {/* 2-Tab Simple Transaction List */}
      <SimpleTransactionList initialTab={initialTab} />
    </div>
  );
};
