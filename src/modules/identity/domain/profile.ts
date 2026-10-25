import { DomainError } from '@/shared/domain/errors';
import { slugify } from '@/shared/domain/slug';

export type Role = 'mill' | 'agent';

export type Profile = Readonly<{
  userId: string;
  role: Role;
  displayName: string;
  handle: string | null;
  createdAt: Date;
}>;

export function createProfile(
  input: { userId: string; role: Role; displayName: string },
  randomSuffix: () => string,
  now: Date = new Date(),
): Profile {
  const displayName = input.displayName.trim();
  if (displayName.length < 2 || displayName.length > 60) throw new DomainError('profile.name_invalid');
  let handle: string | null = null;
  if (input.role === 'agent') {
    const stem = slugify(displayName).replaceAll('-', '').slice(0, 16);
    if (!stem) throw new DomainError('profile.name_invalid');
    handle = `${stem}-${randomSuffix()}`;
  }
  return Object.freeze({ userId: input.userId, role: input.role, displayName, handle, createdAt: now });
}
