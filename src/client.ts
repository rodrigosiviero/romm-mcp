/**
 * RomM API client - handles all HTTP communication with the RomM instance.
 */

const BASE_URL = process.env.ROMM_BASE_URL || "";
const API_KEY = process.env.ROMM_API_KEY || "";

if (!BASE_URL) {
  console.error("Error: ROMM_BASE_URL environment variable is required");
  process.exit(1);
}
if (!API_KEY) {
  console.error("Error: ROMM_API_KEY environment variable is required");
  process.exit(1);
}

export class RomMClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl || BASE_URL).replace(/\/+$/, "");
    this.apiKey = apiKey || API_KEY;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    if (options.body && typeof options.body === "string") {
      headers["Content-Type"] = "application/json";
    }

    const resp = await fetch(url, { ...options, headers });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`RomM API ${resp.status}: ${text || resp.statusText} [${options.method || "GET"} ${path}]`);
    }

    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return resp.json() as Promise<T>;
    }
    return resp.text() as unknown as T;
  }

  // ─── System ───────────────────────────────────────────────

  async heartbeat() {
    return this.request<any>("/api/heartbeat");
  }

  async stats() {
    return this.request<any>("/api/stats");
  }

  async getConfig() {
    return this.request<any>("/api/config");
  }

  // ─── Platforms ────────────────────────────────────────────

  async listPlatforms() {
    return this.request<any[]>("/api/platforms");
  }

  async getPlatform(id: number) {
    return this.request<any>(`/api/platforms/${id}`);
  }

  // ─── ROMs ─────────────────────────────────────────────────

  async browseRoms(params: {
    platform_id?: number;
    platform_ids?: number[];
    collection_id?: number;
    search_term?: string;
    limit?: number;
    offset?: number;
    order_by?: string;
    order_dir?: string;
    matched?: boolean;
    favorite?: boolean;
    duplicate?: boolean;
    missing?: boolean;
    playable?: boolean;
    genres?: string[];
    franchises?: string[];
    companies?: string[];
    regions?: string[];
    languages?: string[];
    group_by_meta_id?: boolean;
  } = {}) {
    const qs = new URLSearchParams();
    // Map platform_id -> platform_ids for API
    if (params.platform_id && !params.platform_ids) {
      qs.set("platform_ids", String(params.platform_id));
    }
    for (const [k, v] of Object.entries(params)) {
      if (k === "platform_id") continue; // handled above
      if (v !== undefined && v !== null && v !== "") {
        if (Array.isArray(v)) {
          for (const item of v) {
            qs.append(k, String(item));
          }
        } else {
          qs.set(k, String(v));
        }
      }
    }
    const query = qs.toString();
    return this.request<any>(`/api/roms${query ? `?${query}` : ""}`);
  }

  async getRom(id: number) {
    return this.request<any>(`/api/roms/${id}`);
  }

  async updateRom(id: number, data: Record<string, any>) {
    return this.request<any>(`/api/roms/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteRoms(ids: number[], confirm: boolean = false) {
    if (!confirm) throw new Error("Delete requires confirm=true. NEVER delete without explicit confirmation.");
    return this.request<any>(`/api/roms/delete`, {
      method: "POST",
      body: JSON.stringify({ roms: ids }),
    });
  }

  async downloadRomUrl(id: number, fileName: string) {
    return `${this.baseUrl}/api/roms/${id}/content/${encodeURIComponent(fileName)}`;
  }

  // ─── Search ───────────────────────────────────────────────

  async searchRoms(params: {
    rom_id?: number;
    query?: string;
    field?: string;
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        qs.set(k, String(v));
      }
    }
    return this.request<any>(`/api/search/roms?${qs.toString()}`);
  }

  // ─── Collections ──────────────────────────────────────────

  async listCollections(updatedAfter?: string) {
    const qs = updatedAfter ? `?updated_after=${updatedAfter}` : "";
    return this.request<any[]>(`/api/collections${qs}`);
  }

  async getCollection(id: number) {
    return this.request<any>(`/api/collections/${id}`);
  }

  async createCollection(data: { name: string; description?: string; rom_ids?: number[]; is_public?: boolean }) {
    return this.request<any>("/api/collections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCollection(id: number, data: Record<string, any>) {
    return this.request<any>(`/api/collections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteCollection(id: number) {
    return this.request<any>(`/api/collections/${id}`, {
      method: "DELETE",
    });
  }

  async listSmartCollections() {
    return this.request<any[]>("/api/collections/smart");
  }

  async listVirtualCollections(type?: string, limit?: number) {
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (limit) qs.set("limit", String(limit));
    const q = qs.toString();
    return this.request<any[]>(`/api/collections/virtual${q ? `?${q}` : ""}`);
  }

  // ─── Firmware ─────────────────────────────────────────────

  async listFirmware(platformId?: number) {
    const qs = platformId ? `?platform_id=${platformId}` : "";
    return this.request<any[]>(`/api/firmware${qs}`);
  }

  async getFirmware(id: number) {
    return this.request<any>(`/api/firmware/${id}`);
  }

  // ─── Saves ────────────────────────────────────────────────

  async listSaves(romId?: number) {
    const qs = romId ? `?rom_id=${romId}` : "";
    return this.request<any[]>(`/api/saves${qs}`);
  }

  async deleteSave(id: number) {
    return this.request<any>(`/api/saves/${id}`, { method: "DELETE" });
  }

  // ─── States ───────────────────────────────────────────────

  async listStates(romId?: number) {
    const qs = romId ? `?rom_id=${romId}` : "";
    return this.request<any[]>(`/api/states${qs}`);
  }

  async deleteState(id: number) {
    return this.request<any>(`/api/states/${id}`, { method: "DELETE" });
  }

  // ─── Screenshots ──────────────────────────────────────────

  async listScreenshots(romId?: number) {
    const qs = romId ? `?rom_id=${romId}` : "";
    return this.request<any[]>(`/api/screenshots${qs}`);
  }

  // ─── Notes ────────────────────────────────────────────────

  async listNotes(romId: number) {
    return this.request<any[]>(`/api/roms/${romId}/notes`);
  }

  async addNote(romId: number, data: { title?: string; content?: string }) {
    return this.request<any>(`/api/roms/${romId}/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateNote(romId: number, noteId: number, data: { title?: string; content?: string }) {
    return this.request<any>(`/api/roms/${romId}/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteNote(romId: number, noteId: number) {
    return this.request<any>(`/api/roms/${romId}/notes/${noteId}`, { method: "DELETE" });
  }

  // ─── Upload ───────────────────────────────────────────────

  async uploadRom(platformId: number, fileName: string, fileData: Buffer) {
    throw new Error("Upload not yet supported - use the RomM web UI for uploads");
  }

  // ─── Tasks ────────────────────────────────────────────────

  async runScan() {
    return this.request<any>("/api/tasks/run", {
      method: "POST",
      body: JSON.stringify({ command: "scan" }),
    });
  }

  async runMetadataScan() {
    return this.request<any>("/api/tasks/run", {
      method: "POST",
      body: JSON.stringify({ command: "metadata" }),
    });
  }

  // ─── Devices ──────────────────────────────────────────────

  async listDevices() {
    return this.request<any[]>("/api/devices");
  }

  // ─── Users ────────────────────────────────────────────────

  async listUsers() {
    return this.request<any[]>("/api/users");
  }

  // ─── Feeds ────────────────────────────────────────────────

  async tinfoilFeed() {
    return this.request<any>("/api/feeds/tinfoil");
  }

  async webrcadeFeed() {
    return this.request<any>("/api/feeds/webrcade");
  }

  // ─── Netplay ──────────────────────────────────────────────

  async listNetplayRooms() {
    return this.request<any>("/api/netplay/list");
  }
}
