/** Lower-case, strip accents and map Turkish dotless ı, so "TİŞÖRT" and "tisort" compare equal. */
export function foldText(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/ı/g, 'i');
}
