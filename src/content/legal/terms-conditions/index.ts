import { part1 } from './part-1';
import { part2 } from './part-2';
import { part3 } from './part-3';
import type { PolicyPart } from './types';

export type { Block, PolicyPart, PolicySection } from './types';

/**
 * Fazl's terms and conditions — the same text as the Fazl app's bundled PDF
 * and the website's Terms page (fazal-web-app assets/content/terms-conditions),
 * copied here so Seller Central shows it without a PDF viewer. When the terms
 * change, copy the website's parts again.
 */
export const TERMS_CONDITIONS: PolicyPart[] = [part1, part2, part3];
