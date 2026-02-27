# WHO Academy Coursewares Scraper

Fetches all trainings from [https://whoacademy.org/coursewares](https://whoacademy.org/coursewares) across all paginated pages (currently 19) and extracts metadata.

## Prerequisites

- Node.js 18+
- `npm install` in this folder

## Usage

```bash
cd scripts/who-academy-scraper
npm install
npm run scrape
```

## Authentication

WHO Academy may require login to view the full course catalog. If the scraper finds 0 courses:

1. **Option A**: Log in to whoacademy.org in a normal browser, then export your cookies (e.g. using a browser extension like "EditThisCookie" or "Cookie-Editor") to a JSON file. Use `--cookies cookies.json` to load them.

2. **Option B**: Contact WHO Academy to request API access or a data export for the course catalog.

## Options

- `--dry-run` — Fetch only the first page (for testing)
- `--max-pages N` — Limit to N pages (default: 99)
- `--out FILE` — Output JSON path (default: `who-academy-coursewares.json`)
- `--cookies FILE` — Load cookies from JSON file (for authenticated access)
- `--debug` — Dump page info (for debugging)

## Output

Creates `who-academy-coursewares.json` with:

```json
{
  "meta": { "source": "...", "scrapedAt": "...", "totalCourses": N },
  "courses": [
    {
      "title": "Course name",
      "link": "https://whoacademy.org/coursewares/course-v1:...",
      "normalizedLink": "https://...?source=edX",
      "description": "...",
      "platform": "WHO Academy",
      "source": "whoacademy.org",
      "page": 1
    }
  ]
}
```

## Note

The scraper uses Puppeteer to render the SPA. If the page structure changes, the DOM selectors in `scrape.js` may need updating. Run with `--dry-run` first to verify extraction.
