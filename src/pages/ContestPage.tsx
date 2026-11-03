import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Gift,
  Key,
  Lock,
  Loader2,
  RefreshCw,
  Trophy,
  X,
  AlertCircle,
  ExternalLink,
  Ticket,
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
  autoScrollToContent?: boolean;
}

export const ContestPage: React.FC<ContestPageProps> = ({
  initialContestId,
  onBack,
  onNavigateToEvent,
  autoScrollToContent = false,
}) => {
  const { db, submitContestEntry, showToast, isAuthenticated, openLoginModal } = useHsgData();

  const [selectedContestId, setSelectedContestId] = useState<string>(
    initialContestId || db.contests[0]?.id || ''
  );

  // Accordion state for About This Contest vs How To Participate (defaults to 'about')
  const [activeInfoTab, setActiveInfoTab] = useState<'about' | 'instruction' | null>('about');

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
  const [isKeyboardActive, setIsKeyboardActive] = useState<boolean>(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);

  // Reference for smooth scrolling directly down past posters to the submission/status section
  const contentAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScrollToContent && contentAnchorRef.current) {
      const timer1 = window.setTimeout(() => {
        contentAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      const timer2 = window.setTimeout(() => {
        contentAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 450);
      return () => {
        window.clearTimeout(timer1);
        window.clearTimeout(timer2);
      };
    }
  }, [autoScrollToContent, selectedContestId]);

  // Auto-scroll input into center view when tapped/focused to prevent keyboard covering
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsKeyboardActive(true);
    const target = e.currentTarget;
    // Delay slightly so mobile virtual keyboard has time to open and resize viewport
    window.setTimeout(() => {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }, 280);
  };

  const handleInputBlur = () => {
    // Delay hiding keyboard spacer slightly to avoid abrupt layout jump
    window.setTimeout(() => {
      setIsKeyboardActive(false);
    }, 150);
  };

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
    db.contests.find((c) => c.id.toLowerCase() === selectedContestId.toLowerCase()) || db.contests[0] || null;

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

  // Check if required event has ended / registration or check-in closed
  const isEventEnded = React.useMemo(() => {
    if (!linkedEvent) return false;
    const start = Number(linkedEvent.date_timestamp || 0);
    const durationHours = Number(linkedEvent.duration_hours) || 4;
    const end = start + durationHours * 3600000;
    return Date.now() > end;
  }, [linkedEvent]);

  // 5-Digit Passcode Unlock State (Persisted per contest & user)
  const unlockStorageKey = React.useMemo(() => {
    const userKey = db.user?.phone || db.user?.id || 'guest';
    return `hsg_contest_passcode_unlocked_${contest?.id || ''}_${userKey}`;
  }, [contest?.id, db.user?.phone, db.user?.id]);

  const [isUnlockedViaPasscode, setIsUnlockedViaPasscode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const userKey = db.user?.phone || db.user?.id || 'guest';
    const key = `hsg_contest_passcode_unlocked_${initialContestId || ''}_${userKey}`;
    return localStorage.getItem(key) === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && unlockStorageKey) {
      setIsUnlockedViaPasscode(localStorage.getItem(unlockStorageKey) === 'true');
    }
  }, [unlockStorageKey]);

  // Passcode Modal & Anti-Brute Force (3 Tries -> 5-min cooldown)
  const [showPasscodeModal, setShowPasscodeModal] = useState<boolean>(false);
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string>('');

  const attemptsKey = React.useMemo(() => {
    const uKey = db.user?.phone || db.user?.id || 'guest';
    return `hsg_contest_passcode_attempts_${contest?.id || ''}_${uKey}`;
  }, [contest?.id, db.user?.phone, db.user?.id]);

  const cooldownKey = React.useMemo(() => {
    const uKey = db.user?.phone || db.user?.id || 'guest';
    return `hsg_contest_passcode_cooldown_${contest?.id || ''}_${uKey}`;
  }, [contest?.id, db.user?.phone, db.user?.id]);

  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [cooldownRemainingSecs, setCooldownRemainingSecs] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cdUntil = Number(localStorage.getItem(cooldownKey) || 0);
    const now = Date.now();
    if (cdUntil > now) {
      setCooldownRemainingSecs(Math.ceil((cdUntil - now) / 1000));
    } else {
      setCooldownRemainingSecs(0);
      const att = Number(localStorage.getItem(attemptsKey) || 0);
      setFailedAttempts(att);
    }
  }, [attemptsKey, cooldownKey]);

  useEffect(() => {
    if (cooldownRemainingSecs <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemainingSecs((prev) => {
        if (prev <= 1) {
          localStorage.removeItem(cooldownKey);
          localStorage.setItem(attemptsKey, '0');
          setFailedAttempts(0);
          setPasscodeError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemainingSecs, cooldownKey, attemptsKey]);

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownRemainingSecs > 0) return;

    const trimmed = passcodeInput.trim();
    if (!trimmed || trimmed.length !== 5) {
      setPasscodeError('Please enter a 5-digit passcode.');
      return;
    }

    const expectedPasscode = (contest?.event_passcode || '').trim();
    if (!expectedPasscode) {
      setPasscodeError('No passcode configured for this contest. Please contact support.');
      return;
    }

    if (trimmed === expectedPasscode) {
      setIsUnlockedViaPasscode(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(unlockStorageKey, 'true');
        localStorage.removeItem(attemptsKey);
        localStorage.removeItem(cooldownKey);
      }
      setFailedAttempts(0);
      setPasscodeError('');
      setPasscodeInput('');
      setShowPasscodeModal(false);
      showToast('Passcode verified! Contest unlocked.');
    } else {
      const next = failedAttempts + 1;
      setFailedAttempts(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem(attemptsKey, String(next));
      }
      if (next >= 3) {
        const cdUntil = Date.now() + 5 * 60 * 1000;
        if (typeof window !== 'undefined') {
          localStorage.setItem(cooldownKey, String(cdUntil));
        }
        setCooldownRemainingSecs(300);
        setPasscodeError('Too many failed attempts. Locked for 5 minutes.');
      } else {
        const remaining = 3 - next;
        setPasscodeError(`Incorrect passcode. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
      }
    }
  };

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
    return (db.contest_submissions || []).filter(
      (s) => String(s.contest_id || '').toLowerCase() === String(contest.id || '').toLowerCase()
    ).length;
  }, [contest, db.contest_submissions]);

  const userSubmissions = React.useMemo(() => {
    if (!contest) return [];
    const uid =
      db.user?.id ||
      (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') ||
      '';
    const phone =
      (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_phone') : '') ||
      db.user?.phone_number ||
      '';
    const cleanPhone = phone.replace(/\D/g, '');

    return (db.contest_submissions || []).filter((s) => {
      const matchContest = String(s.contest_id || '').toLowerCase() === String(contest.id || '').toLowerCase();
      if (!matchContest) return false;
      if (uid && s.user_id === uid) return true;
      if (cleanPhone && s.user_phone && s.user_phone.replace(/\D/g, '') === cleanPhone) return true;
      return false;
    });
  }, [contest, db.contest_submissions, db.user?.id, db.user?.phone_number]);

  const userSubmissionsCount = userSubmissions.length;
  const hasApprovedEntry = userSubmissions.some((s) => s.status === 'approved' || s.status === 'winner');

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
    if (Array.isArray(contest.submission_questions) && contest.submission_questions.length > 0) {
      return contest.submission_questions.slice(0, 5);
    }
    return [];
  }, [contest]);

  // Registered Prizes
  const registeredPrizes = React.useMemo(() => {
    if (!contest || !Array.isArray(contest.prizes)) return [];
    return contest.prizes.slice(0, 10);
  }, [contest]);

  // Winners announcement state strictly based on contest.winners_announced
  const isWinnersAnnounced = Boolean(contest?.winners_announced);

  // Winners for this contest (only visible once announced)
  const contestWinners = React.useMemo(() => {
    if (!contest || !isWinnersAnnounced) return [];
    return (db.contest_winners || []).filter(
      (w) => String(w.contest_id || '').toLowerCase() === String(contest.id || '').toLowerCase()
    );
  }, [contest, db.contest_winners, isWinnersAnnounced]);

  // Current user's winning prizes for this contest (only visible once announced)
  const myWinningPrizes = React.useMemo(() => {
    if (!contest || !isWinnersAnnounced) return [];
    const uid =
      db.user?.id ||
      (typeof window !== 'undefined' ? localStorage.getItem('hsg_auth_user_id') : '') ||
      '';
    if (!uid) return [];
    return (db.contest_winners || []).filter((w) => {
      return (
        String(w.contest_id || '').toLowerCase() === String(contest.id || '').toLowerCase() &&
        w.user_id === uid
      );
    });
  }, [contest, db.contest_winners, db.user?.id, isWinnersAnnounced]);

  // Countdown timer calculations
  const getCountdownParts = () => {
    if (!contest?.end_timestamp) return null;
    const startNum = contest.start_timestamp ? Number(contest.start_timestamp) : null;
    const endNum = Number(contest.end_timestamp);
    if (!endNum) return null;

    const isUpcoming = Boolean(startNum && now < startNum);
    const isEnded = now >= endNum;
    const target = isUpcoming ? startNum! : endNum;
    const diff = Math.max(0, target - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { days, hours, mins, secs, isUpcoming, isEnded, diff };
  };

  const cd = getCountdownParts();

  // Header countdown text for right-hand indicator (no seconds, matching title font size)
  const countdownText = React.useMemo(() => {
    if (isWinnersAnnounced) return 'Winners Announced';
    if (!cd) return null;
    if (cd.isEnded) return 'Contest ended';
    if (cd.isUpcoming) {
      if (cd.days > 0) return `Contest starts in ${cd.days} ${cd.days === 1 ? 'day' : 'days'}`;
      if (cd.hours > 0) return `Contest starts in ${cd.hours} ${cd.hours === 1 ? 'hour' : 'hours'} ${cd.mins}min`;
      return `Contest starts in ${cd.mins}min`;
    }
    // Active contest
    if (cd.days > 0) return `Contest will end in ${cd.days} ${cd.days === 1 ? 'day' : 'days'}`;
    if (cd.hours > 0) return `${cd.hours} ${cd.hours === 1 ? 'hour' : 'hours'} ${cd.mins}min`;
    return `${cd.mins}min`;
  }, [isWinnersAnnounced, cd]);

  // Submission handler (100% same like cashback campaign)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contest) return;

    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

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

    // Validate all extra contest questions are answered (all are mandatory, without badge/tick)
    for (let i = 0; i < extraQuestionsList.length; i++) {
      const q = extraQuestionsList[i];
      const key = q.id || `q_${i + 1}`;
      const val = (extraAnswers[key] || '').trim();
      const qTitle = q.question || (q as any).label || `Question #${i + 1}`;
      if (!val) {
        showToast(`Please answer #${i + 1}: ${qTitle}`);
        return;
      }
      if (q.type === 'number' && isNaN(Number(val))) {
        showToast(`Please enter a valid number for #${i + 1}`);
        return;
      }
    }

    // Submit contest entry
    submitContestEntry(
      {
        ...extraAnswers,
        ...(isUnlockedViaPasscode ? { unlocked_via_passcode: 'true', pass_mode: '5_digit_event_passcode' } : {}),
      },
      receiptFileName,
      contest.id,
      {
        receipt_photo_url: receiptPhotoUrl || receiptPreviewUrl,
        amount_paid: Number(totalAmount || 0),
        items_count: Number(qty || 0),
      }
    );

    setIsSending(true);
  };

  // Mask Phone helper
  const maskPhone = (phone?: string) => {
    if (!phone) return '-';
    if (phone.includes('*')) return phone;
    const clean = phone.replace(/\D/g, '');
    if (!clean) return phone;
    return `*******${clean.slice(-4)}`;
  };

  return (
    <div className="w-full px-5 pt-0.5 pb-8 font-primary">
      {/* Top Header Row (Countdown Bar) */}
      <div className="flex items-center justify-between min-h-[36px] py-0.5">
        {/* Placeholder space for the single fluid back button located in the fixed header */}
        <div className="w-9 h-9 shrink-0" aria-hidden="true" />
        {countdownText && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#141416]">
            <span>{countdownText}</span>
            <Clock className="w-3.5 h-3.5 text-[#141416] shrink-0" />
          </div>
        )}
      </div>

      {contest ? (
        <div className="w-full space-y-4 mt-1.5">
          {/* Header Block: Edge-to-Edge Posters (Zero Gap between posters, with breathing room to description) */}
          <div className="-mx-5 w-[calc(100%+2.5rem)] flex flex-col p-0 m-0 overflow-hidden pb-4">
            {/* Inside Posters (Edge-to-Edge, maximum 8) */}
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

          {/* 3. INSIDE DESCRIPTION & INSTRUCTION (ACCORDION COLLAPSIBLE: Visible to everyone so visitors can read details) */}
          {(contest.inside_description || contest.inside_instruction) && (
            <div className="w-full p-4 rounded-3xl bg-white shadow-xs space-y-3">
              {contest.inside_description && (
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveInfoTab((prev) => (prev === 'about' ? null : 'about'))
                    }
                    className="w-full flex items-center justify-between text-left cursor-pointer select-none"
                  >
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                      About This Contest
                    </h3>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                        activeInfoTab === 'about' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {activeInfoTab === 'about' && (
                    <p className="text-xs text-zinc-600 mt-1 whitespace-pre-line leading-relaxed animate-in fade-in duration-150">
                      {contest.inside_description}
                    </p>
                  )}
                </div>
              )}
              {contest.inside_instruction && (
                <div className={contest.inside_description ? 'pt-2 border-t border-slate-100' : ''}>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveInfoTab((prev) => (prev === 'instruction' ? null : 'instruction'))
                    }
                    className="w-full flex items-center justify-between text-left cursor-pointer select-none"
                  >
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                      How To Participate
                    </h3>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                        activeInfoTab === 'instruction' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {activeInfoTab === 'instruction' && (
                    <p className="text-xs text-zinc-600 mt-1 whitespace-pre-line leading-relaxed animate-in fade-in duration-150">
                      {contest.inside_instruction}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}



          {/* 5. OUTCOME WINNER SCREEN (WHEN WINNERS ANNOUNCED OR WHEN ENDED) VS SUBMISSION FORM (WHEN ACTIVE) */}
          <div ref={contentAnchorRef} className="scroll-mt-4" />
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
          ) : !isAuthenticated ? (
            /* ==========================================================
               GATE: USER NOT LOGGED IN -> HIDE ALL WORDS/STATES AND SHOW LOGIN PROMPT
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-[#141416]">
                  Log In to Participate
                </h3>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  Please log in with your account to view contest details and submit your entry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openLoginModal()}
                className="w-full h-12 rounded-full bg-[#141416] hover:bg-zinc-800 text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Log In to Continue</span>
              </button>
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
          ) : hasRequiredEvent && !isEventJoined && !isUnlockedViaPasscode ? (
            isEventEnded ? (
              /* ==========================================================
                 STATE 1B: EVENT HAS ENDED (MISSED EVENT) -> 5-DIGIT PASSCODE UNLOCK
                 ========================================================== */
              <div className="w-full p-6 rounded-3xl bg-white shadow-xs space-y-4 text-center animate-in fade-in duration-300">
                <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                  <Key className="w-7 h-7" />
                </div>

                <div>
                  <h2 className="text-base font-extrabold text-zinc-950">
                    Missed the Event? ⏳
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    Missed or skipped the event? You can still participate by entering your ticket passcode to unlock this contest without entering the event.
                  </p>
                </div>

                {/* Unified Ticket to Join Contest Box */}
                {(contest.requirement_note || linkedEvent) && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-extrabold uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-amber-800" />
                        <span>Ticket to Join Contest</span>
                      </div>
                      {Number(contest.reward_points || contest.submission_limits?.points_per_submission || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#141416] text-[#FFEA00] text-[10px] font-extrabold">
                          +{contest.reward_points || contest.submission_limits?.points_per_submission} pts
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#141416]">
                      {linkedEvent && (
                        <li className="flex items-start gap-1.5 font-bold">
                          <span className="text-amber-800 font-extrabold">•</span>
                          <span>
                            Joining event {linkedEvent.title}
                            <span className="text-rose-600 font-bold ml-1.5 text-[11px]">
                              (Event Ended)
                            </span>
                          </span>
                        </li>
                      )}
                      {contest.requirement_note && (
                        <li className="flex items-start gap-1.5 font-bold">
                          <span className="text-amber-800 font-extrabold">•</span>
                          <span className="whitespace-pre-line">{contest.requirement_note}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="space-y-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setPasscodeInput('');
                      setPasscodeError('');
                      setShowPasscodeModal(true);
                    }}
                    className="w-full h-12 px-3 rounded-full bg-[#141416] hover:bg-zinc-800 text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    <Key className="w-4 h-4 text-[#FFEA00] shrink-0" />
                    <span>Enter Ticket Passcode</span>
                  </button>
                  <p className="text-xs text-zinc-500 text-center font-medium">
                    to Unlock without entering event
                  </p>
                </div>
              </div>
            ) : (
              /* ==========================================================
                 STATE 1A: EVENT IS OPEN -> MUST JOIN EVENT TO PARTICIPATE
                 ========================================================== */
              <div className="w-full p-6 rounded-3xl bg-white shadow-xs space-y-4 text-center animate-in fade-in duration-300">
                <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                  <Calendar className="w-7 h-7" />
                </div>

                <div>
                  <h2 className="text-base font-extrabold text-zinc-950">
                    Event Participation Required
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    To participate in this contest once it opens, you must join our partner event: <strong className="text-zinc-800">{linkedEvent?.title || 'Partner Event'}</strong>.
                  </p>
                </div>

                {/* Unified Ticket to Join Contest Box */}
                {(contest.requirement_note || linkedEvent) && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-extrabold uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-amber-800" />
                        <span>Ticket to Join Contest</span>
                      </div>
                      {Number(contest.reward_points || contest.submission_limits?.points_per_submission || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#141416] text-[#FFEA00] text-[10px] font-extrabold">
                          +{contest.reward_points || contest.submission_limits?.points_per_submission} pts
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#141416]">
                      {linkedEvent && (
                        <li className="flex items-start gap-1.5 font-bold">
                          <span className="text-amber-800 font-extrabold">•</span>
                          <span>
                            Joining event {linkedEvent.title}
                            <span className="text-amber-700 font-bold ml-1.5 text-[11px]">
                              (Required)
                            </span>
                          </span>
                        </li>
                      )}
                      {contest.requirement_note && (
                        <li className="flex items-start gap-1.5 font-bold">
                          <span className="text-amber-800 font-extrabold">•</span>
                          <span className="whitespace-pre-line">{contest.requirement_note}</span>
                        </li>
                      )}
                    </ul>
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

                {contest.event_passcode && (
                  <div className="space-y-0.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPasscodeInput('');
                        setPasscodeError('');
                        setShowPasscodeModal(true);
                      }}
                      className="w-full text-center text-xs font-bold text-zinc-700 hover:text-zinc-900 transition py-0.5 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      <span>Enter Ticket Passcode</span>
                    </button>
                    <p className="text-[11px] text-zinc-500 text-center font-medium">
                      to Unlock without entering event
                    </p>
                  </div>
                )}
              </div>
            )
          ) : hasRequiredEvent && !isEventCheckedIn && !isUnlockedViaPasscode ? (
            /* ==========================================================
               STATE 2: USER HAS JOINED BUT NOT CHECKED IN
               ========================================================== */
            <div className="w-full p-6 rounded-3xl bg-white shadow-xs space-y-4 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 text-[#0B57D0] flex items-center justify-center mx-auto shadow-xs">
                <Clock className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-base font-extrabold text-zinc-950">
                  {isEventEnded ? 'Missed Event Check-In' : 'Waiting for Event Date'}
                </h2>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  {isEventEnded
                    ? 'The event has concluded without venue check-in. If you have a ticket passcode, enter it below to unlock this contest without entering the event.'
                    : 'You have joined this event! Contest submissions open after you check in on the event date.'}
                </p>
              </div>

              {/* Unified Ticket to Join Contest Box */}
              {(contest.requirement_note || linkedEvent) && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-extrabold uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-amber-800" />
                      <span>Ticket to Join Contest</span>
                    </div>
                    {Number(contest.reward_points || contest.submission_limits?.points_per_submission || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#141416] text-[#FFEA00] text-[10px] font-extrabold">
                        +{contest.reward_points || contest.submission_limits?.points_per_submission} pts
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#141416]">
                    {linkedEvent && (
                      <li className="flex items-start gap-1.5 font-bold">
                        <span className="text-amber-800 font-extrabold">•</span>
                        <span>
                          Joining event {linkedEvent.title}
                          <span className="text-emerald-700 font-bold ml-1.5 text-[11px]">
                            (Joined ✓{isEventEnded ? ' - Check-in Closed' : ''})
                          </span>
                        </span>
                      </li>
                    )}
                    {contest.requirement_note && (
                      <li className="flex items-start gap-1.5 font-bold">
                        <span className="text-amber-800 font-extrabold">•</span>
                        <span className="whitespace-pre-line">{contest.requirement_note}</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {isEventEnded ? (
                <div className="space-y-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setPasscodeInput('');
                      setPasscodeError('');
                      setShowPasscodeModal(true);
                    }}
                    className="w-full h-12 px-3 rounded-full bg-[#141416] hover:bg-zinc-800 text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    <Key className="w-4 h-4 text-[#FFEA00] shrink-0" />
                    <span>Enter Ticket Passcode</span>
                  </button>
                  <p className="text-xs text-zinc-500 text-center font-medium">
                    to Unlock without entering event
                  </p>
                </div>
              ) : (
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
              )}
            </div>
          ) : cd?.isUpcoming ? (
            /* ==========================================================
               UPCOMING CONTEST NOT OPEN YET (EVENT REQS FULFILLED OR UNLOCKED)
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
                  You are all set! Submissions have not opened yet. Please check back when the countdown timer reaches zero!
                </p>
              </div>
            </div>
          ) : (isQuotaReached || (userSubmissionsCount > 0 && !isEnteringAnother)) ? (
            /* ==========================================================
               SUBMITTED ENTRIES VIEW (FULL DETAILS & ANSWERS LIST)
               ========================================================== */
            <div className="w-full space-y-4 animate-in fade-in duration-300">
              {/* Summary Card */}
              <div className="w-full p-6 rounded-3xl bg-white shadow-xs text-center space-y-3.5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-xs ${
                  isQuotaReached
                    ? 'bg-[#141416] text-[#FFEA00]'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                }`}>
                  {isQuotaReached ? <Trophy className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-[#141416]">
                    {userSubmissionsCount === 1 ? "Boom! You're In To Win! 🏆" : `Boom! ${userSubmissionsCount} Entries In To Win! 🏆`}
                  </h3>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-zinc-900">
                    You have submitted {userSubmissionsCount} {userSubmissionsCount === 1 ? 'entry' : 'entries'} for this contest.
                  </p>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                    {isQuotaReached
                      ? `Maximum quota reached (${maxPerUser}/${maxPerUser}). Stay tuned for winners announcement!`
                      : 'You can submit additional entries with separate purchase receipts to increase your winning chances.'}
                  </p>
                </div>

                {!isQuotaReached && (
                  <button
                    type="button"
                    onClick={() => setIsEnteringAnother(true)}
                    className="w-full h-12 rounded-full bg-[#141416] hover:bg-zinc-800 text-[#FFEA00] font-extrabold text-xs shadow-md active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    <span>+ Submit Another Entry</span>
                  </button>
                )}
              </div>

              {/* Submitted Entries List */}
              <div className="space-y-3">
                <div className="text-xs font-extrabold text-zinc-900 px-1 flex items-center justify-between">
                  <span>Your Submitted {userSubmissionsCount === 1 ? 'Entry' : 'Entries'}</span>
                  <span className="text-[11px] text-zinc-500 font-semibold">{userSubmissionsCount} total</span>
                </div>

                {userSubmissions.map((sub, idx) => {
                  const isApproved = sub.status === 'approved' || sub.status === 'winner';
                  const isRejected = sub.status === 'rejected';
                  const answersObj = (sub.extra_answers || sub.answers_json || sub.answer_json || {}) as Record<string, any>;
                  const rawTs = Number(sub.created_at || sub.timestamp || 0);
                  const subDate = rawTs > 0 ? new Date(rawTs) : new Date();

                  // Check if there are valid user-answered questions (excluding internal flags)
                  const hasAnswers = Object.entries(answersObj).some(
                    ([k, v]) => !k.startsWith('unlocked_') && k !== 'pass_mode' && v !== undefined && v !== null && v !== ''
                  );

                  return (
                    <div
                      key={sub.id || idx}
                      className="w-full p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-3 text-left"
                    >
                      {/* Top Row: Entry #, Date & Status */}
                      <div className={`flex items-center justify-between ${hasAnswers ? 'border-b border-slate-100 pb-2.5' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center">
                            {userSubmissions.length - idx}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 font-mono flex items-center gap-1.5">
                              <span>{sub.id}</span>
                              {(sub.unlocked_via_passcode || answersObj.unlocked_via_passcode) && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 font-sans">
                                  Passcode ✓
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {subDate.toLocaleDateString('en-GB')} {subDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        {/* Status Pill */}
                        {isApproved ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Approved</span>
                          </div>
                        ) : isRejected ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                            <span>Declined</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending Review</span>
                          </div>
                        )}
                      </div>

                      {/* Submitted Answers (Only displayed if contest questions were answered) */}
                      {hasAnswers && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wide">
                            Submitted Answers:
                          </div>
                          <div className="space-y-1.5">
                            {extraQuestionsList.map((q, qIdx) => {
                              const ans = answersObj[q.id || `q_${qIdx + 1}`];
                              if (ans === undefined || ans === null || ans === '') return null;
                              return (
                                <div
                                  key={q.id || qIdx}
                                  className="text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100"
                                >
                                  <div className="text-zinc-500 font-semibold text-[11px]">
                                    {qIdx + 1}. {q.question || (q as any).label || `Question ${qIdx + 1}`}
                                  </div>
                                  <div className="text-zinc-950 font-bold mt-0.5 break-all">
                                    {(q.type === 'url' || String(ans).startsWith('http://') || String(ans).startsWith('https://')) ? (
                                      <a
                                        href={String(ans).startsWith('http') ? String(ans) : `https://${String(ans)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#0B57D0] underline hover:text-blue-800 inline-flex items-center gap-1"
                                      >
                                        <span>{String(ans)}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    ) : (
                                      String(ans)
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {/* Fallback for any answers not mapped to extraQuestionsList */}
                            {Object.entries(answersObj)
                              .filter(([k, v]) => !k.startsWith('unlocked_') && k !== 'pass_mode' && v !== undefined && v !== null && v !== '' && !extraQuestionsList.some((q, idx) => (q.id || `q_${idx + 1}`) === k))
                              .map(([k, v]) => (
                                <div
                                  key={k}
                                  className="text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100"
                                >
                                  <div className="text-zinc-500 font-semibold text-[11px]">
                                    {k}
                                  </div>
                                  <div className="text-zinc-950 font-bold mt-0.5 break-all">
                                    {(String(v).startsWith('http://') || String(v).startsWith('https://')) ? (
                                      <a
                                        href={String(v).startsWith('http') ? String(v) : `https://${String(v)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#0B57D0] underline hover:text-blue-800 inline-flex items-center gap-1"
                                      >
                                        <span>{String(v)}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    ) : (
                                      String(v)
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ==========================================================
               SUBMISSION FORM (ONLY DISPLAYED WHEN LOGGED IN)
               ========================================================== */
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="w-full p-5 rounded-3xl bg-white shadow-xs space-y-4">
                {/* Unified Ticket to Join Contest Box */}
                {(contest.requirement_note || contest.required_event_id) && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-extrabold uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-amber-800" />
                        <span>Ticket to Join Contest</span>
                      </div>
                      {Number(contest.reward_points || contest.submission_limits?.points_per_submission || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#141416] text-[#FFEA00] text-[10px] font-extrabold">
                          +{contest.reward_points || contest.submission_limits?.points_per_submission} pts
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#141416]">
                      {contest.required_event_id && (
                        <li className="flex items-start gap-1.5 font-bold">
                          <span className="text-amber-800 font-extrabold">•</span>
                          <span>
                            Joining event {linkedEvent?.title || 'Partner Event'}
                            <span className="text-emerald-700 font-extrabold ml-1">✓</span>
                          </span>
                        </li>
                      )}
                      {contest.requirement_note && (
                        <li className="flex items-start gap-1.5 font-bold">
                          <span className="text-amber-800 font-extrabold">•</span>
                          <span className="whitespace-pre-line">{contest.requirement_note}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* UPLOAD PURCHASE RECEIPT */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#141416]">
                    Upload Purchase Receipt <span className="text-[#EC008C]">*</span>
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
              </div>

              {/* 3. CONTEST QUESTIONS (SEPARATE CONTAINER & DIFFERENT COLOUR, NO TITLE) */}
              {extraQuestionsList.length > 0 && (
                <div className="w-full p-5 rounded-3xl bg-[#141416] text-white shadow-xs space-y-4 animate-in fade-in duration-200">
                  {extraQuestionsList.map((q, idx) => {
                    const qType = (q.type || 'text').toLowerCase();
                    const placeholder =
                      qType === 'number'
                        ? 'Enter a number...'
                        : qType === 'url'
                        ? 'https://...'
                        : 'Type your answer here...';

                    return (
                      <div key={q.id || idx} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-white">
                            {idx + 1}. {q.question || (q as any).label || `Question ${idx + 1}`}
                          </label>
                          {qType !== 'text' && (
                            <span className="text-[10px] uppercase font-bold text-zinc-400 bg-white/10 px-2 py-0.5 rounded">
                              {qType === 'url' ? 'URL' : 'Number'}
                            </span>
                          )}
                        </div>
                        <input
                          type={qType === 'number' ? 'number' : qType === 'url' ? 'url' : 'text'}
                          inputMode={qType === 'number' ? 'numeric' : qType === 'url' ? 'url' : 'text'}
                          required
                          placeholder={placeholder}
                          value={extraAnswers[q.id || `q_${idx + 1}`] || ''}
                          onFocus={handleInputFocus}
                          onBlur={handleInputBlur}
                          onChange={(e) =>
                            setExtraAnswers((prev) => ({
                              ...prev,
                              [q.id || `q_${idx + 1}`]: e.target.value,
                            }))
                          }
                          className="w-full h-11 px-3.5 rounded-2xl bg-white/10 text-white placeholder-zinc-500 text-xs border border-white/10 focus:border-[#FFEA00] focus:outline-none transition"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Submit & Navigation Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={isUploadingReceipt}
                  className="w-full h-12 rounded-full bg-[#EC008C] hover:bg-[#d6007e] text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
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

              {/* Dynamic Virtual Keyboard Spacer Cushion (Prevents keyboard from covering input) */}
              <div
                className={`transition-all duration-300 pointer-events-none ${
                  isKeyboardActive ? 'h-72' : 'h-2'
                }`}
              />
            </form>
          )}

          {/* Universal Contest Terms & Conditions Button (Always visible at bottom of EVERY contest state) */}
          <div className="pt-2 pb-6 text-center">
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="text-xs font-semibold text-zinc-400 hover:text-zinc-700 underline underline-offset-4 transition cursor-pointer"
            >
              Contest Terms &amp; Conditions
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full p-8 rounded-3xl bg-white text-center text-xs text-zinc-400 shadow-xs">
          No contest active right now. Please check back later.
        </div>
      )}

      {/* 5-Digit Passcode Unlock Modal */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 animate-in fade-in duration-200 font-primary">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-5 text-center relative">
            <button
              type="button"
              onClick={() => {
                setShowPasscodeModal(false);
                setPasscodeError('');
                setPasscodeInput('');
              }}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-zinc-500 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <Key className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-zinc-950">
                Enter Ticket Passcode
              </h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Enter the 5-digit ticket passcode to unlock this contest without entering the event.
              </p>
            </div>

            <form onSubmit={handleVerifyPasscode} className="space-y-4">
              <div className="space-y-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  value={passcodeInput}
                  disabled={cooldownRemainingSecs > 0}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setPasscodeInput(val);
                    if (passcodeError) setPasscodeError('');
                  }}
                  placeholder="• • • • •"
                  autoFocus
                  className="w-full h-14 px-4 text-center font-mono text-2xl font-black tracking-[0.4em] rounded-2xl bg-slate-50 border-2 border-slate-200 outline-none focus:border-[#0B57D0] focus:bg-white text-zinc-900 transition disabled:opacity-50 disabled:bg-slate-100"
                />

                {cooldownRemainingSecs > 0 ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                    <span>
                      Locked. Try again in{' '}
                      <span className="font-mono font-bold">
                        {Math.floor(cooldownRemainingSecs / 60)}:
                        {String(cooldownRemainingSecs % 60).padStart(2, '0')}
                      </span>
                    </span>
                  </div>
                ) : passcodeError ? (
                  <p className="text-xs font-semibold text-rose-600 animate-in fade-in">
                    {passcodeError}
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-400">
                    3 attempts allowed before a 5-minute timeout.
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasscodeModal(false);
                      setPasscodeError('');
                      setPasscodeInput('');
                    }}
                    className="flex-1 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-zinc-700 font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={cooldownRemainingSecs > 0 || passcodeInput.length !== 5}
                    className="flex-1 h-11 px-3 rounded-full bg-[#141416] hover:bg-zinc-800 disabled:opacity-40 text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] cursor-pointer"
                  >
                    Unlock Contest
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 text-center font-medium">
                  to Unlock without entering event
                </p>
              </div>
            </form>
          </div>
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

      {/* Full Page Contest Terms & Conditions View */}
      {showTermsModal && contest && (
        <div className="fixed inset-0 z-50 bg-[#F6F6F9] overflow-y-auto flex flex-col font-sans animate-in fade-in duration-200">
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-10 bg-[#FFEA00] border-b border-black/10 px-4 py-3 flex items-center justify-between relative shadow-xs">
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="z-10 flex items-center gap-1 text-xs font-extrabold text-[#141416] px-3 py-1.5 rounded-full bg-white hover:bg-white/90 shadow-2xs active:scale-95 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#141416]" />
              <span>Back</span>
            </button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <h2 className="text-sm font-extrabold text-[#141416] tracking-tight">
                Terms &amp; Conditions
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="z-10 w-8 h-8 rounded-full bg-white hover:bg-white/90 flex items-center justify-center text-[#141416] shadow-2xs active:scale-95 transition cursor-pointer"
            >
              <X className="w-4 h-4 text-[#141416]" />
            </button>
          </div>

          {/* Full Page Content Body */}
          <div className="flex-1 max-w-lg w-full mx-auto p-5 pb-16 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4 text-left">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold uppercase text-[#0B57D0] tracking-wider">
                  Contest Rules &amp; Terms
                </span>
                <h1 className="text-base font-extrabold text-[#141416] mt-0.5">
                  {contest.frontpage_title || contest.title}
                </h1>
                {contest.requirement_note && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Entry Requirement: <span className="font-semibold text-zinc-800">{contest.requirement_note}</span>
                  </p>
                )}
              </div>

              {/* Terms Paragraph */}
              <div className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line font-normal space-y-2">
                {contest.terms_and_conditions?.trim() ? (
                  contest.terms_and_conditions
                ) : (
                  <div className="text-zinc-500 italic py-4">
                    Standard contest terms and conditions apply. By participating and submitting a receipt, entrants agree to comply with all official contest requirements, eligibility rules, and organizer verification policies.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="w-full h-12 rounded-full bg-[#141416] hover:bg-zinc-800 text-white font-extrabold text-xs shadow-md transition active:scale-[0.99] flex items-center justify-center cursor-pointer"
            >
              <span>Back to Contest</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
