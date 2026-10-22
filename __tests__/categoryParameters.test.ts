import {
  buildParametersFromCategory,
  canAddCustomValue,
  hydrateParametersFromSaved,
  serializeParameters,
} from '../src/utils/categoryParameters';

// Categories shaped as GET /categories returns them, with the "Condition"
// lists the admin has set on staging.
const category = (conditionValues: string[], extra: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Mobiles',
  parameters: {
    en: [
      {
        name: 'Condition',
        values: conditionValues,
        valueKeys: conditionValues.map((_, i) => `k${i}`),
        isOptional: false,
        allowCustomValue: false,
        ...extra,
      },
      { name: 'Brand', values: ['Samsung', 'Apple'], valueKeys: ['b1', 'b2'] },
    ],
  },
});

const retail = { newOnly: true };
const condition = (params: ReturnType<typeof buildParametersFromCategory>) =>
  params.find(p => p.name === 'Condition')!;

describe('a retail listing is new', () => {
  it('offers only New, already chosen, where the rest are second-hand', () => {
    const c = condition(buildParametersFromCategory(category(['New', 'Like New', 'Used', 'Refurbished']), retail));
    expect(c.availableValues).toEqual(['New']);
    expect(c.variants).toEqual(['New']);
    // Its key goes with it, for anything narrowed by it.
    expect(c.valueKeys).toEqual(['k0']);
    expect(serializeParameters([c])).toEqual([{ name: 'Condition', variants: ['New'] }]);
  });

  it('keeps the new kinds there are, to choose from', () => {
    const c = condition(
      buildParametersFromCategory(category(['New', 'Used', 'Genuine', 'Aftermarket', 'Refurbished']), retail),
    );
    expect(c.availableValues).toEqual(['New', 'Genuine', 'Aftermarket']);
    expect(c.variants).toEqual([]);
    expect(c.valueKeys).toEqual(['k0', 'k2', 'k3']);
  });

  it('drops "Good" as a second-hand grade too', () => {
    const c = condition(buildParametersFromCategory(category(['New', 'Like New', 'Good', 'Used']), retail));
    expect(c.availableValues).toEqual(['New']);
  });

  it("leaves a condition that isn't about wear (an animal's) as it is", () => {
    const c = condition(buildParametersFromCategory(category(['Healthy', 'Pregnant', 'Trained', 'Untrained']), retail));
    expect(c.availableValues).toEqual(['Healthy', 'Pregnant', 'Trained', 'Untrained']);
    expect(c.variants).toEqual([]);
  });

  it('touches no other parameter', () => {
    const brand = buildParametersFromCategory(category(['New', 'Used']), retail).find(p => p.name === 'Brand')!;
    expect(brand.availableValues).toEqual(['Samsung', 'Apple']);
    expect(brand.variants).toEqual([]);
  });

  it('makes a listing saved as Used, when edited, New', () => {
    const params = hydrateParametersFromSaved(
      [
        { name: 'Condition', values: ['Used'] },
        { name: 'Brand', values: ['Apple'] },
      ],
      category(['New', 'Used']),
      retail,
    );
    const c = condition(params);
    expect(c.variants).toEqual(['New']);
    expect(c.availableValues).toEqual(['New']);
    expect(params.find(p => p.name === 'Brand')!.variants).toEqual(['Apple']);
  });

  it('keeps a saved new value where there are several', () => {
    const c = condition(
      hydrateParametersFromSaved([{ name: 'Condition', values: ['Genuine'] }], category(['New', 'Used', 'Genuine']), retail),
    );
    expect(c.variants).toEqual(['Genuine']);
  });

  it('lets no condition be typed in, even where the admin allows typing', () => {
    const c = condition(buildParametersFromCategory(category(['New', 'Used'], { allowCustomValue: true }), retail));
    expect(canAddCustomValue(c)).toBe(false);
    const brand = buildParametersFromCategory(category(['New', 'Used']), retail).find(p => p.name === 'Brand')!;
    expect(canAddCustomValue({ ...brand, allowCustomValue: true })).toBe(true);
  });
});

describe('a classified listing keeps every condition', () => {
  it('offers New, Like New, Used and the rest, none chosen', () => {
    const c = condition(buildParametersFromCategory(category(['New', 'Like New', 'Used', 'Refurbished'])));
    expect(c.availableValues).toEqual(['New', 'Like New', 'Used', 'Refurbished']);
    expect(c.variants).toEqual([]);
  });

  it('keeps a saved Used when edited', () => {
    const c = condition(hydrateParametersFromSaved([{ name: 'Condition', values: ['Used'] }], category(['New', 'Used'])));
    expect(c.variants).toEqual(['Used']);
    expect(c.availableValues).toEqual(['New', 'Used']);
  });

  it("follows the admin's word on typing a condition", () => {
    const c = condition(buildParametersFromCategory(category(['New', 'Used'], { allowCustomValue: true })));
    expect(canAddCustomValue(c)).toBe(true);
  });
});
