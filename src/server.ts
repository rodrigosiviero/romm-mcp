#!/usr/bin/env node

/**
 * RomM MCP Server — MCP server for the RomM game/ROM management platform.
 *
 * Supports two transports:
 *   - stdio (default) — for local CLI usage
 *   - streamable-http — for Docker / remote / multi-client usage
 *
 * Set MCP_TRANSPORT=http to enable HTTP mode.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RomMClient } from "./client.js";

// ════════════════════════════════════════════════════════════
//  Shared: create and configure the MCP server with all tools
// ════════════════════════════════════════════════════════════

export function createServer(): McpServer {
  const client = new RomMClient();

  const server = new McpServer({
    name: "romm",
    version: "1.0.0",
  });

  // ─── romm_stats ──────────────────────────────────────────

  server.tool("romm_stats", "Get RomM library statistics — total platforms, ROMs, saves, states, screenshots, and total file size.", {}, async () => {
    const stats = await client.stats();
    const bytes = stats.TOTAL_FILESIZE_BYTES || 0;
    const gb = (bytes / (1024 ** 3)).toFixed(1);
    return {
      content: [{
        type: "text",
        text: [
          `📊 **RomM Library Stats**`,
          `Platforms: ${stats.PLATFORMS}`,
          `ROMs: ${stats.ROMS}`,
          `Saves: ${stats.SAVES}`,
          `States: ${stats.STATES}`,
          `Screenshots: ${stats.SCREENSHOTS}`,
          `Total Size: ${gb} GB`,
        ].join("\n"),
      }],
    };
  });

  // ─── romm_list_platforms ─────────────────────────────────

  server.tool("romm_list_platforms", "List all platforms in the RomM library with ROM counts, categories, and metadata.", {
    with_roms_only: z.boolean().optional().default(false).describe("Only show platforms that have ROMs"),
  }, async ({ with_roms_only }) => {
    const platforms = await client.listPlatforms();
    let filtered = platforms;
    if (with_roms_only) {
      filtered = platforms.filter((p: any) => p.rom_count > 0);
    }

    const lines = filtered.map((p: any) =>
      `• **${p.name}** (${p.slug}) — ${p.rom_count} ROMs  [${p.category || "Unknown"}]`
    );

    return {
      content: [{
        type: "text",
        text: [
          `🎮 **Platforms** (${filtered.length}${with_roms_only ? " with ROMs" : " total"})`,
          "",
          ...lines,
        ].join("\n"),
      }],
    };
  });

  // ─── romm_browse_roms ────────────────────────────────────

  server.tool("romm_browse_roms", "Browse and filter ROMs with pagination. Supports filtering by platform, collection, favorites, unmatched, and sorting.", {
    platform_id: z.number().optional().describe("Filter by platform ID"),
    collection_id: z.number().optional().describe("Filter by collection ID"),
    search_term: z.string().optional().describe("Search term to filter ROMs by name"),
    limit: z.number().optional().default(25).describe("Results per page (default 25, max 100)"),
    offset: z.number().optional().default(0).describe("Offset for pagination"),
    order_by: z.string().optional().describe("Sort field: name, size, rating, release_date"),
    order_dir: z.string().optional().describe("Sort direction: asc or desc"),
    matched: z.boolean().optional().describe("Filter by matched status"),
    favorite: z.boolean().optional().describe("Show only favorites"),
    duplicate: z.boolean().optional().describe("Show only duplicates"),
    missing: z.boolean().optional().describe("Show only missing ROMs"),
    playable: z.boolean().optional().describe("Show only playable (browser) ROMs"),
    genres: z.array(z.string()).optional().describe("Filter by genres"),
    companies: z.array(z.string()).optional().describe("Filter by companies"),
    regions: z.array(z.string()).optional().describe("Filter by regions"),
  }, async (params) => {
    const p: any = { ...params, limit: Math.min(params.limit || 25, 100) };
    if (params.platform_id) { p.platform_ids = [params.platform_id]; delete p.platform_id; }
    const result = await client.browseRoms(p);

    const items = result.items || result.data || result;
    const total = result.total || items.length;
    const roms = Array.isArray(items) ? items : [];

    const lines = roms.map((r: any) => {
      const platform = r.platform_display_name || r.platform_slug || "?";
      const size = r.fs_size_bytes ? `${(r.fs_size_bytes / (1024 ** 2)).toFixed(1)} MB` : "";
      const rating = r.metadatum?.average_rating ? `⭐${r.metadatum.average_rating}` : "";
      return `• [${r.id}] **${r.name || r.fs_name_no_tags}** (${platform}) ${size} ${rating}`;
    });

    return {
      content: [{
        type: "text",
        text: [
          `🕹️ **ROMs** (showing ${roms.length} of ${total}, offset ${params.offset || 0})`,
          "",
          ...lines,
          "",
          `Use offset=${(params.offset || 0) + roms.length} to see more.`,
        ].join("\n"),
      }],
    };
  });

  // ─── romm_get_rom ────────────────────────────────────────

  server.tool("romm_get_rom", "Get full details for a specific ROM by ID — metadata, genres, companies, file info, notes.", {
    id: z.number().describe("ROM ID"),
  }, async ({ id }) => {
    const rom = await client.getRom(id);

    const meta = rom.metadatum || {};
    const genres = (meta.genres || []).join(", ") || "N/A";
    const companies = (meta.companies || []).join(", ") || "N/A";
    const franchises = (meta.franchises || []).join(", ") || "N/A";
    const modes = (meta.game_modes || []).join(", ") || "N/A";
    const size = rom.fs_size_bytes ? `${(rom.fs_size_bytes / (1024 ** 2)).toFixed(1)} MB` : "N/A";
    const release = meta.first_release_date ? new Date(meta.first_release_date).toLocaleDateString() : "N/A";

    const lines = [
      `🎮 **${rom.name}**`,
      `ID: ${rom.id}`,
      `Platform: ${rom.platform_display_name || rom.platform_slug}`,
      `File: ${rom.fs_name} (${size})`,
      `Extension: ${rom.fs_extension}`,
      "",
      `📝 **Summary:** ${rom.summary || "No summary available"}`,
      "",
      `🏷️ **Genres:** ${genres}`,
      `🏢 **Companies:** ${companies}`,
      `🔗 **Franchises:** ${franchises}`,
      `👥 **Game Modes:** ${modes}`,
      `⭐ **Rating:** ${meta.average_rating || "N/A"}`,
      `📅 **Release:** ${release}`,
      `🎮 **Players:** ${meta.player_count || "N/A"}`,
    ];

    if (rom.youtube_video_id) {
      lines.push(`▶️ **YouTube:** https://youtube.com/watch?v=${rom.youtube_video_id}`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  });

  // ─── romm_search_roms ────────────────────────────────────

  server.tool("romm_search_roms", "Search ROMs by name. Returns matching ROMs with basic info. Use this to find specific games.", {
    query: z.string().describe("Search term (game name)"),
    limit: z.number().optional().default(10).describe("Max results (default 10)"),
  }, async ({ query, limit }) => {
    const result = await client.browseRoms({
      search_term: query,
      limit: Math.min(limit, 50),
    });

    const items = result.items || result.data || result;
    const roms = Array.isArray(items) ? items : [];

    if (roms.length === 0) {
      return { content: [{ type: "text", text: `No ROMs found matching "${query}".` }] };
    }

    const lines = roms.map((r: any) =>
      `• [${r.id}] **${r.name || r.fs_name_no_tags}** (${r.platform_display_name || r.platform_slug})`
    );

    return {
      content: [{
        type: "text",
        text: [
          `🔍 **Search: "${query}"** (${roms.length} results)`,
          "",
          ...lines,
        ].join("\n"),
      }],
    };
  });

  // ─── romm_manage_collections ─────────────────────────────

  server.tool("romm_manage_collections", "Manage RomM collections. Actions: list, get, create, update, delete. Also supports smart and virtual collections.", {
    action: z.enum(["list", "get", "create", "update", "delete", "list_smart", "list_virtual"]).describe("Action to perform"),
    id: z.number().optional().describe("Collection ID (for get/update/delete)"),
    name: z.string().optional().describe("Collection name (for create/update)"),
    description: z.string().optional().describe("Collection description"),
    rom_ids: z.array(z.number()).optional().describe("ROM IDs to add to collection"),
    is_public: z.boolean().optional().describe("Make collection public"),
    is_favorite: z.boolean().optional().describe("Mark as favorite"),
    type: z.string().optional().describe("Virtual collection type filter"),
    confirm_delete: z.boolean().optional().describe("Must be true for delete action"),
  }, async (params) => {
    const { action } = params;

    if (action === "list") {
      const cols = await client.listCollections();
      const lines = cols.map((c: any) =>
        `• [${c.id}] **${c.name}** — ${c.rom_count} ROMs ${c.description ? `(${c.description})` : ""}`
      );
      return { content: [{ type: "text", text: [`📁 **Collections** (${cols.length})`, "", ...lines].join("\n") }] };
    }

    if (action === "list_smart") {
      const cols = await client.listSmartCollections();
      const lines = cols.map((c: any) => `• [${c.id}] **${c.name}** — ${c.rom_count} ROMs`);
      return { content: [{ type: "text", text: [`🧠 **Smart Collections** (${cols.length})`, "", ...lines].join("\n") }] };
    }

    if (action === "list_virtual") {
      const cols = await client.listVirtualCollections(params.type);
      const lines = cols.map((c: any) => `• [${c.id}] **${c.name}** — ${c.rom_count} ROMs`);
      return { content: [{ type: "text", text: [`👻 **Virtual Collections** (${cols.length})`, "", ...lines].join("\n") }] };
    }

    if (action === "get") {
      if (!params.id) throw new Error("id required for get action");
      const col = await client.getCollection(params.id);
      const romLines = (col.rom_ids || []).slice(0, 20).map((rid: number) => `  ROM #${rid}`);
      return {
        content: [{
          type: "text",
          text: [
            `📁 **${col.name}**`,
            `ID: ${col.id}`,
            `Description: ${col.description || "N/A"}`,
            `ROMs: ${col.rom_count}`,
            ...(romLines.length > 0 ? ["", "ROM IDs:", ...romLines] : []),
            ...(col.rom_count > 20 ? [`  ... and ${col.rom_count - 20} more`] : []),
          ].join("\n"),
        }],
      };
    }

    if (action === "create") {
      if (!params.name) throw new Error("name required for create action");
      const col = await client.createCollection({
        name: params.name,
        description: params.description,
        rom_ids: params.rom_ids,
        is_public: params.is_public,
      });
      return { content: [{ type: "text", text: `✅ Created collection **${col.name}** (ID: ${col.id}) with ${col.rom_count} ROMs.` }] };
    }

    if (action === "update") {
      if (!params.id) throw new Error("id required for update action");
      const updateData: Record<string, any> = {};
      if (params.name !== undefined) updateData.name = params.name;
      if (params.description !== undefined) updateData.description = params.description;
      if (params.rom_ids !== undefined) updateData.rom_ids = params.rom_ids;
      if (params.is_public !== undefined) updateData.is_public = params.is_public;
      if (params.is_favorite !== undefined) updateData.is_favorite = params.is_favorite;
      const col = await client.updateCollection(params.id, updateData);
      return { content: [{ type: "text", text: `✅ Updated collection **${col.name}** (ID: ${col.id}).` }] };
    }

    if (action === "delete") {
      if (!params.id) throw new Error("id required for delete action");
      if (!params.confirm_delete) {
        return { content: [{ type: "text", text: `⚠️ To delete collection ${params.id}, set confirm_delete=true. This cannot be undone.` }] };
      }
      await client.deleteCollection(params.id);
      return { content: [{ type: "text", text: `🗑️ Deleted collection ID ${params.id}.` }] };
    }

    throw new Error(`Unknown action: ${action}`);
  });

  // ─── romm_get_collection_roms ────────────────────────────

  server.tool("romm_get_collection_roms", "Get all ROMs in a specific collection with details.", {
    id: z.number().describe("Collection ID"),
    limit: z.number().optional().default(50).describe("Max ROMs to return"),
    offset: z.number().optional().default(0).describe("Offset for pagination"),
  }, async ({ id, limit, offset }) => {
    const result = await client.browseRoms({ collection_id: id, limit, offset });
    const items = result.items || result.data || result;
    const roms = Array.isArray(items) ? items : [];
    const total = result.total || roms.length;

    const lines = roms.map((r: any) =>
      `• [${r.id}] **${r.name || r.fs_name_no_tags}** (${r.platform_display_name || r.platform_slug})`
    );

    return {
      content: [{
        type: "text",
        text: [
          `📁 **Collection ROMs** (${roms.length} of ${total})`,
          "",
          ...lines,
          ...(total > roms.length ? ["", `Use offset=${offset + roms.length} for more.`] : []),
        ].join("\n"),
      }],
    };
  });

  // ─── romm_list_firmware ──────────────────────────────────

  server.tool("romm_list_firmware", "List firmware files available in RomM, optionally filtered by platform.", {
    platform_id: z.number().optional().describe("Filter by platform ID"),
  }, async ({ platform_id }) => {
    const firmware = await client.listFirmware(platform_id);

    if (!Array.isArray(firmware) || firmware.length === 0) {
      return { content: [{ type: "text", text: "No firmware found." }] };
    }

    const lines = firmware.map((f: any) =>
      `• [${f.id}] **${f.name || f.filename}** (${f.platform_name || f.platform_slug || "?"})`
    );

    return {
      content: [{
        type: "text",
        text: [`💾 **Firmware** (${firmware.length})`, "", ...lines].join("\n"),
      }],
    };
  });

  // ─── romm_download_rom ───────────────────────────────────

  server.tool("romm_download_rom", "Get the download URL for a ROM file.", {
    id: z.number().describe("ROM ID"),
  }, async ({ id }) => {
    const rom = await client.getRom(id);
    const fileName = rom.fs_name || rom.name;
    const url = client.downloadRomUrl(id, fileName);

    return {
      content: [{
        type: "text",
        text: [
          `📥 **Download: ${rom.name || rom.fs_name_no_tags}**`,
          `Platform: ${rom.platform_display_name || rom.platform_slug}`,
          `Size: ${rom.fs_size_bytes ? `${(rom.fs_size_bytes / (1024 ** 2)).toFixed(1)} MB` : "N/A"}`,
          `URL: ${url}`,
          "",
          `Note: Requires authentication. Add header: Authorization: Bearer <API_KEY>`,
        ].join("\n"),
      }],
    };
  });

  // ─── romm_update_rom ─────────────────────────────────────

  server.tool("romm_update_rom", "Update ROM metadata — name, notes, favorite status.", {
    id: z.number().describe("ROM ID"),
    name: z.string().optional().describe("New display name"),
    note_raw_markdown: z.string().optional().describe("Markdown note for the ROM"),
    is_favorite: z.boolean().optional().describe("Set favorite status"),
  }, async (params) => {
    const { id, ...data } = params;
    const cleanData: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) cleanData[k] = v;
    }

    const rom = await client.updateRom(id, cleanData);
    return {
      content: [{
        type: "text",
        text: `✅ Updated ROM **${rom.name}** (ID: ${rom.id}). Updated fields: ${Object.keys(cleanData).join(", ")}`,
      }],
    };
  });

  // ─── romm_rom_notes ──────────────────────────────────────

  server.tool("romm_rom_notes", "Manage notes attached to a ROM. Actions: list, add, update, delete.", {
    action: z.enum(["list", "add", "update", "delete"]).describe("Action to perform"),
    rom_id: z.number().describe("ROM ID"),
    note_id: z.number().optional().describe("Note ID (for update/delete)"),
    title: z.string().optional().describe("Note title"),
    content: z.string().optional().describe("Note content (markdown)"),
  }, async ({ action, rom_id, note_id, title, content }) => {
    if (action === "list") {
      const notes = await client.listNotes(rom_id);
      if (!Array.isArray(notes) || notes.length === 0) {
        return { content: [{ type: "text", text: `No notes found for ROM ${rom_id}.` }] };
      }
      const lines = notes.map((n: any) => `• [${n.id}] **${n.title || "Untitled"}**\n  ${n.content || ""}`);
      return { content: [{ type: "text", text: [`📝 **Notes for ROM ${rom_id}**`, "", ...lines].join("\n") }] };
    }

    if (action === "add") {
      await client.addNote(rom_id, { title: title || "Note", content: content || "" });
      return { content: [{ type: "text", text: `✅ Added note to ROM ${rom_id}.` }] };
    }

    if (action === "update") {
      if (!note_id) throw new Error("note_id required for update");
      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      await client.updateNote(rom_id, note_id, updateData);
      return { content: [{ type: "text", text: `✅ Updated note ${note_id} on ROM ${rom_id}.` }] };
    }

    if (action === "delete") {
      if (!note_id) throw new Error("note_id required for delete");
      await client.deleteNote(rom_id, note_id);
      return { content: [{ type: "text", text: `🗑️ Deleted note ${note_id} from ROM ${rom_id}.` }] };
    }

    throw new Error(`Unknown action: ${action}`);
  });

  // ─── romm_manage_saves ───────────────────────────────────

  server.tool("romm_manage_saves", "List save files, optionally filtered by ROM.", {
    rom_id: z.number().optional().describe("Filter by ROM ID"),
  }, async ({ rom_id }) => {
    const saves = await client.listSaves(rom_id);

    if (!Array.isArray(saves) || saves.length === 0) {
      return { content: [{ type: "text", text: "No saves found." }] };
    }

    const lines = saves.map((s: any) =>
      `• [${s.id}] ${s.file_name || s.filename || "Unknown"} — ROM #${s.rom_id} (${s.platform_slug || ""})`
    );

    return {
      content: [{
        type: "text",
        text: [`💾 **Save Files** (${saves.length})`, "", ...lines].join("\n"),
      }],
    };
  });

  // ─── romm_manage_states ──────────────────────────────────

  server.tool("romm_manage_states", "List save state files, optionally filtered by ROM.", {
    rom_id: z.number().optional().describe("Filter by ROM ID"),
  }, async ({ rom_id }) => {
    const states = await client.listStates(rom_id);

    if (!Array.isArray(states) || states.length === 0) {
      return { content: [{ type: "text", text: "No save states found." }] };
    }

    const lines = states.map((s: any) =>
      `• [${s.id}] ${s.file_name || s.filename || "Unknown"} — ROM #${s.rom_id} (${s.platform_slug || ""})`
    );

    return {
      content: [{
        type: "text",
        text: [`🎮 **Save States** (${states.length})`, "", ...lines].join("\n"),
      }],
    };
  });

  // ─── romm_system ─────────────────────────────────────────

  server.tool("romm_system", "System operations: heartbeat check, get config, trigger library scan, or update metadata.", {
    action: z.enum(["heartbeat", "config", "scan", "metadata_scan"]).describe("Action: heartbeat (health check), config (get config), scan (trigger library scan), metadata_scan (update metadata)"),
  }, async ({ action }) => {
    if (action === "heartbeat") {
      const hb = await client.heartbeat();
      const version = hb.SYSTEM?.VERSION || "unknown";
      const platforms = hb.FILESYSTEM?.FS_PLATFORMS || [];
      return {
        content: [{
          type: "text",
          text: [
            `💚 **RomM Heartbeat**`,
            `Version: ${version}`,
            `Setup Wizard: ${hb.SYSTEM?.SHOW_SETUP_WIZARD ? "Active" : "Complete"}`,
            `Platform directories: ${platforms.length} (${platforms.slice(0, 10).join(", ")}${platforms.length > 10 ? "..." : ""})`,
            `IGDB: ${hb.METADATA_SOURCES?.IGDB_API_ENABLED ? "✅" : "❌"}`,
            `ScreenScraper: ${hb.METADATA_SOURCES?.SS_API_ENABLED ? "✅" : "❌"}`,
            `EmulatorJS: ${hb.EMULATION?.DISABLE_EMULATOR_JS ? "❌" : "✅"}`,
            `RuffleRS: ${hb.EMULATION?.DISABLE_RUFFLE_RS ? "❌" : "✅"}`,
          ].join("\n"),
        }],
      };
    }

    if (action === "config") {
      const config = await client.getConfig();
      return {
        content: [{
          type: "text",
          text: `⚙️ **RomM Config**\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\``,
        }],
      };
    }

    if (action === "scan") {
      const result = await client.runScan();
      return { content: [{ type: "text", text: `🔍 Library scan triggered. Result: ${JSON.stringify(result)}` }] };
    }

    if (action === "metadata_scan") {
      const result = await client.runMetadataScan();
      return { content: [{ type: "text", text: `📝 Metadata scan triggered. Result: ${JSON.stringify(result)}` }] };
    }

    throw new Error(`Unknown action: ${action}`);
  });

  // ─── romm_screenshots ────────────────────────────────────

  server.tool("romm_screenshots", "List screenshots, optionally filtered by ROM.", {
    rom_id: z.number().optional().describe("Filter by ROM ID"),
  }, async ({ rom_id }) => {
    const screenshots = await client.listScreenshots(rom_id);

    if (!Array.isArray(screenshots) || screenshots.length === 0) {
      return { content: [{ type: "text", text: "No screenshots found." }] };
    }

    const lines = screenshots.map((s: any) =>
      `• [${s.id}] ROM #${s.rom_id} — ${s.file_name || s.filename || "Screenshot"}`
    );

    return {
      content: [{
        type: "text",
        text: [`📸 **Screenshots** (${screenshots.length})`, "", ...lines].join("\n"),
      }],
    };
  });

  return server;
}
