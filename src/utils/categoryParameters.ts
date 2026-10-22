// A listing's details ("parameters") the way the Fazl app builds them
// (Native-fazl-app/src/utils/categoryParameters.js), so a product listed from
// either app gets the same fields: the category's own parameters, some of
// which depend on another (Make → Model), plus the seller's own "Add Details".

type Localized = string | { en?: string; ur?: string } | null | undefined;

const pick = (v: Localized | number): string =>
  v == null ? '' : typeof v === 'object' ? v.en ?? v.ur ?? '' : String(v);

/** A category as returned by GET /categories (full fields). */
export interface CategoryWithParameters {
  id: string;
  name: string;
  /** Image URL, shown in the category list as on Fazl. */
  icon?: string | null;
  parameters?: { en?: unknown[]; ur?: unknown[] } | null;
}

export interface FormParameter {
  id: string;
  name: string;
  /** The chosen value(s). */
  variants: string[];
  /** The values the category offers right now (after the parent's choice). */
  availableValues: string[];
  /** From the category, as opposed to one the seller added. */
  fromCategory: boolean;
  /** Admin's settings for the parameter (Admin > Categories); unset is off. */
  isOptional?: boolean;
  allowCustomValue?: boolean;
  allowMultiple?: boolean;
  /** Another parameter is narrowed by this one's value (Make, for Model). */
  hasDependents?: boolean;
  dependsOnIndex?: number;
  valueKeys?: string[];
  valuesByParent?: Record<string, string[]>;
  valueKeysByParent?: Record<string, string[]>;
  activeParentKey?: string;
  /** A retail listing's "Condition", its second-hand values left out (see
   *  newOnly): never typed in either. */
  newOnlyCondition?: boolean;
}

interface Entry {
  name: string;
  values: string[];
  dependsOn: string | null;
  valueKeys: string[] | null;
  valuesByParent: Record<string, string[]> | null;
  valueKeysByParent: Record<string, string[]> | null;
  settings: Pick<FormParameter, 'isOptional' | 'allowCustomValue' | 'allowMultiple'>;
  newOnlyCondition?: boolean;
}

function readEntry(raw: unknown): Entry {
  const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = pick((typeof raw === 'object' ? e.name : raw) as Localized);
  const values = Array.isArray(e.values) ? (e.values as unknown[]).map(v => pick(v as Localized)).filter(Boolean) : [];
  const dependsOn = typeof e.dependsOn === 'string' && e.dependsOn.trim() ? e.dependsOn.trim() : null;
  const valueKeys =
    Array.isArray(e.valueKeys) && e.valueKeys.every(k => typeof k === 'string') ? (e.valueKeys as string[]) : null;
  const valuesByParent =
    e.valuesByParent && typeof e.valuesByParent === 'object' ? (e.valuesByParent as Record<string, string[]>) : null;
  const valueKeysByParent =
    e.valueKeysByParent && typeof e.valueKeysByParent === 'object'
      ? (e.valueKeysByParent as Record<string, string[]>)
      : null;
  const settings = {
    ...(e.isOptional === true ? { isOptional: true } : {}),
    ...(e.allowCustomValue === true ? { allowCustomValue: true } : {}),
    ...(e.allowMultiple === true ? { allowMultiple: true } : {}),
  };
  return { name, values, dependsOn, valueKeys, valuesByParent, valueKeysByParent, settings };
}

/** Indexes of the entries another entry depends on. */
function parentIndexes(entries: Entry[], indexOf: Map<string, number>): Set<number> {
  const parents = new Set<number>();
  entries.forEach(e => {
    if (!e.dependsOn) return;
    const i = indexOf.get(e.dependsOn) ?? indexOf.get(e.dependsOn.toLowerCase());
    if (i !== undefined) parents.add(i);
  });
  return parents;
}

/**
 * A retail listing is new (`newOnly`): of a category's "Condition", the
 * second-hand values (Used, Like New, Refurbished, Good…) are never offered.
 * The others stay (New, Sealed, Genuine, Aftermarket, Made to Order…), as does
 * a "Condition" that isn't about wear at all (an animal's: Healthy, Trained…).
 * A classified listing (posted from the Fazl app, edited here) keeps them all.
 */
const SECOND_HAND = new Set([
  'used',
  'like new',
  'refurbished',
  'good',
  'fair',
  'second hand',
  'second-hand',
  'pre-owned',
  'open box',
]);

export const isConditionParameter = (name: string): boolean => /^\s*condition\s*$/i.test(name);

const isSecondHand = (value: string) => SECOND_HAND.has(value.trim().toLowerCase());

/** A "Condition" entry with its second-hand values left out (their keys too). */
function newOnly(e: Entry): Entry {
  if (!isConditionParameter(e.name)) return e;
  const kept = e.values.map((value, i) => ({ value, i })).filter(({ value }) => !isSecondHand(value));
  if (kept.length === 0 || kept.length === e.values.length) return e;
  return {
    ...e,
    values: kept.map(k => k.value),
    valueKeys: e.valueKeys ? kept.map(k => e.valueKeys![k.i]) : null,
    newOnlyCondition: true,
  };
}

/** The value a retail listing is given without asking: a "Condition" left with one choice (New). */
const onlyChoice = (e: Entry): string | undefined =>
  e.newOnlyCondition && e.values.length === 1 ? e.values[0] : undefined;

function entriesOf(category: CategoryWithParameters | null | undefined, newOnlyListing = false): Entry[] {
  const list = category?.parameters?.en ?? [];
  if (!Array.isArray(list)) return [];
  const entries = list.map(readEntry).filter(e => e.name);
  return newOnlyListing ? entries.map(newOnly) : entries;
}

function optionsForParent(entry: Entry, parent: Entry | undefined, parentValue: string | undefined) {
  if (!entry.dependsOn || !entry.valuesByParent) return entry.values;
  if (!parent || !parentValue) return [];
  const i = parent.values.indexOf(parentValue);
  const key = i >= 0 ? parent.valueKeys?.[i] : undefined;
  return key ? entry.valuesByParent[key] ?? [] : [];
}

const extras = (e: Entry) => ({
  ...e.settings,
  ...(e.valueKeys ? { valueKeys: e.valueKeys } : {}),
  ...(e.valuesByParent ? { valuesByParent: e.valuesByParent } : {}),
  ...(e.valueKeysByParent ? { valueKeysByParent: e.valueKeysByParent } : {}),
});

/** A new listing's details from its category: every field empty (but a
 *  retail listing's Condition with one choice left, which is chosen),
 *  dependents locked. */
export function buildParametersFromCategory(
  category: CategoryWithParameters,
  { newOnly: newOnlyListing = false }: { newOnly?: boolean } = {},
): FormParameter[] {
  const entries = entriesOf(category, newOnlyListing);
  const indexOf = new Map(entries.map((e, i) => [e.name, i]));
  const parents = parentIndexes(entries, indexOf);
  return entries.map((e, i) => {
    const dependsOnIndex = e.dependsOn ? indexOf.get(e.dependsOn) : undefined;
    const given = onlyChoice(e);
    return {
      id: `cat-${category.id}-${i}`,
      name: e.name,
      variants: given ? [given] : [],
      availableValues: dependsOnIndex !== undefined ? [] : e.values,
      fromCategory: true,
      ...(e.newOnlyCondition ? { newOnlyCondition: true } : {}),
      ...(parents.has(i) ? { hasDependents: true } : {}),
      ...(dependsOnIndex !== undefined ? { dependsOnIndex } : {}),
      ...extras(e),
    };
  });
}

/** A saved listing's details laid back over its category, for editing. */
export function hydrateParametersFromSaved(
  saved: { name: string; values: string[] }[],
  category: CategoryWithParameters | null | undefined,
  { newOnly: newOnlyListing = false }: { newOnly?: boolean } = {},
): FormParameter[] {
  const entries = entriesOf(category, newOnlyListing);
  if (!entries.length) {
    return saved.map((p, i) => ({
      id: `param-${i}`,
      name: p.name,
      variants: p.values,
      availableValues: p.values,
      fromCategory: false,
    }));
  }
  const savedByName = new Map(saved.map(p => [p.name.toLowerCase(), p]));
  const indexOf = new Map(entries.map((e, i) => [e.name.toLowerCase(), i]));
  const parents = parentIndexes(entries, indexOf);
  const chosen = new Map<number, string | undefined>();

  const results: FormParameter[] = entries.map((e, i) => {
    let values = savedByName.get(e.name.toLowerCase())?.values ?? [];
    // A retail listing saved as second-hand before: not any more (see
    // newOnly); with one choice left, that one.
    if (e.newOnlyCondition) {
      values = values.filter(v => !isSecondHand(v));
      const given = onlyChoice(e);
      if (!values.length && given) values = [given];
    }
    // Every saved value where admin allows several (and nothing depends on this one), else the one.
    const selected = e.settings.allowMultiple && !parents.has(i) ? values : values.slice(0, 1);
    chosen.set(i, selected[0]);
    const dependsOnIndex = e.dependsOn ? indexOf.get(e.dependsOn.toLowerCase()) : undefined;
    let available = e.values;
    let activeParentKey: string | undefined;
    if (dependsOnIndex !== undefined) {
      const parent = entries[dependsOnIndex];
      const parentValue = chosen.get(dependsOnIndex);
      available = optionsForParent(e, parent, parentValue);
      const pi = parentValue ? parent.values.indexOf(parentValue) : -1;
      activeParentKey = pi >= 0 ? parent.valueKeys?.[pi] : undefined;
    }
    // A saved value the list doesn't have (typed by the seller, or the category changed) stays shown.
    const missing = selected.filter(v => !available.includes(v));
    return {
      id: `cat-${category?.id}-${i}`,
      name: e.name,
      variants: selected,
      availableValues: missing.length ? [...available, ...missing] : available,
      fromCategory: true,
      ...(e.newOnlyCondition ? { newOnlyCondition: true } : {}),
      ...(parents.has(i) ? { hasDependents: true } : {}),
      ...(dependsOnIndex !== undefined ? { dependsOnIndex } : {}),
      ...extras(e),
      ...(activeParentKey ? { activeParentKey } : {}),
    };
  });

  // Details the seller added themselves keep their values.
  const categoryNames = new Set(entries.map(e => e.name.toLowerCase()));
  saved.forEach((p, i) => {
    if (categoryNames.has(p.name.toLowerCase())) return;
    results.push({
      id: `own-${i}`,
      name: p.name,
      variants: p.values,
      availableValues: p.values,
      fromCategory: false,
    });
  });
  return results;
}

/** After a value changes, recompute (and clear if no longer valid) what depends on it. */
export function cascadeParameterDependents(params: FormParameter[], changedIndex: number): FormParameter[] {
  const next = [...params];
  for (let i = changedIndex + 1; i < next.length; i++) {
    const entry = next[i];
    if (entry.dependsOnIndex === undefined) continue;
    const parent = next[entry.dependsOnIndex];
    const parentValue = parent?.variants?.[0];
    const pi = parentValue ? (parent.availableValues || []).indexOf(parentValue) : -1;
    const parentKey =
      pi < 0
        ? undefined
        : parent.dependsOnIndex !== undefined
        ? parent.valueKeysByParent?.[parent.activeParentKey ?? '']?.[pi]
        : parent.valueKeys?.[pi];
    const options = parentKey ? entry.valuesByParent?.[parentKey] ?? [] : [];
    const previous = entry.availableValues || [];
    const unchanged =
      options.length === previous.length &&
      options.every((v, j) => v === previous[j]) &&
      parentKey === entry.activeParentKey;
    if (unchanged) continue;
    const stillValid = entry.variants.every(v => options.includes(v));
    next[i] = { ...entry, availableValues: options, activeParentKey: parentKey, ...(stillValid ? {} : { variants: [] }) };
  }
  return next;
}

/** Has a value, or is a dependent field its parent's choice leaves nothing to pick for. */
export function isParameterSatisfied(p: FormParameter): boolean {
  if (p.variants.length > 0) return true;
  // Admin made it optional: it may be left empty.
  if (p.isOptional) return true;
  return p.dependsOnIndex !== undefined && p.availableValues.length === 0;
}

/** Admin allows several values, and no other parameter is narrowed by this one's. */
export function allowsMultipleValues(p: FormParameter | null | undefined): boolean {
  return !!p?.allowMultiple && !p.hasDependents;
}

/**
 * Whether the seller may type a value of their own: when admin allows custom
 * values, and always for a parameter with no values to choose from at all,
 * which would otherwise be unfillable.
 */
export function canAddCustomValue(p: FormParameter | null | undefined): boolean {
  if (!p) return false;
  // A retail listing's condition is one of the new ones offered, never one typed in ("Used").
  if (p.newOnlyCondition && p.availableValues.length > 0) return false;
  if (!p.fromCategory || p.allowCustomValue) return true;
  return p.dependsOnIndex === undefined && p.availableValues.length === 0;
}

/** A dependent field waiting on its parent's value. */
export function isParameterLocked(p: FormParameter): boolean {
  return p.dependsOnIndex !== undefined && p.variants.length === 0 && p.availableValues.length === 0;
}

/** What the backend stores: [{ name, variants }], only details with a value. */
export function serializeParameters(params: FormParameter[]): { name: string; variants: string[] }[] {
  return params
    .filter(p => p.name.trim())
    .map(p => ({ name: p.name, variants: p.variants.filter(Boolean) }))
    .filter(p => p.variants.length > 0);
}
