import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

const CHUNK_SIZE = 800;     // 日本語の目安（文字）
const CHUNK_OVERLAP = 120;  // 文脈の断絶を防ぐ重なり

export type Chunk = { chunkIndex: number; heading: string; content: string };

// 見出し(h2/h3)単位のセクションに分ける
function htmlToSections(html: string): { heading: string; text: string }[] {
  const $ = cheerio.load(html);
  $('script, style').remove();

  const sections: { heading: string; text: string }[] = [];
  let current = { heading: '', text: '' };

  $('body').children().each((_, el) => {
    const tag = (el as Element).tagName?.toLowerCase();
    const text = $(el).text().replace(/\s+\n/g, '\n').trim();
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      if (current.text.trim()) sections.push(current);
      current = { heading: $(el).text().trim(), text: '' };
    } else if (text) {
      current.text += text + '\n';
    }
  });
  if (current.text.trim()) sections.push(current);
  return sections;
}

// 長いセクションをオーバーラップ付きで分割
function splitText(text: string): string[] {
  const clean = text.replace(/\n{2,}/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

export function chunkPost(html: string): Chunk[] {
  const chunks: Chunk[] = [];
  let idx = 0;
  for (const s of htmlToSections(html)) {
    for (const piece of splitText(s.text)) {
      // 見出しを各チャンク先頭に付与 → 埋め込み・LLM双方に文脈を与える
      const content = s.heading ? `${s.heading}\n${piece}` : piece;
      chunks.push({ chunkIndex: idx++, heading: s.heading, content });
    }
  }
  return chunks;
}