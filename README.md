# Homescreen

A personal productivity dashboard designed as a browser homepage for VC/startup founders and technologists. Consolidates information streams, quick-access tools, and AI-powered insights into a single elegant view.

Built with React 19, TypeScript, Vite, and Supabase.

## Why This Exists

Rather than switching between dozens of tabs and apps, everything surfaces on one homescreen. It's a command center for someone who values their attention and wants their browser start page to be genuinely useful.

## Features

### Quick Shortcuts
- Links to frequently used sites (Google, GitHub, Claude, etc.)
- App launchers (e.g., open Slack directly)
- Terminal commands (e.g., launch Claude Code in terminal)
- Fully customizable - add any URL, app, or shell command

### Notion-Integrated Todo System
- Bidirectional sync with a Notion database
- Filter by date range (today, week, month)
- Mark items complete directly from the homescreen
- Add new tasks that push to Notion
- Configurable task limit per view

### Multi-Source News Feed
Aggregates content from multiple sources:

| Source | Description |
|--------|-------------|
| Hacker News | Tech community discussions and launches |
| GitHub Trending | Trending repositories across languages |
| YC Companies | Y Combinator startup directory via YC-OSS API |
| ArXiv | AI/ML research papers (cs.AI, cs.LG, cs.CL, cs.CV, stat.ML) |
| RSS Feeds | TechCrunch, BetaKit (startup/VC news) |
| NewsAPI | General tech headlines (optional) |

**Filtering capabilities:**
- By source, date range (Today/Week/Month/Custom)
- Full-text search across titles and summaries
- Semantic search with vector embeddings (requires Supabase + OpenAI)
- By relevance score threshold
- By theme tags (multi-select)
- Star items for later reference (persisted to Supabase)

**Display options:**
- Sort by Recent or Top score
- Pagination with Load More
- Real-time updates via Supabase subscriptions

### AI-Powered Report Generation
Generate synthesized reports from feed items using OpenAI:
- **Daily Insights** - Executive summary, key trends, notable items, opportunities
- **Daily Update** - Newsletter-style briefing with top stories and quick hits
- **Custom Research** - Web search augmented deep-dive on any topic

Features:
- Customizable prompt templates
- Save custom presets
- Export reports to Notion
- Optional web search for deeper research

### Visual Customization
- **Shader Backgrounds** - Swirl and ChromaFlow WebGL animations with adjustable colors, speed, detail
- **Unsplash Integration** - Dynamic background images (replaces shader when enabled)
- **Full Color Theming** - Background, accent, text colors with live preview
- **Content Backdrop** - Adjustable opacity blur panel behind content
- **Section Visibility** - Toggle shortcuts, todos, feed sections on/off
- **Grain Overlay** - Subtle texture effect for depth

## Usage Workflow

**Morning Routine:**
1. Open browser to homescreen
2. Scan the time/date and personalized greeting
3. Quick-hit shortcuts for email, portfolio dashboards, or deal flow tools
4. Review todos synced from Notion (today's priorities)
5. Scan the aggregated feed for overnight developments
6. Generate a "Daily Insights" report for the team

**Throughout the Day:**
- Star interesting feed items for later
- Use keyboard shortcuts for quick access
- Quick-launch Claude Code for development tasks

**Research Mode:**
- Use "Custom Research" template with web search enabled
- Filter feed by themes relevant to a sector thesis
- Export curated insights to Notion for team sharing

## Quick Start

```bash
# Clone and install
git clone https://github.com/notjosh37/homescreenapp.git
cd homescreenapp
npm install

# Configure environment (optional)
cp .env.example .env
# Edit .env with your API keys

# Run dev server
npm run dev
```

Open http://localhost:5173

## Environment Variables

Create a `.env` file in the project root:

```env
# Supabase (recommended for full functionality)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional integrations
VITE_NOTION_API_KEY=ntn_xxx
VITE_NOTION_DATABASE_ID=xxx
VITE_NEWS_API_KEY=xxx
VITE_UNSPLASH_API_KEY=xxx
VITE_OPENAI_API_KEY=sk-xxx
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | No* | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | No* | Supabase anonymous key |
| `VITE_NOTION_API_KEY` | No | Notion integration API key |
| `VITE_NOTION_DATABASE_ID` | No | Notion database for todos |
| `VITE_NEWS_API_KEY` | No | NewsAPI.org key for headlines |
| `VITE_UNSPLASH_API_KEY` | No | Unsplash API for background images |
| `VITE_OPENAI_API_KEY` | No | OpenAI key for AI report generation |

*Without Supabase, the app falls back to client-side fetching (HN + RSS only).

### Supabase Edge Function Secrets

Set these in your Supabase dashboard under Project Settings > Edge Functions:

| Secret | Description |
|--------|-------------|
| `OPENAI_API_KEY` | For generating embeddings (semantic search) |
| `GITHUB_TOKEN` | For enriching GitHub trending repos with API data |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + Shift + S` | Open Settings |
| `Cmd + Shift` (hold) | Show refresh buttons |

## Configuration

### Settings Panel
Access via `Cmd + Shift + S` or the gear icon:

- **Shader**: Colors, speed, detail, effect type
- **Visibility**: Toggle sections on/off
- **Notion**: API keys and database IDs
- **Feed**: News sources and AI settings

### Config Export/Import
- Selective export by section
- API key protection warnings
- Preview before import
- Validation with error messages

## Notion Setup

### Todos Database
1. Create integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create database with columns:
   - `Name` (title)
   - `status` (status: Completed, Not Started, In Progress)
   - `Type` (select: Task, Bug, Feature, Idea)
3. Share database with your integration
4. Copy database ID from URL

### Insights Database
For feed aggregation:
- Same setup as todos
- Columns: Title, URL, Source, Date, Score, Themes, Company, Summary

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Build**: Vite 7
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Vector Search**: pgvector + OpenAI embeddings
- **Graphics**: WebGL shaders via `shaders` package
- **Styling**: CSS with custom properties
- **Font**: Domine (serif)
- **APIs**: Notion, NewsAPI, Unsplash, OpenAI, GitHub, ArXiv, YC-OSS

## Project Structure

```
src/
  App.tsx                    # Main component (state, logic, UI)
  App.css                    # All styles
  main.tsx                   # Entry point
  index.css                  # Base styles, font imports
  types/
    index.ts                 # TypeScript interfaces and defaults
  services/
    supabase.ts              # Supabase client and query helpers
  hooks/
    useFeed.ts               # Feed, search, and sources hooks
    useLocalStorage.ts       # localStorage sync hook
  components/
    FeedSection.tsx          # Feed component with Supabase integration
api/
  notion.ts                  # Vercel serverless function for Notion proxy
supabase/
  migrations/
    20241201000000_initial_schema.sql  # Database schema
  functions/
    _shared/                 # Shared utilities (CORS, Supabase client)
    fetch-hn/                # Hacker News fetcher
    fetch-github/            # GitHub Trending fetcher
    fetch-yc/                # YC Companies fetcher
    fetch-arxiv/             # ArXiv papers fetcher
    fetch-rss/               # RSS feed fetcher
    embed-content/           # OpenAI embedding generator
    search/                  # Hybrid semantic search
```

## Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Run the database migration:
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```

3. Deploy edge functions:
   ```bash
   supabase functions deploy
   ```

4. Set edge function secrets:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-xxx
   supabase secrets set GITHUB_TOKEN=ghp_xxx
   ```

5. Add environment variables to your `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Scheduled Fetching

Set up scheduled fetches using Supabase's pg_cron:

```sql
-- Fetch HN every 30 minutes
SELECT cron.schedule('fetch-hn', '*/30 * * * *',
  $$SELECT net.http_post(
    'https://your-project.supabase.co/functions/v1/fetch-hn',
    '{}',
    'application/json',
    ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_key'))]
  )$$
);
```

## Deployment

### Vercel (Recommended)

1. Connect repo to Vercel
2. Add environment variables in dashboard
3. Deploy

The `api/notion.ts` serverless function proxies Notion API requests to avoid CORS issues.

### Manual Build

```bash
npm run build
npm run preview
```

Output in `dist/` directory.

## Auto-Start (macOS)

The app can start automatically on login:

```bash
# Create Launch Agent
cat > ~/Library/LaunchAgents/com.homescreenapp.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.homescreenapp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>./node_modules/vite/bin/vite.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/homescreenapp</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load it
launchctl load ~/Library/LaunchAgents/com.homescreenapp.plist
```

## License

Private project.
