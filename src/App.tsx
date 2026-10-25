import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  Check,
  Flame,
  Home,
  ReceiptText,
  ShoppingBag,
  Smartphone,
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

  const [route, setRoute] = useState<ActiveRoute>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (
        hash === 'account' ||
        hash === 'events' ||
        hash === 'contest' ||
        hash === 'redeem' ||
        hash === 'invite' ||
        hash === 'transactions' ||
        hash === 'snap'
      ) {
        return hash as ActiveRoute;
      }
      const saved = sessionStorage.getItem('hsg_active_route');
      if (
        saved &&
        [
          'home',
          'account',
          'events',
          'contest',
          'redeem',
          'invite',
          'transactions',
          'snap',
        ].includes(saved)
      ) {
        return saved as ActiveRoute;
      }
    }
    return 'home';
  });

  const navigateTo = (newRoute: ActiveRoute) => {
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
      const rawHash = window.location.hash.replace('#', '');
      const hash = rawHash.split('?')[0].toLowerCase();
      if (rawHash.includes('?')) {
        const queryStr = rawHash.split('?')[1] || '';
        const params = new URLSearchParams(queryStr);
        const eventId = params.get('id');
        if (eventId) setSelectedEventId(eventId);
        if (params.get('venue_scan') === '1') setIsVenueScan(true);
      }
      if (hash === 'transactions' && !isAuthenticated) {
        setRoute('home');
        openLoginModal();
        return;
      }
      if (
        hash === 'account' ||
        hash === 'events' ||
        hash === 'contest' ||
        hash === 'redeem' ||
        hash === 'invite' ||
        hash === 'transactions' ||
        hash === 'snap'
      ) {
        setRoute(hash as ActiveRoute);
      } else if (!hash) {
        setRoute('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated]);

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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = window.location.hash || window.location.search;
    const match = raw.match(/[?&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  });
  const [isVenueScan, setIsVenueScan] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const raw = window.location.hash || window.location.search;
    return raw.includes('venue_scan=1');
  });
  const [selectedContestId, setSelectedContestId] = useState<string | null>(
    null
  );
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(
    () => window.innerWidth > 768
  );
  const [bypassDesktopBlocker, setBypassDesktopBlocker] =
    useState<boolean>(false);

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
    const c1 = (db.settings.theme_color_1 || '#FFEA00').trim() || '#FFEA00';
    const c2 = (db.settings.theme_color_2 || '#EC008C').trim() || '#EC008C';
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
    if (route !== 'events' && mainScrollRef.current) {
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
      ? window.location.origin
      : 'https://hsgplus.community';

  // DESKTOP QR BLOCKER FOR MOBILE APP
  if (isDesktopViewport && !bypassDesktopBlocker) {
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

        <div className="mt-6 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setBypassDesktopBlocker(true)}
            className="h-11 px-6 rounded-full bg-[#141416] text-white font-semibold text-xs flex items-center gap-2 shadow-sm hover:opacity-90"
          >
            <Smartphone className="w-4 h-4 text-[#FFEA00]" />
            Preview Mobile App on Desktop
          </button>
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
        <header className="w-full h-15 px-5 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center text-left">
            <HsgLogo size="md" darkText />
          </div>

          {/* Top-Right: Weekly App Open Streak Button + Profile / Login Button */}
          <div className="flex items-center gap-2">
            {/* Clickable Weekly Streak Button */}
            <button
              type="button"
              onClick={() => requireAuth(handleOpenStreakPopup)}
              title={`Weekly App Streak: ${weeklyStreak} Weeks`}
              className="h-9 px-3 rounded-full bg-white/85 text-[#141416] text-xs font-extrabold flex items-center gap-1 shadow-2xs active:scale-95 transition select-none cursor-pointer"
            >
              <Flame className="w-4 h-4 text-[#EC008C] fill-[#EC008C]" />
              <span>{weeklyStreak}</span>
            </button>

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
              className={`h-9 px-3.5 rounded-full flex items-center gap-1.5 transition shadow-2xs font-bold text-xs cursor-pointer ${
                route === 'account'
                  ? 'bg-[#141416] text-[#FFEA00]'
                  : isAuthenticated
                  ? 'bg-white/85 text-[#141416]'
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
          className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar pb-4"
        >
          {route === 'home' ? (
            <HomePage
              onOpenAccount={() => navigateTo('account')}
              onOpenEvents={(eventId) => {
                setSelectedEventId(eventId || null);
                navigateTo('events');
              }}
              onOpenContest={(contestId) => {
                setSelectedContestId(contestId || null);
                navigateTo('contest');
              }}
              onOpenRedeemShop={() => {
                setRedeemBackRoute('home');
                navigateTo('redeem');
              }}
            />
          ) : route === 'snap' ? (
            <SnapCashbackPage onSuccessDone={() => navigateTo('account')} />
          ) : route === 'events' ? (
            <EventsPage
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => {
                setSelectedEventId(id);
                if (!id) setIsVenueScan(false);
              }}
              isVenueScan={isVenueScan}
              onClearVenueScan={() => setIsVenueScan(false)}
              scrollContainerRef={mainScrollRef}
            />
          ) : route === 'contest' ? (
            <ContestPage
              initialContestId={selectedContestId}
              onBack={() => navigateTo('home')}
            />
          ) : route === 'redeem' ? (
            <RedeemShopPage onBack={() => navigateTo(redeemBackRoute)} />
          ) : route === 'invite' ? (
            <InviteFriendsPage onBack={() => navigateTo('account')} />
          ) : route === 'transactions' ? (
            isAuthenticated ? (
              <TransactionHistoryPage
                initialTab={txHistoryTab}
                onBack={() => navigateTo('account')}
              />
            ) : null
          ) : (
            <AccountPage
              onBack={() => navigateTo('home')}
              onOpenRedeemShop={() => {
                setRedeemBackRoute('account');
                navigateTo('redeem');
              }}
              onOpenInvite={() => {
                if (!isAuthenticated) {
                  openLoginModal();
                  return;
                }
                navigateTo('invite');
              }}
              onOpenTransactions={(tab = 'cashback') => {
                if (!isAuthenticated) {
                  openLoginModal();
                  return;
                }
                setTxHistoryTab(tab);
                navigateTo('transactions');
              }}
            />
          )}
        </main>

        {/* FIXED 3-ITEM MODERN BOTTOM BAR */}
        <nav className="w-full h-18 px-6 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 grid grid-cols-3 items-center shrink-0 relative z-20">
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
                  {/* Curved "Scan Receipt & Earn Cashback" Text */}
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
                      Scan Receipt &amp; Earn Cashback
                    </textPath>
                  </text>
                </svg>
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedEventId(null);
              navigateTo('events');
            }}
            className="h-full flex flex-col items-center justify-center gap-1 transition cursor-pointer text-[#141416] font-semibold"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[11px]">Events</span>
          </button>
        </nav>

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
          <div className="fixed top-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[398px] z-[999999] pointer-events-auto transition-all">
            <div
              role="status"
              aria-live="polite"
              className="w-full bg-[#141416]/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/20 font-semibold text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-200"
            >
              <span className="flex-1 leading-snug">{toastMessage}</span>
              <span className="w-2 h-2 rounded-full bg-[#FFEA00] shrink-0 animate-pulse" />
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
