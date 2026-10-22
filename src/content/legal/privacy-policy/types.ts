/**
 * The shape of Fazl's legal documents as text, copied from the website
 * (fazal-web-app assets/content/privacy-policy/types.ts) along with the text.
 */

export type Block =
  /** `strong` is a bold sentence that closes the paragraph. */
  | { type: 'p'; text: string; strong?: string }
  | { type: 'ul'; items: string[] }
  /** A list the PDF numbers 1, 2, 3… */
  | { type: 'ol'; items: string[] }
  /** A numbered subsection heading inside a section, e.g. "2.1. …". */
  | { type: 'h'; text: string }
  | { type: 'dl'; items: { term: string; definition: string }[] };

export type PolicySection = {
  /** Anchor id, used by the table of contents. */
  id: string;
  /** The number the PDF gives this section. */
  number: number;
  heading: string;
  blocks: Block[];
};

export type PolicyPart = {
  id: string;
  /** e.g. "Part I" - the PDF numbers its parts in roman. Left out, with
   *  `title`, for a document whose sections are not grouped into parts. */
  label?: string;
  title?: string;
  sections: PolicySection[];
};
