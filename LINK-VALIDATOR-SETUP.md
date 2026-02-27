# Link Validator – production setup

## User guide

- **Run a check:** Open the [validator](https://cyrilmolines.github.io/PHHE-training/validator/), load your data (demo or SharePoint), then click **Validate links**. Results show status (Working, Broken, Redirected, etc.) and response time.
- **Filter:** Click a stat (e.g. **Broken**) to show only those rows; click **✕ Clear** to show all again.
- **Error hints:** Expand a row (click the row or the expand icon) to see details. For known errors (e.g. 301, 302, 404, timeout), a **Hint** line explains the meaning (e.g. “Permanent redirect. The resource has a new URL; clients should use it from now on.”).
- **Group by error:** Use **Sort: Default** to keep the original order, or **Group by error** to sort results so the same error type appears together (e.g. all “301 Moved Permanently” in one block). Helps when fixing many links of the same kind.
- **Export:** Use **Export report** to download a text summary of the run.

## Live URLs

| What | URL |
|------|-----|
| **Link Validator** | https://cyrilmolines.github.io/PHHE-training/validator/ |
| **Link-check API** | https://phhe-link.vercel.app/ |
| **API endpoint** | https://phhe-link.vercel.app/api/check-link?url=... |

The validator calls the API by default. To use a different API: add `?api=https://your-api.vercel.app` to the validator URL.

## Vercel (API)

- **Project:** phhe-link  
- **Repo:** CyrilMolines/PHHE-training, branch **main**  
- **Root Directory:** empty  
- **Output Directory:** empty  
- **vercel.json:** rewrites only (`/` → `/api/root`); `api/` is auto-detected.

See **api/README.md** and **api/TROUBLESHOOT-VERCEL.md** for deploy and 404 fixes.

## GitHub Pages (Validator UI)

The validator is served from the **gh-pages** branch (built from `dist-embed` in the Training-Hub repo). To change the default API URL, set `DEFAULT_LINK_CHECK_API` in `apps/finder-ui/src/ui/LinkValidator.tsx` to `https://phhe-link.vercel.app`, then rebuild and redeploy `dist-embed` to gh-pages.

### Validator UI (technical)

- **Error hints:** The UI shows a short explanation (hint) next to each known error in the expanded row. Hints are defined for: 301, 302, 303, 304, 305, 307, 308, Not Found (404), and Timeout (>12s). Implemented via `ERROR_HINTS` in the validator bundle; the hint row is rendered when `ERROR_HINTS[error]` exists.
- **Sort / group by error:** Results can be shown in **Default** order (same as check order) or **Group by error** (sorted by status then error string so identical errors are grouped). Sort state is `sortBy` (`"default"` | `"byError"`); the displayed list is the filtered array, optionally sorted with `(status||"").localeCompare(...)` and `(error||"").localeCompare(...)` before mapping.
