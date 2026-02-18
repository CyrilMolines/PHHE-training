# Link Validator – production setup

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
