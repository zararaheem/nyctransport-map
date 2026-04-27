import { fetchFamilies } from "../../lib/data";

let cache    = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30s — matches frontend polling interval

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const now = Date.now();
    if (!cache || now - cacheTime > CACHE_TTL) {
      cache     = await fetchFamilies();
      cacheTime = now;
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate");
    return res.status(200).json(cache);
  } catch (err) {
    console.error("Error fetching families:", err);
    return res.status(500).json({ error: err.message });
  }
}
