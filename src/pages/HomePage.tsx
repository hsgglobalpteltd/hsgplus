import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  Megaphone,
  Plus,
  Trophy,
  Wallet,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { isImageLoaded, markImageLoaded } from '../lib/imagePreloader';

interface HomePageProps {
  onOpenAccount: () => void;
  onOpenEvents: (eventId?: string) => void;
  onOpenContest: (contestId?: string) => void;
  onOpenRedeemShop: () => void;
}

function formatCountdown(startTs?: number | string, endTs?: number | string, now = Date.now()): string {
  if (!endTs) return 'Live Now';
  const startNum = startTs ? Number(startTs) : null;
  const endNum = Number(endTs);
  if (!endNum) return 'Live Now';

  if (startNum && now < startNum) {
    const diff = Math.max(0, startNum - now);
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (diff >= 86400000) {
      return `Starts in ${days} ${days === 1 ? 'day' : 'days'}`;
    }
    return `Starts in ${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  if (now >= endNum) {
    return 'Contest Ended';
  }
  const diff = Math.max(0, endNum - now);
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (diff >= 86400000) {
    return `${days} ${days === 1 ? 'day' : 'days'} left`;
  }
  return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s left`;
}

function ContestThumbnail({
  src,
  alt,
  countdownText,
  isWinnersAnnounced = false,
}: {
  src: string;
  alt: string;
  countdownText: string;
  isWinnersAnnounced?: boolean;
}) {
  const alreadyCached = isImageLoaded(src);
  const [loaded, setLoaded] = useState<boolean>(() => alreadyCached);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      markImageLoaded(src);
      setLoaded(true);
    }
  }, [src]);

  return (
    <div className="w-full relative bg-zinc-100 overflow-hidden min-h-[220px]">
      {!loaded && !alreadyCached && (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-100 animate-pulse flex items-center justify-center min-h-[220px]">
          <div className="w-7 h-7 rounded-full border-2 border-zinc-300 border-t-zinc-500 animate-spin opacity-40" />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="eager"
        decoding="async"
        onLoad={() => {
          markImageLoaded(src);
          setLoaded(true);
        }}
        className={`w-full h-auto max-h-[560px] object-cover block transition-opacity duration-150 ${
          loaded || alreadyCached ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!isWinnersAnnounced && (
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[#141416]/90 backdrop-blur-xs text-[#FFEA00] text-[11px] font-extrabold flex items-center gap-1.5 shadow-md z-10">
          <Clock className="w-3.5 h-3.5 text-[#EC008C]" />
          <span>{countdownText}</span>
        </div>
      )}
    </div>
  );
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenAccount,
  onOpenEvents,
  onOpenContest,
  onOpenRedeemShop,
}) => {
  const { db, isAuthenticated, openLoginModal } = useHsgData();

  // Mock data amounts shown when user is not logged in (to attract them to log in)
  const MOCK_TOTAL_CASH = 88.9;
  const MOCK_AVAILABLE_CASH = 55.0;
  const MOCK_TOTAL_PTS = 1980;
  const MOCK_AVAILABLE_PTS = 1980;

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const upcomingEvents = db.events
    .filter((e) => e.date_timestamp >= now - 7 * 86400000)
    .sort((a, b) => a.date_timestamp - b.date_timestamp);
  const nextEvent = upcomingEvents[0] || null;

  const availableCash = isAuthenticated && db.user
    ? Number(db.user.wallet_balance || 0)
    : (isAuthenticated ? Number(db.user?.wallet_balance || 0) : MOCK_AVAILABLE_CASH);

  const pendingCashFromTxs = React.useMemo(() => {
    return (db.transactions || [])
      .filter((tx) => tx.status === 'pending')
      .reduce((sum, tx) => {
        const amt = Number(
          tx.amount_cashback ?? tx.net_cashback ?? tx.cashback_amount ?? tx.amount ?? 0
        );
        return sum + (amt > 0 ? amt : 0);
      }, 0);
  }, [db.transactions]);

  const pendingCash = isAuthenticated && db.user
    ? Math.max(
        Number(db.user?.pending_balance || 0),
        Number(pendingCashFromTxs.toFixed(2))
      )
    : (isAuthenticated ? 0 : Number((MOCK_TOTAL_CASH - MOCK_AVAILABLE_CASH).toFixed(2)));

  const totalCash = isAuthenticated && db.user
    ? Number((availableCash + pendingCash).toFixed(2))
    : (isAuthenticated ? availableCash : MOCK_TOTAL_CASH);

  const availablePts = isAuthenticated && db.user
    ? Number(db.user?.points_balance || 0)
    : (isAuthenticated ? Number(db.user?.points_balance || 0) : MOCK_AVAILABLE_PTS);

  const pendingPtsFromTxs = React.useMemo(() => {
    return (db.transactions || [])
      .filter((tx) => tx.status === 'pending')
      .reduce((sum, tx) => {
        const pts = Number(
          tx.amount_points ?? tx.net_points ?? tx.points ?? 0
        );
        return sum + (pts > 0 ? pts : 0);
      }, 0);
  }, [db.transactions]);

  const pendingPts = isAuthenticated && db.user
    ? Math.max(
        Number(db.user?.pending_points || 0),
        pendingPtsFromTxs
      )
    : 0;

  const totalPts = isAuthenticated && db.user
    ? availablePts + pendingPts
    : (isAuthenticated ? availablePts : MOCK_TOTAL_PTS);

  const cashStr = `$${totalCash.toFixed(2)}`;
  const ptsStr = totalPts.toLocaleString();

  // Dynamic responsive font size: scales down smoothly when digits increase so right side always has generous padding
  const getCashFontSize = (len: number) => {
    if (len <= 5) return 'text-2xl'; // e.g. $0.00
    if (len <= 6) return 'text-xl'; // e.g. $88.90
    if (len <= 8) return 'text-lg'; // e.g. $188.90 or $999.00
    if (len <= 10) return 'text-base'; // e.g. $1,288.90
    return 'text-sm';
  };

  const getPtsFontSize = (len: number) => {
    if (len <= 4) return 'text-xs'; // e.g. 1980
    if (len <= 6) return 'text-[11px]'; // e.g. 19,800
    return 'text-[10px]';
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });

  return (
    <div className="w-full px-5 pt-2 pb-14 space-y-6">
      {/* 1. TOP SPLIT ROW: Cashback Amount | Upcoming Event Small */}
      <div className="w-full grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenAccount}
          className="w-full p-4 rounded-3xl bg-[#141416] text-white text-left shadow-sm active:scale-[0.98] transition flex flex-col justify-between min-h-[116px] overflow-hidden"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-zinc-400 font-medium truncate pr-1">
              Cashback & Points
            </span>
            <Wallet className="w-4 h-4 text-[#FFEA00] shrink-0" />
          </div>
          <div className="my-1 flex items-baseline justify-start w-full min-w-0 pr-3">
            <span
              className={`${getCashFontSize(
                cashStr.length
              )} font-extrabold tracking-tight text-[#FFEA00] truncate leading-tight`}
            >
              {cashStr}
            </span>
          </div>
          <div className="text-xs font-extrabold text-white flex items-center justify-between w-full min-w-0">
            <span className="truncate pr-1">
              <span className={getPtsFontSize(ptsStr.length)}>{ptsStr}</span>{' '}
              <span className="text-[11px] font-bold text-[#FFEA00]">pts</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#EC008C] shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenEvents(nextEvent?.id)}
          className="w-full p-4 rounded-3xl bg-white text-[#141416] text-left shadow-sm active:scale-[0.98] transition flex flex-col justify-between min-h-[116px]"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-zinc-500 font-medium">Next Event</span>
            <Calendar className="w-4 h-4 text-[#EC008C]" />
          </div>
          {nextEvent ? (
            <>
              <div className="text-sm font-bold leading-snug line-clamp-2 mt-1">
                {nextEvent.title}
              </div>
              <div className="text-[11px] font-semibold text-zinc-500 mt-1 flex items-center justify-between w-full">
                <span>{formatDate(nextEvent.date_timestamp)}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#141416]" />
              </div>
            </>
          ) : (
            <div className="text-xs text-zinc-400 mt-2">No upcoming run</div>
          )}
        </button>
      </div>

      {/* 2. ACTIVE CONTESTS (Hidden when no active contest exists) */}
      {db.contests.length > 0 && (
        <section className="w-full">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-base font-bold text-[#141416]">Active Contests</h2>
          </div>

          <div className="w-full space-y-3.5">
            {db.contests.slice(0, 3).map((contest) => {
              const fpTitle =
                contest.frontpage_title ||
                contest.frontpage_config?.title ||
                contest.title;
              const fpDesc =
                contest.frontpage_description ||
                contest.frontpage_config?.description ||
                (contest as any).subtitle ||
                '';
              const fpPhoto =
                contest.frontpage_poster_url ||
                contest.frontpage_config?.cover_photo_url ||
                (Array.isArray(contest.inside_posters) && contest.inside_posters[0]) ||
                (Array.isArray(contest.poster_images) && contest.poster_images[0]) ||
                '';
              const isWinnersAnnounced = Boolean(contest.winners_announced);
              const countdownText = formatCountdown(
                contest.start_timestamp,
                contest.end_timestamp,
                now
              );

              return (
                <div
                  key={contest.id}
                  onClick={() => onOpenContest(contest.id)}
                  className="w-full rounded-3xl bg-white overflow-hidden shadow-xs cursor-pointer active:scale-[0.99] transition border border-zinc-200/60"
                >
                  {fpPhoto && (
                    <ContestThumbnail
                      src={fpPhoto}
                      alt={fpTitle}
                      countdownText={countdownText}
                      isWinnersAnnounced={isWinnersAnnounced}
                    />
                  )}

                  <div className="p-4 space-y-3">
                    <div>
                      {!fpPhoto && !isWinnersAnnounced && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141416] text-[#FFEA00] text-[10px] font-extrabold mb-2">
                          <Clock className="w-3 h-3 text-[#EC008C]" />
                          <span>{countdownText}</span>
                        </div>
                      )}
                      <h3 className="text-base font-extrabold text-[#141416] leading-snug">
                        {fpTitle}
                      </h3>
                      {fpDesc && (
                        <p className="text-xs text-zinc-600 leading-relaxed mt-1">
                          {fpDesc}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-500">
                        {isWinnersAnnounced ? 'Tap to view' : 'Tap for details & rules'}
                      </span>
                      {isWinnersAnnounced ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenContest(contest.id);
                          }}
                          className="h-9 px-4 rounded-full bg-[#141416] text-[#FFEA00] text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:bg-black transition active:scale-95 cursor-pointer"
                        >
                          <Trophy className="w-3.5 h-3.5 text-[#FFEA00]" />
                          <span>View Winners</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenContest(contest.id);
                          }}
                          className="h-9 px-4 rounded-full bg-[#EC008C] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:bg-[#d6007e] transition active:scale-95 cursor-pointer"
                        >
                          <span>Submit Entry</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. ANNOUNCEMENTS */}
      <section className="w-full">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-base font-bold text-[#141416]">Announcements</h2>
          <span className="text-xs text-zinc-500">Latest news</span>
        </div>

        {db.announcements.length > 0 ? (
          <div className="w-full space-y-2.5">
            {db.announcements.map((ann) => (
              <div
                key={ann.id}
                className="w-full p-4 rounded-2xl bg-[#141416] text-white shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#FFEA00] shrink-0 stroke-[1.75]" />
                  <h3 className="text-sm font-bold text-white truncate">
                    {ann.title}
                  </h3>
                </div>
                <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                  {ann.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full p-5 rounded-2xl bg-white text-xs text-zinc-400">
            No announcements available.
          </div>
        )}
      </section>

      {/* 4. POST HIGHLIGHTS — SCROLL LEFT */}
      <section className="w-full">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-base font-bold text-[#141416]">Post Highlights</h2>
          <span className="text-xs font-medium text-zinc-500">Swipe left &larr;</span>
        </div>

        {db.highlights.length > 0 ? (
          <div className="w-full flex gap-3.5 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2">
            {db.highlights.map((item) => {
              const postUrl =
                (item as any).post_url || item.external_link || '';
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (postUrl) {
                      window.open(postUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className={`w-44 shrink-0 snap-start bg-white rounded-3xl p-2.5 shadow-xs transition ${
                    postUrl
                      ? 'cursor-pointer active:scale-[0.98]'
                      : ''
                  }`}
                >
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className={`w-full h-36 rounded-2xl bg-zinc-100 ${
                      item.image_url.includes('hsg-bottle')
                        ? 'object-contain p-2 bg-[#FFFDF0]'
                        : 'object-cover'
                    }`}
                  />
                  <div className="px-1 pt-2.5 pb-1">
                    <div className="text-[10px] font-bold text-[#EC008C] truncate">
                      {item.brand_name}
                    </div>
                    <div className="text-xs font-bold text-[#141416] truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {item.subtitle}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full p-5 rounded-2xl bg-white text-xs text-zinc-400">
            No post highlights available.
          </div>
        )}
      </section>

      {/* 5. HSG+ SHOP — REDEEM PRODUCTS & MERCH (MAXIMUM 8 ITEMS + LOAD MORE) */}
      <section id="hsg-shop-section" className="w-full scroll-mt-2">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-base font-bold text-[#141416]">HSG+ Shop</h2>
          <button
            type="button"
            onClick={onOpenRedeemShop}
            className="text-xs font-semibold text-[#EC008C]"
          >
            View shop
          </button>
        </div>

        {db.merch_catalog.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {db.merch_catalog.slice(0, 8).map((item) => {
                const mode = item.redeem_mode || 'both';
                const ptsPrice = Number(
                  item.price_points ?? Math.round(item.price * 10)
                );
                const cat = item.category || 'Product';

                return (
                  <div
                    key={item.id}
                    onClick={onOpenRedeemShop}
                    className="rounded-3xl bg-white p-3 shadow-xs border border-zinc-200/60 flex flex-col justify-between cursor-pointer active:scale-[0.99] transition"
                  >
                    <div>
                      <div className="w-full aspect-square rounded-2xl bg-[#F6F6F9] overflow-hidden relative mb-2.5">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className={`w-full h-full ${
                              item.image_url.includes('hsg-bottle')
                                ? 'object-contain p-3'
                                : 'object-cover'
                            }`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] text-zinc-400">
                            No Photo
                          </div>
                        )}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 text-[#141416] text-[9px] font-bold">
                          {cat === 'Merch' ? 'Merch' : 'Product'}
                        </span>
                      </div>

                      <h3 className="text-xs font-extrabold text-[#141416] line-clamp-2 leading-snug">
                        {item.name}
                      </h3>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
                        {(mode === 'both' || mode === 'points_only') && (
                          <span className="font-extrabold text-[#141416]">
                            {ptsPrice} pts
                          </span>
                        )}
                        {mode === 'both' && (
                          <span className="text-zinc-400 text-[10px]">or</span>
                        )}
                        {(mode === 'both' || mode === 'cashback_only') && (
                          <span className="font-extrabold text-[#EC008C]">
                            ${item.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isAuthenticated) {
                          openLoginModal();
                          return;
                        }
                        onOpenRedeemShop();
                      }}
                      className="w-full h-8 mt-3 rounded-full bg-[#141416] text-[#FFEA00] text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onOpenRedeemShop}
              className="w-full h-11 rounded-full bg-white text-[#141416] text-xs font-extrabold shadow-xs border border-zinc-200/80 flex items-center justify-center gap-1.5 active:scale-[0.99] transition"
            >
              <span>Load More</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#EC008C]" />
            </button>
          </div>
        ) : (
          <div className="w-full p-5 rounded-2xl bg-white text-xs text-zinc-400">
            No shop items available right now.
          </div>
        )}
      </section>
    </div>
  );
};
