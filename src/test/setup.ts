import { vi } from 'vitest';

// Actions read their language from the request's Referer, and tests have no request: they run in English.
vi.mock('@/i18n/action', () => ({ actionLang: async () => 'en' }));
