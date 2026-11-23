import type { Localized } from './parts';

const L = (en: string, tr: string): Localized => ({ en, tr });

// Main colours a buyer or supplier would name for a textile product. Shared by photo tags and the AI verdict.
export const COLORS = {
  black: L('Black', 'Siyah'),
  white: L('White', 'Beyaz'),
  grey: L('Grey', 'Gri'),
  beige: L('Beige', 'Bej'),
  brown: L('Brown', 'Kahverengi'),
  red: L('Red', 'Kırmızı'),
  pink: L('Pink', 'Pembe'),
  orange: L('Orange', 'Turuncu'),
  yellow: L('Yellow', 'Sarı'),
  green: L('Green', 'Yeşil'),
  blue: L('Blue', 'Mavi'),
  navy: L('Navy', 'Lacivert'),
  purple: L('Purple', 'Mor'),
  multi: L('Multicolour', 'Çok renkli'),
} as const;
export type ColorId = keyof typeof COLORS;
