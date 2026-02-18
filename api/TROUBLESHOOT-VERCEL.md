# Vercel 404 troubleshooting (phhe-link)

If **https://phhe-link.vercel.app/** or **/api/check-link** return **404: NOT_FOUND**, fix the project settings in the Vercel dashboard.

## 1. Output Directory (most common cause)

**Vercel → phhe-link → Settings → General → Build & Development Settings**

- **Output Directory** must be **empty** (or not set).
- If it is set (e.g. `dist-embed`, `dist`, `out`), Vercel serves **only** that folder. The `api/` folder and serverless functions are then **not** part of the deployment, so every URL returns 404.
- **Fix:** Clear the field and save. Then **Redeploy** (Deployments → ⋯ on latest → Redeploy).

## 2. Root Directory

**Same page: Build & Development Settings**

- **Root Directory** must be **empty** (or `.`) so the repo **root** is used (where `api/`, `vercel.json`, `index.html` live).
- If it is set to a subfolder (e.g. `apps/finder-ui`), `api/` and `vercel.json` are never seen.
- **Fix:** Clear the field and save. Then **Redeploy**.

## 3. Framework preset

**Same page**

- If **Framework Preset** is set to something that expects an output directory (e.g. Vite, Next.js), clear it or set to **Other** so Vercel does not override behaviour.
- **Fix:** Set to **Other** (or leave as detected). Then **Redeploy**.

## 4. Confirm repo content

The connected repo (**CyrilMolines/PHHE-training**) branch **main** must have at root:

- `api/check-link.js`
- `api/root.js`
- `vercel.json`
- `index.html`

Check: https://github.com/CyrilMolines/PHHE-training/tree/main

## 5. After changing settings

1. Save the settings.
2. Go to **Deployments**.
3. Open **⋯** on the latest deployment → **Redeploy** (use same commit).
4. Wait 1–2 minutes, then try:
   - https://phhe-link.vercel.app/
   - https://phhe-link.vercel.app/api/check-link?url=https://example.com

## 6. Build and runtime logs

If it still 404s:

- **Deployments** → open the latest deployment → **Building** / **Logs**: check for errors.
- **Logs** (runtime): check for errors when you open the URL.

If the build uses a custom **Build Command** that only builds a frontend (e.g. `npm run build` outputting to `dist-embed`), that can leave the deployment with only that output. Remove the Build Command so Vercel uses the repo as-is and deploys `api/` from `vercel.json`.
