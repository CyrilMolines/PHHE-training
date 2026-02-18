# Link-check API (Vercel)

Serverless API for the PHHE Link Validator. Returns real HTTP status for any URL (no CORS).

- **Endpoint:** `GET /api/check-link?url=https://example.com/page`
- **Response:** `{ "statusCode": 200, "ok": true }` or `{ "statusCode": 404, "ok": false }`
- **Default URL used by validator:** `https://training-hub.vercel.app`

---

## Deploy (one-time)

### Option A: Vercel dashboard (easiest)

1. Go to **[https://vercel.com/new](https://vercel.com/new)** and sign in (GitHub is fine).
2. Click **Import Git Repository** and select your **Training-Hub** repo (or the repo that contains this `api/` folder).
3. **Project Name:** set to **`training-hub`** so the URL is `https://training-hub.vercel.app`.
4. **Root Directory:** leave as **`.`** (repo root; `vercel.json` and `api/` must be at root).
5. Click **Deploy**. Wait for the build to finish.
6. Your API is live at **https://training-hub.vercel.app/api/check-link?url=...**

The validator at https://cyrilmolines.github.io/PHHE-training/validator/ uses this URL by default, so it will work with no changes.

Future pushes to the repo will auto-deploy if you left “Vercel for Git” connected.

---

### Option B: Vercel CLI (then GitHub Action)

1. **Log in once:** in a terminal at the **repo root** (where `vercel.json` and `api/` are):
   ```bash
   npx vercel login
   ```
2. **Create/link project and deploy:**
   ```bash
   npx vercel --prod --yes
   ```
   When asked for project name, use **`training-hub`** so the URL is `https://training-hub.vercel.app`.

3. **Optional – auto-deploy on push:**  
   After the first deploy, run in the same repo:
   ```bash
   npx vercel link
   ```
   Then add these as **GitHub repo secrets** (Settings → Secrets and variables → Actions):
   - **VERCEL_TOKEN** – create at [vercel.com/account/tokens](https://vercel.com/account/tokens)
   - **VERCEL_ORG_ID** – from `.vercel/project.json` after `vercel link` (or Vercel dashboard → your team → Settings)
   - **VERCEL_PROJECT_ID** – from `.vercel/project.json` (or Vercel project → Settings → General)

   Pushes that touch `api/` or `vercel.json` will trigger the workflow in `.github/workflows/deploy-api-vercel.yml`.

---

## Overriding the API URL

If your API is at a different URL (e.g. `https://my-project.vercel.app`), open the validator with:

`https://cyrilmolines.github.io/PHHE-training/validator/?api=https://my-project.vercel.app`

No trailing slash on the `api` value.
