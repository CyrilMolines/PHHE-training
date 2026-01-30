# WHO Training Finder

AI-powered training search for WHO emergency trainings. Runs 100% in the browser with no server required.

## Features

- **Semantic Search**: Uses BGE-Small embeddings (~130MB) for meaning-based search
- **Conversational AI**: SmolLM-135M-Instruct (~270MB) for natural language responses  
- **Lexical Search**: BM25-based fallback when AI models are loading or unavailable
- **Intent Extraction**: Detects language, modality, platform, and audience preferences
- **Offline Support**: Data and models cached in browser after first load

## Model Sizes

| Model | Size | Purpose |
|-------|------|---------|
| BGE-Small-EN | ~130MB | Semantic embeddings |
| SmolLM-135M | ~270MB | Conversational AI |
| **Total** | **~400MB** | First download only |

Models are downloaded from HuggingFace Hub on first use and cached in IndexedDB.

## Building

```bash
cd apps/finder-ui
npm install
npm run build:demo-data  # Generate demo data from CSV
npm run build            # Build for production
```

## Deployment

The `dist/` folder (~25MB) can be deployed to any static hosting:

### GitHub Pages

```bash
# In dist folder
git init
git add .
git commit -m "Deploy"
git remote add origin https://github.com/YOUR_ORG/training-finder.git
git push -f origin main:gh-pages
```

### Cloudflare Pages / Netlify / Vercel

1. Connect your repository
2. Set build command: `npm run build`
3. Set output directory: `dist`

### Google Cloud Storage

```bash
gsutil -m cp -r dist/* gs://your-bucket/training-finder/
```

### Manual Upload

Upload contents of `dist/` folder to any web server.

## Configuration

Click "Settings" in the app to configure:

- **Data Source**: Demo JSON (default) or SharePoint list
- **Embedding Model**: MiniLM (~23MB), GTE-Small (~67MB), or BGE-Small (~130MB)
- **AI Assistant**: Enable/disable SmolLM for conversational responses
- **Remote Models**: Allow downloading from HuggingFace Hub

## Local Development

```bash
npm run dev   # Start dev server at http://localhost:5173
```

## SharePoint Integration

For SharePoint deployment, use the SPFx web part in `C:\dev\spfx-who\` which integrates directly with SharePoint lists.

## Browser Requirements

- Modern browser with WebAssembly support
- ~500MB free memory for AI models
- Chrome/Edge/Firefox/Safari (2023+)

## Architecture

```
src/
├── lib/
│   ├── embeddings.ts    # BGE/MiniLM embedding model
│   ├── chatModel.ts     # SmolLM conversational AI
│   ├── search.ts        # Lexical (BM25) search
│   ├── cache.ts         # IndexedDB caching
│   ├── config.ts        # App configuration
│   └── schema.ts        # Type definitions
└── ui/
    ├── App.tsx          # Main application
    └── styles.css       # Styling
```

## License

WHO Internal Use
