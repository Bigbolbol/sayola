import { connection } from "next/server";
import { loadState } from "@/lib/server/state";

export async function GET() {
  await connection();
  try {
    return Response.json(await loadState());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
