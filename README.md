# Homescreen

A personal dashboard with animated shader backgrounds, task management, and multi-source news aggregation. Built with React 19 and Vite.

## Features

### Animated Backgrounds
- **Shader Effects**: Swirl and ChromaFlow WebGL animations
- **Customizable Colors**: Background, accent, and text colors
- **Unsplash Integration**: Dynamic background images
- **Grain Overlay**: Subtle texture effect for depth

### Task Management
- Local storage persistence
- Notion database sync (optional)
- Filter by status and type
- Sort by date, name, or status
- Configurable task limit per view

### News Feed
Multi-source aggregation with n8n pipeline integration:

| Source | Description |
|--------|-------------|
| HN | Hacker News top stories |
| News | NewsAPI headlines |
| PH | Product Hunt launches |
| RSS | BetaKit, TechCrunch feeds |

**Filtering:**
- Date range: Today, Week, Month, or Custom
- Score threshold slider (0-10)
- Theme tag multi-select
- Full-text search

**Features:**
- Star items for later (persisted)
- Pagination with Load More
- Sort by Recent or Top score

### AI Reports
Generate summaries from feed items using OpenAI:
- Customizable report templates
- Save template presets
- Export to Notion

### Shortcuts
Quick links to websites, apps, files, and shell commands.

## Quick Start

```bash
# Clone and install
git clone https://github.com/notjosh37/homescreenapp.git
cd homescreenapp
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run dev server
npm run dev
```

Open http://localhost:5173

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_NOTION_API_KEY=ntn_xxx
VITE_NOTION_DATABASE_ID=xxx
VITE_NEWS_API_KEY=xxx
VITE_UNSPLASH_API_KEY=xxx
VITE_OPENAI_API_KEY=sk-xxx
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_NOTION_API_KEY` | No | Notion integration API key |
| `VITE_NOTION_DATABASE_ID` | No | Notion database for todos/insights |
| `VITE_NEWS_API_KEY` | No | NewsAPI.org key for headlines |
| `VITE_UNSPLASH_API_KEY` | No | Unsplash API for background images |
| `VITE_OPENAI_API_KEY` | No | OpenAI key for AI report generation |

All keys are optional. Features degrade gracefully without them.

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
For feed aggregation via n8n:
- Same setup as todos
- Columns: Title, URL, Source, Date, Score, Themes

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

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Build**: Vite 7
- **Styling**: CSS with custom properties
- **Font**: Domine (serif)
- **APIs**: Notion, NewsAPI, Unsplash, OpenAI

## Project Structure

```
src/
  App.tsx       # Main component (state, logic, UI)
  App.css       # All styles
  main.tsx      # Entry point
  index.css     # Base styles
docs/
  PRD-insights-panel.md  # Feature specifications
```

## Building for Production

```bash
npm run build
npm run preview
```

Output in `dist/` directory.

## License

Private project.
