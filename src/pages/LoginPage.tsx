import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useHsgData } from '../context/HsgDataContext';
import { HsgLogo } from '../components/HsgLogo';

const WORKER_URL = 'https://ib-v2.hsgglobalpteltd.workers.dev';

// Crisp Official WhatsApp SVG Emblem
const WhatsAppIcon: React.FC<{ className?: string }> = ({
  className = 'w-6 h-6',
}) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
  </svg>
);

interface CountryCode {
  code: string;
  dial: string;
  name: string;
  minDigits: number;
  maxDigits: number;
  placeholder: string;
}

const COUNTRIES: CountryCode[] = [
  // Top Quick Picks
  { code: 'SG', dial: '+65', name: 'Singapore', minDigits: 8, maxDigits: 8, placeholder: 'e.g. 91234567' },
  { code: 'MY', dial: '+60', name: 'Malaysia', minDigits: 9, maxDigits: 10, placeholder: 'e.g. 123456789' },
  // Community Partners
  { code: 'IN', dial: '+91', name: 'India', minDigits: 10, maxDigits: 10, placeholder: 'e.g. 9876543210' },
  { code: 'BD', dial: '+880', name: 'Bangladesh', minDigits: 10, maxDigits: 10, placeholder: 'e.g. 1712345678' },
  // Other ASEAN Countries
  { code: 'ID', dial: '+62', name: 'Indonesia', minDigits: 9, maxDigits: 12, placeholder: 'e.g. 8123456789' },
  { code: 'PH', dial: '+63', name: 'Philippines', minDigits: 10, maxDigits: 10, placeholder: 'e.g. 9123456789' },
  { code: 'MM', dial: '+95', name: 'Myanmar', minDigits: 9, maxDigits: 10, placeholder: 'e.g. 912345678' },
  { code: 'TH', dial: '+66', name: 'Thailand', minDigits: 9, maxDigits: 9, placeholder: 'e.g. 812345678' },
  { code: 'VN', dial: '+84', name: 'Vietnam', minDigits: 9, maxDigits: 10, placeholder: 'e.g. 912345678' },
  { code: 'BN', dial: '+673', name: 'Brunei', minDigits: 7, maxDigits: 7, placeholder: 'e.g. 7123456' },
  { code: 'KH', dial: '+855', name: 'Cambodia', minDigits: 8, maxDigits: 9, placeholder: 'e.g. 12345678' },
  { code: 'LA', dial: '+856', name: 'Laos', minDigits: 8, maxDigits: 10, placeholder: 'e.g. 2012345678' },
];

interface WhatsAppSession {
  session_id: string;
  auth_code: string;
  target_whatsapp_phone: string;
  target_whatsapp_display?: string;
  prefilled_message: string;
}

interface LoginPageProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onClose, onSuccess }) => {
  const { loginWithWhatsApp } = useHsgData();

  // Country & Phone State
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRIES[0]);
  const [phoneDigits, setPhoneDigits] = useState<string>('');
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState<boolean>(false);

  // Registration Status
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isCheckingUser, setIsCheckingUser] = useState<boolean>(false);

  // WhatsApp Session & Verification
  const [initLoading, setInitLoading] = useState<boolean>(false);
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Terms of Service & Privacy Policy Modal State
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [policyText, setPolicyText] = useState<string>('');
  const [policyUpdatedAt, setPolicyUpdatedAt] = useState<number | null>(null);
  const [agreedToPolicy, setAgreedToPolicy] = useState<boolean>(false);

  const pollTimerRef = useRef<number | null>(null);
  const checkDebounceRef = useRef<number | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      if (checkDebounceRef.current) window.clearTimeout(checkDebounceRef.current);
    };
  }, []);

  // Fetch dynamic Terms & Policy setting on mount
  useEffect(() => {
    fetch(`${WORKER_URL}/api/hsg-app/settings/policy`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setPolicyText(data.policy_text || '');
          setPolicyUpdatedAt(data.policy_updated_at || null);
        }
      })
      .catch(() => {});
  }, []);

  // Clean full international phone string (e.g. "6591234567" or "62812345678", stripping leading 0)
  const cleanLocalDigits = phoneDigits.replace(/\D/g, '').replace(/^0+/, '');
  const fullPhone = `${selectedCountry.dial.replace(/\D/g, '')}${cleanLocalDigits}`;

  // Silent Database Check on Typing Last Digit
  useEffect(() => {
    const rawCleanDigits = phoneDigits.replace(/\D/g, '').replace(/^0+/, '');

    // Reset if digits incomplete
    if (rawCleanDigits.length < selectedCountry.minDigits - 1 && rawCleanDigits.length < 8) {
      setIsRegistered(false);
      setIsCheckingUser(false);
      return;
    }

    if (checkDebounceRef.current) {
      window.clearTimeout(checkDebounceRef.current);
    }

    setIsCheckingUser(true);

    checkDebounceRef.current = window.setTimeout(async () => {
      try {
        const targetCleanPhone = `${selectedCountry.dial.replace(/\D/g, '')}${rawCleanDigits}`;
        let phoneHash = '';
        try {
          const msgUint8 = new TextEncoder().encode(targetCleanPhone);
          const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          phoneHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch {}

        const queryParams = new URLSearchParams({ phone: targetCleanPhone });
        if (phoneHash) queryParams.set('phone_hash', phoneHash);

        const res = await fetch(
          `${WORKER_URL}/api/hsg-app/auth/check-user?${queryParams.toString()}`
        );
        if (res.ok) {
          const data = await res.json();
          setIsRegistered(Boolean(data.exists));
        } else {
          setIsRegistered(false);
        }
      } catch {
        setIsRegistered(false);
      } finally {
        setIsCheckingUser(false);
      }
    }, 280);
  }, [phoneDigits, selectedCountry]);

  // Poll WhatsApp Session Verification
  useEffect(() => {
    if (!session?.session_id || isVerified) return;

    const pollInterval = window.setInterval(async () => {
      try {
        const res = await fetch(
          `${WORKER_URL}/api/hsg-app/auth/whatsapp/poll?session_id=${encodeURIComponent(
            session.session_id
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'verified') {
            if (pollTimerRef.current) {
              window.clearInterval(pollTimerRef.current);
            }
            setIsVerified(true);
            const rawCand = (data.customer_phone || fullPhone || '').replace(/\D/g, '');
            const verifiedPhone = rawCand.length >= 8 ? rawCand : fullPhone.replace(/\D/g, '');
            if (verifiedPhone && verifiedPhone.length >= 8) {
              try { localStorage.setItem('hsg_auth_phone', verifiedPhone); } catch {}
            }
            const verifiedName = data.customer_name || `HSG Member ${verifiedPhone.slice(-4)}`;
            window.setTimeout(() => {
              loginWithWhatsApp(verifiedPhone, verifiedName, data.user);
              if (onSuccess) onSuccess();
            }, 700);
          }
        }
      } catch {
        // Silent catch for intermittent network blip
      }
    }, 2000);

    pollTimerRef.current = pollInterval;

    return () => {
      window.clearInterval(pollInterval);
    };
  }, [session, isVerified, fullPhone, loginWithWhatsApp, onSuccess]);

  const handleStartWhatsAppSession = async (withTerms: boolean) => {
    const rawCleanDigits = phoneDigits.replace(/\D/g, '');
    if (rawCleanDigits.length < selectedCountry.minDigits) {
      setErrorMessage(
        `Please enter a valid ${selectedCountry.name} phone number (${selectedCountry.minDigits} digits).`
      );
      return;
    }

    setInitLoading(true);
    setErrorMessage(null);
    try {
      const currentOrigin =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://plus.hsgglobal.sg';

      const res = await fetch(`${WORKER_URL}/api/hsg-app/auth/whatsapp/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          terms_accepted: withTerms,
          app_url: currentOrigin,
        }),
      });

      if (!res.ok) {
        throw new Error('Could not connect to WhatsApp authentication service');
      }
      const data = await res.json();
      if (!data.success || !data.session_id) {
        throw new Error(data.error || 'Failed to initialize WhatsApp login');
      }

      const newSession: WhatsAppSession = {
        session_id: data.session_id,
        auth_code: data.auth_code,
        target_whatsapp_phone: data.target_whatsapp_phone || '6584755948',
        target_whatsapp_display: data.target_whatsapp_display || '+65 8475 5948',
        prefilled_message:
          data.prefilled_message ||
          `Login verification code for HSG+ Community: ${data.auth_code}`,
      };

      setSession(newSession);
      setShowPolicyModal(false);

      // Construct direct WhatsApp link to official bot
      const targetPhone = newSession.target_whatsapp_phone.replace(/\D/g, '');
      const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(
        newSession.prefilled_message
      )}`;

      try {
        // Direct location navigation avoids popup-blocking on mobile / async handlers
        const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = waUrl;
        } else {
          const win = window.open(waUrl, '_blank');
          if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = waUrl;
          }
        }
      } catch (openErr) {
        console.warn('Popup blocked by browser, falling back to location.href:', openErr);
        window.location.href = waUrl;
      }
    } catch (err: any) {
      console.error('WhatsApp Login Init Error:', err);
      setErrorMessage(
        err?.message || 'Unable to connect to WhatsApp service. Please try again.'
      );
    } finally {
      setInitLoading(false);
    }
  };

  const handleMainButtonClick = () => {
    const rawCleanDigits = phoneDigits.replace(/\D/g, '');
    if (rawCleanDigits.length < selectedCountry.minDigits) {
      setErrorMessage(
        `Please enter your complete phone number (${selectedCountry.minDigits} digits).`
      );
      return;
    }

    setErrorMessage(null);

    // If already registered, proceed directly to WhatsApp
    if (isRegistered) {
      handleStartWhatsAppSession(false);
    } else {
      // New member: Open Terms of Service & Privacy Policy sheet first
      setShowPolicyModal(true);
    }
  };

  const handleReopenWhatsApp = () => {
    if (!session) return;
    const targetPhone = session.target_whatsapp_phone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(
      session.prefilled_message
    )}`;
    window.location.href = waUrl;
  };

  const handleCancelSession = () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
    }
    setSession(null);
    setIsVerified(false);
    setErrorMessage(null);
  };

  const formatEpochDate = (ts: number) => {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const isCompleteNumber =
    phoneDigits.replace(/\D/g, '').length >= selectedCountry.minDigits;
  const showRegisterButton = isCompleteNumber && !isRegistered && !isCheckingUser;

  return (
    <div className="w-full h-full min-h-[580px] flex flex-col justify-between px-7 sm:px-8 pt-8 pb-8 select-none relative overflow-y-auto no-scrollbar">
      {/* TOP-RIGHT CLOSE BUTTON */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close login dialog"
          className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-zinc-600 hover:text-zinc-900 flex items-center justify-center shadow-xs transition absolute top-5 right-5 cursor-pointer z-20"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* INNER SHELL */}
      <div className="w-full max-w-[340px] mx-auto flex flex-col flex-1 justify-between">
        {/* BRANDING HEADER */}
        <div className="w-full pt-2">
          <div className="inline-block">
            <HsgLogo size="lg" darkText />
          </div>
          <h1 className="font-extrabold text-2xl text-[#141416] leading-tight mt-5">
            Welcome to HSG+ Community
          </h1>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
            Earn product cashback, RSVP for brand events, join HSG contests and
            more...
          </p>
        </div>

        {/* CENTER ACTION AREA */}
        <div className="w-full my-auto py-6">
          {errorMessage && (
            <div className="w-full p-3.5 mb-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <p className="font-bold">Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          )}

          {!session ? (
            /* FRONT LOGIN / REGISTRATION INTERFACE */
            <div className="w-full flex flex-col gap-4">
              {/* PHONE INPUT WITH COUNTRY SELECTOR & ROUNDED STATUS INDICATOR */}
              <div className="w-full">
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="w-full h-12 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs flex items-center pl-2 pr-2 relative focus-within:border-zinc-400 transition">
                  {/* Country Selector Dropdown Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCountryMenuOpen((prev) => !prev)}
                      className="h-9 px-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 flex items-center gap-1 text-xs font-bold text-[#141416] transition cursor-pointer shrink-0"
                    >
                      <span>{selectedCountry.dial}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    </button>

                    {/* Country Selector Dropdown Menu */}
                    {isCountryMenuOpen && (
                      <>
                        <div
                          onClick={() => setIsCountryMenuOpen(false)}
                          className="fixed inset-0 z-40 bg-black/10"
                        />
                        <div className="absolute top-11 left-0 z-50 w-52 max-h-60 overflow-y-auto no-scrollbar rounded-2xl bg-white shadow-xl border border-zinc-200/90 py-1 animate-in fade-in zoom-in-95 duration-150">
                          {COUNTRIES.map((c) => {
                            const isSelected = c.code === selectedCountry.code;
                            return (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  setSelectedCountry(c);
                                  setIsCountryMenuOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-zinc-50 transition cursor-pointer ${
                                  isSelected ? 'bg-zinc-100/70 font-bold text-[#141416]' : 'text-zinc-600'
                                }`}
                              >
                                <span>{c.name}</span>
                                <span className="font-mono text-zinc-500 text-[11px] font-semibold">
                                  {c.dial}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Digits Input Field */}
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneDigits}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, selectedCountry.maxDigits);
                      setPhoneDigits(clean);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder={selectedCountry.placeholder}
                    className="flex-1 min-w-0 h-full pl-2.5 pr-11 text-sm font-bold text-[#141416] placeholder:text-zinc-300 placeholder:font-normal focus:outline-none bg-transparent"
                  />

                  {/* ROUNDED STATUS MARK INDICATOR (ABSOLUTE INSIDE RIGHT) */}
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                    {isCheckingUser ? (
                      <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                    ) : isRegistered ? (
                      <div
                        title="Registered Member (Verified in Database)"
                        className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs transition-transform duration-200 scale-100"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div
                        title="Unregistered Number"
                        className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-400 flex items-center justify-center transition-all duration-200"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ALWAYS VIBRANT WHATSAPP ACTION BUTTON (DYNAMIC REGISTER / LOGIN) */}
              <button
                type="button"
                onClick={handleMainButtonClick}
                disabled={initLoading}
                className="w-full h-13 mt-1 rounded-2xl bg-[#25D366] hover:bg-[#20BD5A] active:scale-[0.98] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                {initLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Connecting to WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <WhatsAppIcon className="w-5 h-5 fill-white" />
                    <span>
                      {showRegisterButton
                        ? 'Register with WhatsApp'
                        : 'Login with WhatsApp'}
                    </span>
                  </>
                )}
              </button>

              {/* NON-SINGAPORE OPERATION NOTICE */}
              {selectedCountry.code !== 'SG' && (
                <div className="w-full py-2 px-3 rounded-xl bg-amber-50/90 border border-amber-200/70 text-amber-900 text-center text-[11px] font-medium leading-snug animate-in fade-in duration-150">
                  <span>HSG+ operates in Singapore only.</span>
                </div>
              )}

              {/* TEXT BUTTON BELOW LOGIN WHATSAPP BUTTON */}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-800 transition cursor-pointer text-center group flex flex-col items-center gap-0.5 mt-4"
                >
                  <span>I will login later..</span>
                  <span className="text-[#EC008C] font-medium group-hover:text-[#141416]">
                    Click here to back to frontpage
                  </span>
                </button>
              )}
            </div>
          ) : isVerified ? (
            /* VERIFIED STATE */
            <div className="w-full p-6 rounded-3xl bg-white shadow-sm border border-emerald-100 flex flex-col items-center text-center animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-[#141416] mt-4">
                Verified Successfully!
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Logging you into HSG+ Community...
              </p>
            </div>
          ) : (
            /* WAITING FOR WHATSAPP BOT WEBHOOK VERIFICATION */
            <div className="w-full p-6 rounded-3xl bg-white shadow-sm border border-slate-100 flex flex-col items-center text-center animate-in fade-in duration-200">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-md">
                  <WhatsAppIcon className="w-7 h-7 fill-white" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
              </div>

              <h3 className="text-base font-extrabold text-[#141416] mt-4">
                Send Code via WhatsApp
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-[260px] leading-relaxed">
                Tap the button below to send your code to our official bot from{' '}
                <span className="font-bold text-[#141416]">+{fullPhone}</span> to verify.
              </p>

              <div className="mt-3 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-800 text-xs font-mono font-bold tracking-wider">
                {session.auth_code}
              </div>

              <div className="w-full mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleReopenWhatsApp}
                  className="w-full h-11 rounded-2xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-extrabold text-xs flex items-center justify-center gap-2 active:scale-98 transition shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <WhatsAppIcon className="w-5 h-5 fill-current" />
                  <span>Open WhatsApp &amp; Send Code</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelSession}
                  className="w-full h-9 rounded-xl text-zinc-500 hover:text-zinc-800 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel / Change Number</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TERMS OF SERVICE & PRIVACY POLICY SHEET MODAL (FOR NEW UNREGISTERED USERS) */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md sm:max-w-lg h-[80vh] max-h-[80vh] rounded-3xl bg-white shadow-2xl border border-zinc-200 p-4 sm:p-5 flex flex-col justify-between">
            {/* Modal Header: Clean Text Only — NO Date in Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2 text-[#141416]">
                <FileText className="w-5 h-5 text-[#EC008C]" />
                <h3 className="text-sm font-extrabold">Terms of Service &amp; Privacy Policy</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPolicyModal(false);
                  setAgreedToPolicy(false);
                }}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Wider scrollable terms text container filling remaining 80vh space */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar my-3 p-3.5 sm:p-4 rounded-2xl bg-zinc-50/80 border border-zinc-100 text-xs text-zinc-700 leading-relaxed font-sans whitespace-pre-wrap">
              {policyText.trim() ? (
                <div>
                  {policyText}
                  {/* Last Updated Date: strictly at the very end of the terms text */}
                  {policyUpdatedAt && (
                    <div className="mt-4 pt-3 border-t border-zinc-200/80 text-[11px] text-zinc-400 font-medium">
                      Last updated: {formatEpochDate(policyUpdatedAt)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full min-h-[140px] flex items-center justify-center text-zinc-400 text-xs italic">
                  No terms and conditions published yet.
                </div>
              )}
            </div>

            {/* Footer: Mandatory Checkbox Agreement & Action Button */}
            <div className="shrink-0 pt-2 border-t border-zinc-100">
              <label className="flex items-start gap-2.5 text-xs text-zinc-700 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={agreedToPolicy}
                  onChange={(e) => setAgreedToPolicy(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded-md accent-[#25D366] cursor-pointer shrink-0"
                />
                <span className="leading-snug">
                  I have read and agree to the <b>Terms of Service &amp; Privacy Policy</b>.
                </span>
              </label>

              <button
                type="button"
                disabled={!agreedToPolicy || initLoading}
                onClick={() => handleStartWhatsAppSession(true)}
                className={`w-full h-11 mt-2.5 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
                  agreedToPolicy && !initLoading
                    ? 'bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-emerald-500/20 active:scale-[0.98]'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
                }`}
              >
                {initLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <WhatsAppIcon className="w-4.5 h-4.5 fill-current" />
                    <span>Agree &amp; Continue with WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
