import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  EyeOff,
  MapPin,
  QrCode,
  ScanLine,
  Users,
  X,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { HsgEvent, EventCategory } from '../types';

interface EventsPageProps {
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isVenueScan?: boolean;
  onClearVenueScan?: () => void;
  onBackToSource?: () => void;
  backLabel?: string;
}

export const EventsPage: React.FC<EventsPageProps> = ({
  selectedEventId,
  onSelectEvent,
  scrollContainerRef,
  isVenueScan = false,
  onClearVenueScan,
  onBackToSource,
  backLabel,
}) => {
  const { db, isAuthenticated, openLoginModal, rsvpEvent, checkInEvent, showToast } = useHsgData();
  const upcomingAnchorRef = useRef<HTMLDivElement | null>(null);
  const [checkInTab, setCheckInTab] = useState<'my_qr' | 'scan_qr'>('my_qr');

  // Check-In modal and post check-in celebration state
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [checkInRewardSuccess, setCheckInRewardSuccess] = useState<{
    rewardPoints: number;
    eventTitle: string;
  } | null>(null);

  // Fee payment selection modal
  const [pendingPaymentEvent, setPendingPaymentEvent] = useState<HsgEvent | null>(
    null
  );
  const [selectedPayMethod, setSelectedPayMethod] = useState<'cashback' | 'points'>(
    'cashback'
  );
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

  // Camera QR Scanner state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startCameraScan = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const qr = new Html5Qrcode('event-camera-reader');
        scannerRef.current = qr;
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            try {
              await qr.stop();
              await qr.clear();
            } catch {}
            scannerRef.current = null;
            setIsScanning(false);
            if (activeEvent) {
              const res = await checkInEvent(activeEvent.id, decodedText);
              if (res.ok) {
                setCheckInRewardSuccess({
                  rewardPoints: res.reward_points || activeEvent.reward_points || 0,
                  eventTitle: activeEvent.title,
                });
              }
            }
          },
          () => {}
        );
      } catch (err) {
        console.warn('Camera scan failed', err);
        showToast(
          'Camera access unavailable. You can tap Quick Verify below to check in.'
        );
        setIsScanning(false);
      }
    }, 100);
  };

  const stopCameraScan = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => scannerRef.current?.clear())
        .catch(() => {})
        .finally(() => {
          scannerRef.current = null;
          setIsScanning(false);
        });
    } else {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  const getEventTimes = (ev: HsgEvent) => {
    const start = ev.date_timestamp;
    const durationHours = Number(ev.duration_hours) || 4;
    const end = start + durationHours * 3600000;
    const checkInOpen = start - 2 * 3600000; // 2 hours early
    return { start, end, checkInOpen, durationHours };
  };

  const handleJoinClick = (ev: HsgEvent) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    if (ev.user_status === 'joined' || ev.user_status === 'checked_in') {
      onSelectEvent(ev.id);
      return;
    }
    const hasFee = Number(ev.fee_amount || 0) > 0;
    if (hasFee) {
      setPendingPaymentEvent(ev);
      setSelectedPayMethod('cashback');
    } else {
      rsvpEvent(ev.id, 'joined', 'free');
    }
  };

  const handleInstantVenueCheckIn = async (ev: HsgEvent) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    if (ev.user_status !== 'joined' && ev.user_status !== 'checked_in') {
      if (Number(ev.fee_amount || 0) > 0) {
        setPendingPaymentEvent(ev);
        setSelectedPayMethod('cashback');
        return;
      }
      await rsvpEvent(ev.id, 'joined', 'free');
    }
    const res = await checkInEvent(ev.id, ev.id);
    if (res.ok) {
      setShowCheckInModal(true);
      setCheckInRewardSuccess({
        rewardPoints: res.reward_points || ev.reward_points || 0,
        eventTitle: ev.title,
      });
      if (onClearVenueScan) onClearVenueScan();
    }
  };

  // Category filter (default is 'All'), dynamically derived from active events
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const dynamicCategories = React.useMemo(() => {
    const unique = Array.from(
      new Set(
        db.events
          .map((e) => String(e.category || '').trim())
          .filter(Boolean)
      )
    );
    return ['All', ...unique];
  }, [db.events]);

  // Calendar View Toggle & Selected Date filter
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<string | null>(
    null
  );

  // Default: 0 old events shown. Each pull loads 5 old events at once.
  const [loadedPastCount, setLoadedPastCount] = useState<number>(0);
  const touchStartYRef = useRef<number | null>(null);

  const now = Date.now();
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const endOfToday = new Date(now).setHours(23, 59, 59, 999);

  const toDateKey = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  // Filter events by Category (and Calendar Date if user tapped a specific date)
  const categoryFilteredEvents = db.events.filter((e) => {
    if (selectedCategory !== 'All' && e.category !== selectedCategory) return false;
    if (selectedCalendarDateKey && toDateKey(e.date_timestamp) !== selectedCalendarDateKey) {
      return false;
    }
    return true;
  });

  // All past events (after their end time)
  const allPastEvents = categoryFilteredEvents
    .filter((e) => Date.now() > getEventTimes(e).end)
    .sort((a, b) => b.date_timestamp - a.date_timestamp);

  // When a specific calendar date is clicked in the past, show it immediately; otherwise slice by loadedPastCount
  const visiblePastEvents = (
    selectedCalendarDateKey
      ? allPastEvents
      : allPastEvents.slice(0, loadedPastCount)
  ).sort((a, b) => a.date_timestamp - b.date_timestamp);

  // Today Events (currently active, happening today, or check-in window open)
  const todayEvents = categoryFilteredEvents
    .filter((e) => {
      const times = getEventTimes(e);
      if (Date.now() > times.end) return false;
      return (
        (e.date_timestamp >= startOfToday && e.date_timestamp <= endOfToday) ||
        (Date.now() >= times.checkInOpen && Date.now() <= times.end)
      );
    })
    .sort((a, b) => a.date_timestamp - b.date_timestamp);

  // Upcoming Events (after today and not in todayEvents)
  const todayIds = new Set(todayEvents.map((e) => e.id));
  const upcomingEvents = categoryFilteredEvents
    .filter((e) => {
      const times = getEventTimes(e);
      if (Date.now() > times.end) return false;
      return !todayIds.has(e.id);
    })
    .sort((a, b) => a.date_timestamp - b.date_timestamp);

  const handleLoadMorePast = () => {
    if (loadedPastCount >= allPastEvents.length) {
      showToast('All past events loaded');
      return;
    }
    const nextCount = Math.min(allPastEvents.length, loadedPastCount + 5);
    setLoadedPastCount(nextCount);
  };

  const handleHideOldEvents = () => {
    setLoadedPastCount(0);
    window.setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 30);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((scrollContainerRef.current?.scrollTop || 0) <= 5) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartYRef.current = null;
    if (deltaY > 65 && (scrollContainerRef.current?.scrollTop || 0) <= 5) {
      handleLoadMorePast();
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  // Build Month Calendar Grid
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventCountByDateKey: Record<string, number> = {};
  db.events.forEach((ev) => {
    if (selectedCategory !== 'All' && ev.category !== selectedCategory) return;
    const k = toDateKey(ev.date_timestamp);
    eventCountByDateKey[k] = (eventCountByDateKey[k] || 0) + 1;
  });

  const activeEvent: HsgEvent | undefined = selectedEventId
    ? db.events.find((e) => e.id === selectedEventId)
    : undefined;

  // INDIVIDUAL EVENT DETAIL PAGE
  if (activeEvent) {
    const userPhone = db.user?.phone_number || '';
    const personalQrValue = `HSG-MEMBER:${userPhone}|EVENT:${activeEvent.id}`;
    const nowTs = Date.now();
    const eventTimes = getEventTimes(activeEvent);
    const isPastEvent = nowTs > eventTimes.end;
    const isCheckInOpen = nowTs >= eventTimes.checkInOpen && nowTs <= eventTimes.end;
    const isJoined =
      activeEvent.user_status === 'joined' ||
      activeEvent.user_status === 'checked_in';
    const isCheckedIn = activeEvent.user_status === 'checked_in';
    const isFull =
      (activeEvent.joined_count || 0) >= activeEvent.max_capacity && !isJoined;
    const hasCashbackFee = Number(activeEvent.fee_amount || 0) > 0;
    const feeAmount = Number(activeEvent.fee_amount || 0);

    return (
      <div className="w-full px-5 pt-2 pb-6 space-y-4">
        {/* Fee Payment Selection Modal */}
        {pendingPaymentEvent && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#141416]">
                  Event Entry Fee
                </h3>
                <button
                  type="button"
                  onClick={() => setPendingPaymentEvent(null)}
                  className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-[#F6F6F9] space-y-1">
                <div className="text-xs font-bold text-[#141416]">
                  {pendingPaymentEvent.title}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {pendingPaymentEvent.location}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Payment Method
                </div>

                <div className="w-full p-3.5 rounded-2xl border border-[#EC008C] bg-pink-50/40 ring-1 ring-[#EC008C] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#141416]">
                      Pay with Cashback
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Balance: ${db.user ? db.user.wallet_balance.toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-[#EC008C]">
                    ${pendingPaymentEvent.fee_amount.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400">
                Notice: Event entry fee is non-refundable upon RSVP.
              </p>

              <button
                type="button"
                disabled={
                  isProcessingPayment ||
                  (db.user?.wallet_balance || 0) < pendingPaymentEvent.fee_amount
                }
                onClick={async () => {
                  setIsProcessingPayment(true);
                  const res = await rsvpEvent(
                    pendingPaymentEvent.id,
                    'joined',
                    'cashback'
                  );
                  setIsProcessingPayment(false);
                  if (res.ok) {
                    setPendingPaymentEvent(null);
                    if (isVenueScan && isCheckInOpen) {
                      // Instant venue check-in after paid RSVP
                      const chkRes = await checkInEvent(pendingPaymentEvent.id, pendingPaymentEvent.id);
                      if (chkRes.ok) {
                        setShowCheckInModal(true);
                        setCheckInRewardSuccess({
                          rewardPoints: chkRes.reward_points || pendingPaymentEvent.reward_points || 0,
                          eventTitle: pendingPaymentEvent.title,
                        });
                        if (onClearVenueScan) onClearVenueScan();
                      }
                    }
                  }
                }}
                className="w-full h-11 rounded-full bg-[#EC008C] text-white font-bold text-xs shadow-xs disabled:opacity-50 active:scale-95 transition cursor-pointer"
              >
                {isProcessingPayment ? 'Processing Payment...' : 'Confirm & Join Event'}
              </button>
            </div>
          </div>
        )}

        {/* TOP BAR: Back button & Category badge */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              stopCameraScan();
              setShowCheckInModal(false);
              if (onBackToSource) {
                onBackToSource();
              } else {
                onSelectEvent(null);
              }
            }}
            className="h-9 px-3.5 rounded-full bg-white text-[#141416] text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition"
          >
            <ArrowLeft className="w-4 h-4" /> {backLabel ? `Back to ${backLabel}` : 'All Events'}
          </button>
          <span className="text-xs font-bold text-[#141416]">
            {activeEvent.distance_or_format &&
            activeEvent.distance_or_format.trim().toLowerCase() !==
              activeEvent.category.trim().toLowerCase()
              ? `${activeEvent.category} • ${activeEvent.distance_or_format}`
              : activeEvent.category}
          </span>
        </div>

        {/* WALK-IN VENUE SCAN PROMPT (if user scanned venue poster) */}
        {isVenueScan && !isPastEvent && !isCheckedIn && (
          <div className="w-full p-4 rounded-3xl bg-[#141416] text-white flex items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#FFEA00] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#FFEA00] shrink-0" />
                <span className="truncate">Venue Check-In Poster Scanned</span>
              </div>
              <div className="text-[11px] text-zinc-300 mt-0.5 truncate">
                {hasCashbackFee
                  ? `RSVP ($${feeAmount.toFixed(2)}) & confirm attendance`
                  : '1-tap instant RSVP and check-in'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleInstantVenueCheckIn(activeEvent)}
              className="h-9 px-4 rounded-full bg-[#EC008C] text-white font-extrabold text-xs shrink-0 active:scale-95 transition shadow-xs cursor-pointer"
            >
              {hasCashbackFee ? `Join & Check In` : '1-Tap Check In'}
            </button>
          </div>
        )}

        {/* MAIN EVENT DETAIL CARD */}
        <div className="w-full rounded-3xl bg-white overflow-hidden shadow-xs">
          <img
            src={activeEvent.image_url}
            alt={activeEvent.title}
            className="w-full h-48 object-cover bg-zinc-100"
          />
          <div className="p-5">
            <div className="text-xs font-semibold text-[#EC008C]">
              {formatDate(activeEvent.date_timestamp)} • {activeEvent.time_label}
            </div>
            <h1 className="text-xl font-bold text-[#141416] mt-1 leading-snug">
              {activeEvent.title}
            </h1>

            {/* Brands Involved */}
            {activeEvent.brands_involved && activeEvent.brands_involved.length > 0 && (
              <div className="mt-1.5 text-xs font-semibold text-[#EC008C]">
                {activeEvent.brands_involved.join(' • ')}
              </div>
            )}

            <div className="mt-3 space-y-1.5 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#EC008C] shrink-0" />
                <span>{activeEvent.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#141416] shrink-0" />
                <span>
                  {activeEvent.joined_count} / {activeEvent.max_capacity} Joined
                </span>
              </div>
              {Number(activeEvent.reward_points || 0) > 0 && (
                <div className="flex items-center gap-2 text-amber-700 font-semibold">
                  <Award className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Check-In Reward: +{activeEvent.reward_points} pts</span>
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
              {activeEvent.description}
            </p>

            <div className="w-full mt-4 p-3.5 rounded-2xl bg-[#F6F6F9] text-xs">
              <span className="font-bold text-[#141416] block">
                Entry Requirement & Fee:
              </span>
              <span className="text-zinc-600 mt-0.5 block">
                {hasCashbackFee ? (
                  <span className="font-semibold text-[#EC008C]">
                    Fee: ${feeAmount.toFixed(2)} — {activeEvent.requirement_text}
                  </span>
                ) : (
                  activeEvent.requirement_text
                )}
              </span>
            </div>

            {/* STATE A: PAST EVENT OUTCOME */}
            {isPastEvent ? (
              <div className="mt-5 space-y-3">
                {isCheckedIn ? (
                  <div className="w-full p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 flex items-start gap-3 shadow-xs">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-emerald-900">
                        Thank you for joining!
                      </h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Your attendance was confirmed. See you at the next event!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full p-4 rounded-3xl bg-zinc-100 border border-zinc-200 text-zinc-900 flex items-start gap-3 shadow-xs">
                    <div className="w-10 h-10 rounded-full bg-zinc-300 text-zinc-700 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-zinc-900">
                        Oh no.. you missed it!
                      </h4>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        Stay tuned for upcoming community meetups!
                      </p>
                    </div>
                  </div>
                )}

                {/* Event Highlights Button (TikTok / Instagram) */}
                {activeEvent.outcome_url &&
                  (activeEvent.outcome_url.startsWith('http://') ||
                    activeEvent.outcome_url.startsWith('https://')) && (
                    <a
                      href={activeEvent.outcome_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-11 rounded-full bg-[#141416] text-[#FFEA00] text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition cursor-pointer"
                    >
                      <Award className="w-4 h-4 text-[#EC008C]" />
                      <span>View Event Highlights</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#FFEA00]" />
                    </a>
                  )}

                <button
                  type="button"
                  onClick={() => {
                    if (onBackToSource) onBackToSource();
                    else onSelectEvent(null);
                  }}
                  className="w-full h-11 rounded-full bg-[#F6F6F9] text-zinc-700 font-bold text-xs active:scale-95 transition cursor-pointer"
                >
                  {backLabel ? `Back to ${backLabel}` : 'Back to All Events'}
                </button>
              </div>
            ) : isCheckedIn ? (
              /* STATE B: ALREADY CHECKED IN (QR container is completely hidden) */
              <div className="mt-5 space-y-3">
                <div className="w-full p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 flex items-start gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-900">
                      Thank you for joining!
                    </h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Your attendance is verified in the system.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (onBackToSource) onBackToSource();
                    else onSelectEvent(null);
                  }}
                  className="w-full h-11 rounded-full bg-[#141416] text-white font-bold text-xs active:scale-95 transition cursor-pointer"
                >
                  {backLabel ? `Back to ${backLabel}` : 'Back to All Events'}
                </button>
              </div>
            ) : isJoined ? (
              /* STATE C: JOINED (Left button is "Joined", Right button is "Check-In") */
              <div className="mt-5 space-y-2">
                <div className="w-full grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled
                    className="h-11 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-default"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Joined</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isCheckInOpen}
                    onClick={() => {
                      if (!isAuthenticated) {
                        openLoginModal();
                        return;
                      }
                      setShowCheckInModal(true);
                    }}
                    className={`h-11 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      isCheckInOpen
                        ? 'bg-[#FFEA00] text-[#141416] shadow-sm active:scale-95 cursor-pointer ring-2 ring-[#FFEA00]/40'
                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Check-In</span>
                  </button>
                </div>

                {onBackToSource && backLabel && (
                  <button
                    type="button"
                    onClick={onBackToSource}
                    className="w-full h-11 rounded-full bg-[#141416] text-[#FFEA00] font-bold text-xs active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Return to {backLabel} &rarr;</span>
                  </button>
                )}

                {!isCheckInOpen && (
                  <p className="text-[11px] text-zinc-500 text-center">
                    Check-in opens 2 hrs before event on {formatDate(activeEvent.date_timestamp)}
                  </p>
                )}
                {isCheckInOpen && (
                  <p className="text-[11px] text-emerald-600 font-bold text-center">
                    ● Check-in is now open! Tap Check-In to scan or show QR
                  </p>
                )}
              </div>
            ) : (
              /* STATE D: NOT JOINED YET (Left: Join / Join with $.., Right: Skip closes page) */
              <div className="mt-5 space-y-2">
                <div className="w-full grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isFull}
                    onClick={() => {
                      if (!isAuthenticated) {
                        openLoginModal();
                        return;
                      }
                      handleJoinClick(activeEvent);
                    }}
                    className={`h-11 rounded-full font-bold text-xs transition shadow-sm ${
                      isFull
                        ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                        : 'bg-[#EC008C] text-white active:scale-95 cursor-pointer'
                    }`}
                  >
                    {isFull
                      ? 'Event Full'
                      : hasCashbackFee
                      ? `Join with $${feeAmount.toFixed(2)}`
                      : 'Join'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onBackToSource) onBackToSource();
                      else onSelectEvent(null);
                    }}
                    className="h-11 rounded-full font-bold text-xs bg-[#F6F6F9] text-zinc-700 hover:bg-zinc-200 active:scale-95 transition cursor-pointer"
                  >
                    Skip
                  </button>
                </div>
                {hasCashbackFee && (
                  <p className="text-[10px] text-zinc-400 text-center">
                    Notice: Event fee is non-refundable upon RSVP.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* DEDICATED CLEAN CHECK-IN MODAL (Pure QR + Instant Reward Celebration Screen) */}
        {showCheckInModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#141416] text-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    Event Check-In
                  </h3>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {activeEvent.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopCameraScan();
                    setShowCheckInModal(false);
                    setCheckInRewardSuccess(null);
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {checkInRewardSuccess ? (
                /* SUCCESS REWARD SCREEN: QR is immediately hidden */
                <div className="py-5 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                    <Check className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      Thank you for joining!
                    </h3>
                    <p className="text-xs text-zinc-300 mt-1">
                      Your attendance is verified.
                    </p>
                  </div>
                  {checkInRewardSuccess.rewardPoints > 0 ? (
                    <div className="p-4 rounded-2xl bg-white/10 border border-[#FFEA00]/30 space-y-1">
                      <div className="text-xs font-semibold text-zinc-300">
                        Here is your reward:
                      </div>
                      <div className="text-3xl font-black text-[#FFEA00]">
                        +{checkInRewardSuccess.rewardPoints}{' '}
                        <span className="text-sm text-white">pts</span>
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Credited to your points wallet
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCheckInModal(false);
                      setCheckInRewardSuccess(null);
                    }}
                    className="w-full h-11 rounded-full bg-[#FFEA00] text-[#141416] font-extrabold text-xs active:scale-95 transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* PURE QR CODE VIEW (Show My QR | Scan Event QR) */
                <div className="space-y-3">
                  <div className="w-full grid grid-cols-2 gap-2 p-1 rounded-full bg-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        stopCameraScan();
                        setCheckInTab('my_qr');
                      }}
                      className={`h-9 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                        checkInTab === 'my_qr'
                          ? 'bg-[#FFEA00] text-[#141416]'
                          : 'text-zinc-300'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Show My QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckInTab('scan_qr')}
                      className={`h-9 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                        checkInTab === 'scan_qr'
                          ? 'bg-[#FFEA00] text-[#141416]'
                          : 'text-zinc-300'
                      }`}
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>Scan Event QR</span>
                    </button>
                  </div>

                  {checkInTab === 'my_qr' ? (
                    <div className="w-full p-6 rounded-2xl bg-white text-[#141416] flex flex-col items-center justify-center">
                      <QRCodeSVG value={personalQrValue} size={180} />
                      <p className="text-xs text-zinc-500 mt-4 text-center font-medium">
                        Show this QR code to venue crew at the entrance to check in
                      </p>
                    </div>
                  ) : (
                    <div className="w-full p-4 rounded-2xl bg-white/5 text-center space-y-3">
                      {isScanning ? (
                        <div className="space-y-3">
                          <div
                            id="event-camera-reader"
                            className="w-full max-w-[240px] mx-auto overflow-hidden rounded-2xl bg-black aspect-square"
                          />
                          <p className="text-[11px] text-zinc-300">
                            Point camera at event venue QR poster
                          </p>
                          <button
                            type="button"
                            onClick={stopCameraScan}
                            className="h-8 px-4 rounded-full bg-white/20 text-white font-bold text-xs active:scale-95 transition cursor-pointer"
                          >
                            Cancel Camera
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 py-2">
                          <ScanLine className="w-10 h-10 text-[#FFEA00] mx-auto" />
                          <p className="text-xs text-zinc-300">
                            Scan event QR poster stationed at the venue entrance
                          </p>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={startCameraScan}
                              className="flex-1 h-10 rounded-full bg-[#EC008C] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                            >
                              <Camera className="w-4 h-4" />
                              <span>Scan with Camera</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await checkInEvent(
                                  activeEvent.id,
                                  activeEvent.event_qr_code
                                );
                                if (res.ok) {
                                  setCheckInRewardSuccess({
                                    rewardPoints:
                                      res.reward_points ||
                                      activeEvent.reward_points ||
                                      0,
                                    eventTitle: activeEvent.title,
                                  });
                                }
                              }}
                              className="px-4 h-10 rounded-full bg-white/10 text-white font-bold text-xs active:scale-95 transition cursor-pointer"
                            >
                              Quick Verify
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ALL EVENTS LIST PAGE
  const remainingPastCount = Math.max(0, allPastEvents.length - loadedPastCount);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full px-5 pt-2 pb-6 space-y-4"
    >
      {/* Fee Payment Selection Modal */}
      {pendingPaymentEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#141416]">
                Event Entry Fee
              </h3>
              <button
                type="button"
                onClick={() => setPendingPaymentEvent(null)}
                className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#F6F6F9] space-y-1">
              <div className="text-xs font-bold text-[#141416]">
                {pendingPaymentEvent.title}
              </div>
              <div className="text-[11px] text-zinc-500">
                {pendingPaymentEvent.location}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Select Payment Method
              </div>

              {pendingPaymentEvent.fee_amount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPayMethod('cashback')}
                  disabled={
                    (db.user?.wallet_balance || 0) <
                    pendingPaymentEvent.fee_amount
                  }
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition ${
                    selectedPayMethod === 'cashback'
                      ? 'border-[#EC008C] bg-pink-50/40 ring-1 ring-[#EC008C]'
                      : 'border-zinc-200 bg-white'
                  } ${
                    (db.user?.wallet_balance || 0) <
                    pendingPaymentEvent.fee_amount
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-[#141416]">
                      Pay with Cashback
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Balance: $
                      {db.user ? db.user.wallet_balance.toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-[#EC008C]">
                    ${pendingPaymentEvent.fee_amount.toFixed(2)}
                  </span>
                </button>
              )}

              {Number(pendingPaymentEvent.fee_points || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPayMethod('points')}
                  disabled={
                    Number(db.user?.points_balance || 0) <
                    Number(pendingPaymentEvent.fee_points || 0)
                  }
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition ${
                    selectedPayMethod === 'points'
                      ? 'border-[#EC008C] bg-pink-50/40 ring-1 ring-[#EC008C]'
                      : 'border-zinc-200 bg-white'
                  } ${
                    Number(db.user?.points_balance || 0) <
                    Number(pendingPaymentEvent.fee_points || 0)
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-[#141416]">
                      Pay with Reward Points
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Balance:{' '}
                      {db.user ? Number(db.user.points_balance || 0) : 0} pts
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-[#141416]">
                    {pendingPaymentEvent.fee_points} pts
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={isProcessingPayment}
              onClick={async () => {
                setIsProcessingPayment(true);
                const res = await rsvpEvent(
                  pendingPaymentEvent.id,
                  'joined',
                  selectedPayMethod
                );
                setIsProcessingPayment(false);
                if (res.ok) {
                  setPendingPaymentEvent(null);
                }
              }}
              className="w-full h-11 rounded-full bg-[#EC008C] text-white font-bold text-xs shadow-xs disabled:opacity-50 active:scale-95 transition"
            >
              {isProcessingPayment
                ? 'Processing Payment...'
                : 'Confirm & Join Event'}
            </button>
          </div>
        </div>
      )}

      {/* SMALL CATEGORY FILTER + CALENDAR VIEW BUTTON */}
      <div className="w-full flex items-center justify-between gap-2">
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {dynamicCategories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  if (cat === 'All') setSelectedCalendarDateKey(null);
                }}
                className={`h-8 px-3 rounded-full text-[11px] font-bold shrink-0 transition ${
                  active
                    ? 'bg-[#141416] text-[#FFEA00]'
                    : 'bg-white text-zinc-600 shadow-2xs'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowCalendar((prev) => !prev)}
          className={`h-8 px-3 rounded-full text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition ${
            showCalendar || selectedCalendarDateKey
              ? 'bg-[#EC008C] text-white shadow-xs'
              : 'bg-white text-[#141416] shadow-2xs'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Calendar</span>
        </button>
      </div>

      {/* EXPANDABLE INTERACTIVE CALENDAR VIEW */}
      {showCalendar && (
        <div className="w-full p-4 rounded-3xl bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
              className="w-8 h-8 rounded-full bg-[#F6F6F9] flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4 text-[#141416]" />
            </button>
            <div className="text-xs font-extrabold text-[#141416]">
              {calendarMonth.toLocaleDateString('en-GB', {
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
              className="w-8 h-8 rounded-full bg-[#F6F6F9] flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4 text-[#141416]" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-400">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-9" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const hasEvent = (eventCountByDateKey[dateKey] || 0) > 0;
              const isSelected = selectedCalendarDateKey === dateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() =>
                    setSelectedCalendarDateKey((prev) =>
                      prev === dateKey ? null : dateKey
                    )
                  }
                  className={`h-9 rounded-xl flex flex-col items-center justify-center text-xs font-bold relative transition ${
                    isSelected
                      ? 'bg-[#EC008C] text-white'
                      : hasEvent
                      ? 'bg-[#FFF5B8] text-[#141416]'
                      : 'text-zinc-500 hover:bg-[#F6F6F9]'
                  }`}
                >
                  <span>{dayNum}</span>
                  {hasEvent && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        isSelected ? 'bg-white' : 'bg-[#EC008C]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {selectedCalendarDateKey && (
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs">
              <span className="font-semibold text-[#141416]">
                Showing events on {selectedCalendarDateKey}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCalendarDateKey(null)}
                className="font-bold text-[#EC008C] flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear Date
              </button>
            </div>
          )}
        </div>
      )}

      {/* TOP PULL-DOWN / HIDE OLD CONTROLS */}
      {!selectedCalendarDateKey && allPastEvents.length > 0 && (
        <div className="w-full flex items-center gap-2">
          {remainingPastCount > 0 ? (
            <button
              type="button"
              onClick={handleLoadMorePast}
              className="flex-1 h-10 px-4 rounded-full bg-white text-xs font-semibold text-[#141416] flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.99] transition"
            >
              <ArrowDown className="w-3.5 h-3.5 text-[#EC008C]" />
              <span>
                Pull down to load {Math.min(5, remainingPastCount)} older events (
                {loadedPastCount}/{allPastEvents.length})
              </span>
            </button>
          ) : (
            <div className="flex-1 h-10 px-4 rounded-full bg-white/70 text-xs font-medium text-zinc-500 flex items-center justify-center">
              All {allPastEvents.length} past events shown
            </div>
          )}

          {loadedPastCount > 0 && (
            <button
              type="button"
              onClick={handleHideOldEvents}
              className="h-10 px-4 rounded-full bg-[#141416] text-[#FFEA00] text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 transition"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide Old</span>
            </button>
          )}
        </div>
      )}

      {/* LOADED PAST EVENTS (Hidden by default; loads 5 per pull-down) */}
      {visiblePastEvents.length > 0 && (
        <div className="w-full space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500">
              Past Events ({visiblePastEvents.length})
            </span>
            {!selectedCalendarDateKey && (
              <button
                type="button"
                onClick={handleHideOldEvents}
                className="text-xs font-bold text-[#EC008C]"
              >
                Hide Old &uarr;
              </button>
            )}
          </div>

          {visiblePastEvents.map((ev) => (
            <div
              key={ev.id}
              onClick={() => onSelectEvent(ev.id)}
              className="w-full p-4 rounded-2xl bg-white flex items-center justify-between gap-3 cursor-pointer shadow-2xs"
            >
              <div className="min-w-0">
                <div className="text-[11px] text-zinc-500">
                  {formatDate(ev.date_timestamp)} • {ev.category}
                </div>
                <div className="text-sm font-bold text-[#141416] truncate">
                  {ev.title}
                </div>
                <div className="text-[11px] font-semibold text-[#EC008C] truncate mt-0.5">
                  Brands: {ev.brands_involved.join(' • ')}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* TODAY EVENT SECTION */}
      <div ref={upcomingAnchorRef} className="w-full space-y-5">
        {todayEvents.length > 0 && (
          <div className="w-full space-y-2.5">
            <h2 className="text-base font-bold text-[#141416]">Today Event</h2>
            {todayEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev.id)}
                className="w-full rounded-3xl bg-hsg-promo-card text-[#141416] overflow-hidden shadow-sm cursor-pointer group transition active:scale-[0.99]"
              >
                {/* Full-width Image Thumbnail */}
                <div className="relative w-full h-44 bg-black/10 overflow-hidden">
                  <img
                    src={ev.image_url}
                    alt={ev.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                  {/* Top-Left Category & Time Pill */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#141416] text-[#FFEA00] shadow-xs">
                      TODAY
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-xs">
                      {ev.category}
                    </span>
                  </div>

                  {/* Top-Right Join Button */}
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev.id);
                      }}
                      className={`h-8 px-4 rounded-full text-xs font-bold transition shadow-lg cursor-pointer ${
                        ev.user_status === 'checked_in' || ev.user_status === 'joined'
                          ? 'bg-[#141416] text-[#FFEA00]'
                          : (ev.joined_count || 0) >= ev.max_capacity
                          ? 'bg-black/60 backdrop-blur-md text-black/50 cursor-not-allowed'
                          : 'bg-[#EC008C] text-white hover:bg-[#d6007e]'
                      }`}
                    >
                      {ev.user_status === 'checked_in' || ev.user_status === 'joined'
                        ? 'Details'
                        : (ev.joined_count || 0) >= ev.max_capacity
                        ? 'Event Full'
                        : Number(ev.fee_amount || 0) > 0
                        ? `Join • $${Number(ev.fee_amount).toFixed(2)}`
                        : 'Join'}
                    </button>
                  </div>
                </div>

                {/* Title and Details Below */}
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#141416]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {ev.time_label}
                    </span>
                    <span className="text-black/80">
                      {Number(ev.fee_amount || 0) > 0
                        ? `$${Number(ev.fee_amount).toFixed(2)} Fee`
                        : 'Free Entry'}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-[#141416] leading-snug">
                    {ev.title}
                  </h3>

                  {ev.brands_involved && ev.brands_involved.length > 0 && (
                    <div className="text-[11px] font-bold text-[#141416]/90 truncate">
                      {ev.brands_involved.join(' • ')}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-black/80 pt-1 border-t border-black/10">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-black/70" />
                      <span className="truncate">{ev.location}</span>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-black/80">
                      {ev.joined_count}/{ev.max_capacity} joined
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* UPCOMING EVENTS SECTION (Sorted Nearest Date to Top) */}
        <div className="w-full space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-base font-bold text-[#141416]">
                Upcoming Events ({upcomingEvents.length})
              </h1>
              <p className="text-xs text-zinc-500">
                Sorted by nearest date first
              </p>
            </div>
            {loadedPastCount > 0 && (
              <button
                type="button"
                onClick={handleHideOldEvents}
                className="text-xs font-bold text-[#EC008C]"
              >
                Hide Old
              </button>
            )}
          </div>

          {upcomingEvents.length > 0 ? (
            <div className="w-full space-y-3">
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev.id)}
                  className="w-full rounded-3xl bg-[#141416] text-white overflow-hidden shadow-sm cursor-pointer group transition active:scale-[0.99]"
                >
                  {/* Full-width Image Thumbnail */}
                  <div className="relative w-full h-44 bg-zinc-900 overflow-hidden">
                    <img
                      src={ev.image_url}
                      alt={ev.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                    {/* Top-Left Date & Category Pill */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/70 backdrop-blur-md text-[#FFEA00] border border-white/10 flex items-center gap-1 shadow-xs">
                        <Calendar className="w-3 h-3" />
                        {formatDate(ev.date_timestamp)}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/70 backdrop-blur-md text-white border border-white/10 shadow-xs">
                        {ev.category}
                      </span>
                    </div>

                    {/* Top-Right Join Button */}
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(ev.id);
                        }}
                        className={`h-8 px-4 rounded-full text-xs font-bold transition shadow-lg cursor-pointer ${
                          ev.user_status === 'checked_in' || ev.user_status === 'joined'
                            ? 'bg-[#FFEA00] text-[#141416]'
                            : (ev.joined_count || 0) >= ev.max_capacity
                            ? 'bg-black/70 backdrop-blur-md text-zinc-400 cursor-not-allowed'
                            : 'bg-[#EC008C] text-white hover:bg-[#d6007e]'
                        }`}
                      >
                        {ev.user_status === 'checked_in' || ev.user_status === 'joined'
                          ? 'Details'
                          : (ev.joined_count || 0) >= ev.max_capacity
                          ? 'Event Full'
                          : Number(ev.fee_amount || 0) > 0
                          ? `Join • $${Number(ev.fee_amount).toFixed(2)}`
                          : 'Join'}
                      </button>
                    </div>
                  </div>

                  {/* Title and Details Below */}
                  <div className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#FFEA00] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {ev.time_label}
                      </span>
                      <span className="text-zinc-300 font-medium">
                        {Number(ev.fee_amount || 0) > 0
                          ? `$${Number(ev.fee_amount).toFixed(2)} Fee`
                          : 'Free Entry'}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-white leading-snug">
                      {ev.title}
                    </h2>

                    {ev.brands_involved && ev.brands_involved.length > 0 && (
                      <div className="text-[11px] font-semibold text-[#EC008C] truncate">
                        {ev.brands_involved.join(' • ')}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-white/10">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                      <span className="shrink-0 text-[11px] text-zinc-400">
                        {ev.joined_count}/{ev.max_capacity} joined
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full p-6 rounded-3xl bg-white text-center text-xs text-zinc-400">
              No events match the selected filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
