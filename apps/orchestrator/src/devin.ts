interface DevinSessionCreateParams {
  prompt: string;
  playbook_id?: string;
  knowledge_ids?: string[];
  structured_output_schema?: Record<string, unknown>;
  tags?: string[];
  repos?: string[];
  session_links?: string[];
  max_acu_limit?: number;
}

interface DevinSessionResponse {
  session_id: string;
  url: string;
  status: string;
  status_detail?: string;
  structured_output?: Record<string, unknown>;
  pull_requests?: Array<{ pr_url: string; pr_state: string }>;
  created_at: string;
  updated_at: string;
  title?: string;
  tags?: string[];
}

interface DevinPlaybookResponse {
  playbook_id: string;
  title: string;
  body: string;
  macro?: string;
}

interface DevinKnowledgeNoteResponse {
  note_id: string;
  name: string;
  body: string;
  trigger: string;
  pinned_repo?: string;
}

export class DevinClient {
  private baseUrl: string;
  private apiKey: string;
  private orgId: string;

  constructor() {
    this.apiKey = process.env.DEVIN_API_KEY!;
    this.orgId = process.env.DEVIN_ORG_ID!;
    this.baseUrl = `https://api.devin.ai/v3/organizations/${this.orgId}`;

    if (!this.apiKey || !this.orgId) {
      throw new Error("DEVIN_API_KEY and DEVIN_ORG_ID must be set");
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Devin API ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // Sessions
  async createSession(
    params: DevinSessionCreateParams
  ): Promise<DevinSessionResponse> {
    return this.request<DevinSessionResponse>("POST", "/sessions", params);
  }

  async getSession(sessionId: string): Promise<DevinSessionResponse> {
    return this.request<DevinSessionResponse>(
      "GET",
      `/sessions/${sessionId}`
    );
  }

  async listSessions(params?: {
    tags?: string[];
    updated_after?: string;
    limit?: number;
  }): Promise<{ items: DevinSessionResponse[] }> {
    const query = new URLSearchParams();
    if (params?.tags) query.set("tags", params.tags.join(","));
    if (params?.updated_after) query.set("updated_after", params.updated_after);
    if (params?.limit) query.set("first", String(params.limit));
    const qs = query.toString();
    return this.request<{ items: DevinSessionResponse[] }>(
      "GET",
      `/sessions${qs ? `?${qs}` : ""}`
    );
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    await this.request("POST", `/sessions/${sessionId}/messages`, { message });
  }

  // Playbooks
  async createPlaybook(params: {
    title: string;
    body: string;
    macro?: string;
  }): Promise<DevinPlaybookResponse> {
    return this.request<DevinPlaybookResponse>("POST", "/playbooks", params);
  }

  async updatePlaybook(
    playbookId: string,
    params: { title: string; body: string; macro?: string }
  ): Promise<void> {
    await this.request("PUT", `/playbooks/${playbookId}`, params);
  }

  async listPlaybooks(): Promise<{ items: DevinPlaybookResponse[] }> {
    return this.request<{ items: DevinPlaybookResponse[] }>(
      "GET",
      "/playbooks"
    );
  }

  // Knowledge
  async createKnowledgeNote(params: {
    name: string;
    body: string;
    trigger: string;
    pinned_repo?: string;
  }): Promise<DevinKnowledgeNoteResponse> {
    return this.request<DevinKnowledgeNoteResponse>(
      "POST",
      "/knowledge/notes",
      params
    );
  }

  async updateKnowledgeNote(
    noteId: string,
    params: { name: string; body: string; trigger: string; pinned_repo?: string }
  ): Promise<DevinKnowledgeNoteResponse> {
    return this.request<DevinKnowledgeNoteResponse>(
      "PUT",
      `/knowledge/notes/${noteId}`,
      params
    );
  }

  async getKnowledgeNote(
    noteId: string
  ): Promise<DevinKnowledgeNoteResponse> {
    return this.request<DevinKnowledgeNoteResponse>(
      "GET",
      `/knowledge/notes/${noteId}`
    );
  }

  async listKnowledgeNotes(): Promise<{
    items: DevinKnowledgeNoteResponse[];
  }> {
    return this.request<{ items: DevinKnowledgeNoteResponse[] }>(
      "GET",
      "/knowledge/notes"
    );
  }

  // Session attachments (for video retrieval)
  async getSessionAttachments(
    sessionId: string
  ): Promise<
    Array<{
      attachment_id: string;
      name: string;
      url: string;
      source: string;
    }>
  > {
    return this.request<
      Array<{
        attachment_id: string;
        name: string;
        url: string;
        source: string;
      }>
    >("GET", `/sessions/${sessionId}/attachments`);
  }
}

// Singleton
let client: DevinClient | null = null;

export function getDevinClient(): DevinClient {
  if (!client) {
    client = new DevinClient();
  }
  return client;
}
