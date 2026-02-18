# Link-check API (Vercel)

Serverless API for the PHHE Link Validator. Returns real HTTP status for any URL (no CORS).

- **Live API:** https://phhe-link.vercel.app/
- **Endpoint:** `GET /api/check-link?url=https://example.com/page`
- **Response:** `{ "statusCode": 200, "ok": true }` or `{ "statusCode": 404, "ok": false }`. On request failure (e.g. network): `{ "statusCode": 502, "ok": false, "error": "..." }`.
- **Validator default:** The Link Validator uses `https://phhe-link.vercel.app` by default.
- **Certificate handling:** If the first request fails with a TLS/certificate error (e.g. "unable to get local issuer certificate" on OpenWHO in Vercel’s runtime), the API retries once with relaxed TLS and returns the server’s real HTTP status. This avoids false positives where valid links are marked as broken.

---

## Deploy (one-time)

### Vercel dashboard

1. Go to **[https://vercel.com/new](https://vercel.com/new)** and sign in.
2. **Import** → **CyrilMolines/PHHE-training**.
3. **Project Name:** `phhe-link` (or another available name).
4. **Root Directory:** leave **empty**.
5. **Output Directory:** leave **empty**.
6. **Framework Preset:** **Other**.
7. Click **Deploy**.

Your API will be at `https://phhe-link.vercel.app/` and `https://phhe-link.vercel.app/api/check-link?url=...`.

---

## Configuration

- **vercel.json** uses only `rewrites` (no `routes`). Root `/` is rewritten to `/api/root`; `/api/check-link` and `/api/root` are auto-detected from the `api/` folder.
- If you get 404, see **api/TROUBLESHOOT-VERCEL.md** (Root Directory and Output Directory must be empty).

---

## Overriding the API URL

To use a different API URL, open the validator with:

`https://cyrilmolines.github.io/PHHE-training/validator/?api=https://your-project.vercel.app`

No trailing slash on the `api` value.
