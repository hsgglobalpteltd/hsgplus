import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Gift,
  Share2,
  Users,
  UserCheck,
  Clock,
  Coins,
  X,
  Loader2,
} from 'lucide-react';
import { useHsgData, getPendingReferralCode } from '../context/HsgDataContext';

interface InviteFriendsPageProps {
  onBack: () => void;
}

interface ReferredFriend {
  id: string;
  name: string;
  cashback: number;
  points: number;
  joined_at: number;
}

interface BonusPointItem {
  id: string;
  title: string;
  points: number;
  joined_at: number;
}

const WORKER_URL = 'https://ib-v2.hsgglobalpteltd.workers.dev';

export const InviteFriendsPage: React.FC<InviteFriendsPageProps> = ({ onBack }) => {
  const { db, claimReferralCode } = useHsgData();

  const [copiedCode, setCopiedCode] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimInput, setClaimInput] = useState(() => getPendingReferralCode());
  const claimInputRef = useRef<HTMLInputElement | null>(null);

  // Referred friends history (Tier 1 direct)
  const [friends, setFriends] = useState<ReferredFriend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [totalEarnedCash, setTotalEarnedCash] = useState(0);
  const [totalEarnedPts, setTotalEarnedPts] = useState(0);

  // Bonus points history (Tier 2-5 network rewards)
  const [bonusPoints, setBonusPoints] = useState<BonusPointItem[]>([]);
  const [totalBonusPts, setTotalBonusPts] = useState(0);

  const cleanPhone = (db.user?.phone_number || '').replace(/\D/g, '');
  const userId = db.user?.id || (typeof window !== 'undefined' ? (localStorage.getItem('hsg_auth_user_id') || '') : '');
  const userCode = db.user?.referral_code || '------';

  const refCashback = Number(db.settings.referral_referrer_cashback ?? 0);
  const refPoints = Number(db.settings.referral_referrer_points ?? 0);
  const refereeCashback = Number(db.settings.referral_referee_cashback ?? 0);
  const refereePoints = Number(db.settings.referral_referee_points ?? 0);

  // 3-Day Referral Welcome Bonus window (vanishes if claimed OR after 3 days)
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const userCreatedAt = Number(db.user?.created_at || 0);
  const isWithin3Days = userCreatedAt > 0 ? Date.now() - userCreatedAt <= THREE_DAYS_MS : false;
  const isReferralClaimed = Boolean(db.user?.referred_by);
  const canClaimReferral = Boolean(!isReferralClaimed && isWithin3Days);

  // Fetch live friends who joined under user (by user_id PK)
  useEffect(() => {
    let isMounted = true;
    const fetchFriends = async () => {
      if (!userId && !cleanPhone) {
        setLoadingFriends(false);
        return;
      }
      try {
        const q = userId
          ? `user_id=${encodeURIComponent(userId)}`
          : `user_phone=${encodeURIComponent(cleanPhone)}`;
        const res = await fetch(
          `${WORKER_URL}/api/hsg-app/referral/friends?${q}`
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.friends) {
              setFriends(data.friends);
              setTotalEarnedCash(data.total_cashback || 0);
              setTotalEarnedPts(data.total_points || 0);
            }
            if (data.bonus_points) {
              setBonusPoints(data.bonus_points);
              setTotalBonusPts(data.total_bonus_points || 0);
            }
            setLoadingFriends(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch referral friends:', e);
      }

      // Fallback: populate from db.transactions where type is referral_bonus
      if (isMounted && db.transactions) {
        const txFriends: ReferredFriend[] = db.transactions
          .filter((t) => {
            const type = String(t.type || '');
            const refType = String((t as any).reference_type || '');
            const isTierOther =
              type.includes('tier2') ||
              type.includes('tier3') ||
              type.includes('tier4') ||
              type.includes('tier5') ||
              refType.includes('tier2') ||
              refType.includes('tier3') ||
              refType.includes('tier4') ||
              refType.includes('tier5');
            return (type === 'referral_bonus' || type === 'referral_reward') && !isTierOther;
          })
          .map((tx) => ({
            id: tx.id,
            name: 'Community Friend',
            cashback: Number((tx as any).net_cashback ?? (tx as any).amount_cashback ?? (tx as any).amount ?? refCashback),
            points: Number((tx as any).net_points ?? (tx as any).amount_points ?? ((tx as any).points > 0 ? (tx as any).points : refPoints)),
            joined_at: Number(tx.created_at || Date.now()),
          }));
        setFriends(txFriends);
        setTotalEarnedCash(txFriends.reduce((sum, f) => sum + f.cashback, 0));
        setTotalEarnedPts(txFriends.reduce((sum, f) => sum + f.points, 0));

        const txBonus: BonusPointItem[] = db.transactions
          .filter((t) => {
            const type = String(t.type || '');
            const refType = String((t as any).reference_type || '');
            return (
              type.includes('tier2') ||
              type.includes('tier3') ||
              type.includes('tier4') ||
              type.includes('tier5') ||
              refType.includes('tier2') ||
              refType.includes('tier3') ||
              refType.includes('tier4') ||
              refType.includes('tier5')
            );
          })
          .map((tx) => ({
            id: tx.id,
            title: 'Referral Bonus Point',
            points: Number((tx as any).net_points ?? (tx as any).amount_points ?? (tx as any).points ?? 0),
            joined_at: Number(tx.created_at || Date.now()),
          }));
        setBonusPoints(txBonus);
        setTotalBonusPts(txBonus.reduce((sum, b) => sum + b.points, 0));

        setLoadingFriends(false);
      }
    };

    fetchFriends();
    return () => {
      isMounted = false;
    };
  }, [cleanPhone, db.transactions]);

  useEffect(() => {
    if (showClaimModal) {
      setTimeout(() => {
        claimInputRef.current?.focus();
        claimInputRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 120);
    }
  }, [showClaimModal]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleShare = async () => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://community.hsgglobal.sg';
    const link = `${origin}?ref=${encodeURIComponent(userCode)}`;
    const text = `Hey! Join me on HSG+ and get $${refereeCashback.toFixed(
      2
    )} free cashback + ${refereePoints} reward points! 🎁 Use my referral code: ${userCode}\n${link}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join HSG+ and Earn Cashback',
          text,
          url: link,
        });
        return;
      } catch {}
    }

    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, '_blank');
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimInput.trim()) return;
    setClaiming(true);
    const res = await claimReferralCode(claimInput.trim().toUpperCase());
    setClaiming(false);
    if (res.ok) {
      setShowClaimModal(false);
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  return (
    <div className="w-full px-5 pt-2 pb-8 space-y-5">
      {/* 1. HEADER ROW */}
      <div className="relative flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          title="Back to Account"
          className="w-9 h-9 rounded-full bg-white/90 text-[#141416] flex items-center justify-center shadow-2xs active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-[#141416] pointer-events-none">
          Invite Friends
        </span>
        <button
          type="button"
          onClick={handleShare}
          title="Share Code"
          className="w-9 h-9 rounded-full bg-white/90 text-[#141416] flex items-center justify-center shadow-2xs active:scale-95 transition"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* CLAIM WELCOME BONUS BANNER (Only available within 3 days if not claimed) */}
      {canClaimReferral && (
        <div className="w-full p-4 rounded-3xl bg-gradient-to-r from-amber-400 via-yellow-400 to-[#FFEA00] text-[#141416] flex items-center justify-between gap-3 shadow-sm border border-amber-300">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-950/70">
              Welcome Bonus
            </div>
            <div className="text-sm font-black text-[#141416]">
              Claim ${refereeCashback.toFixed(2)} Free Cashback
            </div>
            <div className="text-[11px] font-medium text-amber-950/80 truncate">
              {claimInput ? `Invited with code: ${claimInput}` : "Have a friend's referral code?"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowClaimModal(true)}
            className="h-9 px-4 rounded-full bg-[#141416] text-[#FFEA00] font-black text-xs shrink-0 shadow-sm active:scale-95 transition cursor-pointer"
          >
            Claim {refereeCashback > 0 ? `$${refereeCashback.toFixed(2)}` : 'Reward'} Now!
          </button>
        </div>
      )}

      {/* 2. REFERRAL REWARD CARD */}
      <div className="w-full p-5 rounded-3xl bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FFF9C4] flex items-center justify-center">
              <Gift className="w-4 h-4 text-[#EC008C]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#141416]">
                Refer Friends & Earn Together
              </h2>
              <p className="text-[10px] text-zinc-400">
                Earn cashback & reward points on every invite
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-zinc-400">
            Unlimited
          </span>
        </div>

        {/* Big Eye-Catching Rewards */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-[#FFF9C4]/70 border border-[#FFEA00]/60 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">
              Cashback Bonus
            </span>
            <span className="text-2xl font-black text-[#141416] tracking-tight mt-0.5">
              +${refCashback.toFixed(2)}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
              Per friend invited
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-pink-50/70 border border-pink-200/80 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] uppercase font-bold text-pink-700 tracking-wider">
              Reward Points
            </span>
            <span className="text-2xl font-black text-[#EC008C] tracking-tight mt-0.5">
              +{refPoints}{' '}
              <span className="text-xs font-bold text-zinc-700">pts</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
              Instant credit
            </span>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
          Friends get{' '}
          <strong className="text-[#141416]">
            +${refereeCashback.toFixed(2)}
          </strong>{' '}
          & <strong className="text-[#EC008C]">+{refereePoints} pts</strong>.{' '}
          You get{' '}
          <strong className="text-[#141416]">+${refCashback.toFixed(2)}</strong>{' '}
          & <strong className="text-[#EC008C]">+{refPoints} pts</strong>!
        </p>

        {/* User's Referral Code Card */}
        <div className="p-3 rounded-2xl bg-[#F6F6F9] flex items-center justify-between gap-2">
          <div>
            <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
              Your Referral Code
            </div>
            <div className="text-base font-black text-[#141416] font-mono tracking-wider mt-0.5">
              {userCode}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyCode}
              className="h-8 px-3 rounded-full bg-white text-zinc-800 border border-zinc-200 text-xs font-bold flex items-center gap-1 shadow-2xs active:scale-95 transition"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="h-8 px-3 rounded-full bg-[#25D366] text-white text-xs font-bold flex items-center gap-1 shadow-2xs active:scale-95 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Do you have a friend's referral code? (Only available within 3 days if not claimed) */}
        {canClaimReferral ? (
          <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-zinc-600 font-medium">
              Do you have a referral code?
            </span>
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="font-bold text-[#EC008C] hover:underline flex items-center gap-1 active:scale-95 transition shrink-0 cursor-pointer"
            >
              <span>Click here</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : isReferralClaimed ? (
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="font-medium">Joined via friend&apos;s referral:</span>
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Check className="w-3 h-3" />
              {db.user?.referred_by}
            </span>
          </div>
        ) : null}
      </div>

      {/* 3. INVITED FRIENDS LIST (DIRECT REFERRALS ONLY - NAME ONLY) */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-700" />
            <h3 className="text-xs font-bold text-[#141416]">
              Invited Friends
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-[#141416] text-[#FFEA00] text-[10px] font-bold">
              {friends.length}
            </span>
          </div>

          {(totalEarnedCash > 0 || totalEarnedPts > 0 || totalBonusPts > 0) && (
            <div className="text-[11px] text-zinc-500 font-medium">
              Total:{' '}
              <span className="font-bold text-emerald-600">
                +${totalEarnedCash.toFixed(2)}
              </span>{' '}
              &{' '}
              <span className="font-bold text-[#EC008C]">
                +{totalEarnedPts} pts
              </span>
              {totalBonusPts > 0 && (
                <>
                  {' '}+ Bonus{' '}
                  <span className="font-bold text-[#EC008C]">
                    {totalBonusPts} pts
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {loadingFriends ? (
          <div className="w-full p-8 rounded-3xl bg-white shadow-2xs flex items-center justify-center gap-2 text-xs text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#0B57D0]" />
            <span>Loading friends history...</span>
          </div>
        ) : friends.length > 0 ? (
          <div className="w-full space-y-2">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="w-full p-3.5 rounded-2xl bg-white shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#141416] truncate">
                      {(friend.name && !/^HSG Member/i.test(friend.name) && !/^\d+$/.test(friend.name)) ? friend.name : 'Community Friend'}
                    </div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{formatDate(friend.joined_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-emerald-600">
                    +${friend.cashback.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-extrabold text-[#EC008C]">
                    +{friend.points} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full p-7 rounded-3xl bg-white shadow-2xs text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-[#F6F6F9] flex items-center justify-center mx-auto text-zinc-400">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-[#141416]">
              No friends have joined yet
            </div>
            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
              Share your referral code with friends, classmates, and family. As soon as they join, you both earn cashback & points!
            </p>
            <button
              type="button"
              onClick={handleShare}
              className="mt-1 h-9 px-5 rounded-full bg-[#141416] text-[#FFEA00] text-xs font-bold inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Referral Code</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. BONUS POINT SECTION (TIER 2, 3, 4, 5 NETWORK REWARDS) */}
      <div className="w-full space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#EC008C]" />
            <h3 className="text-xs font-bold text-[#141416]">
              Bonus Point
            </h3>
            {bonusPoints.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-pink-100 text-[#EC008C] text-[10px] font-bold">
                {bonusPoints.length}
              </span>
            )}
          </div>

          {totalBonusPts > 0 && (
            <div className="text-[11px] text-zinc-500 font-medium">
              Bonus:{' '}
              <span className="font-bold text-[#EC008C]">
                +{totalBonusPts} pts
              </span>
            </div>
          )}
        </div>

        {bonusPoints.length > 0 ? (
          <div className="w-full space-y-2">
            {bonusPoints.map((bp) => (
              <div
                key={bp.id}
                className="w-full p-3.5 rounded-2xl bg-white shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-pink-50 text-[#EC008C] border border-pink-100 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#141416] truncate">
                      Referral Bonus Point
                    </div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{formatDate(bp.joined_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-[#EC008C]">
                    +{bp.points} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full p-5 rounded-3xl bg-white shadow-2xs text-center space-y-1">
            <div className="text-xs font-bold text-[#141416]">
              No bonus points yet
            </div>
            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
              Earn bonus points when friends of your invited members join!
            </p>
          </div>
        )}
      </div>

      {/* REFERRAL CLAIM POPUP MODAL */}
      {showClaimModal && (
        <div className="fixed inset-0 z-[999999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FFF9C4] flex items-center justify-center shrink-0">
                  <Gift className="w-4 h-4 text-[#EC008C]" />
                </div>
                <h3 className="text-sm font-bold text-[#141416]">
                  Claim Referral Bonus
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowClaimModal(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-snug">
              Got an invite code from a friend? Enter it below to claim{' '}
              <strong className="text-[#EC008C]">
                +${refereeCashback.toFixed(2)} cashback
              </strong>{' '}
              & <strong className="text-[#EC008C]">+{refereePoints} points</strong>!
            </p>

            <form onSubmit={handleApplyReferral} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    Referral Code
                  </label>
                  {claimInput && (
                    <button
                      type="button"
                      onClick={() => setClaimInput('')}
                      className="text-[10px] text-zinc-400 hover:text-zinc-600 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  ref={claimInputRef}
                  type="text"
                  value={claimInput}
                  onChange={(e) => setClaimInput(e.target.value.toUpperCase())}
                  placeholder="e.g. HSG1234"
                  maxLength={12}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F6F6F9] border border-zinc-200 text-[#141416] font-mono text-sm font-bold uppercase tracking-wider focus:outline-none focus:border-[#EC008C]"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  Auto-filled from your invite link. You can edit or change this code anytime before claiming.
                </p>
              </div>

              <button
                type="submit"
                disabled={claiming || !claimInput.trim()}
                className="w-full h-11 rounded-full bg-[#141416] text-[#FFEA00] font-bold text-xs shadow-xs disabled:opacity-50 active:scale-95 transition flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FFEA00]" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Insert your friend code and claim it</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
