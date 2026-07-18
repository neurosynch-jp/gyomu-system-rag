'use client';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Source = { title: string; url: string };

export default function Embed() {
  const [q, setQ] = useState('');
  const [displayed, setDisplayed] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');

  const fullTextRef = useRef('');
  const displayedLenRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamingRef = useRef(false);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startTypewriter() {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      const full = fullTextRef.current;
      if (displayedLenRef.current < full.length) {
        const step = Math.max(1, Math.ceil((full.length - displayedLenRef.current) / 40));
        displayedLenRef.current = Math.min(full.length, displayedLenRef.current + step);
        setDisplayed(full.slice(0, displayedLenRef.current));
      } else if (!streamingRef.current) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      }
    }, 20);
  }

  async function ask() {
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true); setStreaming(true); setError('');
    setDisplayed(''); setSources([]);
    fullTextRef.current = ''; displayedLenRef.current = 0;

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'エラーが発生しました。時間をおいて再度お試しください。');
        setStreaming(false); return;
      }
      startTypewriter();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === 'sources') setSources(msg.sources ?? []);
          else if (msg.type === 'text') fullTextRef.current += msg.text;
          else if (msg.type === 'error') setError(msg.error);
        }
      }
    } catch {
      setError('通信に失敗しました。ネットワークを確認してください。');
    } finally {
      setStreaming(false); setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* ヘッダー */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">業務システム.com AI検索</p>
        <p className="text-xs text-slate-400">記事の内容について質問できます</p>
      </div>

      {/* 回答エリア（スクロール） */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {(loading || displayed) && !error && (
          loading && !displayed ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              回答を作成しています…
            </div>
          ) : (
            <>
              <div className="prose prose-slate prose-sm max-w-none text-slate-800
                              prose-a:text-blue-600 prose-a:underline prose-headings:font-bold">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayed}</ReactMarkdown>
              </div>
              {sources.length > 0 && displayed && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">参照した記事</p>
                  <ul className="space-y-1">
                    {sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                           className="text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )
        )}
        {!loading && !displayed && !error && (
          <p className="text-sm text-slate-400">
            例：製造業を営んでいます。AIを使って従業員の作業を自動化するためのアイデアが見つかる記事を紹介してください。
          </p>
        )}
      </div>

      {/* 入力エリア（下固定） */}
      <div className="shrink-0 border-t border-slate-200 p-3">
        <textarea
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
          placeholder="質問を入力…" rows={2} maxLength={500}
          className="w-full resize-none rounded-lg border border-slate-300 p-2 text-sm text-slate-800
                     outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-slate-400">{q.length}/500</span>
          <button onClick={ask} disabled={loading || !q.trim()}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white
                       hover:bg-slate-700 disabled:opacity-40">
            {loading ? '検索中…' : '質問'}
          </button>
        </div>
      </div>
    </div>
  );
}