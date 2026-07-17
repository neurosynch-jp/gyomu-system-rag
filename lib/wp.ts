export type WpPost = {
  id: number; title: string; link: string; contentHtml: string; status: string;
};

export async function fetchPost(postId: number): Promise<WpPost | null> {
  const url = `${process.env.WP_BASE_URL}/wp-json/wp/v2/posts/${postId}` +
              `?_fields=id,title,link,content,status`;
  const res = await fetch(url, { headers: { 'User-Agent': 'rag-indexer' } });
  if (!res.ok) return null;
  const p = await res.json();
  return {
    id: p.id,
    title: p.title?.rendered ?? '',
    link: p.link,
    contentHtml: p.content?.rendered ?? '',
    status: p.status,
  };
}