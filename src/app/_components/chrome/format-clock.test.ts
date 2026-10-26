import { expect, it } from 'vitest';
import { formatClock } from './format-clock';

it('shows Istanbul time', () => expect(formatClock(new Date('2026-10-25T09:04:05Z'))).toBe('12:04:05'));
