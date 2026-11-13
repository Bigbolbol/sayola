import { connection } from "next/server";
import { currentCode } from "@/lib/server/otp";

/** Demo-only stand-in for the recipient's phone inbox: returns the code an SMS would carry. */
export async function GET(request: Request) {
  await connection();
  const id = new URL(request.url).searchParams.get("payment");
  if (id === null || !/^\d+$/.test(id)) {
    return Response.json({ error: "payment is required" }, { status: 400 });
  }
  return Response.json({ code: currentCode(`pay:${id}`) });
}
