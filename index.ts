import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

async function validSignature(raw: string, signature: string, secret: string) {
  const prefix = "sha256=";
  if (!signature.startsWith(prefix)) return false;
  const hex = signature.slice(prefix.length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const expected = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ hex.toLowerCase().charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("HANDYPAY_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceKey) return json({ error: "Webhook is not configured" }, 503);
  const raw = await req.text();
  if (raw.length > 1_000_000) return json({ error: "Payload too large" }, 413);
  if (!await validSignature(raw, req.headers.get("x-handypay-signature") ?? "", secret)) return json({ error: "Invalid signature" }, 401);

  let event: any;
  try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!event?.id || !event?.type) return json({ error: "Missing event id/type" }, 400);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: eventInsertError } = await admin.from("handypay_webhook_events").insert({ event_id: event.id, event_type: event.type });
  if (eventInsertError) {
    if (eventInsertError.code !== "23505") return json({ error: "Could not record webhook" }, 500);
    const { data: prior } = await admin.from("handypay_webhook_events").select("processed_at").eq("event_id", event.id).maybeSingle();
    if (prior?.processed_at) return json({ received: true, duplicate: true });
    // An earlier attempt failed before completion; continue processing this retry.
  }

  const data = event.data ?? {};
  const meta = data.metadata ?? data.subscription?.metadata ?? {};
  const workspaceId = meta.workspace_id;
  const planKey = meta.plan_key;
  const billingInterval = meta.billing_interval;
  try {
    if (workspaceId && ["team", "business"].includes(planKey) && ["monthly", "annual"].includes(billingInterval)) {
      const type = String(event.type);
      const isDeleted = type === "customer.subscription.deleted";
      const isFailed = type === "payment_intent.payment_failed" || type === "checkout.session.async_payment_failed";
      const isRefunded = type === "charge.refunded";
      const isSuccess = type === "customer.subscription.created" || type === "customer.subscription.updated" || type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded" || type === "payment_intent.succeeded";
      if (isDeleted || isFailed || isRefunded || isSuccess) {
        const providerStatus = String(data.status ?? "").toLowerCase();
        const status = isDeleted || isRefunded || providerStatus === "canceled" ? "canceled"
          : isFailed || ["past_due", "unpaid"].includes(providerStatus) ? "past_due"
          : providerStatus === "incomplete" ? "incomplete"
          : providerStatus === "trialing" ? "trial"
          : isSuccess ? "active" : "incomplete";
        const { error } = await admin.from("workspace_subscriptions").upsert({
          workspace_id: workspaceId,
          provider: "handypay",
          provider_customer_id: typeof (data.customer ?? data.customer_id) === "string" ? (data.customer ?? data.customer_id) : (data.customer ?? data.customer_id)?.id ?? null,
          provider_subscription_id: typeof (data.subscription ?? data.id) === "string" ? (data.subscription ?? data.id) : (data.subscription ?? data.id)?.id ?? null,
          plan_key: planKey,
          billing_interval: billingInterval,
          status,
          current_period_end: data.current_period_end ? new Date(data.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: Boolean(data.cancel_at_period_end),
          last_payment_at: isSuccess ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "workspace_id" });
        if (error) throw error;
      }
    }
    await admin.from("handypay_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", event.id);
    return json({ received: true });
  } catch (_error) {
    await admin.from("handypay_webhook_events").update({ processing_error: "Subscription update failed" }).eq("event_id", event.id);
    // Return non-2xx so the provider retries after a transient database failure.
    return json({ error: "Webhook processing failed" }, 500);
  }
});
