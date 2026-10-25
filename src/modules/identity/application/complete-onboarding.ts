import { DomainError } from '@/shared/domain/errors';
import { createProfile, type Profile, type Role } from '../domain/profile';
import type { ProfileRepository } from '../domain/repositories';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const MAX_HANDLE_ATTEMPTS = 5;

const randomSuffix = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => ALPHABET[b % ALPHABET.length]).join('');

export async function completeOnboarding(
  deps: {
    profiles: ProfileRepository;
    registerCompany: (input: { name: string; city: string; country: string; ownerUserId: string }) => Promise<{ slug: string }>;
    randomSuffix?: () => string;
  },
  input: { userId: string; displayName: string; role: Role; company?: { name: string; city: string; country: string } },
): Promise<{ profile: Profile; companySlug: string | null }> {
  if (await deps.profiles.findByUserId(input.userId)) throw new DomainError('profile.exists');
  if (input.role === 'mill' && !input.company) throw new DomainError('profile.company_required');

  // Build (and so validate) the profile first, so a bad name cannot leave a company behind.
  let profile: Profile | undefined;
  for (let attempt = 0; attempt < MAX_HANDLE_ATTEMPTS && !profile; attempt++) {
    const candidate = createProfile(input, deps.randomSuffix ?? randomSuffix);
    if (!candidate.handle || !(await deps.profiles.handleExists(candidate.handle))) profile = candidate;
  }
  if (!profile) throw new DomainError('profile.handle_unavailable');

  const company = input.role === 'mill' && input.company
    ? await deps.registerCompany({ ...input.company, ownerUserId: input.userId })
    : null;
  await deps.profiles.save(profile);
  return { profile, companySlug: company?.slug ?? null };
}
