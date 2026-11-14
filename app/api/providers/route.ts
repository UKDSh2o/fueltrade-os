import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { providerStatus } from "../../../lib/providers.js";

// Reports whether each external integration is live, dummy or unconfigured. Never returns variable values.
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  return Response.json(providerStatus(env as unknown as Record<string, string>), { headers: { "Cache-Control": "no-store" } });
}
