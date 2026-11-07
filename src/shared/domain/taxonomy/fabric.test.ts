import { expect, it } from 'vitest';
import { describeFabric, fabricHsCode, normalizeFabricSpec } from './fabric';

const DENIM = { construction: 'woven', pattern: 'twill', twillRatio: '3/1', twillDirection: 'rht',
  fibres: [{ code: 'co', percent: '98' }, { code: 'EA', percent: 2 }], weight: '12.5', weightUnit: 'oz', widthCm: '150', dye: 'rope', finishes: ['sanforized'] };

it('normalizes a denim sheet into standard codes and g/m²', () => {
  expect(normalizeFabricSpec(DENIM)).toEqual({ construction: 'woven', pattern: 'twill', twill: { ratio: '3/1', direction: 'rht' },
    fibres: [{ code: 'CO', percent: 98 }, { code: 'EL', percent: 2 }], weightGsm: 424, widthCm: 150, dye: 'rope', finishes: ['sanforized'] });
});

it('describes it in sector terms, in both languages', () => {
  const s = normalizeFabricSpec(DENIM);
  expect(describeFabric(s, 'en')).toEqual(['Woven · 3/1 right-hand twill (RHT)', 'Denim', '98% Cotton (CO, Gossypium spp.) · 2% Elastane (EL)',
    '424 g/m² (12.5 oz/yd²)', '150 cm wide', 'Rope-dyed', 'Sanforized', 'HS 5209.42']);
  expect(describeFabric(s, 'tr')).toEqual(['Dokuma · 3/1 sağ dimi (RHT)', 'Denim', '%98 Pamuk (CO, Gossypium spp.) · %2 Elastan (EL)',
    '424 g/m² (12,5 oz/yd²)', '150 cm en', 'Halat boyama', 'Sanforlu', 'HS 5209.42']);
});

const spec = (patch: object) => normalizeFabricSpec({ ...DENIM, ...patch });
it.each([
  [{}, '5209.42'],
  [{ weight: '180', weightUnit: 'gsm' }, '5208'],
  [{ weight: '200', weightUnit: 'gsm', fibres: [{ code: 'CO', percent: 100 }] }, '5208'],
  [{ dye: 'piece_dyed' }, '5209'],
  [{ fibres: [{ code: 'CO', percent: 70 }, { code: 'PES', percent: 30 }], weight: '300', weightUnit: 'gsm' }, '5211.42'],
  [{ pattern: 'plain', twillRatio: '', twillDirection: '', fibres: [{ code: 'CO', percent: 70 }, { code: 'PES', percent: 30 }], weight: '150', weightUnit: 'gsm' }, '5210'],
  [{ fibres: [{ code: 'CO', percent: 60 }, { code: 'LI', percent: 40 }], weight: '250', weightUnit: 'gsm' }, '5212'],
  [{ fibres: [{ code: 'CO', percent: 50 }, { code: 'PES', percent: 50 }] }, null],
  [{ construction: 'knitted', pattern: 'single_jersey', twillRatio: '', twillDirection: '' }, null],
])('fabricHsCode(%j) → %s', (patch, hs) => expect(fabricHsCode(spec(patch))).toBe(hs));

it.each([
  [{ construction: 'felt' }, 'fabric.construction_invalid'],
  [{ pattern: 'rib' }, 'fabric.pattern_invalid'],
  [{ twillRatio: '' }, 'fabric.twill_invalid'],
  [{ pattern: 'plain' }, 'fabric.twill_invalid'], // plain weave with a twill ratio
  [{ fibres: [] }, 'fabric.fibre_invalid'],
  [{ fibres: [{ code: 'CO', percent: 50 }, { code: 'co', percent: 50 }] }, 'fabric.fibre_invalid'],
  [{ fibres: [{ code: 'CO', percent: 97.5 }, { code: 'EL', percent: 2.5 }] }, 'fabric.fibre_invalid'],
  [{ fibres: [{ code: 'CO', percent: 98 }, { code: 'EL', percent: 3 }] }, 'fabric.composition_total'],
  [{ weight: '10', weightUnit: 'gsm' }, 'fabric.weight_invalid'],
  [{ weightUnit: 'kg' }, 'fabric.weight_invalid'],
  [{ widthCm: '20' }, 'fabric.width_invalid'],
  [{ dye: 'tie_dye' }, 'fabric.dye_invalid'],
  [{ finishes: ['laser'] }, 'fabric.finish_invalid'],
])('rejects %j', (patch, code) => expect(() => spec(patch)).toThrow(expect.objectContaining({ code })));
