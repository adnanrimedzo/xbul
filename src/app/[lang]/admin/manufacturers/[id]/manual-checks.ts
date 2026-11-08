type ManualCheck = { label: string; url: string };

// The registries an admin checks by hand (spec §5): none of them has an API we can use.
const CERTIFICATES: ManualCheck[] = [
  { label: 'GOTS', url: 'https://www.global-standard.org/find-suppliers-shops-and-inputs' },
  { label: 'Textile Exchange (GRS, RCS, OCS)', url: 'https://textileexchange.org/find-certified-company/' },
  { label: 'OEKO-TEX Label Check', url: 'https://www.oeko-tex.com/en/label-check' },
];

export const MANUAL_CHECKS: Record<'TR' | 'default', ManualCheck[]> = {
  TR: [
    { label: 'e-Devlet belge doğrulama', url: 'https://www.turkiye.gov.tr/belge-dogrulama' },
    { label: 'GİB', url: 'https://dijital.gib.gov.tr/' },
    { label: 'TTSG', url: 'https://www.ticaretsicil.gov.tr/' },
    ...CERTIFICATES,
  ],
  default: CERTIFICATES,
};

export function manualChecksFor(country: string, openSupplyHubId: string | null): ManualCheck[] {
  const checks = MANUAL_CHECKS[country === 'TR' ? 'TR' : 'default'];
  return openSupplyHubId ? [...checks, { label: 'Open Supply Hub', url: `https://opensupplyhub.org/facilities/${encodeURIComponent(openSupplyHubId)}` }] : checks;
}
