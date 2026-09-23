import Dashboard from "./dashboard";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <Dashboard user={{ displayName: user.displayName, email: user.email }} />;
}
