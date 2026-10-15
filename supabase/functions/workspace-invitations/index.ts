import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const DEFAULT_APP_URL = "https://the-last-time-machine.pages.dev";
const configuredAppUrl = (Deno.env.get("APP_URL") || "").replace(/\/+$/, "");
const appUrl = configuredAppUrl || DEFAULT_APP_URL;
const allowedOrigins = new Set([DEFAULT_APP_URL, configuredAppUrl].filter(Boolean));
const baseCorsHeaders = {
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const corsHeadersForOrigin = (origin: string | null) => ({
  ...baseCorsHeaders,
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "null",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeadersForOrigin(origin), "Content-Type": "application/json" } });
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const respond = (body: unknown, status = 200) => json(body, status, origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersForOrigin(origin) });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  if (!appUrl || (origin && !allowedOrigins.has(origin))) return respond({ error: "Origin not allowed." }, 403);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return respond({ error: "Invitation service is not configured." }, 500);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return respond({ error: "Sign in first." }, 401);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return respond({ error: "Your session is invalid or expired. Please sign in again." }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond({ error: "Invalid request body." }, 400); }
  if (body.action === "create") {
    const workspaceId = String(body.workspaceId || "");
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return respond({ error: "Enter a valid email address." }, 400);
    if (!workspaceId) return respond({ error: "Workspace is required." }, 400);
    const { data: membership, error: membershipError } = await admin.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
    if (membershipError) return respond({ error: "Could not verify workspace permissions." }, 500);
    if (!membership || !["owner", "admin"].includes(membership.role)) return respond({ error: "Only workspace owners and admins can invite members." }, 403);
    const { data: alreadyInvited } = await admin.from("workspace_invitations").select("id").eq("workspace_id", workspaceId).eq("email", email).is("accepted_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (alreadyInvited) return respond({ error: "There is already a pending invitation for that email." }, 409);
    // Search all Auth user pages so invitations continue to work after the first 1,000 accounts.
    let targetUser: { id: string } | null = null;
    for (let page = 1; ; page += 1) {
      const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) return respond({ error: "Could not verify the invitee. Please try again." }, 500);
      targetUser = usersPage.users.find((u) => (u.email || "").toLowerCase() === email) ?? null;
      if (targetUser || usersPage.users.length < 1000) break;
    }
    if (targetUser) {
      const { data: alreadyMember, error: memberError } = await admin.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("user_id", targetUser.id).maybeSingle();
      if (memberError) return respond({ error: "Could not verify workspace membership." }, 500);
      if (alreadyMember) return respond({ error: "That person is already a member of this workspace." }, 409);
    }
    const token = makeToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await admin.from("workspace_invitations").insert({ workspace_id: workspaceId, email, role: "member", token_hash: await sha256(token), invited_by: user.id, expires_at: expiresAt });
    if (insertError) return respond({ error: "Could not create invitation. Check the invitation database setup." }, 500);
    return respond({ inviteUrl: `${appUrl.replace(/\/$/, "")}/?invite=${encodeURIComponent(token)}`, email, expiresAt, delivery: "manual" });
  }
  if (body.action === "accept") {
    const token = String(body.token || "");
    if (!/^[a-f0-9]{64}$/.test(token)) return respond({ error: "Invitation link is invalid." }, 400);
    const email = String(user.email || "").trim().toLowerCase();
    if (!email || !user.email_confirmed_at) return respond({ error: "Confirm your email address before accepting a workspace invitation." }, 403);
    const { data: accepted, error: acceptError } = await admin.rpc("accept_workspace_invitation", { p_token_hash: await sha256(token), p_email: email, p_user_id: user.id });
    if (acceptError) {
      const message = acceptError.message || "Could not accept invitation.";
      if (message.includes("INVITE_NOT_FOUND")) return respond({ error: "Invitation is invalid or has already been removed." }, 404);
      if (message.includes("INVITE_ALREADY_USED")) return respond({ error: "This invitation has already been used." }, 409);
      if (message.includes("INVITE_EXPIRED")) return respond({ error: "This invitation has expired. Ask the workspace owner for a new one." }, 410);
      if (message.includes("INVITE_EMAIL_MISMATCH")) return respond({ error: "This invitation was issued to a different email address. Sign in with the invited address." }, 403);
      return respond({ error: "Could not accept invitation. Check the invitation database setup." }, 500);
    }
    const row = Array.isArray(accepted) ? accepted[0] : accepted;
    if (!row?.workspace_id) return respond({ error: "The invitation was accepted but the workspace could not be loaded." }, 500);
    return respond({ success: true, workspace: { id: row.workspace_id, name: row.workspace_name } });
  }
  return respond({ error: "Unknown invitation action." }, 400);
});