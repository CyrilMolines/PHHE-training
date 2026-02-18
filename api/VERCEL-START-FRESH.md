# Delete Vercel project and start over

## Option A: Delete in the browser (you’re on the right page)

The browser should be on **your project → Settings → General**.

1. **Scroll to the bottom** of the page (Danger Zone).
2. Click **“Delete”** (or “Remove Project” / “Delete Project”).
3. Confirm when asked (e.g. type the project name).
4. Then go to **Option B** to create a new project.

## Option B: Delete via API (then create in browser)

1. Get a token: **https://vercel.com/account/tokens** → Create → copy token.
2. In PowerShell run (replace `YOUR_TOKEN` with your token):

```powershell
$env:VERCEL_TOKEN = "YOUR_TOKEN"
Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/YOUR_PROJECT_NAME" -Method Delete -Headers @{ "Authorization" = "Bearer $env:VERCEL_TOKEN" }
```

3. Then create the new project (see below).

## Create the new project (after delete)

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
