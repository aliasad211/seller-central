import { PolicyPart, PRIVACY_POLICY } from '../src/content/legal/privacy-policy';
import { TERMS_CONDITIONS } from '../src/content/legal/terms-conditions';

// Settings > Privacy policy / Terms & conditions: the same documents as the
// Fazl app's PDFs, as the website carries them (50 and 67 sections).
const sectionsOf = (parts: PolicyPart[]) => parts.flatMap(p => p.sections);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test('the privacy policy is all there, in order', () => {
  expect(PRIVACY_POLICY).toHaveLength(8);
  expect(sectionsOf(PRIVACY_POLICY).map(s => s.number)).toEqual(range(1, 50));
});

test('the terms are all there, numbered as the PDF numbers them', () => {
  expect(TERMS_CONDITIONS).toHaveLength(3);
  // The PDF itself numbers 33–35 twice (Disclaimer…Indemnification, then
  // Beta Features…), so 67 sections end at 64; kept as printed.
  expect(sectionsOf(TERMS_CONDITIONS).map(s => s.number)).toEqual([
    ...range(1, 35),
    ...range(33, 35),
    ...range(36, 64),
  ]);
});

test.each([
  ['privacy policy', PRIVACY_POLICY],
  ['terms and conditions', TERMS_CONDITIONS],
])('every row of the %s has its own key, and every section has text', (_name, parts) => {
  // The screen's list is keyed by these ids, parts and sections together.
  const keys = [...parts.map(p => p.id), ...sectionsOf(parts).map(s => s.id)];
  expect(new Set(keys).size).toBe(keys.length);
  for (const section of sectionsOf(parts)) {
    expect(section.heading.trim()).not.toBe('');
    expect(section.blocks.length).toBeGreaterThan(0);
  }
});
