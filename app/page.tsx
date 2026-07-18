'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Source = { title: string; url: string };

export default function Home() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

async function ask() {
    const question = q.trim();
    if (!question || loading) return;

    setLoading(true);
    setError('');
    setAnswer('');
    setSources([]);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      // エラー（429/400など）はJSONで返る想定なので先に判定
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'エラーが発生しました。時間をおいて再度お試しください。');
        return;
      }

      // ストリームを1行ずつ読む
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 改行で区切って、完成した行だけ処理（最後の未完成行はbufferに残す）
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === 'sources') {
            setSources(msg.sources ?? []);
          } else if (msg.type === 'text') {
            setAnswer((prev) => prev + msg.text); // 差分を継ぎ足していく
          } else if (msg.type === 'error') {
            setError(msg.error);
          }
        }
      }
    } catch {
      setError('通信に失敗しました。ネットワークを確認して再度お試しください。');
    } finally {
      setLoading(false);
    }
  }

  // Enterで送信（Shift+Enterは改行）
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">業務システム.com AI検索</h1>
        <p className="mt-1 text-sm text-slate-500">
          記事の内容について質問できます。回答には参照した記事のリンクが付きます。
        </p>
      </header>

      {/* 入力エリア */}
      <div className="flex flex-col gap-2">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="例：製造業を営んでいます。AIを使って従業員の作業を自動化するためのアイデアが見つかる記事を紹介してください。"
          rows={3}
          maxLength={500}
          className="w-full resize-none rounded-lg border border-slate-300 p-3 text-slate-800
                     shadow-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{q.length} / 500</span>
          <button
            onClick={ask}
            disabled={loading || !q.trim()}
            className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white
                       transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? '検索中…' : '質問する'}
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ローディング */}
      {loading && !loading && (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          記事を検索して回答を作成しています…
        </div>
      )}

      {/* 回答 */}
      {answer && (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="prose prose-slate prose-sm max-w-none text-slate-800
                prose-a:text-blue-600 prose-a:underline prose-headings:font-bold">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>

          {sources.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                参照した記事
              </h2>
              <ul className="space-y-1">
                {sources.map((s) => (
                  <li key={s.url}><a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline underline-offset-2 hover:text-blue-800"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}