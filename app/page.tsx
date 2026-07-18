'use client';
import { useState } from 'react';

export default function Chat() {
  const [q, setQ] = useState('');
  const [ans, setAns] = useState('');
  const [sources, setSources] = useState<{ title: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();
    setAns(data.answer);
    setSources(data.sources ?? []);
    setLoading(false);
  }

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} />
      <button onClick={ask} disabled={loading}>質問</button>
      <p>{ans}</p>
      <ul>{sources.map((s) => <li key={s.url}><a href={s.url}>{s.title}</a></li>)}</ul>
    </div>
  );
}