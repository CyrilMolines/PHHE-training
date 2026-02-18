# Delete Vercel project and start over

## Option A: Delete in the browser

1. Open your project on Vercel → **Settings** → **General**.
2. Scroll to the bottom (Danger Zone).
3. Click **Delete** and confirm.

## Option B: Delete via API

1. Get a token: **https://vercel.com/account/tokens** → Create → copy token.
2. In PowerShell (replace `YOUR_TOKEN` and `YOUR_PROJECT_NAME`):

```powershell
$env:VERCEL_TOKEN = "YOUR_TOKEN"
Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/YOUR_PROJECT_NAME" -Method Delete -Headers @{ "Authorization" = "Bearer $env:VERCEL_TOKEN" }
```

## Create a new project (after delete)

1. Open **https://vercel.com/new**
2. **Import** → **CyrilMolines/PHHE-training**
3. **Project Name:** `phhe-link` (or another available name)
4. **Root Directory:** leave **empty**
5. **Output Directory:** leave **empty**
6. **Framework Preset:** **Other**
7. **Build Command:** leave **empty**
8. Click **Deploy**

After deploy (1–2 min), check:

- https://phhe-link.vercel.app/
- https://phhe-link.vercel.app/api/check-link?url=https://example.com
