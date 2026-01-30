# WHO PHHE Training Tools - Quick Manual

## 1. Training Finder (Web)
**Find trainings by topic, type, or keywords**

🔗 https://cyrilmolines.github.io/PHHE-training/

Just type what you're looking for (e.g., "infection prevention online french")

---

## 2. Link Validator (Command Line)
**Check if training links are broken**

```bash
cd tools/link-validator
node validate-links.js
```

**Results:**
- ✓ Open & working - publicly accessible
- 🔐 Login required - works but needs auth (NOT broken)
- 👤 In-person - no URL needed
- ✗ Broken - needs attention

**Reports saved to:** `tools/link-validator/validation-report-YYYY-MM-DD.txt`

---

## 3. Data Export (Web)
**Convert SharePoint CSV to JSON format**

🔗 https://cyrilmolines.github.io/PHHE-training/export/

1. Export CSV from SharePoint list
2. Upload to Data Export tool
3. Download `demo-trainings.json`
4. Upload to GitHub

---

## 4. Sync Training Data (Batch File)
**Guided workflow to update training data**

```
Double-click: tools\sharepoint-sync\sync-training-data.bat
```

Opens 3 windows in sequence:
1. SharePoint list → Export CSV
2. Data Export tool → Convert to JSON
3. GitHub → Upload file

---

## 5. Training Discovery (Web)
**Find potential new trainings**

🔗 https://cyrilmolines.github.io/PHHE-training/discovery/

- Check if a URL is already in the list
- See known training sources
- Export new finds for review

---

## Quick Reference

| Task | Tool | How |
|------|------|-----|
| Search trainings | Finder | Open web link |
| Check broken links | Validator | Run `node validate-links.js` |
| Update training data | Sync | Run `sync-training-data.bat` |
| Convert CSV to JSON | Export | Open web link, upload CSV |
| Find new trainings | Discovery | Open web link |

---

## File Locations

```
Training-Hub/
├── tools/
│   ├── link-validator/
│   │   └── validate-links.js      # Link checker script
│   └── sharepoint-sync/
│       └── sync-training-data.bat # Sync helper
└── apps/finder-ui/
    └── public/
        └── demo-trainings.json    # Training data
```

---

## URLs Summary

- **Finder**: https://cyrilmolines.github.io/PHHE-training/
- **Validator**: https://cyrilmolines.github.io/PHHE-training/validator/
- **Discovery**: https://cyrilmolines.github.io/PHHE-training/discovery/
- **Export**: https://cyrilmolines.github.io/PHHE-training/export/
