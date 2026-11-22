import React from 'react';
import type { UserRole } from '../types';

const AVATAR_PALETTE = [
  '#2f5bea', // Cobalt Blue
  '#12805f', // Emerald Teal
  '#4338ca', // Deep Indigo
  '#0369a1', // Ocean Sky
  '#0f766e', // Pine Teal
  '#6d28d9', // Royal Violet
  '#b45309', // Warm Amber
  '#be123c', // Crimson Rose
] as const;

export function getInitialFromName(name?: string, email?: string): string {
  const cleaned = (name || '')
    .trim()
    .replace(/^(dr|prof|mr|mrs|ms|shri|smt)\.?\s+/i, '')
    .trim();

  const candidate = cleaned || (name || '').trim() || (email || '').trim();
  const match = candidate.match(/[A-Za-z0-9]/);
  return match ? match[0].toUpperCase() : 'U';
}

export function getAvatarColor(name?: string, email?: string, role?: UserRole): string {
  const seed = `${(name || '').trim().toLowerCase()}|${(email || '').trim().toLowerCase()}`;
  if (!seed || seed === '|') {
    if (role === 'faculty') return '#12805f';
    if (role === 'organizer') return '#4338ca';
    return '#2f5bea';
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

interface GoogleVAvatarProps {
  name?: string;
  email?: string;
  role?: UserRole;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showRing?: boolean;
  className?: string;
}

export const GoogleVAvatar: React.FC<GoogleVAvatarProps> = ({
  name,
  email,
  role,
  size = 'md',
  showRing = true,
  className = '',
}) => {
  const initial = getInitialFromName(name, email);
  const bgColor = getAvatarColor(name, email, role);

  const dim =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'md'
      ? 'w-10 h-10 text-sm'
      : size === 'lg'
      ? 'w-12 h-12 text-lg'
      : 'w-20 h-20 text-3xl';

  const ringClass = showRing
    ? 'ring-2 ring-[#dbe3f0] dark:ring-[#2d3e63] ring-offset-2 ring-offset-white dark:ring-offset-[#131d33]'
    : '';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none text-white font-bold tracking-tight shadow-2xs ${dim} ${ringClass} ${className}`}
      style={{ backgroundColor: bgColor }}
      aria-label={`Profile avatar ${initial}`}
      title={name || email || 'User'}
    >
      {initial}
    </div>
  );
};

export const UserAvatar = GoogleVAvatar;
