import { env } from "cloudflare:workers";
import Dashboard from "./dashboard";
import { requireChatGPTUser } from "./chatgpt-auth";
import { dummyEnabled } from "../lib/providers.js";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  const dummy = dummyEnabled(env as unknown as Record<string, string>);
  return (
    <>
      {dummy && (
        <>
          {/* The sidebar and shell are fixed to the viewport, so reserve the banner's 32px for both. */}
          <style>{`aside{top:32px !important}.app-shell{padding-top:32px}`}</style>
          <div
            role="status"
            data-testid="dummy-mode-banner"
            title="External providers are simulated. Signatures, screening, tracking, messages and prices are not real."
            style={{ position: "fixed", top: 0, left: 0, right: 0, height: 32, lineHeight: "32px", zIndex: 1000, background: "#7a1f00", color: "#fff", padding: "0 12px", fontSize: 12, fontWeight: 600, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            DUMMY MODE: providers are simulated. Results are not real.
          </div>
        </>
      )}
      <Dashboard user={{ displayName: user.displayName, email: user.email }} />
    </>
  );
}
