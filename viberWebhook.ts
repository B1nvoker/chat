import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const event = await req.json();
  const viberUserId = String(event?.sender?.id || "");
  const text = String(event?.message?.text || "").trim();

  if (!viberUserId || !text) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: user } = await supabase
    .from("users")
    .upsert({ channel: "viber", external_id: viberUserId }, { onConflict: "channel,external_id" })
    .select("id")
    .single();

  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existingConv?.id;

  if (!conversationId) {
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, status: "new" })
      .select("id")
      .single();
    conversationId = conv.id;
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    sender: "user",
    text,
    channel: "viber",
    meta: { raw: event },
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
