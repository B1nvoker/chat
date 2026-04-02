import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "POST") {
    const body = await req.json();
    if (body?.action === "typing" && body?.conversationId && body?.actor) {
      await supabase.from("typing_events").insert({
        conversation_id: body.conversationId,
        actor: body.actor,
        expires_at: new Date(Date.now() + 4000).toISOString(),
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");
  const since = url.searchParams.get("since");

  if (!conversationId) {
    return new Response(JSON.stringify({ messages: [], typing: false, operatorOnline: false }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let query = supabase
    .from("messages")
    .select("id, sender, text, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (since) {
    query = query.gt("created_at", since);
  }

  const { data: messages } = await query;

  const now = new Date().toISOString();

  const [{ data: typingRows }, { data: onlineRow }] = await Promise.all([
    supabase
      .from("typing_events")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("actor", "operator")
      .gt("expires_at", now)
      .limit(1),
    supabase
      .from("operator_presence")
      .select("is_online")
      .eq("is_online", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return new Response(
    JSON.stringify({
      messages: messages || [],
      typing: Boolean(typingRows?.length),
      operatorOnline: Boolean(onlineRow?.is_online),
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
});
