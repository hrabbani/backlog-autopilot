import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { BlueprintSchema, type Blueprint } from "@backlog-autopilot/shared";

let cachedConfig: Blueprint | null = null;

export function loadBlueprint(): Blueprint {
  if (cachedConfig) return cachedConfig;

  const configPath = path.resolve(
    import.meta.dirname,
    "../../../config/blueprint.yaml"
  );
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = parse(raw);
  cachedConfig = BlueprintSchema.parse(parsed);
  return cachedConfig;
}

export function reloadBlueprint(): Blueprint {
  cachedConfig = null;
  return loadBlueprint();
}
