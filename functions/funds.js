// Cloudflare Pages Function: /api/funds
// Serves fund-analytics.json from R2 bucket

export async function onRequest(context) {
  // Cloudflare R2 binding (add to your Pages project settings)
  const r2 = context.env.MF_DATA_BUCKET; // R2 binding name
  const key = 'data/latest/fund-analytics.json';

  try {
    const object = await r2.get(key);
    if (!object) {
      return new Response('Not found', { status: 404 });
    }
    const json = await object.text();
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return new Response('Error fetching data', { status: 500 });
  }
}
