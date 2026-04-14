#!/usr/bin/env node

/**
 * RomM MCP Server — entry point.
 *
 * Transports:
 *   - stdio (default) — for CLI / local usage
 *   - streamable-http — for Docker / remote / multi-client
 *
 * Set MCP_TRANSPORT=http to enable HTTP mode.
 * HTTP config: MCP_PORT (default 3000), MCP_HOST (default "0.0.0.0")
 */

import { createServer } from "./server.js";

const transport = process.env.MCP_TRANSPORT?.toLowerCase();

async function startStdio() {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const server = createServer();
  const t = new StdioServerTransport();
  await server.connect(t);
  console.error("RomM MCP server running on stdio");
}

async function startHttp() {
  const { Hono } = await import("hono");
  const { cors } = await import("hono/cors");
  const { serve } = await import("@hono/node-server");
  const { WebStandardStreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
  );

  const DEBUG = process.env.ROMM_DEBUG === "1" || process.env.ROMM_DEBUG === "true";
  const port = parseInt(process.env.MCP_PORT || "3000", 10);
  const host = process.env.MCP_HOST || "0.0.0.0";

  console.error(`[romm-http] Starting HTTP transport...`);
  console.error(`[romm-http] Host: ${host}, Port: ${port}`);
  console.error(`[romm-http] Debug: ${DEBUG ? "ON" : "OFF"} (set ROMM_DEBUG=1 to enable)`);
  console.error(`[romm-http] ROMM_BASE_URL: ${process.env.ROMM_BASE_URL ? "set" : "NOT SET"}`);
  console.error(`[romm-http] ROMM_API_KEY: ${process.env.ROMM_API_KEY ? "set" : "NOT SET"}`);

  const app = new Hono();

  // Middleware: log ALL incoming requests
  app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    if (DEBUG) {
      console.error(
        `[romm-http] ${c.req.method} ${c.req.url} → ${c.res.status} (${Date.now() - start}ms)`
      );
    }
  });

  // CORS — allow all origins for local/Docker usage
  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version"],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }));

  if (DEBUG) {
    console.error("[romm-http] CORS middleware configured (origin: *)");
  }

  // Health check
  app.get("/health", (c) => {
    if (DEBUG) {
      console.error("[romm-http] Health check hit");
    }
    return c.json({
      status: "ok",
      service: "romm-mcp",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      rommBaseUrl: process.env.ROMM_BASE_URL || "(not set)",
      rommApiKey: process.env.ROMM_API_KEY ? "configured" : "NOT SET",
    });
  });

  // MCP endpoint — stateless mode (fresh server per request)
  app.all("/mcp", async (c) => {
    const startTime = Date.now();
    const method = c.req.method;
    const url = c.req.url;

    console.error(`[romm-mcp] ═══ MCP REQUEST: ${method} ${url}`);

    if (DEBUG) {
      console.error(`[romm-mcp] Headers:`, Object.fromEntries(c.req.raw.headers.entries()));
      try {
        const bodyClone = c.req.raw.clone();
        const bodyText = await bodyClone.text();
        console.error(`[romm-mcp] Body: ${bodyText.substring(0, 2000)}`);
      } catch (e: any) {
        console.error(`[romm-mcp] Body read error: ${e.message}`);
      }
    }

    try {
      const transport = new WebStandardStreamableHTTPServerTransport();
      const server = createServer();

      if (DEBUG) {
        console.error("[romm-mcp] Connecting MCP server to transport...");
      }

      await server.connect(transport);

      if (DEBUG) {
        console.error("[romm-mcp] MCP server connected, handling request...");
      }

      const response = await transport.handleRequest(c.req.raw);

      if (DEBUG) {
        console.error(`[romm-mcp] Response status: ${response.status}`);
        console.error(`[romm-mcp] Response headers:`, Object.fromEntries(response.headers.entries()));
        console.error(`[romm-mcp] Request handled in ${Date.now() - startTime}ms`);
      }

      return response;
    } catch (err: any) {
      console.error(`[romm-mcp] ✗ ERROR in MCP handler (${Date.now() - startTime}ms):`, err.message);
      console.error(`[romm-mcp] ✗ Stack:`, err.stack);
      return c.json({ error: err.message }, 500);
    }
  });

  try {
    serve({ fetch: app.fetch, port, hostname: host }, (info) => {
      console.error(`[romm-http] ✓ Server running on HTTP`);
      console.error(`[romm-http]   Health:   http://${info.address}:${info.port}/health`);
      console.error(`[romm-http]   MCP:      http://${info.address}:${info.port}/mcp`);
      console.error(`[romm-http]   Debug:    ROMM_DEBUG=${DEBUG ? "1" : "0"}`);
    });
  } catch (err: any) {
    console.error(`[romm-http] ✗ Failed to start server:`, err.message);
    console.error(`[romm-http] ✗ Stack:`, err.stack);
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  if (transport === "http" || transport === "streamable-http") {
    await startHttp();
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
