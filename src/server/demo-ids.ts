// Fixed ids for the demo data. No imports: Playwright specs import this file directly.
export const DEMO = {
  users: {
    mill: 'demo-user-mill', denizli: 'demo-user-denizli', bursa: 'demo-user-bursa', maker: 'demo-user-maker',
    pending: 'demo-user-pending', pending2: 'demo-user-pending2',
  },
  emails: {
    mill: 'mill@example.test', denizli: 'denizli@example.test', bursa: 'bursa@example.test', maker: 'maker@example.test',
    pending: 'pending@example.test', pending2: 'pending2@example.test',
  },
  companies: {
    indigo: '5c1d0a10-0000-4000-8000-000000000001',
    denizli: '5c1d0a10-0000-4000-8000-000000000002',
    bursa: '5c1d0a10-0000-4000-8000-000000000003',
    anka: '5c1d0a10-0000-4000-8000-000000000004',
    ege: '5c1d0a10-0000-4000-8000-000000000005', // submitted, waiting for review
    marmara: '5c1d0a10-0000-4000-8000-000000000006', // submitted, waiting for review
  },
  companySlugs: { indigo: 'indigo-mill', denizli: 'denizli-indigo', bursa: 'bursa-weave', anka: 'anka-garments', ege: 'ege-orme', marmara: 'marmara-denim' },
  articles: {
    indigo60219: '5c1d0a20-0000-4000-8000-000000000001',
    indigo60409: '5c1d0a20-0000-4000-8000-000000000002',
  },
  articleSlugs: { indigo60219: '60219-1', indigo60409: '60409-1' },
  products: {
    guess: '5c1d0a30-0000-4000-8000-000000000001',
    liujo: '5c1d0a30-0000-4000-8000-000000000002',
    armani: '5c1d0a30-0000-4000-8000-000000000003',
  },
} as const;
