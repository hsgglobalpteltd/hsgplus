import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Flame,
  Home,
  ReceiptText,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { HsgDataProvider, useHsgData } from './context/HsgDataContext';
import { HsgLogo } from './components/HsgLogo';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { SnapCashbackPage } from './pages/SnapCashbackPage';
import { EventsPage } from './pages/EventsPage';
import { ContestPage } from './pages/ContestPage';
import { AccountPage } from './pages/AccountPage';
import { RedeemShopPage } from './pages/RedeemShopPage';
import { InviteFriendsPage } from './pages/InviteFriendsPage';
import { TransactionHistoryPage } from './pages/TransactionHistoryPage';

type ActiveRoute =
  | 'home'
  | 'snap'
  | 'events'
  | 'contest'
  | 'account'
  | 'redeem'
  | 'invite'
  | 'transactions';

function parseInitialDeepLink(): {
  route: ActiveRoute;
  contestId: string | null;
  eventId: string | null;
  venueToken: string | null;
  isVenueScan: boolean;
} {
  if (typeof window === 'undefined') {
    return { route: 'home', contestId: null, eventId: null, venueToken: null, isVenueScan: false };
  }
  const pathname = window.location.pathname || '';
  const rawHash = (window.location.hash || '').replace(/^#/, '');
  const search = window.location.search || '';
  const raw = window.location.hash || window.location.search;

  let contestId: string | null = null;
  let eventId: string | null = null;
  let venueToken: string | null = null;
  let isVenueScan = false;
  let targetRoute: ActiveRoute = 'home';

  // 1. Direct pathname detection (/c/:id or /e/:id)
  if (/^\/[cC]\//.test(pathname)) {
    const rawId = pathname.replace(/^\/[cC]\//, '').split('/')[0].split('?')[0].trim();
    if (rawId) contestId = decodeURIComponent(rawId).toLowerCase();
    targetRoute = 'contest';
  } else if (/^\/[eE]\//.test(pathname)) {
    const rawId = pathname.replace(/^\/[eE]\//, '').split('/')[0].split('?')[0].trim();
    if (rawId) eventId = decodeURIComponent(rawId).toLowerCase();
    targetRoute = 'events';
  }

  // 2. Query / Hash parameters
  const hashPart = rawHash.split('?')[0].toLowerCase();
  const queryStr = raw.includes('?') ? raw.split('?')[1] : (search ? search.replace(/^\?/, '') : '');
  const params = new URLSearchParams(queryStr);
  const qId = params.get('id');
  const vt = params.get('vt');

  if (vt) {
    venueToken = decodeURIComponent(vt);
    isVenueScan = true;
  }
  if (params.get('venue_scan') === '1') {
    isVenueScan = true;
  }

  if (hashPart === 'contest' || raw.toLowerCase().includes('contest') || pathname.toLowerCase().includes('contest')) {
    if (qId) contestId = decodeURIComponent(qId).trim().toLowerCase();
    targetRoute = 'contest';
  } else if (hashPart === 'events' || raw.toLowerCase().includes('events') || (qId && !contestId) || isVenueScan) {
    if (qId) eventId = decodeURIComponent(qId).trim().toLowerCase();
    targetRoute = 'events';
  } else if (
    ['account', 'redeem', 'invite', 'transactions', 'snap'].includes(hashPart)
  ) {
    targetRoute = hashPart as ActiveRoute;
  } else {
    const saved = sessionStorage.getItem('hsg_active_route');
    if (saved && ['home', 'account', 'events', 'contest', 'redeem', 'invite', 'transactions', 'snap'].includes(saved)) {
      targetRoute = saved as ActiveRoute;
    }
  }

  return { route: targetRoute, contestId, eventId, venueToken, isVenueScan };
}

const HsgMobileShell: React.FC = () => {
  const {
    db,
    isAuthenticated,
    showLoginModal,
    openLoginModal,
    closeLoginModal,
    requireAuth,
    toastMessage,
  } = useHsgData();

  const initialDeepLink = React.useMemo(() => parseInitialDeepLink(), []);

  const ROUTE_ORDER: Record<ActiveRoute, number> = {
    home: 0,
    snap: 1,
    events: 2,
    account: 3,
    contest: 4,
    redeem: 5,
    invite: 6,
    transactions: 7,
  };

  const [route, setRoute] = useState<ActiveRoute>(initialDeepLink.route);
  const [slideDir, setSlideDir] = useState<'right' | 'left'>('right');
  const [navKey, setNavKey] = useState<number>(0);

  const homeScrollPosRef = useRef<number>(0);
  const eventsScrollPosRef = useRef<number>(0);

  const navigateTo = (newRoute: ActiveRoute, forceDirection?: 'right' | 'left') => {
    if (route === 'home' && newRoute !== 'home' && mainScrollRef.current) {
      homeScrollPosRef.current = mainScrollRef.current.scrollTop;
    }
    if (route === 'events' && newRoute !== 'events' && mainScrollRef.current) {
      eventsScrollPosRef.current = mainScrollRef.current.scrollTop;
    }
    const currentOrder = ROUTE_ORDER[route] ?? 0;
    const targetOrder = ROUTE_ORDER[newRoute] ?? 0;
    const calculatedDir = targetOrder >= currentOrder ? 'right' : 'left';
    setSlideDir(forceDirection || calculatedDir);
    setNavKey((k) => k + 1);
    setIsContestScrolled(false);
    setHasContestUserScrolled(false);
    setRoute(newRoute);
    try {
      sessionStorage.setItem('hsg_active_route', newRoute);
      if (newRoute === 'home') {
        if (window.location.hash) {
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        }
      } else {
        window.location.hash = newRoute;
      }
    } catch (e) {}
  };

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseInitialDeepLink();
      if (parsed.contestId) setSelectedContestId(parsed.contestId);
      if (parsed.eventId) setSelectedEventId(parsed.eventId);
      if (parsed.venueToken) setVenueToken(parsed.venueToken);
      if (parsed.isVenueScan) setIsVenueScan(true);

      if (parsed.route === 'transactions' && !isAuthenticated) {
        setRoute('home');
        openLoginModal();
        return;
      }

      if (parsed.route === 'contest' || parsed.route === 'events') {
        if (route === 'home' && mainScrollRef.current) {
          homeScrollPosRef.current = mainScrollRef.current.scrollTop;
        }
        if (route === 'events' && mainScrollRef.current) {
          eventsScrollPosRef.current = mainScrollRef.current.scrollTop;
        }
      }
      setRoute(parsed.route);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated, route]);

  // On-mount deep-link check: If URL or QR contains contest or event id, vt, or venue_scan, activate route immediately
  useEffect(() => {
    const parsed = parseInitialDeepLink();
    if (parsed.contestId) setSelectedContestId(parsed.contestId);
    if (parsed.eventId) setSelectedEventId(parsed.eventId);
    if (parsed.venueToken) setVenueToken(parsed.venueToken);
    if (parsed.isVenueScan) setIsVenueScan(true);
    if (parsed.route && parsed.route !== 'home') {
      setRoute(parsed.route);
    }
  }, []);

  // Strict route guard: Transaction History cannot be accessed without login
  useEffect(() => {
    if (!isAuthenticated && route === 'transactions') {
      navigateTo('home');
      openLoginModal();
    }
  }, [isAuthenticated, route]);

  const [txHistoryTab, setTxHistoryTab] = useState<'cashback' | 'points'>('cashback');
  const [redeemBackRoute, setRedeemBackRoute] = useState<'home' | 'account'>(
    'home'
  );
  const [eventBackRoute, setEventBackRoute] = useState<'events' | 'contest'>('events');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialDeepLink.eventId);
  const [venueToken, setVenueToken] = useState<string | null>(initialDeepLink.venueToken);
  const [isVenueScan, setIsVenueScan] = useState<boolean>(initialDeepLink.isVenueScan);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(initialDeepLink.contestId);
  const [contestAutoScroll, setContestAutoScroll] = useState<boolean>(false);
  const [contestBackRoute, setContestBackRoute] = useState<'home' | 'events'>('home');
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(
    () => window.innerWidth > 768
  );

  // Streak Popup State:
  // 1st click -> shows Streak Detail + Congrats Animation
  // 2nd click onwards -> just displays Streak Detail without Congrats Animation
  const [showStreakPopup, setShowStreakPopup] = useState<boolean>(false);
  const [hasSeenStreakCongrats, setHasSeenStreakCongrats] =
    useState<boolean>(false);
  const [playCongratsAnimation, setPlayCongratsAnimation] =
    useState<boolean>(false);

  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  // Dynamic Bottom Nav Button (Shop vs Home)
  const [isShopInView, setIsShopInView] = useState<boolean>(false);

  // Contest, Event Detail, Account & Transactions Header Scroll State (fades back arrow in header and hides streak button on scroll)
  const [isContestScrolled, setIsContestScrolled] = useState<boolean>(false);
  const [hasContestUserScrolled, setHasContestUserScrolled] = useState<boolean>(false);

  const isFluidHeaderRoute =
    route === 'contest' ||
    (route === 'events' && Boolean(selectedEventId)) ||
    route === 'account' ||
    route === 'transactions';

  const handleContestBack = () => {
    setContestAutoScroll(false);
    setIsContestScrolled(false);
    setHasContestUserScrolled(false);
    if (contestBackRoute === 'events') {
      setContestBackRoute('home');
      navigateTo('events', 'left');
    } else {
      navigateTo('home', 'left');
    }
  };

  const handleEventDetailBack = () => {
    setIsContestScrolled(false);
    setHasContestUserScrolled(false);
    if (eventBackRoute === 'contest') {
      setEventBackRoute('events');
      setSelectedEventId(null);
      navigateTo('contest', 'left');
    } else {
      setSelectedEventId(null);
    }
  };

  const handleFluidBack = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsContestScrolled(false);
    setHasContestUserScrolled(false);
    if (route === 'contest') {
      handleContestBack();
    } else if (route === 'events') {
      handleEventDetailBack();
    } else if (route === 'transactions') {
      navigateTo('account', 'left');
    } else if (route === 'account') {
      navigateTo('home', 'left');
    } else {
      navigateTo('home', 'left');
    }
  };

  // Scroll-Orbiting "SNAP & EARN" Badge State (Option A: 1:1 scroll orbit + Behavior 2: magnetic snap-back)
  const [badgeRotation, setBadgeRotation] = useState<number>(0);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const scrollAnchorRef = useRef<number | null>(null);
  const baseAngleRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);

  const handleMainScroll = () => {
    // 1. Calculate Orbit Rotation from Scroll (Anchored to gesture start so it always begins from 12 o'clock)
    if (mainScrollRef.current) {
      const currentScrollTop = mainScrollRef.current.scrollTop;

      // Track Contest, Event Detail, Account, and Transactions page scroll for docking header back button & merging streak pill
      if (isFluidHeaderRoute) {
        const scrolled = currentScrollTop > 2;
        setIsContestScrolled(scrolled);
        if (scrolled && !hasContestUserScrolled) {
          setHasContestUserScrolled(true);
        }
      } else if (isContestScrolled) {
        setIsContestScrolled(false);
      }

      // Start of a new scroll gesture after resting at 12 o'clock
      if (!isScrollingRef.current || scrollAnchorRef.current === null) {
        scrollAnchorRef.current = currentScrollTop;
        isScrollingRef.current = true;
        setIsScrolling(true);
      }

      const delta = currentScrollTop - scrollAnchorRef.current;
      const currentAngle = baseAngleRef.current + delta * 0.6;
      setBadgeRotation(currentAngle);

      // Behavior 2: Snap back to nearest upright 12 o'clock position 800ms after scroll stops
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        const nearestTurn = Math.round(currentAngle / 360) * 360;
        baseAngleRef.current = nearestTurn;
        scrollAnchorRef.current = null;
        isScrollingRef.current = false;
        setIsScrolling(false);
        setBadgeRotation(nearestTurn);
      }, 800);
    }

    // 2. Track Shop section view for Home/Shop toggle
    if (route !== 'home') {
      if (isShopInView) setIsShopInView(false);
      return;
    }
    const main = mainScrollRef.current;
    const shopEl = document.getElementById('hsg-shop-section');
    if (main && shopEl) {
      const rect = shopEl.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const relativeTop = rect.top - mainRect.top;
      // When user scrolled down and the shop section is within the visible portion
      const inView = relativeTop <= mainRect.height * 0.45;
      setIsShopInView(inView);
    } else {
      setIsShopInView(false);
    }
  };

  const handleHomeShopClick = () => {
    if (route !== 'home') {
      setSelectedEventId(null);
      navigateTo('home');
      setIsShopInView(false);
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (isShopInView) {
      // Scrolled to shop -> scroll back to top of Home
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      // At top / feed -> scroll down to HSG+ Shop section
      const shopEl = document.getElementById('hsg-shop-section');
      if (shopEl) {
        shopEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (mainScrollRef.current) {
        mainScrollRef.current.scrollTo({
          top: mainScrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!db.settings.theme_color_1 && !db.settings.theme_color_2) return;
    const c1 = (db.settings.theme_color_1 || '#FFEA00').trim();
    const c2 = (db.settings.theme_color_2 || '#EC008C').trim();
    document.documentElement.style.setProperty('--hsg-color-1', c1);
    document.documentElement.style.setProperty('--hsg-color-2', c2);

    const metaList = document.querySelectorAll('meta[name="theme-color"]');
    if (metaList.length > 0) {
      metaList.forEach((m) => m.setAttribute('content', c1));
    } else {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      m.content = c1;
      document.head.appendChild(m);
    }

    try {
      localStorage.setItem('hsg_theme_color_1', c1);
      localStorage.setItem('hsg_theme_color_2', c2);
    } catch {}
  }, [db.settings.theme_color_1, db.settings.theme_color_2]);

  useEffect(() => {
    baseAngleRef.current = 0;
    scrollAnchorRef.current = null;
    isScrollingRef.current = false;
    setBadgeRotation(0);
    setIsScrolling(false);
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    if (route !== 'contest' && !(route === 'events' && Boolean(selectedEventId))) {
      setIsContestScrolled(false);
      setHasContestUserScrolled(false);
    }
    if (route === 'home') {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTo({
          top: homeScrollPosRef.current,
          behavior: 'instant' as ScrollBehavior,
        });
      }
    } else if (route === 'events') {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTo({
          top: eventsScrollPosRef.current,
          behavior: 'instant' as ScrollBehavior,
        });
      }
    } else if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({
        top: 0,
        behavior: 'instant' as ScrollBehavior,
      });
    }
  }, [route]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenStreakPopup = () => {
    if (!hasSeenStreakCongrats) {
      setPlayCongratsAnimation(true);
      setHasSeenStreakCongrats(true);
    } else {
      setPlayCongratsAnimation(false);
    }
    setShowStreakPopup(true);
  };

  const currentUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : 'https://plus.hsgglobal.sg';

  // DESKTOP QR BLOCKER FOR MOBILE APP (STRICT MOBILE ONLY)
  if (isDesktopViewport) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-hsg-app-canvas text-[#141416] px-6 text-center select-none">
        <HsgLogo size="lg" darkText />
        <h1 className="font-bold text-2xl mt-3 tracking-tight">
          Open HSG+ Community on Mobile
        </h1>
        <p className="text-sm text-zinc-600 max-w-sm mt-1.5">
          Scan the QR code with your phone camera to claim Cashback, join HSG+ Events, and win prizes.
        </p>

        <div className="bg-white p-6 mt-6 rounded-3xl shadow-md">
          <QRCodeSVG value={currentUrl} size={190} />
        </div>
      </div>
    );
  }

  const weeklyStreak = db.user?.weekly_streak ?? 4;

  return (
    <div className="w-full h-full flex justify-center bg-hsg-app-canvas md:bg-[#E5E5EA] overflow-hidden">
      <div className="w-full md:max-w-[430px] h-full flex flex-col bg-hsg-app-canvas text-[#141416] overflow-hidden relative md:shadow-2xl">
        {/* WEEKLY STREAK DETAIL POPUP MODAL */}
        {showStreakPopup && (
          <div
            onClick={() => setShowStreakPopup(false)}
            className="absolute inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center px-6"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full rounded-3xl bg-[#141416] text-white p-6 shadow-2xl relative overflow-hidden ${
                playCongratsAnimation ? 'animate-streak-pop' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setShowStreakPopup(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-zinc-300 flex items-center justify-center absolute top-4 right-4"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl bg-[#FFEA00] text-[#141416] flex items-center justify-center shrink-0 shadow-md ${
                    playCongratsAnimation ? 'animate-streak-flame' : ''
                  }`}
                >
                  <Flame className="w-9 h-9 text-[#EC008C] fill-[#EC008C]" />
                </div>
                <div>
                  <div className="text-2xl font-black text-[#FFEA00] leading-none">
                    {weeklyStreak} {weeklyStreak === 1 ? 'Week' : 'Weeks'} Streak
                  </div>
                  <p className="text-xs text-zinc-300 mt-1">
                    Keep opening HSG+ every week to maintain your active streak.
                  </p>
                </div>
              </div>

              {/* 4-Week Streak Progress Row */}
              <div className="grid grid-cols-4 gap-2 mt-5">
                {[1, 2, 3, 4].map((wk) => {
                  const done = wk <= weeklyStreak;
                  return (
                    <div
                      key={wk}
                      className={`p-2.5 rounded-2xl text-center border ${
                        done
                          ? 'bg-[#FFEA00]/15 border-[#FFEA00] text-[#FFEA00]'
                          : 'bg-white/5 border-white/10 text-zinc-500'
                      }`}
                    >
                      <div className="text-[10px] font-bold">Week {wk}</div>
                      <div className="mt-1 flex items-center justify-center">
                        {done ? (
                          <Check className="w-4 h-4 text-[#FFEA00]" />
                        ) : (
                          <Flame className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowStreakPopup(false)}
                className="w-full h-11 mt-5 rounded-full bg-[#FFEA00] text-[#141416] text-xs font-extrabold"
              >
                {playCongratsAnimation ? 'Awesome, Keep It Up!' : 'Close'}
              </button>
            </div>
          </div>
        )}

        {/* FIXED TOP HEADER */}
        <header className="w-full h-15 px-5 flex items-center justify-between shrink-0 select-none relative z-40">
          <div className="flex items-center text-left gap-2">
            <HsgLogo size="md" darkText />

            {/* SINGLE FLUID BACK BUTTON (Active on contest, event detail, account, transactions) */}
            {isFluidHeaderRoute && (
              <div
                className={`flex items-center relative z-50 pointer-events-auto ${
                  !hasContestUserScrolled
                    ? '-translate-x-[68px] translate-y-[48px]'
                    : isContestScrolled
                    ? 'animate-contest-dock-up'
                    : 'animate-contest-drop-back'
                }`}
              >
                <button
                  type="button"
                  onClick={handleFluidBack}
                  title="Back"
                  className="w-8 h-8 rounded-full bg-white text-[#141416] flex items-center justify-center shadow-2xs active:scale-90 transition-transform cursor-pointer shrink-0 overflow-hidden relative z-50 pointer-events-auto"
                >
                  <span
                    className={
                      hasContestUserScrolled ? 'animate-contest-icon-fade flex items-center justify-center' : 'flex items-center justify-center'
                    }
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* SVG Gooey Filter for Authentic Fluid Metaball Necking / Coalescence */}
          <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
            <defs>
              <filter id="metaball-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                  result="goo"
                />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
            </defs>
          </svg>

          {/* Top-Right: Weekly App Open Streak Button + Profile / Login Button */}
          <div
            className={`flex items-center gap-2 relative isolate ${
              isFluidHeaderRoute ? 'gooey-filter-container' : ''
            }`}
          >
            {/* Clickable Weekly Streak Button: Strictly BEHIND profile button (z-0) */}
            <div
              style={{ zIndex: 0 }}
              className={`flex items-center relative ${
                isFluidHeaderRoute
                  ? !hasContestUserScrolled
                    ? 'opacity-100 scale-100'
                    : isContestScrolled
                    ? 'animate-liquid-merge pointer-events-none'
                    : 'animate-liquid-unmerge'
                  : 'opacity-100 scale-100'
              }`}
            >
              <button
                type="button"
                onClick={() => requireAuth(handleOpenStreakPopup)}
                title={`Weekly App Streak: ${weeklyStreak} Weeks`}
                className="h-9 px-3 rounded-full bg-white text-[#141416] text-xs font-extrabold flex items-center gap-1 shadow-2xs active:scale-95 transition select-none cursor-pointer shrink-0"
              >
                <Flame className="w-4 h-4 text-[#EC008C] fill-[#EC008C]" />
                <span>{weeklyStreak}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  openLoginModal();
                } else {
                  navigateTo('account');
                }
              }}
              aria-label={isAuthenticated ? 'Open Account' : 'Log In'}
              style={{ zIndex: 20 }}
              className={`h-9 px-3.5 rounded-full flex items-center gap-1.5 transition shadow-2xs font-bold text-xs cursor-pointer relative ${
                isFluidHeaderRoute && hasContestUserScrolled
                  ? isContestScrolled
                    ? 'animate-profile-absorb'
                    : 'animate-profile-release'
                  : ''
              } ${
                route === 'account'
                  ? 'bg-[#141416] text-[#FFEA00]'
                  : isAuthenticated
                  ? 'bg-white text-[#141416]'
                  : 'bg-[#141416] text-white'
              }`}
            >
              <User className="w-4 h-4" />
              {!isAuthenticated ? (
                <span>Login</span>
              ) : (
                <span className="max-w-[85px] truncate text-[11px] font-bold">
                  {db.user?.nickname || 'Account'}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* SCROLL-LOCKED INTERNAL VIEWPORT */}
        <main
          ref={mainScrollRef}
          onScroll={handleMainScroll}
          className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar pb-4 scroll-smooth"
        >
          {/* KEEP-ALIVE HOMEPAGE (Preserves loaded photos, state, and scroll position) */}
          <div
            className={
              route === 'home'
                ? `w-full ${slideDir === 'right' ? 'animate-slide-fade-right' : 'animate-slide-fade-left'}`
                : 'hidden'
            }
          >
            <HomePage
              onOpenAccount={() => navigateTo('account', 'right')}
              onOpenEvents={(eventId) => {
                setEventBackRoute('events');
                setSelectedEventId(eventId || null);
                navigateTo('events', 'right');
              }}
              onOpenContest={(contestId) => {
                setSelectedContestId(contestId || null);
                navigateTo('contest', 'right');
              }}
              onOpenRedeemShop={() => {
                setRedeemBackRoute('home');
                navigateTo('redeem', 'right');
              }}
            />
          </div>

          {route === 'snap' && (
            <div
              key={`snap_${navKey}`}
              className={`w-full ${slideDir === 'right' ? 'animate-slide-fade-right' : 'animate-slide-fade-left'}`}
            >
              <SnapCashbackPage onSuccessDone={() => navigateTo('account', 'right')} />
            </div>
          )}
          {/* KEEP-ALIVE EVENTS PAGE (Preserves first 4 images loaded, event card state, and instant tab switch) */}
          <div
            className={
              route === 'events'
                ? `w-full ${slideDir === 'right' ? 'animate-slide-fade-right' : 'animate-slide-fade-left'}`
                : 'hidden'
            }
          >
            <EventsPage
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => {
                setSelectedEventId(id);
                setIsContestScrolled(false);
                setHasContestUserScrolled(false);
                if (id && mainScrollRef.current) {
                  mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                }
                if (!id) {
                  setIsVenueScan(false);
                  setVenueToken(null);
                  if (eventBackRoute === 'contest') {
                    setEventBackRoute('events');
                    navigateTo('contest', 'left');
                  }
                }
              }}
              onBackToSource={() => {
                setSelectedEventId(null);
                setIsContestScrolled(false);
                setHasContestUserScrolled(false);
                setIsVenueScan(false);
                setVenueToken(null);
                if (eventBackRoute === 'contest') {
                  setEventBackRoute('events');
                  navigateTo('contest', 'left');
                } else {
                  navigateTo('events', 'left');
                }
              }}
              backLabel={eventBackRoute === 'contest' ? 'Contest' : undefined}
              isVenueScan={isVenueScan}
              venueToken={venueToken}
              onClearVenueScan={() => {
                setIsVenueScan(false);
                setVenueToken(null);
              }}
              onOpenContest={(contestId, autoScroll) => {
                setSelectedContestId(contestId);
                setContestAutoScroll(Boolean(autoScroll));
                setContestBackRoute('events');
                navigateTo('contest', 'right');
              }}
              scrollContainerRef={mainScrollRef}
            />
          </div>
          {route === 'contest' && (
            <div
              key={`contest_${navKey}`}
              className={`w-full ${slideDir === 'right' ? 'animate-slide-fade-right' : 'animate-slide-fade-left'}`}
            >
              <ContestPage
                initialContestId={selectedContestId}
                autoScrollToContent={contestAutoScroll}
                onBack={handleContestBack}
                onNavigateToEvent={(eventId) => {
                  if (eventId) setSelectedEventId(eventId);
                  setEventBackRoute('contest');
                  navigateTo('events', 'left');
                }}
              />
            </div>
          )}
          {route === 'redeem' && (
            <div
              key={`redeem_${navKey}`}
              className={`w-full ${slideDir === 'right' ? 'animate-slide-fade-right' : 'animate-slide-fade-left'}`}
            >
              <RedeemShopPage onBack={() => navigateTo(redeemBackRoute, 'left')} />
            </div>
          )}
          {route === 'invite' && (
            <div
              key={`invite_${navKey}`}
              className={`w-full ${slideDir === 'right' ? 'animate-slide-fade-right' : 'animate-slide-fade-left'}`}
            >
              <InviteFriendsPage onBack={() => navigateTo('account', 'left')} />
            </div>
          )}
          {route === 'transactions' && isAuthenticated && (
            <div
              key={`transactions_${navKey}`}
              className={`w-full ${slideDir === 'right' ? 'animate-slide-fade-right' : 'animate-slide-fade-left'}`}
            >
              <TransactionHistoryPage
                initialTab={txHistoryTab}
                onBack={() => navigateTo('account', 'left')}
                scrollContainerRef={mainScrollRef}
              />
            </div>
          )}
          {route === 'account' && (
            <div
              key={`account_${navKey}`}
              className={`w-full ${slideDir === 'right' ? 'animate-slide-fade-right' : 'animate-slide-fade-left'}`}
            >
              <AccountPage
                onBack={() => navigateTo('home', 'left')}
                onOpenRedeemShop={() => {
                  setRedeemBackRoute('account');
                  navigateTo('redeem', 'right');
                }}
                onOpenInvite={() => {
                  if (!isAuthenticated) {
                    openLoginModal();
                    return;
                  }
                  navigateTo('invite', 'right');
                }}
                onOpenTransactions={(tab = 'cashback') => {
                  if (!isAuthenticated) {
                    openLoginModal();
                    return;
                  }
                  setTxHistoryTab(tab);
                  navigateTo('transactions', 'right');
                }}
              />
            </div>
          )}
        </main>

        {/* FIXED 3-ITEM MODERN BOTTOM BAR (Hidden on Contest, Event Detail, Account & Transactions pages) */}
        {!isFluidHeaderRoute && (
          <nav className="w-full h-18 px-6 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 grid grid-cols-3 items-center shrink-0 relative z-20 animate-in fade-in duration-150">
            <button
              type="button"
              onClick={handleHomeShopClick}
              className="h-full flex flex-col items-center justify-center gap-1 transition cursor-pointer text-[#141416] font-semibold"
            >
              {route === 'home' ? (
                isShopInView ? (
                  <>
                    <Home className="w-5 h-5 transition-transform duration-200" />
                    <span className="text-[11px]">Home</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5 transition-transform duration-200" />
                    <span className="text-[11px]">Shop</span>
                  </>
                )
              ) : (
                <>
                  <Home className="w-5 h-5" />
                  <span className="text-[11px]">Home</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center relative">
              <button
                type="button"
                onClick={() => requireAuth(() => navigateTo('snap'))}
                aria-label="Snap Receipt for Cashback"
                className="relative flex items-center justify-center -translate-y-5 active:scale-95 transition cursor-pointer shrink-0 group select-none"
              >
                {/* Circular Dark Charcoal Button with White Receipt Icon (Matches other menu items) */}
                <div className="w-14 h-14 rounded-full bg-[#141416] text-white flex items-center justify-center shadow-lg shadow-black/15 group-active:scale-95 transition">
                  <ReceiptText className="w-6 h-6 stroke-[2]" />
                </div>

                {/* Orbiting Badge Container: Rotates around center of the 56px button */}
                <div
                  className="absolute inset-0 pointer-events-none z-30"
                  style={{
                    transform: `rotate(${badgeRotation}deg)`,
                    transformOrigin: '28px 28px',
                    transition: isScrolling
                      ? 'none'
                      : 'transform 0.65s cubic-bezier(0.34, 1.4, 0.64, 1)',
                    willChange: 'transform',
                  }}
                >
                  {/* Curved Orbiting Text */}
                  <svg
                    className="absolute -top-[14px] left-1/2 -translate-x-1/2 overflow-visible"
                    width="80"
                    height="44"
                    viewBox="0 0 80 44"
                  >
                    <defs>
                      <path
                        id="snap-earn-curve"
                        d="M 5 42 A 35 35 0 0 1 75 42"
                        fill="none"
                      />
                    </defs>
                    {/* Curved "Scan Receipt & Earn Reward" Text */}
                    <text
                      fill="#141416"
                      fontSize="6.8"
                      fontWeight="700"
                      letterSpacing="0.02em"
                      dominantBaseline="central"
                    >
                      <textPath
                        href="#snap-earn-curve"
                        startOffset="50%"
                        textAnchor="middle"
                      >
                        Scan Receipt &amp; Earn Reward
                      </textPath>
                    </text>
                  </svg>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setEventBackRoute('events');
                setSelectedEventId(null);
                navigateTo('events');
              }}
              className="h-full flex flex-col items-center justify-center gap-1 transition cursor-pointer text-[#141416] font-semibold"
            >
              <Calendar className="w-5 h-5" />
              <span className="text-[11px]">Events</span>
            </button>
          </nav>
        )}

        {/* WHATSAPP LOGIN MODAL OVERLAY */}
        {showLoginModal && (
          <div className="absolute inset-0 z-50 bg-hsg-app-canvas flex flex-col animate-in fade-in duration-200">
            <LoginPage
              onClose={closeLoginModal}
              onSuccess={closeLoginModal}
            />
          </div>
        )}

        {/* GLOBAL CUSTOM TOAST — ALWAYS IN FRONT OF ALL MODALS, POPUPS & BACKDROPS */}
        {toastMessage && (
          <div className="fixed top-[72px] left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[398px] z-[999999] pointer-events-none flex justify-center">
            <div
              role="status"
              aria-live="polite"
              className="w-full bg-white/95 backdrop-blur-md text-zinc-900 px-4 py-3 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 font-semibold text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
            >
              <span className="flex-1 leading-snug">{toastMessage}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function App() {
  return (
    <HsgDataProvider>
      <HsgMobileShell />
    </HsgDataProvider>
  );
}

export default App;
