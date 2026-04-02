import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req) => {
  const { text, conversationId } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let convId = conversationId;

  // если нет — создаем
  if (!convId) {
    const { data: user } = await supabase
      .from("users")
      .insert({ channel: "web" })
      .select()
      .single();

    const { data: conv } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select()
      .single();

    convId = conv.id;
  }

  await supabase.from("messages").insert({
    conversation_id: convId,
    sender: "user",
    text,
  });

  return new Response(JSON.stringify({ ok: true, conversationId: convId }));
});
