import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

type Channel = "web" | "telegram" | "viber";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeChannel(channel: string | undefined): Channel {
  if (channel === "telegram" || channel === "viber") return channel;
  return "web";
}

function sanitizeText(text: string): string {
  return text.replace(/[<>]/g, "").trim().slice(0, 4000);
}

async function ensureConversation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  conversationId?: string
): Promise<string> {
  if (conversationId) return conversationId;

  const { data: openConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openConv?.id) return openConv.id;

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, status: "new" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return conv.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const body = await req.json();
  const text = sanitizeText(String(body?.text || ""));
  const channel = normalizeChannel(body?.channel);
  const userId = body?.userId as string | undefined;
  const conversationId = body?.conversationId as string | undefined;
  const name = body?.name ? String(body.name).slice(0, 120) : null;
  const phone = body?.phone ? String(body.phone).slice(0, 40) : null;

  if (!text) {
    return new Response(JSON.stringify({ error: "Text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let resolvedUserId = userId;

  if (!resolvedUserId) {
    const { data: user, error } = await supabase
      .from("users")
      .insert({ channel, name, phone })
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    resolvedUserId = user.id;
  } else if (name || phone) {
    await supabase
      .from("users")
      .update({ name, phone })
      .eq("id", resolvedUserId);
  }

  // basic anti-spam rate limit: 20 messages / minute per user
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", resolvedUserId)
    .gte("created_at", since);

  if ((count || 0) > 20) {
    return new Response(JSON.stringify({ error: "Too many messages, try later" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let convId: string;
  try {
    convId = await ensureConversation(supabase, resolvedUserId, conversationId);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { error: messageError } = await supabase.from("messages").insert({
    conversation_id: convId,
    user_id: resolvedUserId,
    sender: "user",
    text,
    channel,
  });

  if (messageError) {
    return new Response(JSON.stringify({ error: messageError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ ok: true, conversationId: convId, userId: resolvedUserId }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
