import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { embedBatch } from '@/lib/embed';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question) {
    return NextResponse.json({ error: 'question required' }, { status: 400 });
  }

  // 1. 質問を同じモデルでベクトル化
  const [qEmbedding] = await embedBatch([question]);

  // 2. 近傍チャンクを取得
  const { data: matches, error } = await supabaseAdmin.rpc('match_doc_chunks', {
    query_embedding: qEmbedding, // ※ 型エラーが出る場合は JSON.stringify(qEmbedding)
    match_count: 6,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3. コンテキスト構築（出典番号付き）
  const context = (matches ?? [])
    .map((m: any, i: number) => `[${i + 1}] (${m.title} - ${m.url})\n${m.content}`)
    .join('\n\n---\n\n');

  // 出典リンク（記事単位で重複排除）
  const seen = new Set<number>();
  const sources: { title: string; url: string }[] = [];
  for (const m of matches ?? []) {
    if (!seen.has(m.post_id)) { seen.add(m.post_id); sources.push({ title: m.title, url: m.url }); }
  }

  // 4. Claude で回答（ハルシネーション対策込み）
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5', // 利用可能なモデル名に合わせる
    max_tokens: 1024,
    system:
      'あなたは「業務システム.com」の記事に基づいて答えるアシスタントです。' +
      '以下のコンテキストの情報だけを使って日本語で回答してください。' +
      'コンテキストに答えがない場合は「記事内に該当する情報が見つかりませんでした」と答え、推測はしないこと。' +
      '回答の該当箇所には [1] のように出典番号を付けること。',
    messages: [
      { role: 'user', content: `コンテキスト:\n${context}\n\n質問: ${question}` },
    ],
  });

  const answer = msg.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  return NextResponse.json({ answer, sources });
}