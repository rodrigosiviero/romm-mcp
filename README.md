# 🎮 RomM MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for [RomM](https://romm.app/) — the self-hosted game and ROM management platform.

Give your AI assistant full access to browse, search, and manage your retro game library.

**Supports both transports:**
- **stdio** — local CLI usage (default)
- **Streamable HTTP** — Docker / remote / multi-client

## Features

- **Browse** your full ROM library with pagination, filtering, and sorting
- **Search** games by name across all platforms
- **Platforms** — list all platforms with ROM counts and metadata
- **Collections** — create, list, update, and delete game collections
- **ROM details** — full metadata including genres, companies, ratings, summaries
- **Firmware** — list available firmware files per platform
- **Save management** — browse save files and save states
- **Notes** — CRUD notes attached to any ROM
- **System** — heartbeat check, config, trigger library scans
- **Screenshots** — browse screenshots per ROM
- **Download URLs** — generate authenticated download links

## Requirements

- Node.js >= 20.0.0
- A running [RomM](https://romm.app/) instance (v4.x+)
- A RomM API key (`rmm_*` token)

## Installation

### Option 1: npx (no install needed)

```bash
npx romm-mcp
```

### Option 2: Clone and build

```bash
git clone https://github.com/rodrigosiviero/romm-mcp.git
cd romm-mcp
npm install
npm run build
```

### Option 3: Docker

```bash
docker compose up -d
```

See [Docker](#docker) section below for details.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ROMM_BASE_URL` | Yes | Your RomM instance URL (e.g. `http://romm.local:5500`) |
| `ROMM_API_KEY` | Yes | RomM API key (generate in RomM → Settings → API Keys) |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` for Streamable HTTP mode |
| `MCP_PORT` | No | HTTP server port (default `3000`, HTTP mode only) |
| `MCP_HOST` | No | HTTP bind address (default `0.0.0.0`, HTTP mode only) |
| `ROMM_DEBUG` | No | Sets to 1 for debug logs |

### Getting Your API Key

1. Open your RomM web UI
2. Go to **Settings** → **API Keys**
3. Click **Generate Key**
4. Copy the `rmm_...` token

## Usage

### stdio Transport (Local)

For Claude Desktop, Cursor, CoPaw, and other local MCP clients.

#### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "romm": {
      "command": "npx",
      "args": ["-y", "romm-mcp"],
      "env": {
        "ROMM_BASE_URL": "http://your-romm-instance:5500",
        "ROMM_API_KEY": "rmm_your_api_key_here"
      }
    }
  }
}
```

#### CoPaw / OpenClaw

Add to `agent.json` under `mcp.clients`:

```json
{
  "romm": {
    "name": "romm",
    "description": "RomM MCP server",
    "enabled": true,
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "romm-mcp"],
    "env": {
      "ROMM_BASE_URL": "http://your-romm-instance:5500",
      "ROMM_API_KEY": "rmm_your_api_key_here"
    }
  }
}
```

### Streamable HTTP Transport (Remote / Docker)

For remote access, Docker deployments, or sharing one MCP server with multiple clients.

#### Local HTTP

```bash
MCP_TRANSPORT=http MCP_PORT=3000 \
ROMM_BASE_URL=http://your-romm-instance:5500 \
ROMM_API_KEY=rmm_your_api_key_here \
npx romm-mcp
```

Then connect your client:

```json
{
  "mcpServers": {
    "romm": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

#### Docker

Create a `.env` file:

```env
ROMM_BASE_URL=http://host.docker.internal:5500
ROMM_API_KEY=rmm_your_api_key_here
```

Then:

```bash
docker compose up -d
```

Or use the published image directly:

```bash
docker run -d \
  --name romm-mcp \
  -p 3000:3000 \
  -e ROMM_BASE_URL=http://host.docker.internal:5500 \
  -e ROMM_API_KEY=rmm_your_api_key_here \
  ghcr.io/rodrigosiviero/romm-mcp:main
```

### Docker Compose (full example)

```yaml
services:
  romm-mcp:
    image: ghcr.io/rodrigosiviero/romm-mcp:main
    ports:
      - "3000:3000"
    environment:
      - MCP_TRANSPORT=http
      - MCP_PORT=3000
      - ROMM_BASE_URL=http://host.docker.internal:5500
      - ROMM_API_KEY=rmm_your_api_key_here
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-O-", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Tools

| Tool | Description |
|------|-------------|
| `romm_stats` | Library statistics — total platforms, ROMs, saves, states, screenshots, file size |
| `romm_list_platforms` | List all platforms with ROM counts, categories, and slugs |
| `romm_browse_roms` | Browse and filter ROMs with pagination. Supports platform, collection, genre, company, region filters, and sorting |
| `romm_get_rom` | Full ROM details by ID — metadata, genres, companies, summary, rating, YouTube link |
| `romm_search_roms` | Search ROMs by name |
| `romm_manage_collections` | CRUD collections (list, get, create, update, delete). Also supports smart and virtual collections |
| `romm_get_collection_roms` | List all ROMs in a specific collection |
| `romm_list_firmware` | List firmware files available per platform |
| `romm_download_rom` | Generate an authenticated download URL for a ROM |
| `romm_update_rom` | Update ROM metadata — display name, notes, favorite status |
| `romm_rom_notes` | Manage notes attached to a ROM (list, add, update, delete) |
| `romm_manage_saves` | List save files, optionally filtered by ROM |
| `romm_manage_states` | List save state files, optionally filtered by ROM |
| `romm_system` | System operations — heartbeat, config, trigger library scan, metadata update |
| `romm_screenshots` | List screenshots, optionally filtered by ROM |

## Example Interactions

```
You: How many games do I have?

🤖: 📊 RomM Library Stats
   Platforms: 20
   ROMs: 1,362
   Saves: 1
   States: 0
   Screenshots: 0
   Total Size: 197.4 GB
```

```
You: Find Mario games in my library

🤖: 🔍 Search: "mario" (5 results)
   • [4227] Mario Kart 8 Deluxe (Nintendo Switch)
   • [4108] Mario Andretti Racing (Sega Mega Drive/Genesis)
   • [921] Super Mario RPG (Nintendo Switch)
   • [933] Paper Mario (Wii)
   • [4109] Mario Lemieux Hockey (Sega Mega Drive/Genesis)
```

```
You: Tell me about Super Mario RPG

🤖: 🎮 Super Mario RPG
   Platform: Nintendo Switch
   File: Super Mario RPG [0100BC0018138000][v0].nsp (6.4 GB)

   📝 Summary: Mario, Bowser, and Peach partner up to repair the
   wish-granting Star Road in this approachable role-playing adventure.

   🏷️ Genres: Adventure, Role-playing (RPG)
   🏢 Companies: ArtePiazza, Flame Hearts, Nintendo
   🔗 Franchises: Mario
   ⭐ Rating: 80.51
   📅 Release: 11/17/2023
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run with stdio (default)
ROMM_BASE_URL=http://localhost:5500 ROMM_API_KEY=rmm_xxx node dist/index.js

# Run with HTTP
MCP_TRANSPORT=http ROMM_BASE_URL=http://localhost:5500 ROMM_API_KEY=rmm_xxx node dist/index.js
```

## Architecture

```
src/
├── client.ts    # RomM REST API client (fetch-based, zero deps)
├── server.ts    # MCP server with all tools (shared between transports)
└── index.ts     # Entry point — auto-detects stdio vs HTTP
```

The API client is a thin wrapper over the [RomM REST API](https://docs.romm.app/API-and-Development/API-Reference/) (OpenAPI 3.1.0). It uses native `fetch` — no external HTTP library needed.

In HTTP mode, the server uses [Hono](https://hono.dev/) with the stateless `WebStandardStreamableHTTPServerTransport` — a fresh MCP server is created per request, making it safe for Docker and multi-client scenarios.

## Compatibility

- RomM v4.x+ (tested with v4.8.1)
- Node.js >= 20 (uses native `fetch`)
- Any MCP-compatible client (Claude Desktop, CoPaw, Cursor, Windsurf, etc.)
- MCP Streamable HTTP spec (`2025-03-26`)

## License

[MIT](LICENSE)
