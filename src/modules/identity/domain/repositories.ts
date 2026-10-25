import type { Profile } from './profile';

export interface ProfileRepository {
  save(p: Profile): Promise<void>;
  findByUserId(id: string): Promise<Profile | null>;
  findByHandle(handle: string): Promise<Profile | null>;
  handleExists(handle: string): Promise<boolean>;
}
