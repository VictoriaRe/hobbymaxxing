import { pushConfig } from "../lib";

export async function GET() {
  return Response.json(pushConfig(), {
    headers: { "cache-control": "no-store" },
  });
}
