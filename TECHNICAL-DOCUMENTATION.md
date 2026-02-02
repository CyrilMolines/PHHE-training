# WHO PHHE Training Platform - Technical Documentation

## Overview

The WHO PHHE Training Platform is a suite of web-based tools for managing and discovering health emergency training resources. The platform is designed to work without server-side infrastructure, using client-side processing and static hosting.

### Key Features
- **Training Finder**: Fast lexical search with fuzzy matching
- **Link Validator**: Automated broken link detection (web + Node.js)
- **Training Platform Search**: Multi-platform search launcher
- **Data Export**: SharePoint CSV to JSON converter

### Architecture Principles
- No server-side processing required
- Runs entirely in the browser
- Hosted on GitHub Pages (free static hosting)
- Data sourced from SharePoint list or static JSON

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GitHub Pages                                   │
│  https://cyrilmolines.github.io/PHHE-training/                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Training   │  │    Link      │  │   Platform   │  │    Data      │ │
│  │   Finder     │  │  Validator   │  │   Search     │  │   Export     │ │
│  │   /          │  │  /validator/ │  │  /discovery/ │  │   /export/   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         ▼                 ▼                 ▼                 ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                     demo-trainings.json                             ││
│  │                     (Static training data)                          ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| UI Framework | Preact | Lightweight React alternative (3KB) |
| Build Tool | Vite | Fast development and production builds |
| Language | TypeScript | Type-safe JavaScript |
| Styling | CSS | Custom styles with WHO branding |

### Hosting
| Service | Purpose |
|---------|---------|
| GitHub Pages | Static site hosting (free) |
| GitHub Repository | Source code and deployment |

### Data Sources
| Source | Format | Usage |
|--------|--------|-------|
| SharePoint List | JSON via REST API | Live data (when embedded) |
| demo-trainings.json | Static JSON | GitHub Pages fallback |
| CSV Export | CSV | Manual data updates |

---

## Project Structure

```
Training-Hub/
├── apps/
│   └── finder-ui/                    # Main application
│       ├── src/
│       │   ├── lib/
│       │   │   ├── schema.ts         # TrainingRecord interface
│       │   │   ├── search.ts         # BM25 lexical search
│       │   │   ├── embeddings.ts     # Semantic embeddings (AI)
│       │   │   ├── chatModel.ts      # SmolLM chat model
│       │   │   ├── demo.ts           # Demo data loader
│       │   │   ├── sharepoint.ts     # SharePoint REST API
│       │   │   └── config.ts         # Configuration
│       │   └── ui/
│       │       ├── AppEmbed.tsx      # Training Finder UI
│       │       ├── LinkValidator.tsx # Link Validator UI
│       │       ├── TrainingDiscovery.tsx # Discovery UI
│       │       ├── DataExport.tsx    # Export UI
│       │       └── styles-*.css      # Component styles
│       ├── public/
│       │   └── demo-trainings.json   # Static training data
│       └── vite.config.*.ts          # Build configurations
│
├── TOOLS-MANUAL.md                   # User documentation
└── TECHNICAL-DOCUMENTATION.md        # This file
```

---

## Component Details

### 1. Training Finder (`AppEmbed.tsx`)

**Purpose**: Search and filter trainings using natural language queries.

**Features**:
- Lexical search (BM25 algorithm) for keyword matching
- Fuzzy matching for typo tolerance
- Filter by modality, language, platform
- Expandable result cards with full details

**Search Algorithm**:
```
User Query → Extract Intent → Apply Filters → BM25 Score → Rank Results
```

**Key Functions**:
- `runSearch(query)`: Main search entry point
- `fallbackExtractIntent(query)`: Parse query into topic and filters
- `bm25Score()`: Calculate relevance scores

**Configuration** (hardcoded for static deployment):
```typescript
const CONFIG = {
  dataSource: "demo_json",  // or "sharepoint"
  searchMode: "fast"        // Lexical search only
};
```

### 2. Link Validator (`LinkValidator.tsx`)

**Purpose**: Check if training URLs are accessible.

**Browser Version Limitations**:
- CORS prevents fetching external page content
- Can only verify basic connectivity (opaque responses)
- Treats network errors as "OK (assumed working)"

**Status Categories**:
| Status | Description |
|--------|-------------|
| ok | URL responded successfully |
| auth_required | Requires login/registration |
| in_person | In-person training, no URL needed |
| blended | Hybrid training, URL may vary |
| warning | Missing URL for online training |
| error | Broken or timeout |

**Key Functions**:
- `checkLink(url)`: Fetch URL with no-cors mode
- `isInPersonTraining(record)`: Check modality field
- `isBlendedTraining(record)`: Check for hybrid modality
- `startValidation()`: Process all records sequentially

### 3. Training Platform Search (`TrainingDiscovery.tsx`)

**Purpose**: Search launcher for external training platforms.

**Features**:
- Configurable search query input
- Quick search keyword buttons
- Opens individual platform search pages with query

**How it works**:
1. User enters search query
2. User clicks "Search" on desired platform
3. Platform's search page opens in new tab with query pre-filled

**Configured Sources**:
| Platform | Search URL Pattern |
|----------|-------------------|
| OpenWHO | `https://openwho.org/esearch/search?keyword=` |
| edX | `https://www.edx.org/search?tab=Course&productType=Course&q=` |
| Coursera | `https://www.coursera.org/search?query=` |
| FutureLearn | `https://www.futurelearn.com/search?q=` |
| CDC TRAIN | `https://www.train.org/cdctrain/search?query=` |
| FEMA | `https://training.fema.gov/is/searchis.aspx?search=` |
| Kaya | `https://kayaconnect.org/course/search.php?q=` |
| UNHCR | `https://www.unhcr.org/search?search=` |
| ReliefWeb | `https://reliefweb.int/training?search=` |
| DisasterReady | Browse only (no search URL) |
| GOARN LMS | Browse only (login required) |

### 4. Data Export (`DataExport.tsx`)

**Purpose**: Convert SharePoint CSV export to JSON format.

**Workflow**:
1. User exports CSV from SharePoint
2. Upload CSV to web tool
3. Tool parses and transforms data
4. Download `demo-trainings.json`
5. Upload to GitHub Pages

**Field Mapping**:
| SharePoint Column | JSON Field |
|-------------------|------------|
| Learning Name | learningName |
| Link / URL | normalizedLink |
| Technical Area | technicalArea |
| Modality | modality, modalityRaw |
| Language | language |
| Platform | platform |
| Description | description |

---

## Data Schema

### TrainingRecord Interface

```typescript
interface TrainingRecord {
  id: string;
  learningName: string;
  description: string;
  normalizedLink: string;
  technicalArea: string;
  focusArea: string;
  modality: string;
  modalityRaw: string;
  language: string;
  platform: string;
  owner: string;
  developer: string;
  intendedAudience: string;
  contactDetails: string;
}
```

---

## Deployment

### GitHub Pages Configuration
- **Source Branch**: `gh-pages`
- **Build Output**: `dist-embed/`
- **Domain**: `cyrilmolines.github.io/PHHE-training`

### Build Commands
```bash
cd apps/finder-ui

# Build individual tools
npm run build:embed      # Training Finder
npm run build:validator  # Link Validator
npm run build:discovery  # Training Discovery
npm run build:export     # Data Export
```

### Deployment Script
```powershell
# Build all tools
npm run build:embed
npm run build:validator
npm run build:discovery
npm run build:export

# Assemble dist-embed folder
# Copy outputs to dist-embed/, dist-embed/validator/, etc.
# Copy demo-trainings.json to each subfolder

# Deploy to GitHub Pages
cd dist-embed
git init
git checkout -b gh-pages
git add -A
git commit -m "Deploy"
git remote add origin https://github.com/CyrilMolines/PHHE-training.git
git push -f origin gh-pages
```

---

## URL Parameters

The tools support URL parameters for configuration:

| Parameter | Values | Description |
|-----------|--------|-------------|
| `mode` | `demo`, `sharepoint` | Force data source |
| `site` | `/sites/EuroWCPHE` | SharePoint site path |
| `list` | `Copytraininglist2912026` | SharePoint list name |

**Examples**:
```
/validator/?mode=demo              # Use demo JSON
/validator/?mode=sharepoint        # Force SharePoint
/?site=/sites/MySite&list=MyList   # Custom SharePoint location
```

---

## Security Considerations

### CORS (Cross-Origin Resource Sharing)
- Browser cannot fetch external site content for analysis
- `no-cors` mode only verifies basic connectivity
- Link Validator treats CORS errors as "OK (assumed working)"

### SharePoint Authentication
- REST API requires same-origin or authenticated requests
- When embedded in SharePoint, uses SSO automatically
- GitHub Pages deployment uses static JSON fallback

---

## Troubleshooting

### "Error loading data" on GitHub Pages
- **Cause**: Defaulted to SharePoint mode without authentication
- **Fix**: URL parameters auto-detect; ensure `demo_json` mode for GitHub Pages

### Link Validator shows all links as "Working"
- **Cause**: CORS prevents deep content analysis in browser
- **Note**: Browser validator can only check basic connectivity, not page content

### Training Finder is slow
- **Cause**: AI models loading
- **Fix**: Fast mode (lexical search) is default; AI models disabled

### Changes not appearing after GitHub upload
- **Cause**: Browser cache or CDN delay
- **Fix**: Hard refresh (Ctrl+Shift+R) or wait 2-3 minutes

---

## Maintenance

### Updating Training Data
1. Export CSV from SharePoint
2. Use Data Export tool to convert
3. Upload `demo-trainings.json` to GitHub `gh-pages` branch

### Adding New Training Sources (Platform Search)
Edit `apps/finder-ui/src/ui/TrainingDiscovery.tsx`:
```typescript
const TRAINING_SOURCES = [
  { 
    name: "New Platform",
    url: "https://example.com/courses",      // Homepage URL
    category: "Category",                     // WHO, MOOC, UN, etc.
    searchUrl: "https://example.com/search?q=", // Optional search URL
    description: "Brief description"
  },
  // ...
];
```
Note: `searchUrl` is optional. If not provided, only "Open" button appears.

---

## Contact

For technical support or contributions, contact the WHO PHHE team.

**Repository**: https://github.com/CyrilMolines/PHHE-training
