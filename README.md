# 🎮 RomM MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for [RomM](https://romm.app/) — the self-hosted game and ROM management platform.

Give your AI assistant full access to browse, search, and manage your retro game library.

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

```bash
git clone https://github.com/srxz/romm-mcp.git
cd romm-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ROMM_BASE_URL` | Yes | Your RomM instance URL (e.g. `http://192.168.15.97:5500`) |
| `ROMM_API_KEY` | Yes | RomM API key (generate one in RomM → Settings → API Keys) |

### Getting Your API Key

1. Open your RomM web UI
2. Go to **Settings** → **API Keys**
3. Click **Generate Key**
4. Copy the `rmm_...` token

### Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "romm": {
      "command": "node",
      "args": ["/path/to/romm-mcp/dist/index.js"],
      "env": {
        "ROMM_BASE_URL": "http://your-romm-instance:5500",
        "ROMM_API_KEY": "rmm_your_api_key_here"
      }
    }
  }
}
```

### Usage with CoPaw / OpenClaw

Add to your `agent.json` under `mcp.clients`:

```json
{
  "romm": {
    "name": "romm",
    "description": "RomM MCP server - game and ROM management",
    "enabled": true,
    "transport": "stdio",
    "command": "node",
    "args": ["/path/to/romm-mcp/dist/index.js"],
    "env": {
      "ROMM_BASE_URL": "http://your-romm-instance:5500",
      "ROMM_API_KEY": "rmm_your_api_key_here"
    }
  }
}
```

### Usage with npx (no clone needed)

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

> **Note:** npx usage requires publishing to npm first.

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

# Run locally (requires env vars)
ROMM_BASE_URL=http://localhost:5500 ROMM_API_KEY=rmm_xxx node dist/index.js
```

## Architecture

```
src/
├── client.ts    # RomM REST API client (fetch-based, zero deps)
└── index.ts     # MCP server with 15 tools
```

The API client is a thin wrapper over the [RomM REST API](https://docs.romm.app/API-and-Development/API-Reference/) (OpenAPI 3.1.0). It uses native `fetch` — no external HTTP library needed.

## Compatibility

- RomM v4.x+ (tested with v4.8.1)
- Node.js >= 20 (uses native `fetch`)
- Any MCP-compatible client (Claude Desktop, CoPaw, Cursor, etc.)

## License

[MIT](LICENSE)
