/**
 * Serverless link-check API for the PHHE Link Validator.
 * Deploy to Vercel (or similar) so the browser validator can get real HTTP status codes (no CORS).
 *
 * GET /api/check-link?url=https://example.com/page
 * Returns: { "statusCode": 200, "ok": true } or { "statusCode": 404, "ok": false }
 *
 * Deploy: vercel (from repo root). Then open validator with ?api=https://YOUR_PROJECT.vercel.app
 */

const TIMEOUT_MS = 12000;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? require("https") : require("http");
    const req = lib.get(
      url,
      { timeout: TIMEOUT_MS, headers: { "User-Agent": "WHO-PHHE-LinkValidator/1.0" } },
      (res) => {
        const statusCode = res.statusCode || 0;
        resolve({ statusCode, ok: statusCode >= 200 && statusCode < 400 });
      }
    );
    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    req.setTimeout(TIMEOUT_MS);
  });
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const url = req.query.url;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url query parameter" });
    return;
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      res.status(400).json({ error: "Invalid URL protocol" });
      return;
    }
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }
  try {
    const { statusCode, ok } = await get(url);
    res.status(200).json({ statusCode, ok });
  } catch (e) {
    const message = e.message || "Request failed";
    const statusCode = message.includes("Timeout") ? 408 : 502;
    res.status(200).json({ statusCode, ok: false, error: message });
  }
};
