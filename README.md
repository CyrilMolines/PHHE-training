# WHO PHHE Training Hub

Tools for discovering, validating, and managing public health emergency (PHHE) training resources.

## Live Site

| Tool | URL |
|------|-----|
| **Training Finder** | https://cyrilmolines.github.io/PHHE-training/ |
| **Link Validator** | https://cyrilmolines.github.io/PHHE-training/validator/ |
| **Training Platform Search** | https://cyrilmolines.github.io/PHHE-training/discovery/ |
| **Data Export** | https://cyrilmolines.github.io/PHHE-training/export/ |

---

## Tools Overview

### 1. Training Finder
Search trainings by topic, type, or keywords. Uses a JSON catalog (`demo-trainings.json`) with metadata: learning name, description, technical area, platform, languages, modality, links, etc. On GitHub Pages, it loads the **most recently committed** JSON file in the repo root.

### 2. Link Validator
Check if training URLs are accessible and detect broken links (e.g. 404). Uses a serverless link-check API for full HTTP status detection. Features:
- **Start Validation** / **Stop**
- Filter by status (Working, Broken, In-person, Blended, Warnings)
- Export report
- Error hints for redirects, 404, timeouts

**API:** The validator calls a link-check API by default. Deploy the `api/` folder to Vercel for production use. See [api/README.md](api/README.md).

### 3. Training Platform Search (Discovery)
Search across external training platforms with a single query. Opens each platform in a new tab with the search term applied. Platforms include:
- OpenWHO, WHO Academy, GOARN LMS
- edX, Coursera, FutureLearn
- CDC TRAIN, FEMA, DisasterReady, Kaya, UNHCR, ReliefWeb Training

### 4. Data Export
Convert SharePoint CSV exports to the JSON format used by the Training Finder. Steps:
1. Export list from SharePoint → CSV
2. Upload CSV in the Export tool
3. Process and download `demo-trainings.json`
4. Upload to GitHub `gh-pages` branch (any filename; latest by commit date is used)

---

## Project Structure

```
├── api/                    # Link-check serverless API (Vercel)
├── discovery/              # Training Platform Search (built)
├── dist-embed/             # Assembled build for GitHub Pages deployment
├── export/                 # Data Export tool (built)
├── validator/              # Link Validator (built)
├── demo-trainings.json     # Sample training catalog
├── embed.html              # Training Finder embed shell
├── index.html              # API landing (when deployed to Vercel)
├── vercel.json             # Vercel config (API routes)
├── scripts/
│   ├── deploy-api-vercel.ps1
│   └── who-academy-scraper/   # Scrape WHO Academy coursewares
└── apps/
    ├── finder-ui/          # Source for embed, validator, discovery, export
    └── spfx-training-finder/  # SharePoint Framework app (optional)
```

---

## Scripts

### WHO Academy Scraper
Fetches all coursewares from [whoacademy.org/coursewares](https://whoacademy.org/coursewares) across paginated pages and extracts metadata.

```bash
cd scripts/who-academy-scraper
npm install
npm run scrape
```

Options: `--dry-run`, `--max-pages N`, `--out FILE`, `--cookies FILE`. See [scripts/who-academy-scraper/README.md](scripts/who-academy-scraper/README.md).

---

## Deployment

### Link-check API (Vercel)
Deploy the API for the Link Validator:

```bash
# One-time: npx vercel login
.\scripts\deploy-api-vercel.ps1
```

Or via [Vercel dashboard](https://vercel.com/new): import the repo, leave Root/Output directories empty, deploy. See [api/README.md](api/README.md) and [api/TROUBLESHOOT-VERCEL.md](api/TROUBLESHOOT-VERCEL.md).

### UI (GitHub Pages)
The live site is built from `dist-embed/` and deployed to the `gh-pages` branch of the PHHE-training repo. To update:

1. Build from `apps/finder-ui`: `build:embed`, `build:validator`, `build:discovery`, `build:export`
2. Assemble into `dist-embed/` (copy validator, discovery, export; add `index.html` copies; add `demo-trainings.json`)
3. From `dist-embed`: `git add -A`, `git commit`, `git push origin main:gh-pages`

See [LINK-VALIDATOR-SETUP.md](LINK-VALIDATOR-SETUP.md) for validator-specific details.

---

## Configuration

| Parameter | Description |
|-----------|-------------|
| `mode` | `demo` or `sharepoint` – force data source |
| `site` | SharePoint site path (e.g. `/sites/EuroWCPHE`) |
| `list` | SharePoint list name |
| `api` | Link-check API base URL (validator only; override default) |

Example: `/validator/?mode=demo&api=https://your-api.vercel.app`

---

## Documentation

- [LINK-VALIDATOR-SETUP.md](LINK-VALIDATOR-SETUP.md) – Link Validator production setup and user guide
- [api/README.md](api/README.md) – Link-check API deploy and usage
- [api/TROUBLESHOOT-VERCEL.md](api/TROUBLESHOOT-VERCEL.md) – Vercel 404 and deploy fixes

---

## License

Internal use. Contact repository maintainers for licensing questions.
