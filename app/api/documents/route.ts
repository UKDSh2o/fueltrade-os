import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const respond = (body: unknown, status = 200) => Response.json(body, { status });

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB) return respond({ error: "Document records are unavailable" }, 503);
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference) return respond({ error: "Trade reference is required" }, 400);
  const rows = await env.DB.prepare(`SELECT id, category, file_name AS fileName, content_type AS contentType, size_bytes AS sizeBytes, status, created_at AS createdAt FROM documents WHERE owner_id = ? AND trade_reference = ? ORDER BY created_at DESC LIMIT 100`).bind(user.userId, reference).all();
  return respond({ documents: rows.results });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: "Sign in required" }, 401);
  if (!env.DB || !env.BUCKET) return respond({ error: "Document storage is unavailable" }, 503);
  const form = await request.formData();
  const file = form.get("file");
  const reference = String(form.get("reference") ?? "").trim();
  const category = String(form.get("category") ?? "Other").trim();
  if (!(file instanceof File) || !reference) return respond({ error: "A file and trade reference are required" }, 400);
  if (file.size > 15 * 1024 * 1024) return respond({ error: "Files must be 15 MB or smaller" }, 413);
  const allowed = new Set(["application/pdf","image/jpeg","image/png","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  if (!allowed.has(file.type)) return respond({ error: "Upload a PDF, DOCX, JPG or PNG file" }, 415);
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const objectKey = `${user.userId}/${reference}/${id}-${safeName}`;
  await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { ownerId: user.userId, tradeReference: reference, category } });
  const now = Date.now();
  try {
    await env.DB.prepare(`INSERT INTO documents (id, owner_id, trade_reference, category, file_name, content_type, size_bytes, object_key, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)`).bind(id,user.userId,reference,category,file.name,file.type,file.size,objectKey,now).run();
  } catch (error) {
    await env.BUCKET.delete(objectKey);
    throw error;
  }
  return respond({ id, fileName: file.name, category, sizeBytes: file.size, status: "received", createdAt: now }, 201);
}
