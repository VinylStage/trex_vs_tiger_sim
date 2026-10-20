import { decodeEntities, elementById, firstElement, metaContent, textOf } from './html.ts';

/** One visible question and its answer, as plain text. */
export interface FaqItem {
  question: string;
  answer: string;
}

/** What the build reads from a page's own HTML (the page is the source of its words). */
export interface PageFacts {
  /** `<title>` text. */
  title: string;
  /** `<meta name="description">`. */
  description: string;
  /** Text of the page's `<h1>`, or null (the simulator renders its heading with JavaScript). */
  h1: string | null;
  /** The visible FAQ (`<section id="faq">`), in page order; empty when the page has none. */
  faq: FaqItem[];
}

/**
 * Questions and answers of the visible FAQ section: every `<h3>` is a question and the text up to
 * the next `<h3>` (paragraphs, links, code) is its answer.
 */
export function extractFaq(html: string): FaqItem[] {
  const section = elementById(html, 'section', 'faq');
  if (section === null) return [];
  const items: FaqItem[] = [];
  const parts = section.split(/<h3(?:\s[^>]*)?>/i).slice(1);
  for (const part of parts) {
    const end = part.toLowerCase().indexOf('</h3>');
    if (end < 0) continue;
    items.push({ question: textOf(part.slice(0, end)), answer: textOf(part.slice(end + 5)) });
  }
  return items;
}

/** Title, description, heading and FAQ of a page. Throws if the title or description is missing. */
export function extractPageFacts(html: string): PageFacts {
  const title = firstElement(html, 'title');
  const description = metaContent(html, 'description');
  if (title === null || description === null) {
    throw new Error('page has no <title> or <meta name="description">');
  }
  const h1 = firstElement(html, 'h1');
  return {
    title: decodeEntities(title).replace(/\s+/g, ' ').trim(),
    description: description.replace(/\s+/g, ' ').trim(),
    h1: h1 === null ? null : textOf(h1),
    faq: extractFaq(html),
  };
}
