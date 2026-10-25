import React from 'react';

export const HsgLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; darkText?: boolean }> = ({
  size = 'md',
  darkText = false,
}) => {
  const sizeClasses =
    size === 'lg'
      ? 'text-4xl tracking-tighter'
      : size === 'sm'
      ? 'text-base tracking-tight'
      : 'text-2xl tracking-tighter';

  return (
    <span
      className={`font-display font-black italic uppercase inline-flex items-baseline select-none ${sizeClasses}`}
    >
      <span className={darkText ? 'text-[#141416]' : 'text-white'}>HSG</span>
      <span className="text-[#EC008C] not-italic font-black ml-0.5">+</span>
    </span>
  );
};
