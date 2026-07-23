/**
 * avatarColor.js — shared avatar utilities
 * Centralizes the color palette and initials logic used across the app.
 */

const AVATAR_COLORS = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
  '#009688', '#4caf50', '#8bc34a', '#ffc107',
  '#ff9800', '#ff5722',
];

/**
 * Returns a consistent color for a given username.
 * Deterministic — same name always maps to same color.
 */
export const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

/**
 * Returns up to 2 uppercase initials from a full name.
 * e.g. "John Doe" → "JD", "Alice" → "AL", "" → "?"
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';
};
