import React, { useEffect, useRef } from 'react';
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
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [isOpen, durationMs]);

  if (!isOpen) return null;

  return (
    <div
      onClick={() => onCompleteRef.current()}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#FFEA00] px-6 text-center select-none animate-in fade-in duration-150 cursor-pointer"
    >
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
