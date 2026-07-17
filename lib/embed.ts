import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small', // 1536次元
    input: texts,                    // 1記事分のチャンクをまとめて渡す
  });
  return res.data.map((d) => d.embedding);
}