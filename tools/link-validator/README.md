# WHO PHHE Link Validator (Deep Content Check)

A Node.js script that performs **deep content validation** of training links - not just checking if URLs respond, but analyzing page content to detect if trainings are actually available.

## What it checks

### URL Level
- HTTP response codes (404, 500, etc.)
- Redirects (follows up to 5)
- Timeouts (15 second limit)
- SSL/TLS errors

### Content Level
- **Unavailable indicators**: "Video removed", "Page not found", "Course ended", etc.
- **Available indicators**: Video players, enrollment buttons, course content
- **Page quality**: Empty pages, error titles, minimal content
- **Platform-specific**: YouTube, Coursera, OpenWHO, Vimeo checks

## Usage

### Quick Start

```bash
cd tools/link-validator
node validate-links.js
```

This uses the default `demo-trainings.json` file.

### With Custom File

```bash
# JSON file
node validate-links.js path/to/trainings.json

# CSV file (exported from SharePoint)
node validate-links.js "path/to/WHO training list.csv"
```

### From Project Root

```bash
node tools/link-validator/validate-links.js "WHO Europe Humanitarian and Health Emergencies Training List.csv"
```

## Input Formats

### JSON
Standard format from the Training Finder app:
```json
[
  {
    "learningName": "Emergency Response Training",
    "normalizedLink": "https://example.com/training",
    "technicalArea": "Emergency"
  }
]
```

### CSV (SharePoint Export)
Direct export from SharePoint list with columns:
- Learning Name
- Link
- Technical Area
- etc.

## Output

### Console
Real-time progress with colored status indicators:
- ✓ Green = Working and verified
- ⚠ Yellow = Warning (potential issues)
- ✗ Red = Broken or unavailable

### Report File
`validation-report-YYYY-MM-DD.txt` - Human-readable report with:
- Summary statistics
- Detailed broken links list
- Warnings list
- Verified working links

### JSON Results
`validation-results-YYYY-MM-DD.json` - Machine-readable results for further processing

## Configuration

Edit `validate-links.js` to adjust:

```javascript
const CONFIG = {
  timeout: 15000,      // Request timeout (ms)
  concurrency: 5,      // Parallel requests
  retries: 2,          // Retry attempts for failures
  userAgent: "..."     // Browser user agent string
};
```

## Example Output

```
🔍 WHO PHHE Training Link Validator (Deep Content Check)

📂 Loading data from: demo-trainings.json
📊 Found 150 trainings with URLs

📋 Starting validation of 150 training links...

✓ [1/150] Introduction to Health Emergencies
✓ [2/150] Infection Prevention and Control
⚠ [3/150] Pandemic Preparedness Course
   └─ Found: "sign in to continue"
✗ [4/150] Old Emergency Training
   └─ Content appears unavailable
   └─ Found: "This course has ended"
...

┌─────────────────────────────────────┐
│           VALIDATION SUMMARY        │
├─────────────────────────────────────┤
│  ✓ Working:  142                    │
│  ⚠ Warnings:   5                    │
│  ✗ Broken:     3                    │
└─────────────────────────────────────┘
```

## Troubleshooting

### "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
Some sites have SSL issues. The script will report these as errors.

### Slow validation
Reduce `concurrency` if your network is slow, or increase `timeout` for slow servers.

### False positives
Some login-protected content may be flagged as warnings. Review the report manually.
