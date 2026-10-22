import { part1 } from './part-1';
import { part2 } from './part-2';
import { part3 } from './part-3';
import { part4 } from './part-4';
import { part5 } from './part-5';
import { part6 } from './part-6';
import { part7 } from './part-7';
import { part8 } from './part-8';
import type { PolicyPart } from './types';

export type { Block, PolicyPart, PolicySection } from './types';

/**
 * Fazl's privacy policy — the same text as the Fazl app's bundled PDF and the
 * website's Privacy Policy page (fazal-web-app assets/content/privacy-policy),
 * copied here so Seller Central shows it without a PDF viewer. When the policy
 * changes, copy the website's parts again.
 */
export const PRIVACY_POLICY: PolicyPart[] = [
  part1,
  part2,
  part3,
  part4,
  part5,
  part6,
  part7,
  part8,
];
