import React, { useEffect } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface SendingAnimationOverlayProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  durationMs?: number;
  onComplete: () => void;
}

export const SendingAnimationOverlay: React.FC<SendingAnimationOverlayProps> = ({
  isOpen,
  title = 'Sending...',
  subtitle = 'Please wait while we submit your entry',
  durationMs = 2500,
  onComplete,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onComplete();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [isOpen, durationMs, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#FFEA00] px-6 text-center select-none animate-in fade-in duration-150">
      <div className="flex flex-col items-center justify-center max-w-xs -mt-10">
        <div className="w-56 h-56 flex items-center justify-center">
          <DotLottieReact
            src="/paper-plane.lottie"
            loop
            autoplay
            className="w-full h-full object-contain pointer-events-none"
          />
        </div>
        <h2 className="text-2xl font-black text-[#141416] tracking-tight uppercase mt-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs font-bold text-[#141416]/75 mt-1 tracking-wide">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
