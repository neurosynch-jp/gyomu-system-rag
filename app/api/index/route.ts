import { chunkPost } from '@/lib/chunk';
import { embedBatch } from '@/lib/embed';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchPost } from '@/lib/wp';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // 長い記事の埋め込みに備える

export async function POST(req: NextRequest) {
  // 1. 認証（共有シークレット）
  if (req.headers.get('x-index-secret') !== process.env.INDEX_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { post_id, action } = await req.json();
  if (!post_id) {
    return NextResponse.json({ error: 'post_id required' }, { status: 400 });
  }

  // 2. 削除
  if (action === 'delete') {
    await supabaseAdmin.from('doc_chunks').delete().eq('post_id', post_id);
    return NextResponse.json({ ok: true, deleted: post_id });
  }

  // 3. 最新本文を取得。公開されていなければ index から除去
  const post = await fetchPost(post_id);
  if (!post || post.status !== 'publish') {
    await supabaseAdmin.from('doc_chunks').delete().eq('post_id', post_id);
    return NextResponse.json({ ok: true, skipped: 'not published' });
  }

  // 4. チャンク化
  const chunks = chunkPost(post.contentHtml);
  if (chunks.length === 0) {
    await supabaseAdmin.from('doc_chunks').delete().eq('post_id', post_id);
    return NextResponse.json({ ok: true, chunks: 0 });
  }

  // 5. 埋め込み（バッチ）
  const embeddings = await embedBatch(chunks.map((c) => c.content));

  // 6. 冪等な置き換え：既存を消してから挿入
  await supabaseAdmin.from('doc_chunks').delete().eq('post_id', post_id);
  const rows = chunks.map((c, i) => ({
    post_id: post.id,
    chunk_index: c.chunkIndex,
    content: c.content,
    embedding: embeddings[i],
    title: post.title,
    url: post.link,
    heading: c.heading,
  }));
  const { error } = await supabaseAdmin.from('doc_chunks').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, post_id: post.id, chunks: rows.length });
}