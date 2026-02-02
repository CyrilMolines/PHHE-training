# WHO PHHE Training Tools - Quick Manual

## 1. Training Finder
**Find trainings by topic, type, or keywords**

https://cyrilmolines.github.io/PHHE-training/

Just type what you're looking for (e.g., "infection prevention online french")

---

## 2. Link Validator

### Web Version (Quick Check)
https://cyrilmolines.github.io/PHHE-training/validator/

- Click **Start Validation** to check all links
- Click **Stop** to cancel at any time
- Click any stat box to filter results (Working, Broken, etc.)
- Click any row to expand and see full details
- Export report when done

> **Note:** Web version does basic reachability checks only. For accurate deep validation, use the command-line version.

### Command-Line Version (Deep Validation)
```bash
cd tools/link-validator
node validate-links.js
```

This version analyzes actual page content to detect:
- 404 error pages
- Login/registration requirements
- Archived or removed courses
- Empty or error pages

**Status icons:**
| Icon | Meaning |
|------|---------|
| ✓ | Working - publicly accessible |
| 🔐 | Login required - works but needs auth |
| 👤 | In-person - no URL needed |
| 🔀 | Blended - hybrid training |
| ⚠ | Warning - needs review |
| ✗ | Broken - needs attention |

---

## 3. Training Discovery
**Search for new trainings across multiple platforms**

https://cyrilmolines.github.io/PHHE-training/discovery/

- Enter a search term (default: "public health emergency")
- Click **Search All Sources** to open searches on all platforms
- Or click **Search** next to individual platforms
- Compare found trainings against your existing list

**Platforms searched:**
- OpenWHO, edX, Coursera, FutureLearn
- CDC TRAIN, FEMA, Kaya, UNHCR
- ReliefWeb, GOARN LMS

---

## 4. Update Training Data
**When the SharePoint list changes, update the tools:**

https://cyrilmolines.github.io/PHHE-training/export/

### Steps:
1. **Export from SharePoint**
   - Go to your SharePoint list
   - Click **Export** → **Export to CSV**

2. **Convert to JSON**
   - Go to the Export tool (link above)
   - Upload your CSV file
   - Click **Process CSV**
   - Click **Download demo-trainings.json**

3. **Upload to GitHub**
   - Click **Open GitHub Upload Page**
   - Drag & drop `demo-trainings.json`
   - Click **Commit changes**

4. **Done!** Changes go live in 1-2 minutes.

> **Note:** You need GitHub collaborator access to upload.

---

## Quick Reference

| Task | URL |
|------|-----|
| Search trainings | https://cyrilmolines.github.io/PHHE-training/ |
| Check links (quick) | https://cyrilmolines.github.io/PHHE-training/validator/ |
| Find new trainings | https://cyrilmolines.github.io/PHHE-training/discovery/ |
| Update training data | https://cyrilmolines.github.io/PHHE-training/export/ |

---

## For Administrators

### Add a collaborator to GitHub:
1. Go to https://github.com/CyrilMolines/PHHE-training/settings/access
2. Click **Add people**
3. Enter their GitHub username or email
4. Select **Write** role
5. They'll receive an email invitation

### Run deep link validation:
```bash
cd tools/link-validator
node validate-links.js
```

### Batch file for data sync:
```bash
cd tools/sharepoint-sync
sync-training-data.bat
```
