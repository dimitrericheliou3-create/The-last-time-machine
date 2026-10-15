import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_APP_URL = "https://the-last-time-machine.pages.dev";

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sendNotice(args: {
  apiKey: string;
  from: string;
  to: string;
  name: string;
  stage: string;
  lastActiveAt: string;
  appUrl: string;
}) {
  const { apiKey, from, to, name, stage, lastActiveAt, appUrl } = args;
  const subjectByStage: Record<string, string> = {
    warning_30d: "Your Last Time Machine account may be deleted in 30 days",
    warning_15d: "Reminder: your Last Time Machine account is approaching deletion",
    warning_7d: "Final reminder: sign in to keep your Last Time Machine account",
    workspace_owner_protected: "Action needed for your inactive Last Time Machine workspace",
    active_subscription_protected: "Your Last Time Machine account has an active subscription",
  };
  const explainByStage: Record<string, string> = {
    warning_30d: "Your account has been inactive for seven months. If you want to keep it, sign in within the next 30 days.",
    warning_15d: "Your account is still inactive. Sign in now if you want to keep your account and any sole-owner workspace data.",
    warning_7d: "This is the final reminder. Your account is scheduled for deletion after eight months of inactivity. Sign in before that deadline to reset the inactivity timer.",
    workspace_owner_protected: "You own a workspace with other members. To protect their access and business knowledge, your account will not be automatically deleted while you remain its owner. Sign in to review the workspace or arrange a safe ownership transfer.",
    active_subscription_protected: "An active or past-due subscription is associated with a workspace you own. We will not automatically delete that account while the subscription needs attention. Sign in to review the workspace and billing status.",
  };
  const lastActiveDate = new Date(lastActiveAt).toLocaleDateString("en", { dateStyle: "long", timeZone: "UTC" });
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033;line-height:1.6">
    <h1 style="font-size:24px">The Last Time Machine</h1>
    <p>Hi ${escapeHtml(name || "there")},</p>
    <p>${escapeHtml(explainByStage[stage] || "Please sign in to keep your account active.")}</p>
    <p><strong>Last recorded activity:</strong> ${escapeHtml(lastActiveDate)} (UTC)</p>
    <p><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#315ee8;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px">Open The Last Time Machine</a></p>
    <p>If you no longer need the service, you don't need to do anything. For a workspace with other members, we will protect shared workspace data rather than automatically remove it.</p>
    <p style="font-size:12px;color:#667085">This is an account-retention notice from The Last Time Machine.</p>
  </div>`;
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: subjectByStage[stage] || "The Last Time Machine account notice", html }),
  });
  if (!result.ok) {
    const safeMessage = await result.text().catch(() => "");
    console.error("Resend notice failed", result.status, safeMessage.slice(0, 500));
    throw new Error("Could not send inactivity notice; no account was deleted.");
  }
}

function escapeHtml(input: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return input.replace(/[&<>"']/g, (char) => entities[char] || char);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("INACTIVITY_CRON_SECRET");
  if (!expectedSecret) return response({ error: "Inactivity sweep is not configured." }, 503);
  if (req.headers.get("Authorization") !== `Bearer ${expectedSecret}`) {
    return response({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response({ error: "Supabase admin configuration is missing." }, 503);

  const body = await req.json().catch(() => ({}));
  // Safe by default: requests are dry-run unless the caller explicitly opts in.
  const dryRun = body?.dry_run !== false;
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("INACTIVITY_FROM_EMAIL") || "";
  const appUrl = (Deno.env.get("APP_URL") || DEFAULT_APP_URL).replace(/\/+$/, "");
  if (!dryRun && (!resendKey || !fromEmail)) {
    return response({ error: "Configure RESEND_API_KEY and INACTIVITY_FROM_EMAIL before enabling deletion. No accounts were changed." }, 503);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const sevenMonthsAgo = subtractMonths(now, 7);
  const sevenMonthsFifteenDaysAgo = new Date(sevenMonthsAgo.getTime() - 15 * 86400000);
  const sevenMonthsTwentyThreeDaysAgo = new Date(sevenMonthsAgo.getTime() - 23 * 86400000);
  const eightMonthsAgo = subtractMonths(now, 8);

  const { data: profiles, error: profileError } = await admin.from("profiles")
    .select("user_id,display_name,email,last_active_at")
    .lte("last_active_at", sevenMonthsAgo.toISOString())
    .order("last_active_at", { ascending: true })
    .limit(500);
  if (profileError) return response({ error: "Could not load inactivity candidates." }, 500);

  const report = { dry_run: dryRun, scanned: profiles?.length || 0, notices_sent: 0, protected: 0, waiting_for_final_warning: 0, deleted: 0, candidates: [] as string[] };

  for (const profile of profiles || []) {
    const userId = profile.user_id as string;
    const email = (profile.email || "").trim();
    const lastActiveAt = profile.last_active_at as string;
    const lastActive = new Date(lastActiveAt);
    const dueForDeletion = lastActive <= eightMonthsAgo;
    let stage = "";
    if (lastActive <= sevenMonthsAgo && lastActive > sevenMonthsFifteenDaysAgo) stage = "warning_30d";
    else if (lastActive <= sevenMonthsFifteenDaysAgo && lastActive > sevenMonthsTwentyThreeDaysAgo) stage = "warning_15d";
    else if (lastActive <= sevenMonthsTwentyThreeDaysAgo && lastActive > eightMonthsAgo) stage = "warning_7d";

    if (stage) {
      const { data: existingNotice, error: noticeReadError } = await admin.from("account_inactivity_notices")
        .select("user_id").eq("user_id", userId).eq("notice_stage", stage).maybeSingle();
      if (noticeReadError) return response({ error: "Could not check inactivity reminder history." }, 500);
      if (!existingNotice && !dryRun && email) {
        await sendNotice({ apiKey: resendKey, from: fromEmail, to: email, name: profile.display_name || "", stage, lastActiveAt, appUrl });
        const { error: noticeInsertError } = await admin.from("account_inactivity_notices").insert({ user_id: userId, notice_stage: stage });
        if (noticeInsertError) console.error("Could not save notice history after delivery", noticeInsertError.message);
        report.notices_sent++;
      }
    }

    if (!dueForDeletion) continue;
    if (dryRun) {
      report.candidates.push(userId);
      continue;
    }

    // The account must have received the final warning at least seven days before deletion.
    const { data: finalNotice, error: finalNoticeError } = await admin.from("account_inactivity_notices")
      .select("user_id,sent_at").eq("user_id", userId).eq("notice_stage", "warning_7d").maybeSingle();
    if (finalNoticeError) return response({ error: "Could not check final warning status." }, 500);

    if (!finalNotice) {
      if (!email) { report.protected++; continue; }
      // Send and record the final warning, then always stop this run. If recording fails,
      // fail closed: a later run may retry the notice, but this account cannot be deleted.
      await sendNotice({ apiKey: resendKey, from: fromEmail, to: email, name: profile.display_name || "", stage: "warning_7d", lastActiveAt, appUrl });
      const { error: noticeInsertError } = await admin.from("account_inactivity_notices")
        .insert({ user_id: userId, notice_stage: "warning_7d" });
      if (noticeInsertError) {
        console.error("Could not save final warning history", noticeInsertError.message);
        return response({ error: "Could not record final warning delivery; the account was not deleted." }, 500);
      }
      report.notices_sent++;
      report.waiting_for_final_warning++;
      continue;
    }

    // Never delete until at least seven full days after the final warning was recorded.
    // Missing/invalid timestamps fail closed and require investigation.
    const finalNoticeSentAt = Date.parse(finalNotice.sent_at || "");
    const minimumFinalNoticeWaitMs = 7 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(finalNoticeSentAt) || Date.now() - finalNoticeSentAt < minimumFinalNoticeWaitMs) {
      report.waiting_for_final_warning++;
      continue;
    }

    const { data: ownedWorkspaces, error: ownedError } = await admin.from("workspaces").select("id,name").eq("owner_id", userId);
    if (ownedError) return response({ error: "Could not verify workspace ownership." }, 500);

    let blocker: "workspace_owner_protected" | "active_subscription_protected" | "" = "";
    for (const ws of ownedWorkspaces || []) {
      const { count, error: memberError } = await admin.from("workspace_members")
        .select("user_id", { count: "exact", head: true }).eq("workspace_id", ws.id);
      if (memberError) return response({ error: "Could not verify workspace membership." }, 500);
      if ((count || 0) > 1) { blocker = "workspace_owner_protected"; break; }

      const { count: activeSubscriptionCount, error: subscriptionError } = await admin.from("workspace_subscriptions")
        .select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).in("status", ["active", "past_due"]);
      if (subscriptionError) return response({ error: "Could not verify workspace billing." }, 500);
      if ((activeSubscriptionCount || 0) > 0) { blocker = "active_subscription_protected"; break; }
    }

    if (blocker) {
      const { data: existingBlockNotice, error: blockReadError } = await admin.from("account_inactivity_notices")
        .select("user_id").eq("user_id", userId).eq("notice_stage", blocker).maybeSingle();
      if (blockReadError) return response({ error: "Could not check workspace protection notice history." }, 500);
      if (!existingBlockNotice && email) {
        await sendNotice({ apiKey: resendKey, from: fromEmail, to: email, name: profile.display_name || "", stage: blocker, lastActiveAt, appUrl });
        const { error } = await admin.from("account_inactivity_notices").insert({ user_id: userId, notice_stage: blocker });
        if (error) console.error("Could not save workspace protection notice history", error.message);
        report.notices_sent++;
      }
      report.protected++;
      continue;
    }

    report.candidates.push(userId);
    // Remove image files for single-member workspaces that will be removed.
    let safeToDelete = true;
    for (const ws of ownedWorkspaces || []) {
      const { data: rows, error: imageRowsError } = await admin.from("solutions").select("image_path")
        .eq("workspace_id", ws.id).not("image_path", "is", null);
      if (imageRowsError) { safeToDelete = false; break; }
      const paths = (rows || []).map((row: { image_path: string | null }) => row.image_path).filter(Boolean) as string[];
      for (let i = 0; i < paths.length; i += 100) {
        const { error: removeError } = await admin.storage.from("solution-images").remove(paths.slice(i, i + 100));
        if (removeError) { safeToDelete = false; break; }
      }
      if (!safeToDelete) break;
    }
    if (!safeToDelete) { report.protected++; continue; }

    // Clean up the user's profile avatar too; Storage does not cascade with auth-user deletion.
    const { data: avatarProfile, error: avatarProfileError } = await admin.from("profiles")
      .select("avatar_path").eq("user_id", userId).maybeSingle();
    if (avatarProfileError) { report.protected++; continue; }
    if (avatarProfile?.avatar_path) {
      const { error: avatarRemoveError } = await admin.storage.from("profile-avatars").remove([avatarProfile.avatar_path]);
      if (avatarRemoveError) { report.protected++; continue; }
    }

    // Keep shared-workspace content and reassign authorship before removing this member.
    const { data: memberships, error: membershipsError } = await admin.from("workspace_members")
      .select("workspace_id,workspaces(owner_id)").eq("user_id", userId);
    if (membershipsError) { report.protected++; continue; }
    for (const membership of memberships || []) {
      const ws = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces;
      if (ws?.owner_id && ws.owner_id !== userId) {
        const { error } = await admin.from("solutions").update({ created_by: ws.owner_id })
          .eq("workspace_id", membership.workspace_id).eq("created_by", userId);
        if (error) { safeToDelete = false; break; }
      }
    }
    if (!safeToDelete) { report.protected++; continue; }

    for (const ws of ownedWorkspaces || []) {
      const operations = [
        () => admin.from("workspace_invitations").delete().eq("workspace_id", ws.id),
        () => admin.from("workspace_subscriptions").delete().eq("workspace_id", ws.id),
        () => admin.from("solutions").delete().eq("workspace_id", ws.id),
        () => admin.from("workspace_members").delete().eq("workspace_id", ws.id),
        () => admin.from("workspaces").delete().eq("id", ws.id),
      ];
      for (const operation of operations) {
        const { error } = await operation();
        if (error) { safeToDelete = false; break; }
      }
      if (!safeToDelete) break;
    }
    if (!safeToDelete) { report.protected++; continue; }

    const { error: inviterError } = await admin.from("workspace_invitations").delete().eq("invited_by", userId);
    if (inviterError) { report.protected++; continue; }
    const { error: memberDeleteError } = await admin.from("workspace_members").delete().eq("user_id", userId);
    if (memberDeleteError) { report.protected++; continue; }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) { report.protected++; continue; }
    report.deleted++;
  }

  return response(report);
});
