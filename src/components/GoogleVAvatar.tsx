import React from 'react';

interface GoogleVAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showRing?: boolean;
}

export const GoogleVAvatar: React.FC<GoogleVAvatarProps> = ({
  size = 'md',
  showRing = true,
}) => {
  const dim =
    size === 'sm'
      ? 'w-8 h-8 text-sm'
      : size === 'md'
      ? 'w-10 h-10 text-base'
      : size === 'lg'
      ? 'w-14 h-14 text-xl'
      : 'w-20 h-20 text-3xl';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none ${dim} ${
        showRing
          ? 'p-[2.5px] bg-[conic-gradient(#ea4335_0deg_90deg,#fbbc05_90deg_180deg,#34a853_180deg_270deg,#4285f4_270deg_360deg)]'
          : ''
      }`}
      aria-label="Profile avatar V"
    >
      <div className="w-full h-full rounded-full bg-[#1a73e8] text-white font-bold flex items-center justify-center border-2 border-white dark:border-[#131d33]">
        V
      </div>
    </div>
  );
};
