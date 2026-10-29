import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const flow = request.nextUrl.searchParams.get("flow");
  const destination = flow === "recovery"
    ? "/login?force=1&mode=reset-password"
    : "/cliente/perfil?emailUpdated=1";
  const redirect = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirect("/login?force=1");

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirect("/login?force=1");
    return redirect(destination);
  } catch {
    return redirect("/login?force=1");
  }
}
