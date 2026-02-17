# WHO PHHE Training Tools - Quick Manual

## 1. Training Finder
**Find trainings by topic, type, or keywords**

https://cyrilmolines.github.io/PHHE-training/

Just type what you're looking for (e.g., "infection prevention online french")

---

## 2. Link Validator
**Check if training links are accessible**

https://cyrilmolines.github.io/PHHE-training/validator/

- Click **Start Validation** to check all links
- Click **Stop** to cancel at any time
- Click any stat box to filter results (Working, Broken, etc.)
- Click any row to expand and see full details
- Export report when done

> **Note:** Due to browser security (CORS), the validator checks basic connectivity only. Links that respond are marked as working.

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

## 3. Training Platform Search
**Search for trainings across multiple platforms**

https://cyrilmolines.github.io/PHHE-training/discovery/

1. Enter a search term (or use quick search buttons)
2. Click **Search** next to any platform to search with your query

**Available platforms:**
- OpenWHO, edX, Coursera, FutureLearn
- CDC TRAIN, FEMA, Kaya, UNHCR
- ReliefWeb, GOARN LMS, DisasterReady

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
   - Drag & drop your JSON file (any filename is fine; the site uses the **most recently committed** JSON)
   - Click **Commit changes**

4. **Done!** Changes go live in 1-2 minutes.

> **Note:** You need GitHub collaborator access to upload.

---

## Quick Reference

| Task | URL |
|------|-----|
| Search trainings | https://cyrilmolines.github.io/PHHE-training/ |
| Check links (quick) | https://cyrilmolines.github.io/PHHE-training/validator/ |
| Search other platforms | https://cyrilmolines.github.io/PHHE-training/discovery/ |
| Update training data | https://cyrilmolines.github.io/PHHE-training/export/ |

---

## For Administrators

### Add a collaborator to GitHub:
1. Go to https://github.com/CyrilMolines/PHHE-training/settings/access
2. Click **Add people**
3. Enter their GitHub username or email
4. Select **Write** role
5. They'll receive an email invitation
