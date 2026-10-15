import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return reply({ error: "Sign in is required." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply({ error: "Account deletion is not configured." }, 500);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return reply({ error: "Your session is invalid. Sign in again and retry." }, 401);
    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== "DELETE") return reply({ error: "Explicit DELETE confirmation is required." }, 400);

    const { data: owned, error: ownedErr } = await admin.from("workspaces").select("id,name").eq("owner_id", user.id);
    if (ownedErr) throw ownedErr;

    for (const ws of owned || []) {
      const { count, error: memberErr } = await admin.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ws.id);
      if (memberErr) throw memberErr;
      if ((count || 0) > 1) {
        return reply({ error: `You own “${ws.name}”, which has other members. Transfer workspace ownership or remove the other members before deleting this account.` }, 409);
      }
    }

    // Remove private image objects for workspaces that will be deleted.
    for (const ws of owned || []) {
      const { data: rows, error: rowsErr } = await admin.from("solutions").select("image_path").eq("workspace_id", ws.id).not("image_path", "is", null);
      if (rowsErr) throw rowsErr;
      const paths = (rows || []).map((r: { image_path: string | null }) => r.image_path).filter(Boolean) as string[];
      for (let i = 0; i < paths.length; i += 100) {
        const { error: storageErr } = await admin.storage.from("solution-images").remove(paths.slice(i, i + 100));
        if (storageErr) throw new Error("Could not safely remove workspace images. No account records were deleted; please retry or contact support.");
      }
    }

    // Remove the user's profile avatar; Storage objects do not cascade with auth-user deletion.
    const { data: profile, error: profileErr } = await admin.from("profiles")
      .select("avatar_path").eq("user_id", user.id).maybeSingle();
    if (profileErr) throw profileErr;
    if (profile?.avatar_path) {
      const { error: avatarStorageErr } = await admin.storage.from("profile-avatars").remove([profile.avatar_path]);
      if (avatarStorageErr) {
        throw new Error("Could not safely remove the profile picture. No account records were deleted; please retry or contact support.");
      }
    }

    // Preserve records in shared workspaces by assigning authorship to that workspace's owner.
    const { data: memberships, error: membershipsErr } = await admin.from("workspace_members").select("workspace_id,workspaces(owner_id)").eq("user_id", user.id);
    if (membershipsErr) throw membershipsErr;
    for (const m of memberships || []) {
      const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
      if (ws?.owner_id && ws.owner_id !== user.id) {
        const { error: reassignErr } = await admin.from("solutions").update({ created_by: ws.owner_id }).eq("workspace_id", m.workspace_id).eq("created_by", user.id);
        if (reassignErr) throw reassignErr;
      }
    }

    for (const ws of owned || []) {
      const { error: invitationsErr } = await admin.from("workspace_invitations").delete().eq("workspace_id", ws.id);
      if (invitationsErr) throw invitationsErr;
      const { error: subsErr } = await admin.from("workspace_subscriptions").delete().eq("workspace_id", ws.id);
      if (subsErr) throw subsErr;
      const { error: solutionsErr } = await admin.from("solutions").delete().eq("workspace_id", ws.id);
      if (solutionsErr) throw solutionsErr;
      const { error: membersErr } = await admin.from("workspace_members").delete().eq("workspace_id", ws.id);
      if (membersErr) throw membersErr;
      const { error: workspaceErr } = await admin.from("workspaces").delete().eq("id", ws.id);
      if (workspaceErr) throw workspaceErr;
    }

    // Cancel invitations sent by the departing user and remove their shared-workspace membership.
    const { error: inviterErr } = await admin.from("workspace_invitations").delete().eq("invited_by", user.id);
    if (inviterErr) throw inviterErr;
    const { error: memberDeleteErr } = await admin.from("workspace_members").delete().eq("user_id", user.id);
    if (memberDeleteErr) throw memberDeleteErr;

    const { error: deleteUserErr } = await admin.auth.admin.deleteUser(user.id);
    if (deleteUserErr) throw deleteUserErr;

    return reply({ success: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return reply({ error: error instanceof Error ? error.message : "Account deletion failed." }, 500);
  }
});