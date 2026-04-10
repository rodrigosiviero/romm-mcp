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

  const port = parseInt(process.env.MCP_PORT || "3000", 10);
  const host = process.env.MCP_HOST || "0.0.0.0";

  const app = new Hono();

  // CORS — allow all origins for local/Docker usage
  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version"],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }));

  // Health check
  app.get("/health", (c) => c.json({
    status: "ok",
    service: "romm-mcp",
    version: "1.0.0",
  }));

  // MCP endpoint — stateless mode (fresh server per request)
  app.all("/mcp", async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport();
    const server = createServer();
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    console.error(`RomM MCP server running on HTTP`);
    console.error(`  Health:   http://${info.address}:${info.port}/health`);
    console.error(`  MCP:      http://${info.address}:${info.port}/mcp`);
  });
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
