# WHO PHHE SharePoint to GitHub Sync

One-command sync of the training list from SharePoint to GitHub Pages.

## What it does

1. **Authenticates** to Microsoft 365 (your WHO account)
2. **Fetches** the training list from SharePoint
3. **Converts** to the JSON format used by the Training Finder
4. **Pushes** directly to GitHub

No manual CSV export, no file conversion, no manual upload!

## Usage

```bash
cd tools/sharepoint-sync
node sync-to-github.js
```

Or from the project root:
```bash
node tools/sharepoint-sync/sync-to-github.js
```

## First Run - Authentication

On first run, you'll see:

```
🔐 Authentication required

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Open: https://microsoft.com/devicelogin
  2. Enter code: ABCD1234
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

1. Open the URL in your browser
2. Enter the code shown
3. Sign in with your WHO account
4. Approve the permissions

The token is cached locally (`.token-cache.json`) so you won't need to re-authenticate every time.

## Subsequent Runs

After initial authentication, the script runs automatically:

```
🔄 WHO PHHE SharePoint → GitHub Sync

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Source: worldhealthorg.sharepoint.com/sites/EuroWCPHE
  List:   Copytraininglist2912026
  Target: github.com/CyrilMolines/PHHE-training
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Using cached access token
📥 Fetching SharePoint list...
   Found 159 training records

🔄 Transforming data...
   Saved to: apps/finder-ui/public/demo-trainings.json

📤 Pushing to GitHub...
✓ Successfully pushed to GitHub!
  Changes will be live at https://cyrilmolines.github.io/PHHE-training/ in ~2 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        SYNC COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ 159 trainings exported
  ✓ Pushed to GitHub
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Configuration

Edit `sync-to-github.js` to change:

```javascript
const CONFIG = {
  sharepoint: {
    sitePath: "/sites/EuroWCPHE",
    listTitle: "Copytraininglist2912026"  // Change to production list
  },
  github: {
    repo: "CyrilMolines/PHHE-training"
  }
};
```

## Workflow

When you update trainings in SharePoint:

1. Make your changes in SharePoint
2. Run: `node sync-to-github.js`
3. Done! Changes live in ~2 minutes

## Security

- Uses **device code flow** (secure, no passwords stored)
- Token cached locally (refresh token valid for ~90 days)
- Only reads SharePoint list data
- Uses your existing WHO account permissions

## Troubleshooting

### "Token refresh failed"
Delete `.token-cache.json` and re-authenticate.

### "List not found"
Check the `listTitle` in config matches exactly.

### "Git push failed"
Make sure you have git credentials configured for GitHub.
