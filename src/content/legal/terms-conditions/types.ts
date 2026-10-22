/**
 * The terms document has the same shape as the privacy policy, so it reuses
 * those types rather than declaring a parallel set that could drift.
 */
export type { Block, PolicyPart, PolicySection } from '../privacy-policy/types';
