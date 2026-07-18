async function main() {
  const base = process.env.WP_BASE_URL!;                 
  const endpoint = process.env.INDEX_ENDPOINT!;     
  const secret = process.env.INDEX_WEBHOOK_SECRET!;

  let page = 1;
  let total = 0;
  while (true) {
    const res = await fetch(
      `${base}/wp-json/wp/v2/posts?per_page=20&page=${page}&_fields=id`
    );
    if (!res.ok) break;
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) break;

    for (const p of posts) {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-index-secret': secret },
        body: JSON.stringify({ post_id: p.id, action: 'upsert' }),
      });
      console.log(p.id, r.status);
      total++;
      await new Promise((r) => setTimeout(r, 500)); // レート配慮
    }
    page++;
  }
  console.log('done:', total);
}
main();