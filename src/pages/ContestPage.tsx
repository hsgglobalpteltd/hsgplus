import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { compressImageFile } from '../lib/imageCompressor';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { SendingAnimationOverlay } from '../components/SendingAnimationOverlay';

const LIVE_WORKER_URL = 'https://ib-v2.hsgglobalpteltd.workers.dev';

interface ContestPageProps {
  initialContestId?: string | null;
  onBack: () => void;
  onNavigateToEvent?: (eventId?: string) => void;
}

export const ContestPage: React.FC<ContestPageProps> = ({
  initialContestId,
  onBack,
  onNavigateToEvent,
}) => {
  const { db, submitContestEntry, showToast } = useHsgData();

  // Selected contest
  const [selectedContestId, setSelectedContestId] = useState<string>(
    initialContestId || db.contests[0]?.id || ''
  );

  // Form States (100% same like cashback campaign)
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string>('');
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string>('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState<boolean>(false);
  const [receiptAttached, setReceiptAttached] = useState<boolean>(false);

  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [qty, setQty] = useState<number | ''>(1);
  const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({});
  const [isEnteringAnother, setIsEnteringAnother] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (initialContestId) {
      setSelectedContestId(initialContestId);
    } else if (!selectedContestId && db.contests[0]?.id) {
      setSelectedContestId(db.contests[0].id);
    }
  }, [initialContestId, db.contests, selectedContestId]);

  const contest =
    db.contests.find((c) => c.id === selectedContestId) || db.contests[0] || null;

  // Check required event
  const linkedEvent = React.useMemo(() => {
    if (!contest?.required_event_id) return null;
    return db.events.find((e) => e.id === contest.required_event_id) || null;
  }, [contest?.required_event_id, db.events]);

  const hasRequiredEvent = Boolean(contest?.required_event_id && linkedEvent);

  // User has clicked Join (status is 'joined' or 'checked_in')
  const isEventJoined = React.useMemo(() => {
    if (!hasRequiredEvent) return true;
    return linkedEvent?.user_status === 'joined' || linkedEvent?.user_status === 'checked_in';
  }, [hasRequiredEvent, linkedEvent]);

  // User has completed venue check-in (status is 'checked_in')
  const isEventCheckedIn = React.useMemo(() => {
    if (!hasRequiredEvent) return true;
    return linkedEvent?.user_status === 'checked_in';
  }, [hasRequiredEvent, linkedEvent]);

  // Dynamic Prize Reward Label (Cash Credit, Point, Product or any combo)
  const getRewardLabel = (p: {
    reward_type?: string;
    reward_cash?: number;
    reward_points?: number;
    product_name?: string;
  }) => {
    const parts: string[] = [];
    if (p.reward_cash && Number(p.reward_cash) > 0) {
      parts.push(`+$${Number(p.reward_cash).toFixed(2)} Cash Credit`);
    }
    if (p.reward_points && Number(p.reward_points) > 0) {
      parts.push(`+${p.reward_points} pts`);
    }
    if (p.product_name) {
      parts.push(`🎁 ${p.product_name}`);
    }
    if (parts.length === 0) {
      if (p.reward_type === 'point') return `+${p.reward_points || 0} pts`;
      if (p.reward_type === 'cashback')
        return `+$${Number(p.reward_cash || 0).toFixed(2)} Cash Credit`;
      return 'Exclusive Prize';
    }
    return parts.join(' • ');
  };

  // Reset form when switching contest
  useEffect(() => {
    setReceiptFileName('');
    setReceiptPhotoUrl('');
    setReceiptPreviewUrl('');
    setReceiptAttached(false);
    setTotalAmount('');
    setQty(1);
    setExtraAnswers({});
    setIsEnteringAnother(false);
  }, [contest?.id]);

  // Clean receipt photo upload directly to storage (same as cashback)
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const chosenName = file.name || `receipt_${Date.now()}.jpg`;
    setReceiptFileName(chosenName);

    const localPreview = URL.createObjectURL(file);
    setReceiptPreviewUrl(localPreview);
    setIsUploadingReceipt(true);

    try {
      const toUpload = await compressImageFile(file, { maxDimension: 1280, quality: 0.8 });
      const cleanName = (toUpload.name || chosenName).replace(/[^a-zA-Z0-9.-]/g, '_');
      const uploadPath = `hsgplus_contest_receipts/${Date.now()}_${cleanName}`;
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
      setIsUploadingReceipt(false);
    }
  };

  // Submission count calculations
  const totalSubmissionsCount = React.useMemo(() => {
    if (!contest) return 0;
    return (db.contest_submissions || []).filter((s) => s.contest_id === contest.id).length;
  }, [contest, db.contest_submissions]);

  const userSubmissionsCount = React.useMemo(() => {
    if (!contest) return 0;
    const uid =
      db.user?.id ||
      (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') ||
      '';
    if (!uid) return 0;

    return (db.contest_submissions || []).filter(
      (s) => s.contest_id === contest.id && s.user_id === uid
    ).length;
  }, [contest, db.contest_submissions, db.user?.id]);

  const maxPerUser = Number(contest?.max_per_user ?? contest?.submission_limits?.max_per_user ?? 0);
  const isQuotaReached = maxPerUser > 0 && userSubmissionsCount >= maxPerUser;

  // Inside Posters List (up to 8)
  const postersList = React.useMemo(() => {
    if (!contest) return [];
    if (Array.isArray(contest.inside_posters) && contest.inside_posters.length > 0) {
      return contest.inside_posters.slice(0, 8);
    }
    if (Array.isArray(contest.poster_images) && contest.poster_images.length > 0) {
      return contest.poster_images.slice(0, 8);
    }
    if (contest.frontpage_poster_url) {
      return [contest.frontpage_poster_url];
    }
    if (contest.frontpage_config?.cover_photo_url) {
      return [contest.frontpage_config.cover_photo_url];
    }
    return [];
  }, [contest]);

  // Extra Questions (up to 5, no default)
  const extraQuestionsList = React.useMemo(() => {
    if (!contest) return [];
    if (Array.isArray(contest.extra_questions) && contest.extra_questions.length > 0) {
      return contest.extra_questions.slice(0, 5);
    }
    return [];
  }, [contest]);

  // Registered Prizes
  const registeredPrizes = React.useMemo(() => {
    if (!contest || !Array.isArray(contest.prizes)) return [];
    return contest.prizes.slice(0, 10);
  }, [contest]);

  // Winners for this contest
  const contestWinners = React.useMemo(() => {
    if (!contest) return [];
    return (db.contest_winners || []).filter((w) => w.contest_id === contest.id);
  }, [contest, db.contest_winners]);

  // Current user's winning prizes for this contest
  const myWinningPrizes = React.useMemo(() => {
    if (!contest) return [];
    const uid =
      db.user?.id ||
      (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') ||
      '';
    const uPhone = String(
      db.user?.phone_number ||
      (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_phone') : '') ||
      ''
    ).replace(/\D/g, '');
    return (db.contest_winners || []).filter((w) => {
      if (w.contest_id !== contest.id) return false;
      if (uid && w.user_id && w.user_id === uid) return true;
      if (
        uPhone &&
        w.user_phone &&
        String(w.user_phone).replace(/\D/g, '').slice(-8) === uPhone.slice(-8)
      ) {
        return true;
      }
      return false;
    });
  }, [contest, db.contest_winners, db.user?.id, db.user?.phone_number]);

  const isWinnersAnnounced = Boolean(contest?.winners_announced) || contestWinners.length > 0;

  // Countdown timer calculations
  const getCountdownParts = () => {
    if (!contest?.end_timestamp) return null;
    const target =
      contest.start_timestamp && now < contest.start_timestamp
        ? contest.start_timestamp
        : contest.end_timestamp;
    const isUpcoming = Boolean(
      contest.start_timestamp && now < contest.start_timestamp
    );
    const isEnded = now >= contest.end_timestamp;
    const diff = Math.max(0, target - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { days, hours, mins, secs, isUpcoming, isEnded };
  };

  const cd = getCountdownParts();

  // Submission handler (100% same like cashback campaign)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contest) return;

    if (isWinnersAnnounced) {
      showToast('Winners have already been announced for this contest.');
      return;
    }

    if (cd?.isEnded) {
      showToast('This contest has already ended.');
      return;
    }

    if (cd?.isUpcoming) {
      showToast('This contest has not started yet. Please check back when it begins!');
      return;
    }

    const maxPerUser = Number(contest.max_per_user ?? contest.submission_limits?.max_per_user ?? 0);
    const totalCap = Number(contest.max_total ?? contest.submission_limits?.total_cap ?? 0);

    if (totalCap > 0 && totalSubmissionsCount >= totalCap) {
      showToast('This contest has reached its maximum entry limit.');
      return;
    }
    if (maxPerUser > 0 && userSubmissionsCount >= maxPerUser) {
      showToast(`You have reached the maximum limit of ${maxPerUser} submission(s).`);
      return;
    }

    if (!receiptAttached || (!receiptPhotoUrl && !receiptPreviewUrl)) {
      showToast('Please snap or upload your purchase receipt.');
      return;
    }

    if (!totalAmount || Number(totalAmount) <= 0) {
      showToast('Please enter the total amount paid ($).');
      return;
    }

    if (!qty || Number(qty) < 1) {
      showToast('Please enter the quantity of items purchased.');
      return;
    }

    // Submit contest entry
    submitContestEntry(extraAnswers, receiptFileName, contest.id, {
      receipt_photo_url: receiptPhotoUrl || receiptPreviewUrl,
      amount_paid: Number(totalAmount),
      items_count: Number(qty),
    });

    setIsSending(true);
  };

  // Mask Phone helper
  const maskPhone = (phone?: string) => {
    if (!phone) return '-';
    const clean = phone.replace(/\D/g, '');
    if (clean.length <= 4) return clean;
    return `...${clean.slice(-4)}`;
  };

  return (
    <div className="w-full px-5 pt-2 pb-8 space-y-4 font-primary">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          title="Back"
          className="w-9 h-9 rounded-full bg-white text-[#141416] flex items-center justify-center shadow-2xs active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-[#141416]">Contest & Rewards</span>
      </div>

      {/* Switch between active contests if multiple */}
      {db.contests.length > 1 && (
        <div className="w-full flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {db.contests.map((c) => {
            const active = c.id === contest?.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedContestId(c.id)}
                className={`px-4 py-2.5 rounded-2xl text-left transition shadow-2xs shrink-0 ${
                  active ? 'bg-[#141416] text-white' : 'bg-white text-[#141416]'
                }`}
              >
                <div className="text-xs font-extrabold truncate max-w-[180px]">
                  {c.frontpage_title || c.frontpage_config?.title || c.title}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {contest ? (
        <div className="w-full space-y-4">
          {/* Header Block: Countdown + Edge-to-Edge Posters (Zero Gap between posters, with breathing room to description) */}
          <div className="-mx-5 w-[calc(100%+2.5rem)] flex flex-col p-0 m-0 overflow-hidden pb-4">
            {/* 1. CONTEST COUNTDOWN TIMER / ANNOUNCEMENT (FULL WIDTH) */}
            {isWinnersAnnounced ? (
              <div className="w-full px-5 py-3 bg-[#141416] text-white flex items-center justify-between text-xs shadow-xs">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Winners Announced</span>
                </div>
              </div>
            ) : cd ? (
              <div className="w-full px-5 py-3 bg-[#141416] text-white flex items-center justify-between text-xs shadow-xs">
                <div className="flex items-center gap-2 font-semibold text-zinc-300">
                  <Clock className="w-3.5 h-3.5 text-[#EC008C]" />
                  <span>
                    {cd.isEnded
                      ? 'Contest Ended'
                      : cd.isUpcoming
                      ? 'Starts In:'
                      : 'Time Remaining:'}
                  </span>
                </div>
                {!cd.isEnded ? (
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#FFEA00]">
                    {cd.days > 0 && <span>{cd.days}d</span>}
                    <span>{String(cd.hours).padStart(2, '0')}h</span>
                    <span>{String(cd.mins).padStart(2, '0')}m</span>
                    <span className="text-[#EC008C]">
                      {String(cd.secs).padStart(2, '0')}s
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-zinc-400">
                    Submission Window Closed
                  </span>
                )}
              </div>
            ) : null}

            {/* 2. VERTICAL INSIDE POSTERS (EDGE-TO-EDGE, MAXIMUM 8) */}
            {postersList.length > 0 && (
              <div className="w-full flex flex-col p-0 m-0 overflow-hidden">
                {postersList.map((imgUrl, idx) => (
                  <img
                    key={idx}
                    src={imgUrl}
                    alt={`Contest Poster ${idx + 1}`}
                    className="w-full h-auto block m-0 p-0 rounded-none select-none"
                  />
                ))}
              </div>
            )}
          </div>

          {/* 3. INSIDE DESCRIPTION & INSTRUCTION */}
          {(contest.inside_description || contest.inside_instruction) && (
            <div className="w-full p-4 rounded-3xl bg-white shadow-xs space-y-3">
              {contest.inside_description && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                    About This Contest
                  </h3>
                  <p className="text-xs text-zinc-600 mt-1 whitespace-pre-line leading-relaxed">
                    {contest.inside_description}
                  </p>
                </div>
              )}
              {contest.inside_instruction && (
                <div className="pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                    How To Participate
                  </h3>
                  <p className="text-xs text-zinc-600 mt-1 whitespace-pre-line leading-relaxed">
                    {contest.inside_instruction}
                  </p>
                </div>
              )}
            </div>
          )}



          {/* 5. OUTCOME WINNER SCREEN (WHEN WINNERS ANNOUNCED OR WHEN ENDED) VS SUBMISSION FORM (WHEN ACTIVE) */}
          {isWinnersAnnounced ? (
            /* ==========================================================
               WINNERS ANNOUNCED SCREEN (SHOWS ONCE WINNERS ARE DRAWN/ANNOUNCED)
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs space-y-4 text-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                  <Trophy className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-zinc-950">
                    Contest Winners Announced! 🎉
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Congratulations to all our lucky winners! Winners can claim their prizes in{' '}
                    <span className="font-bold text-zinc-800">Account &gt; Achievements</span>.
                  </p>
                </div>

                {/* List of Announced Winners */}
                <div className="space-y-3 pt-1">
                  {contestWinners.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center italic py-2">
                      Official winner roster being published...
                    </p>
                  ) : (
                    contestWinners.map((w) => {
                      const photoUrl = w.prize_photo_url || w.product_image;
                      const hasImage = Boolean(photoUrl);
                      const prizeTitle = w.prize_title || w.product_name || 'Prize';
                      const rewardLabel = getRewardLabel(w);
                      const isUserWinner = myWinningPrizes.some((wp) => wp.id === w.id);

                      return (
                        <div
                          key={w.id}
                          className={`relative overflow-hidden p-5 rounded-2xl flex flex-col items-center justify-center text-center transition-all ${
                            isUserWinner
                              ? 'bg-gradient-to-b from-amber-50/60 via-white to-white border-2 border-amber-300 ring-4 ring-amber-100/70 shadow-md'
                              : 'bg-white border border-slate-200/90 shadow-2xs'
                          }`}
                        >
                          {/* Lottie Confetti Animation Layer (Looping over card if user is winner) */}
                          {isUserWinner && (
                            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                              <DotLottieReact
                                src="/confetti.lottie"
                                loop
                                autoplay
                                className="w-full h-full object-cover opacity-90 pointer-events-none"
                              />
                            </div>
                          )}

                          {/* Curved Flying Text: CONGRATS YOU WON! */}
                          {isUserWinner && (
                            <svg
                              className="absolute inset-0 w-full h-full pointer-events-none z-30 select-none overflow-hidden"
                              viewBox="0 0 340 180"
                              preserveAspectRatio="none"
                            >
                              <defs>
                                <linearGradient
                                  id={`snakeGold-${w.id}`}
                                  x1="0%"
                                  y1="0%"
                                  x2="100%"
                                  y2="0%"
                                >
                                  <stop offset="0%" stopColor="#EA580C" />
                                  <stop offset="30%" stopColor="#F59E0B" />
                                  <stop offset="70%" stopColor="#FBBF24" />
                                  <stop offset="100%" stopColor="#D97706" />
                                </linearGradient>
                                <path
                                  id={`snakePath-${w.id}`}
                                  d="M -130 175 Q 160 160, 450 15"
                                  fill="none"
                                />
                              </defs>
                              <text
                                fill={`url(#snakeGold-${w.id})`}
                                fontSize="36"
                                fontWeight="900"
                                letterSpacing="2px"
                                className="uppercase font-black"
                              >
                                <textPath
                                  href={`#snakePath-${w.id}`}
                                  startOffset="105%"
                                >
                                  CONGRATS YOU WON!
                                  <animate
                                    attributeName="startOffset"
                                    from="105%"
                                    to="-75%"
                                    dur="6.5s"
                                    repeatCount="indefinite"
                                  />
                                </textPath>
                              </text>
                            </svg>
                          )}

                          {hasImage ? (
                            <img
                              src={photoUrl}
                              alt={prizeTitle}
                              className="w-20 h-20 rounded-2xl object-cover bg-slate-50 border border-slate-200 shadow-2xs mb-2.5 z-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-2 shadow-2xs z-0">
                              <Trophy className="w-5 h-5 text-amber-500" />
                            </div>
                          )}

                          <div
                            className={`${
                              hasImage ? 'text-base' : 'text-xl'
                            } font-black text-zinc-950 tracking-tight z-0`}
                          >
                            {prizeTitle}
                          </div>

                          <div className="text-sm font-extrabold text-zinc-800 mt-1 z-0">
                            {w.user_nickname}
                          </div>
                          <div className="text-[11px] font-medium text-zinc-400 z-0">
                            ({maskPhone(w.user_phone)})
                          </div>

                          <div className="mt-3 z-0">
                            <span className="px-3.5 py-1 rounded-full bg-blue-50 text-[#0B57D0] text-xs font-black border border-blue-200 shadow-2xs">
                              {rewardLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* If user had submissions, show their participation note */}
                {userSubmissionsCount > 0 && (
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-zinc-500 font-medium">
                    You entered {userSubmissionsCount} {userSubmissionsCount === 1 ? 'submission' : 'submissions'} for this contest.
                  </div>
                )}
              </div>
            </div>
          ) : cd?.isEnded ? (
            /* ==========================================================
               CONTEST PERIOD ENDED BUT WINNERS NOT ANNOUNCED YET
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs space-y-4 text-center animate-in fade-in duration-300">
              {userSubmissionsCount > 0 ? (
                /* USER JOINED BUT WINNERS NOT ANNOUNCED YET */
                <div className="space-y-3 py-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-zinc-950">
                      Thank You For Joining! 🎉
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                      We have received your entry and are currently verifying all submissions and counting the final results. Winners will be announced shortly!
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-zinc-700">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Counting in progress...</span>
                  </div>
                </div>
              ) : (
                /* USER MISSED THE CONTEST */
                <div className="space-y-3 py-2">
                  <div className="w-14 h-14 rounded-full bg-slate-100 text-zinc-400 flex items-center justify-center mx-auto">
                    <Clock className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-zinc-950">
                      Oh, you missed this contest! ⏳
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                      The submission window for this contest is closed. Stay tuned — contest winners will be announced shortly!
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : cd?.isUpcoming ? (
            /* ==========================================================
               UPCOMING CONTEST NOT OPEN YET
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs space-y-3 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-[#0B57D0] flex items-center justify-center mx-auto">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-zinc-950">
                  Contest Starts Soon ⏳
                </h2>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Submissions have not opened yet. Please check back when the countdown timer reaches zero!
                </p>
              </div>
            </div>
          ) : hasRequiredEvent && !isEventJoined ? (
            /* ==========================================================
               STATE 1: USER HAS NOT JOINED EVENT YET
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs space-y-4 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <Calendar className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-base font-extrabold text-zinc-950">
                  Required to Join This Event
                </h2>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  You must join our partner event to participate in this contest.
                </p>
              </div>

              {contest.requirement_note && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-left">
                  <div className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wide">
                    Contest Requirement
                  </div>
                  <div className="text-xs text-amber-950 font-medium mt-0.5 whitespace-pre-line leading-relaxed">
                    {contest.requirement_note}
                  </div>
                </div>
              )}

              {linkedEvent && (
                <div className="p-3.5 rounded-2xl bg-[#F6F6F9] border border-slate-200 flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-[#EC008C] tracking-wide">
                      Required Event
                    </span>
                    <h4 className="text-xs font-extrabold text-[#141416] truncate">
                      {linkedEvent.title}
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {linkedEvent.location} • Status:{' '}
                      <span className="font-bold text-amber-600">
                        Not Joined Yet
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onNavigateToEvent) {
                    onNavigateToEvent(contest.required_event_id || undefined);
                  }
                }}
                className="w-full h-12 rounded-full bg-[#141416] hover:bg-zinc-800 text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#FFEA00]" />
                <span>Click to View &amp; Join Event</span>
              </button>
            </div>
          ) : hasRequiredEvent && !isEventCheckedIn ? (
            /* ==========================================================
               STATE 2: USER HAS JOINED BUT NOT CHECKED IN (WAITING FOR EVENT DATE)
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs space-y-4 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 text-[#0B57D0] flex items-center justify-center mx-auto shadow-xs">
                <Clock className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-base font-extrabold text-zinc-950">
                  Waiting for Event Date
                </h2>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  You have joined this event! Contest submissions open after you check in on the event date.
                </p>
              </div>

              {contest.requirement_note && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left">
                  <div className="text-[10px] font-extrabold uppercase text-zinc-500 tracking-wide">
                    Contest Requirement
                  </div>
                  <div className="text-xs text-zinc-800 font-medium mt-0.5 whitespace-pre-line leading-relaxed">
                    {contest.requirement_note}
                  </div>
                </div>
              )}

              {linkedEvent && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wide">
                      Required Event
                    </span>
                    <h4 className="text-xs font-extrabold text-emerald-950 truncate">
                      {linkedEvent.title}
                    </h4>
                    <p className="text-[11px] text-emerald-800 mt-0.5 truncate">
                      {linkedEvent.location} • Status:{' '}
                      <span className="font-extrabold text-emerald-700">
                        Joined ✓ (Check-In Needed)
                      </span>
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[10px] font-bold shrink-0">
                    Joined
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onNavigateToEvent) {
                    onNavigateToEvent(contest.required_event_id || undefined);
                  }
                }}
                className="w-full h-12 rounded-full bg-[#141416] hover:bg-zinc-800 text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#FFEA00]" />
                <span>View Event &amp; Check In</span>
              </button>
            </div>
          ) : isQuotaReached ? (
            /* ==========================================================
               ALL ALLOWED ENTRIES SUBMITTED (QUOTA REACHED)
               All form inputs, upload area, and submit buttons hidden!
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs text-center space-y-4 animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-[#141416] text-[#FFEA00] flex items-center justify-center mx-auto shadow-sm">
                <Trophy className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-[#141416]">
                  You're in the Draw! 🎉
                </h3>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Entry is pending review</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-900">
                  You have submitted {userSubmissionsCount} {userSubmissionsCount === 1 ? 'entry' : 'entries'} for this contest.
                </p>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  Stay tuned and wait for winners to be announced! Good luck!
                </p>
              </div>
            </div>
          ) : userSubmissionsCount > 0 && !isEnteringAnother ? (
            /* ==========================================================
               ENTRY SUBMITTED VIEW (QUOTA REMAINING)
               Clean status view with option to submit another entry!
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs text-center space-y-4 animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-[#141416]">
                  Entry Submitted!
                </h3>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Entry is pending review</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-900">
                  You have submitted {userSubmissionsCount} {userSubmissionsCount === 1 ? 'entry' : 'entries'} for this contest.
                </p>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  The more entries you submit, the more chances you have to win!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnteringAnother(true)}
                className="w-full h-12 rounded-full bg-[#141416] hover:bg-zinc-800 text-[#FFEA00] font-extrabold text-xs shadow-md active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                <span>+ Submit Another Entry</span>
              </button>
            </div>
          ) : (
            /* ==========================================================
               SUBMISSION FORM
               ========================================================== */
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="w-full p-5 rounded-3xl bg-white shadow-xs space-y-4">
                {/* Requirements Summary Card */}
                {(contest.required_event_id || contest.requirement_note) && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2 text-left">
                    {contest.required_event_id && linkedEvent && (
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                        <div className="flex items-center gap-2 min-w-0 truncate">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">Required to Join Event: {linkedEvent.title}</span>
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-full shrink-0">
                          Done ✓
                        </span>
                      </div>
                    )}
                    {contest.requirement_note && (
                      <div className="text-xs text-zinc-800 pt-1.5 border-t border-emerald-200/60 leading-relaxed font-medium">
                        {contest.requirement_note}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#141416]">
                      Submit Your Contest Entry
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Upload receipt &amp; purchase details to join
                    </p>
                  </div>
                  {(contest.reward_points || contest.submission_limits?.points_per_submission) && (
                    <span className="px-2.5 py-1 rounded-full bg-[#141416] text-[#FFEA00] text-[11px] font-extrabold shadow-2xs">
                      +{contest.reward_points || contest.submission_limits?.points_per_submission} pts
                    </span>
                  )}
                </div>

                {/* 1. UPLOAD PURCHASE RECEIPT */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#141416]">
                    1. Upload Purchase Receipt <span className="text-[#EC008C]">*</span>
                  </label>

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
                        {isUploadingReceipt ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Camera className="w-5 h-5" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#141416]">
                        {isUploadingReceipt
                          ? 'Uploading receipt...'
                          : 'Tap to Snap or Upload Receipt'}
                      </span>
                      <span className="text-[11px] text-zinc-500 mt-0.5">
                        Clear photo showing store &amp; date
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
                        <span>Change</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 2. AMOUNT PAID & QUANTITY PURCHASED */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#141416]">
                      Amount Paid ($) <span className="text-[#EC008C]">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={totalAmount}
                        onChange={(e) =>
                          setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-11 pl-8 pr-3.5 rounded-2xl bg-[#F6F6F9] text-xs font-bold text-[#141416] border border-zinc-200/80 outline-none focus:border-[#141416]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#141416]">
                      Qty Purchased <span className="text-[#EC008C]">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="1"
                      value={qty}
                      onChange={(e) =>
                        setQty(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10)))
                      }
                      className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F6F9] text-xs font-bold text-[#141416] border border-zinc-200/80 outline-none focus:border-[#141416]"
                    />
                  </div>
                </div>

                {/* 3. EXTRA QUESTIONS (MAX 5, NO DEFAULT) */}
                {extraQuestionsList.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="text-xs font-bold text-[#141416]">
                      Extra Contest Questions
                    </div>
                    {extraQuestionsList.map((q, idx) => (
                      <div key={q.id || idx} className="space-y-1.5">
                        <label className="block text-xs font-semibold text-zinc-700">
                          {idx + 1}. {q.question}
                        </label>
                        <input
                          type="text"
                          placeholder="Your answer..."
                          value={extraAnswers[q.id || `q_${idx + 1}`] || ''}
                          onChange={(e) =>
                            setExtraAnswers((prev) => ({
                              ...prev,
                              [q.id || `q_${idx + 1}`]: e.target.value,
                            }))
                          }
                          className="w-full h-10 px-3.5 rounded-2xl bg-[#F6F6F9] text-xs font-medium text-zinc-800 border border-zinc-200/80 outline-none focus:border-[#141416]"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isUploadingReceipt}
                  className="w-full h-12 rounded-full bg-[#EC008C] hover:bg-[#d6007e] text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] disabled:opacity-50 mt-2"
                >
                  {Number(contest.reward_points || contest.submission_limits?.points_per_submission || 0) > 0
                    ? `Submit Contest Entry (+${contest.reward_points || contest.submission_limits?.points_per_submission} pts)`
                    : 'Submit Contest Entry'}
                </button>

                {userSubmissionsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsEnteringAnother(false)}
                    className="w-full text-center text-xs font-bold text-zinc-400 hover:text-zinc-700 pt-1 transition cursor-pointer"
                  >
                    ← Back to My Entry Status
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="w-full p-8 rounded-3xl bg-white text-center text-xs text-zinc-400 shadow-xs">
          No contest active right now. Please check back later.
        </div>
      )}

      {/* Sending animation overlay (Theme 1 Yellow + Paper Plane Lottie) */}
      <SendingAnimationOverlay
        isOpen={isSending}
        title="Sending Entry..."
        subtitle="Submitting your contest entry"
        durationMs={2500}
        onComplete={() => {
          setIsSending(false);
          setReceiptAttached(false);
          setReceiptPhotoUrl('');
          setReceiptPreviewUrl('');
          setReceiptFileName('');
          setTotalAmount('');
          setQty(1);
          setExtraAnswers({});
          setIsEnteringAnother(false);
          showToast('Contest entry submitted successfully!');
        }}
      />
    </div>
  );
};
