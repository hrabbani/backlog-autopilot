import fs from "node:fs";
import path from "node:path";
import { FileCode, BookOpen } from "lucide-react";
import { getConfigValue } from "@/lib/db";

export const dynamic = "force-dynamic";

async function fetchRoutingRules(): Promise<string> {
  const noteId = getConfigValue("routing_rules_note_id");
  const orgId = process.env.DEVIN_ORG_ID;
  const apiKey = process.env.DEVIN_API_KEY;

  if (!noteId || !orgId || !apiKey) {
    return "(Run setup first to create the routing rules Knowledge note)";
  }

  try {
    const res = await fetch(
      `https://api.devin.ai/v3/organizations/${orgId}/knowledge/notes/${noteId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) return `(Failed to fetch: ${res.status})`;
    const note = (await res.json()) as { body: string };
    return note.body;
  } catch {
    return "(Could not reach Devin API)";
  }
}

export default async function ConfigPage() {
  const blueprintPath = path.resolve(
    process.cwd(),
    "../../config/blueprint.yaml"
  );
  let blueprint = "(blueprint.yaml not found)";
  try {
    blueprint = fs.readFileSync(blueprintPath, "utf-8");
  } catch {
    // file absent in this environment
  }

  const routingRules = await fetchRoutingRules();

  return (
    <div className="p-8">
      <div className="max-w-7xl">
        <h1 className="text-xl font-semibold text-devin-text-primary mb-1">
          Configuration
        </h1>
        <p className="text-[13px] text-devin-text-secondary mb-8">
          Read-only view of the current blueprint and routing rules.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-devin-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-devin-border bg-devin-bg-surface">
              <FileCode size={14} className="text-devin-text-secondary" />
              <span className="text-[13px] font-medium text-devin-text-primary">
                blueprint.yaml
              </span>
            </div>
            <pre className="p-4 text-[13px] font-mono overflow-auto max-h-[600px] text-devin-text-primary bg-devin-bg-main">
              {blueprint}
            </pre>
          </div>

          <div className="border border-devin-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-devin-border bg-devin-bg-surface">
              <BookOpen size={14} className="text-devin-text-secondary" />
              <span className="text-[13px] font-medium text-devin-text-primary">
                Routing Rules (Devin Knowledge)
              </span>
            </div>
            <pre className="p-4 text-[13px] font-mono overflow-auto max-h-[600px] text-devin-text-primary bg-devin-bg-main whitespace-pre-wrap">
              {routingRules}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
