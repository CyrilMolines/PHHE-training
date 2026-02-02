# WHO PHHE Training Tools - Quick Manual

## 1. Training Finder
**Find trainings by topic, type, or keywords**

https://cyrilmolines.github.io/PHHE-training/

Just type what you're looking for (e.g., "infection prevention online french")

---

## 2. Link Validator (Web)
**Check if training links are broken**

https://cyrilmolines.github.io/PHHE-training/validator/

- Click **Start Validation** to check all links
- Click **Stop** to cancel at any time
- Click any row to see full details
- Export report when done

**Status icons:**
| Icon | Meaning |
|------|---------|
| ✓ | Working - publicly accessible |
| 🔐 | Login required - works but needs auth |
| 👤 | In-person - no URL needed |
| ⚠ | Warning - online training without URL |
| ✗ | Broken - needs attention |

---

## 3. Update Training Data
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
   - Click **Open GitHub Upload Page** (or go to: https://github.com/CyrilMolines/PHHE-training/upload/gh-pages)
   - Drag & drop `demo-trainings.json`
   - Click **Commit changes**

4. **Done!** Changes go live in 1-2 minutes.

> **Note:** You need GitHub collaborator access to upload. Contact the administrator if you don't have access.

---

## 4. Training Discovery
**Find potential new trainings to add**

https://cyrilmolines.github.io/PHHE-training/discovery/

- Check if a URL is already in the list
- See known training sources
- Export new finds for review

---

## Quick Reference

| Task | URL |
|------|-----|
| Search trainings | https://cyrilmolines.github.io/PHHE-training/ |
| Check broken links | https://cyrilmolines.github.io/PHHE-training/validator/ |
| Update training data | https://cyrilmolines.github.io/PHHE-training/export/ |
| Find new trainings | https://cyrilmolines.github.io/PHHE-training/discovery/ |

---

## For Administrators

### Add a collaborator to GitHub:
1. Go to https://github.com/CyrilMolines/PHHE-training/settings/access
2. Click **Add people**
3. Enter their GitHub username or email
4. Select **Write** role
5. They'll receive an email invitation

### Deep link validation (command line):
```bash
cd tools/link-validator
node validate-links.js
```
This checks actual page content, not just URL response.
