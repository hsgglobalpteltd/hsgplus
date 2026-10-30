import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Gift,
  MapPin,
  Receipt,
  RefreshCw,
  Store,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { compressImageFile } from '../lib/imageCompressor';
import { SendingAnimationOverlay } from '../components/SendingAnimationOverlay';

const LIVE_WORKER_URL = 'https://ib-v2.hsgglobalpteltd.workers.dev';

interface SnapCashbackPageProps {
  onSuccessDone: () => void;
}

export const SnapCashbackPage: React.FC<SnapCashbackPageProps> = ({
  onSuccessDone,
}) => {
  const {
    activeCampaign,
    activeCampaigns,
    setActiveCampaignId,
    submitCashbackClaim,
    showToast,
    db,
  } = useHsgData();

  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string>('');
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [receiptAttached, setReceiptAttached] = useState<boolean>(false);

  // Mandatory Receipt Purchase Details
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [qty, setQty] = useState<number | ''>(1);

  // Velocity Question (1 to 10 selection)
  const [velocityAnswer, setVelocityAnswer] = useState<number | null>(null);

  // Custom campaign questions answers (indexed by question id or key)
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isMilestonesExpanded, setIsMilestonesExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (activeCampaign) {
      setQty(activeCampaign.min_qty || 1);
      setTotalAmount('');
      setVelocityAnswer(null);
      setCustomAnswers({});
      setReceiptAttached(false);
      setReceiptPhotoUrl('');
      setReceiptPreviewUrl('');
      setReceiptFileName('');
    }
  }, [activeCampaign?.id]);

  // Preload all active campaign posters into browser memory for 0ms instant tab switching
  useEffect(() => {
    if (activeCampaigns && activeCampaigns.length > 0) {
      activeCampaigns.forEach((camp) => {
        const url = (camp as any)?.poster_url || (camp as any)?.promo_card_url || camp?.banner_image_url;
        if (url) {
          const img = new Image();
          img.src = url;
        }
      });
    }
  }, [activeCampaigns]);

  const formatDate = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Fixed reward label
  const rewardLabel = React.useMemo(() => {
    if (!activeCampaign) return '';
    const rType = (activeCampaign as any).reward_type || activeCampaign.purchase_reward_mode || 'cashback';
    const rCash = Number((activeCampaign as any).reward_cash !== undefined ? (activeCampaign as any).reward_cash : (activeCampaign.cashback_amount || 0));
    const rPoints = Number((activeCampaign as any).reward_points || 0);

    if (rType === 'both') {
      return `+$${rCash.toFixed(2)} Cash & +${rPoints} Pts`;
    }
    if (rType === 'points') {
      return `+${rPoints || rCash} Points`;
    }
    return `+$${rCash.toFixed(2)} Cashback`;
  }, [activeCampaign]);

  // Velocity question is enabled by default unless explicitly disabled
  const velocityEnabled = (activeCampaign as any)?.velocity_task_enabled !== false;

  // Custom questions (up to 3)
  const customQuestions = React.useMemo(() => {
    if (!activeCampaign) return [];
    const list = Array.isArray((activeCampaign as any).custom_questions)
      ? (activeCampaign as any).custom_questions
      : Array.isArray(activeCampaign.tasks)
      ? activeCampaign.tasks
      : [];
    return list.filter((q: any) => q.question && q.id !== 'task_product_movement' && q.id !== 'q1').slice(0, 3);
  }, [activeCampaign]);

  // User's claims for this campaign
  const userClaims = React.useMemo(() => {
    if (!activeCampaign || !db?.cashback_claims) return [];
    const currentUid =
      db.user?.id ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('hsg_auth_user_id') || ''
        : '');
    const currentPhone =
      db.user?.phone ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('hsg_auth_phone') || ''
        : '');
    return db.cashback_claims.filter((c) => {
      const matchCamp = c.campaign_id === activeCampaign.id;
      if (!matchCamp) return false;
      const matchUser =
        (currentUid && c.user_id === currentUid) ||
        (currentPhone && (c.user_phone === currentPhone || c.user_info?.phone === currentPhone));
      return matchUser;
    });
  }, [activeCampaign?.id, db?.cashback_claims, db?.user?.id, db?.user?.phone]);

  const totalReceipts = userClaims.length;

  const differentStoresCount = React.useMemo(() => {
    const activeClaims = userClaims.filter((c) => c.diagnose_status !== 'rejected');
    if (activeClaims.length === 0) return 0;

    const storeIds = new Set<string>();
    let hasUnassigned = false;

    for (const c of activeClaims) {
      const sId = String(
        c.ocr_data?.assign_store_id || c.assign_store_id || (c as any).outlet_id || ''
      ).trim();
      if (sId) {
        storeIds.add(sId);
      } else {
        hasUnassigned = true;
      }
    }
    return storeIds.size + (hasUnassigned ? 1 : 0);
  }, [userClaims]);

  // Campaign Store Visit Milestones ("More Stores, More Rewards")
  const storeVisitMilestones = React.useMemo(() => {
    if (!activeCampaign) return [];
    const isEnabled = (activeCampaign as any).enable_milestones !== false;
    if (!isEnabled) return [];
    const raw =
      (activeCampaign as any).unlock_rewards ||
      (activeCampaign as any).store_visit_milestones ||
      activeCampaign.reward?.unlock_rewards ||
      [];
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw
      .map((m: any, idx: number) => {
        const targetStores = Number(m.stores || (idx + 1) * 2);
        const cashVal = Number(
          m.cash !== undefined
            ? m.cash
            : parseFloat(String(m.reward || '').replace(/[^0-9.]/g, '')) || 0
        );
        const ptsVal = Number(m.points || 0);
        let rewardText = '';
        if (cashVal > 0 && ptsVal > 0) {
          rewardText = `+$${cashVal.toFixed(cashVal % 1 === 0 ? 0 : 2)} + ${ptsVal} Pts`;
        } else if (cashVal > 0) {
          rewardText = `+$${cashVal.toFixed(cashVal % 1 === 0 ? 0 : 2)} Cash`;
        } else if (ptsVal > 0) {
          rewardText = `+${ptsVal} Pts`;
        } else {
          rewardText = m.reward || 'Bonus';
        }
        return {
          tier: m.tier || idx + 1,
          stores: targetStores,
          cash: cashVal,
          points: ptsVal,
          rewardText,
          isUnlocked: differentStoresCount >= targetStores,
        };
      })
      .sort((a: any, b: any) => a.stores - b.stores);
  }, [activeCampaign, differentStoresCount]);

  // Clean receipt photo upload directly to storage (NO OCR run on client)
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const chosenName = file.name || `receipt_${Date.now()}.jpg`;
    setReceiptFileName(chosenName);

    // Instant local preview
    const localPreview = URL.createObjectURL(file);
    setReceiptPreviewUrl(localPreview);
    setIsUploading(true);

    try {
      const toUpload = await compressImageFile(file, { maxDimension: 1280, quality: 0.8 });
      const cleanName = (toUpload.name || chosenName).replace(/[^a-zA-Z0-9.-]/g, '_');
      const uploadPath = `receipts/${Date.now()}_${cleanName}`;
      const res = await fetch(
        `${LIVE_WORKER_URL}/api/upload?filename=${encodeURIComponent(uploadPath)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': toUpload.type || 'image/jpeg' },
          body: toUpload,
        }
      );

      if (res.ok) {
        const data = await res.json();
        setReceiptPhotoUrl(data.url || localPreview);
      } else {
        setReceiptPhotoUrl(localPreview);
      }
      setReceiptAttached(true);
      showToast('Receipt attached successfully!');
    } catch (err) {
      console.warn('Receipt upload fallback:', err);
      setReceiptPhotoUrl(localPreview);
      setReceiptAttached(true);
      showToast('Receipt captured!');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCampaign) return;

    if (!receiptAttached || (!receiptPhotoUrl && !receiptPreviewUrl)) {
      showToast('Please snap or upload your purchase receipt.');
      return;
    }

    if (!totalAmount || Number(totalAmount) <= 0) {
      showToast('Please enter the amount paid for this item.');
      return;
    }

    if (!qty || Number(qty) < 1) {
      showToast('Please enter the quantity of items purchased.');
      return;
    }

    if (velocityEnabled && !velocityAnswer) {
      showToast('Please answer: Ask Cashier average movement (select 1 to 10).');
      return;
    }

    // Build structured answer map
    const answersPayload: Record<string, any> = {};
    if (velocityEnabled && velocityAnswer) {
      answersPayload.q1 = 'Ask Cashier, this product move out how many avr perday';
      answersPayload.a1 = velocityAnswer;
    }

    customQuestions.forEach((q: any, idx: number) => {
      const qKey = `q${idx + 2}`;
      const aKey = `a${idx + 2}`;
      answersPayload[qKey] = q.question;
      answersPayload[aKey] = customAnswers[q.id || qKey] || '';
    });

    const rCash = Number((activeCampaign as any).reward_cash !== undefined ? (activeCampaign as any).reward_cash : (activeCampaign.cashback_amount || 0));

    submitCashbackClaim({
      transaction_id: `REC-${Date.now().toString().slice(-6)}`,
      raw_address: (activeCampaign as any).where_to_buy || 'Singapore Store Outlet',
      items: (activeCampaign as any).product_name || (activeCampaign as any).title || 'BOOM+ Product',
      qty: Number(qty),
      amount: Number(totalAmount),
      cashback_earned: rCash,
      survey_answers: {
        campaign_id: activeCampaign.id,
        ...answersPayload,
      },
      receipt_photo_name: receiptFileName || 'receipt.jpg',
      receipt_photo_url: receiptPhotoUrl || receiptPreviewUrl,
    });

    setIsSending(true);
  };

  // Get clean Brand Name + Reward for scrollable pill tab
  const getCampaignTabLabel = (camp: any) => {
    const brand = (camp.brand || camp.brand_name || 'HSG+').trim();
    const rType = camp.reward?.type || camp.reward_type || camp.purchase_reward_mode || 'cashback';
    const rCash = Number(camp.reward?.cash !== undefined ? camp.reward.cash : (camp.reward_cash !== undefined ? camp.reward_cash : (camp.cashback_amount || 0)));
    const rPoints = Number(camp.reward?.points !== undefined ? camp.reward.points : (camp.reward_points || 0));

    let rewardStr = '';
    if (rType === 'both') {
      rewardStr = "+$" + rCash.toFixed(2) + " & " + rPoints + " Pts";
    } else if (rType === 'points') {
      rewardStr = "+" + (rPoints || rCash) + " Pts";
    } else {
      rewardStr = "+$" + rCash.toFixed(2);
    }
    return { brand, rewardStr };
  };

  const posterImg =
    (activeCampaign as any)?.poster_url ||
    (activeCampaign as any)?.promo_card_url ||
    activeCampaign?.banner_image_url ||
    '';

  return (
    <div className="w-full flex flex-col space-y-4 pb-24">
      {/* 0. MULTI-CAMPAIGN SCROLLABLE PILL BAR (Max 4 Active Campaigns, Brand + Reward) */}
      {activeCampaigns && activeCampaigns.length > 1 && (
        <div className="w-full px-4 pt-0.5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth pt-1 pb-3 -mb-3">
            {activeCampaigns.map((camp) => {
              const isSelected = camp.id === activeCampaign?.id;
              const { brand, rewardStr } = getCampaignTabLabel(camp);
              return (
                <button
                  key={camp.id}
                  type="button"
                  onClick={(e) => {
                    setActiveCampaignId(camp.id);
                    e.currentTarget.scrollIntoView({
                      behavior: 'smooth',
                      inline: 'center',
                      block: 'nearest',
                    });
                  }}
                  className={`relative h-9 px-3.5 rounded-full font-bold text-xs shrink-0 whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs ${
                    isSelected
                      ? 'bg-[#141416] text-white border border-[#141416]'
                      : 'bg-white text-zinc-700 border border-zinc-200/90 hover:bg-zinc-50'
                  }`}
                >
                  <span className="uppercase tracking-wide">{brand}</span>
                  <span className="text-zinc-400 font-normal">•</span>
                  <span
                    className={
                      isSelected
                        ? 'text-white font-extrabold'
                        : 'text-zinc-900 font-extrabold'
                    }
                  >
                    {rewardStr}
                  </span>

                  {/* Active Downward Pointer Arrow (Larger, floating over margin) */}
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[8px] border-x-transparent border-t-[9px] border-t-[#141416] pointer-events-none z-20"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!activeCampaign ? (
        <div className="w-full p-8 rounded-3xl bg-white text-center shadow-xs">
          <p className="text-sm font-semibold text-zinc-500">
            No active cashback campaign at the moment.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* 1. CAMPAIGN POSTER (4:5 or 1:1) & BASIC DETAILS */}
          <div className="w-full rounded-b-3xl overflow-hidden bg-white shadow-xs border-b border-zinc-200/60">
            {activeCampaigns && activeCampaigns.length > 0 ? (
              <div className="w-full bg-zinc-100 relative overflow-hidden">
                {activeCampaigns.map((camp) => {
                  const url = (camp as any)?.poster_url || (camp as any)?.promo_card_url || camp?.banner_image_url;
                  if (!url) return null;
                  const isCurrent = camp.id === activeCampaign?.id;
                  return (
                    <img
                      key={camp.id}
                      src={url}
                      alt={(camp as any).title || camp.product_name}
                      loading="eager"
                      decoding="sync"
                      className={`w-full h-auto transition-opacity duration-150 ${
                        isCurrent
                          ? 'relative block opacity-100 z-10'
                          : 'absolute inset-0 opacity-0 pointer-events-none -z-10'
                      }`}
                    />
                  );
                })}
              </div>
            ) : posterImg ? (
              <div className="w-full bg-zinc-100 relative overflow-hidden">
                <img
                  src={posterImg}
                  alt={(activeCampaign as any).title || activeCampaign.product_name}
                  loading="eager"
                  className="w-full h-auto block"
                />
              </div>
            ) : null}

            <div className="p-4 bg-hsg-promo-card text-[#141416] space-y-1.5 text-xs font-semibold">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold uppercase tracking-wide text-[#EC008C]">
                  {(activeCampaign as any).brand || activeCampaign.brand_name || 'BOOM+'}
                </span>
                <span className="font-black text-xs text-[#141416] bg-white/80 px-2 py-0.5 rounded-full shadow-2xs">
                  {rewardLabel}
                </span>
              </div>

              <div className="text-base font-extrabold text-[#141416]">
                {(activeCampaign as any).title || activeCampaign.campaign_name || 'Cashback Campaign'}
              </div>

              {Boolean((activeCampaign as any).description || activeCampaign.display_description) && (
                <p className="text-xs text-zinc-700 font-medium">
                  {(activeCampaign as any).description || activeCampaign.display_description}
                </p>
              )}

              {Boolean((activeCampaign as any).instructions) && (
                <div className="pt-2 border-t border-black/10">
                  <div className="text-[11px] font-bold text-zinc-800 uppercase tracking-wide">Instructions</div>
                  <p className="text-xs text-zinc-700 font-medium mt-0.5 whitespace-pre-line">
                    {(activeCampaign as any).instructions}
                  </p>
                </div>
              )}

              {Boolean((activeCampaign as any).rules) && (
                <div className="pt-1.5 text-[11px] text-zinc-600 font-medium italic">
                  Rule: {(activeCampaign as any).rules}
                </div>
              )}

              {Boolean((activeCampaign as any).start_time || activeCampaign.start_timestamp) && (
                <div className="flex items-center gap-1.5 text-black/80 pt-1 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-[#EC008C] shrink-0" />
                  <span>
                    Valid: {formatDate((activeCampaign as any).start_time || activeCampaign.start_timestamp)} –{' '}
                    {formatDate((activeCampaign as any).end_time || activeCampaign.end_timestamp)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 space-y-4">
            {/* 1.5. STORE VISIT MILESTONES ("More Stores, More Rewards") */}
            {storeVisitMilestones.length > 0 && (
              <div className="w-full rounded-2xl bg-white shadow-xs border border-zinc-200/80 overflow-hidden transition-all">
                {/* Header (Accordion Toggle) */}
                <button
                  type="button"
                  onClick={() => setIsMilestonesExpanded((prev) => !prev)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-zinc-50/70 active:bg-zinc-100/60 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-7 h-7 rounded-lg bg-pink-50 text-[#EC008C] flex items-center justify-center shrink-0 border border-pink-100">
                      <Gift className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-900 truncate">
                        More Stores, More Rewards
                      </div>
                      <p className="text-[10px] text-zinc-500 font-normal truncate">
                        Shop at different stores to unlock bonus rewards
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-zinc-600 border border-slate-200 whitespace-nowrap">
                      {differentStoresCount} {differentStoresCount === 1 ? 'Store' : 'Stores'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                        isMilestonesExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Collapsible Content */}
                {isMilestonesExpanded && (
                  <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-zinc-100 animate-in fade-in duration-200">
                    {/* Top Metrics Bar: Clean & compact */}
                    <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-zinc-50/80 border border-zinc-100">
                      <div className="flex items-center gap-2 px-1 min-w-0">
                        <Receipt className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <div className="min-w-0 flex items-baseline gap-1.5 whitespace-nowrap">
                          <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Receipts:</span>
                          <span className="text-xs font-bold text-zinc-800">{totalReceipts}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 px-1 border-l border-zinc-200 min-w-0">
                        <Store className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <div className="min-w-0 flex items-baseline gap-1.5 whitespace-nowrap">
                          <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Diff. Stores:</span>
                          <span className="text-xs font-bold text-zinc-800">{differentStoresCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Milestone Stepper Tiers - Strict 1-Line per Tier, Clean Font Weights */}
                    <div className="space-y-1.5">
                      {storeVisitMilestones.map((tier: any) => {
                        const isUnlocked = tier.isUnlocked;
                        const remaining = Math.max(0, tier.stores - differentStoresCount);

                        return (
                          <div
                            key={tier.tier}
                            className={`h-9 px-2.5 rounded-xl border transition flex items-center justify-between gap-2 whitespace-nowrap ${
                              isUnlocked
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                : 'bg-white border-zinc-200/70 text-zinc-800'
                            }`}
                          >
                            {/* Left: Step Badge + Target + Status (Single Line, No Wrap) */}
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden whitespace-nowrap">
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                  isUnlocked
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600'
                                }`}
                              >
                                {isUnlocked ? (
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                ) : (
                                  `#${tier.tier}`
                                )}
                              </div>

                              <span className="text-xs font-semibold text-zinc-800 whitespace-nowrap">
                                Visit {tier.stores} Stores
                              </span>

                              {isUnlocked ? (
                                <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                  Unlocked
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-400 font-normal whitespace-nowrap">
                                  ({remaining} more)
                                </span>
                              )}
                            </div>

                            {/* Right: Reward Capsule */}
                            <div
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border shrink-0 whitespace-nowrap ${
                                isUnlocked
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-[#FFEA00]/30 text-zinc-900 border-[#FFEA00]/80'
                              }`}
                            >
                              {tier.rewardText}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. UPLOAD PURCHASE RECEIPT */}
            <div className="w-full p-5 rounded-3xl bg-white shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-bold text-[#141416]">
                    Upload Purchase Receipt
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Snap or upload receipt photo clearly
                  </p>
                </div>
              </div>

            {!receiptAttached ? (
              <label className="w-full h-32 rounded-2xl border-2 border-dashed border-zinc-300 bg-[#F6F6F9] flex flex-col items-center justify-center cursor-pointer active:scale-[0.99] transition">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceiptUpload}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-[#141416] text-[#FFEA00] flex items-center justify-center mb-2">
                  {isUploading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs font-bold text-[#141416]">
                  {isUploading ? 'Uploading receipt...' : 'Tap to Snap or Upload Receipt'}
                </span>
                <span className="text-[11px] text-zinc-500 mt-0.5">
                  Clear photo showing store & date
                </span>
              </label>
            ) : (
              <div className="w-full p-3.5 rounded-2xl bg-[#F6F6F9] border border-zinc-200/80 flex items-center justify-between gap-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 min-w-0">
                  {receiptPreviewUrl || receiptPhotoUrl ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-200 border border-zinc-300 shrink-0">
                      <img
                        src={receiptPreviewUrl || receiptPhotoUrl}
                        alt="Receipt preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Check className="w-6 h-6 stroke-[2.5]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-[#141416] flex items-center gap-1.5">
                      <span>Receipt Attached</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-mono">
                      {receiptFileName || 'receipt_photo.jpg'}
                    </p>
                  </div>
                </div>

                <label className="h-8 px-3 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-700 flex items-center gap-1.5 shrink-0 cursor-pointer hover:bg-zinc-50 active:scale-95 transition">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                  <RefreshCw
                    className={`w-3 h-3 text-zinc-500 ${
                      isUploading ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{isUploading ? 'Uploading...' : 'Change'}</span>
                </label>
              </div>
            )}
          </div>

          {/* 3. RECEIPT PURCHASE DETAILS (Mandatory Amount & Qty) */}
          <div className="w-full p-5 rounded-3xl bg-white shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-[#141416]">
                Receipt Purchase Details
              </h2>
              <p className="text-[11px] text-zinc-500">
                Our product amount only (exclude other groceries on receipt)
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Amount Paid for this Item ($) <span className="text-[#EC008C]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={totalAmount}
                    onChange={(e) =>
                      setTotalAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                    className="w-full h-11 pl-8 pr-3.5 rounded-2xl bg-[#F6F6F9] text-[#141416] text-sm font-bold border border-zinc-200 focus:border-[#EC008C] focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Total Items / Quantity Purchased <span className="text-[#EC008C]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={qty}
                  onChange={(e) =>
                    setQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  placeholder="1"
                  className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F6F9] text-[#141416] text-sm font-bold border border-zinc-200 focus:border-[#EC008C] focus:bg-white focus:outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* 4. STORE VELOCITY QUESTION (If Enabled) */}
          {velocityEnabled && (
            <div className="w-full p-5 rounded-3xl bg-[#141416] text-white shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-bold text-white leading-snug">
                  Ask Cashier, this product move out how many avr perday
                </h2>
                <span className="text-[10px] uppercase font-bold text-pink-400 bg-pink-950/60 px-2.5 py-0.5 rounded-full border border-pink-700/50 shrink-0">
                  Required
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Select the number the cashier estimated (1 to 10)
              </p>

              <div className="w-full grid grid-cols-5 gap-2 mt-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                  const isSelected = velocityAnswer === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setVelocityAnswer(num)}
                      className={`h-11 rounded-2xl font-bold text-xs transition ${
                        isSelected
                          ? 'bg-[#FFEA00] text-[#141416] shadow-sm scale-[1.03]'
                          : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      {num === 10 ? '10+' : num}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. CUSTOM CAMPAIGN QUESTIONS (If Any) */}
          {customQuestions.map((q: any, idx: number) => {
            const qKey = q.id || `q${idx + 2}`;
            const answer = customAnswers[qKey] || '';
            return (
              <div
                key={qKey}
                className="w-full p-5 rounded-3xl bg-[#141416] text-white shadow-xs space-y-2"
              >
                <h2 className="text-sm font-bold text-white leading-snug">
                  {q.question}
                </h2>
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  value={answer}
                  onChange={(e) =>
                    setCustomAnswers((prev) => ({
                      ...prev,
                      [qKey]: e.target.value,
                    }))
                  }
                  className="w-full h-11 px-3.5 rounded-2xl bg-white/10 text-white placeholder-zinc-500 text-xs border border-white/10 focus:border-[#FFEA00] focus:outline-none"
                />
              </div>
            );
          })}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="w-full h-13 rounded-full bg-[#EC008C] hover:bg-[#d6007e] text-white font-bold text-sm shadow-md active:scale-[0.99] transition cursor-pointer"
          >
            Submit Receipt & Claim Reward
          </button>
        </div>
      </form>
      )}

      {/* Sending animation overlay (Theme 1 Yellow + Paper Plane Lottie) */}
      <SendingAnimationOverlay
        isOpen={isSending}
        title="Sending Receipt..."
        subtitle="Submitting proof to review queue"
        durationMs={2500}
        onComplete={() => {
          setIsSending(false);
          showToast('Receipt submitted! Your cashback claim is under review.');
          onSuccessDone();
        }}
      />
    </div>
  );
};
