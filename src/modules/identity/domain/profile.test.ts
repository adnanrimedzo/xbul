import { expect, it } from 'vitest';
import { createProfile } from './profile';

it('gives agents a readable handle and mills none', () => {
  expect(createProfile({ userId: 'u1', role: 'agent', displayName: 'Laura Martin' }, () => 'x7k2').handle).toBe('lauramartin-x7k2');
  expect(createProfile({ userId: 'u2', role: 'mill', displayName: 'Ali Kaya' }, () => 'zzzz').handle).toBeNull();
  expect(() => createProfile({ userId: 'u3', role: 'agent', displayName: 'L' }, () => 'a')).toThrow(expect.objectContaining({ code: 'profile.name_invalid' }));
});

it('trims the display name and bounds it to 2-60 characters', () => {
  expect(createProfile({ userId: 'u1', role: 'mill', displayName: '  Ali Kaya  ' }, () => 'zzzz').displayName).toBe('Ali Kaya');
  expect(() => createProfile({ userId: 'u1', role: 'mill', displayName: ' A ' }, () => 'zzzz')).toThrow(expect.objectContaining({ code: 'profile.name_invalid' }));
  expect(() => createProfile({ userId: 'u1', role: 'mill', displayName: 'x'.repeat(61) }, () => 'zzzz')).toThrow(expect.objectContaining({ code: 'profile.name_invalid' }));
  expect(createProfile({ userId: 'u1', role: 'mill', displayName: 'x'.repeat(60) }, () => 'zzzz').displayName).toHaveLength(60);
});

it('caps the handle stem at 16 characters and freezes the profile', () => {
  const p = createProfile({ userId: 'u1', role: 'agent', displayName: 'Alexandria Bartholomew-Smythe' }, () => 'ab12');
  expect(p.handle).toBe('alexandriabartho-ab12');
  expect(Object.isFrozen(p)).toBe(true);
});

it('rejects an agent whose name has no slug characters', () => {
  expect(() => createProfile({ userId: 'u1', role: 'agent', displayName: '!!!' }, () => 'ab12')).toThrow(expect.objectContaining({ code: 'profile.name_invalid' }));
});
