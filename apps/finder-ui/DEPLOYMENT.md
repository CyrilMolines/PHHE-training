## Deploying `who-training-finder-ui` to SharePoint (static files, no server)

### What this app does (scope)
- **Reads** training items from a SharePoint **list copy** using SharePoint REST (`/_api/...`) with the current user’s browser session (SSO cookies).
- Provides a **chat-like guided search** with:
  - Structured filters (language/modality/platform/audience)
  - Lexical ranking (BM25)
  - Optional client-side semantic embeddings (no external calls by default; see below)

### Prerequisites in SharePoint
- **Create a COPY list** (manual step; do not modify the production list):
  - Create a new list in the target site.
  - Import the CSV export you provided to populate it.
  - Note the list title (you will enter it in the app config).
- **Choose a document library folder** to host the static app files.
  - Example: `Site Assets/TrainingFinder/`
  - The folder must be readable by your users.

### Build the app locally
From `apps/finder-ui/`:

```bash
npm install

# Optional: generate a local demo dataset (from the provided CSV export in repo root)
npm run build:demo-data

npm run build
```

The static site output will be in `apps/finder-ui/dist/`.

### Upload to SharePoint
Upload the **contents** of `dist/` to your chosen SharePoint folder, preserving the structure:
- `index.html`
- `assets/` (JS/CSS chunks)
- any other files in `dist/` (e.g., `demo-trainings.json` if present)

### Open the app in SharePoint
Open the uploaded `index.html` from SharePoint (it will have a URL like):
- `.../SiteAssets/TrainingFinder/index.html`

Then click **Config** in the app and set:
- **Data source**: `SharePoint list (recommended)`
- **Site relative URL**: the site that contains the **COPY** list (example: `/sites/EuroWCPHE`)
- **List title**: the exact title of the **COPY** list

Click **Save**, then click **Refresh**.

### Add to the SharePoint landing page
Use one of these approaches:
- **Link**: Add a Quick Links web part entry pointing to the `index.html`.
- **Embed**: Add an Embed web part and embed the `index.html` URL (works in many tenants; if blocked by policy, fall back to a normal link).

### Optional: enable semantic embeddings locally (no external calls by default)
By default the app is configured to **not download models remotely**.

You have two options:
- **Option A (no remote downloads): host the model files in SharePoint**
  - Upload a compatible `all-MiniLM-L6-v2` model folder under the app’s `modelsBasePath` (default `./models`), so the runtime can load it from the same SharePoint location.
  - Keep **Allow remote model downloads** unchecked.
- **Option B (remote downloads allowed):** enable remote downloads
  - Check **Allow remote model downloads** in Config.
  - This may be blocked by policy/network and may increase external dependency surface.

If embeddings fail to load for any reason (CSP, missing files, blocked downloads), the app automatically falls back to lexical ranking.

### Troubleshooting
- **403/401 on `/_api/...` calls**
  - The current user likely lacks permissions on the COPY list, or the app is not hosted on the same SharePoint origin.
- **404 list not found**
  - Confirm the **site relative URL** and **list title** in Config match the COPY list exactly.
- **Results are empty / fields missing**
  - The UI expects the COPY list to contain these columns from the export:
    - `Learning Name`, `Description`, `Technical area`, `Focus area`, `Intended audience`, `Owner`, `Developer`, `Contact details`, `Language`, `Modality`, `Platform`, `Link`, `Comment`, `Sign-off status`.
  - If your COPY list internal field names differ from `field_2`, `field_3`, etc., update the mapping in `src/lib/sharepoint.ts` (`mapItemToCsvHeaderShape`).

