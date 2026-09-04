import { createFileRoute } from "@tanstack/react-router";

const FHIR_JSON = "application/fhir+json";

async function proxy({ request, params }: { request: Request; params: { _splat?: string } }) {
  const base = process.env["FHIR_BASE_URL"];
  const token = process.env["FHIR_ACCESS_TOKEN"];

  if (!base || !token) {
    return Response.json(
      { error: "FHIR server is not configured yet. Add the server URL and access token." },
      { status: 503 },
    );
  }

  const incoming = new URL(request.url);
  const path = (params._splat ?? "").replace(/^\/+/, "");
  const target = `${base.replace(/\/+$/, "")}/${path}${incoming.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: FHIR_JSON,
  };
  const method = request.method.toUpperCase();
  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.text();
    headers["Content-Type"] = FHIR_JSON;
  }

  try {
    const res = await fetch(target, { method, headers, body });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? FHIR_JSON,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Could not reach the FHIR server." }, { status: 502 });
  }
}

export const Route = createFileRoute("/api/fhir/$")({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      DELETE: proxy,
    },
  },
});
