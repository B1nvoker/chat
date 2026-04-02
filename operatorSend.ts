import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendToTelegram(chatId: string, text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendToViber(receiver: string, text: string) {
  const token = Deno.env.get("VIBER_BOT_TOKEN");
  if (!token) return;
  await fetch("https://chatapi.viber.com/pa/send_message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Viber-Auth-Token": token,
    },
    body: JSON.stringify({
      receiver,
      type: "text",
      text,
    }),
  });
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

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: authData } = await supabaseAuth.auth.getUser();
  const role = authData.user?.user_metadata?.role;
  if (!authData.user || (role !== "operator" && role !== "admin")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { conversationId, text } = await req.json();
  if (!conversationId || !text) {
    return new Response(JSON.stringify({ error: "conversationId and text are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const messageText = String(text).replace(/[<>]/g, "").trim().slice(0, 4000);
  if (!messageText) {
    return new Response(JSON.stringify({ error: "Text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, user_id")
    .eq("id", conversationId)
    .single();

  if (!conv) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, channel, external_id")
    .eq("id", conv.user_id)
    .single();

  await supabase.from("messages").insert({
    conversation_id: conv.id,
    user_id: user.id,
    sender: "operator",
    text: messageText,
    channel: user.channel,
  });

  await supabase
    .from("conversations")
    .update({ assigned_operator: authData.user.id, status: "in_progress" })
    .eq("id", conv.id);

  if (user.channel === "telegram" && user.external_id) {
    await sendToTelegram(user.external_id, messageText);
  } else if (user.channel === "viber" && user.external_id) {
    await sendToViber(user.external_id, messageText);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
