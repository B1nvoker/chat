import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "PUBLIC_ANON_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const el = (id) => document.getElementById(id);

const authView = el("auth");
const appView = el("app");
const authErr = el("authErr");

const convsEl = el("convs");
const messagesEl = el("messages");
const typingEl = el("typing");
const currentConvEl = el("currentConv");
const searchEl = el("search");
const filterEl = el("filter");
const inputEl = el("input");
const quickRepliesEl = el("quickReplies");

let selectedConversation = null;
let currentUser = null;
let conversations = [];

function renderMessage(sender, text) {
  const div = document.createElement("div");
  div.className = `msg ${sender === "operator" ? "msg-operator" : "msg-user"}`;
  div.textContent = text;
  return div;
}

async function loadQuickReplies() {
  const { data } = await supabase.from("quick_replies").select("title, body").limit(20);
  quickRepliesEl.innerHTML = "";
  (data || []).forEach((item) => {
    const btn = document.createElement("button");
    btn.textContent = item.title;
    btn.onclick = () => {
      inputEl.value = item.body;
      inputEl.focus();
    };
    quickRepliesEl.appendChild(btn);
  });
}

function applyFilters(rows) {
  const q = searchEl.value.trim().toLowerCase();
  const status = filterEl.value;

  return rows.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (!q) return true;
    return (
      (c.last_message || "").toLowerCase().includes(q) ||
      (c.users?.phone || "").toLowerCase().includes(q) ||
      (c.users?.name || "").toLowerCase().includes(q)
    );
  });
}

function drawConversations() {
  convsEl.innerHTML = "";
  const rows = applyFilters(conversations);

  rows.forEach((c) => {
    const div = document.createElement("div");
    div.className = `conv ${selectedConversation?.id === c.id ? "active" : ""}`;
    div.innerHTML = `
      <div><b>${c.users?.name || c.users?.phone || c.id.slice(0, 8)}</b> <span class="meta">${c.status}</span></div>
      <div>${c.last_message || "Без сообщений"}</div>
      <div class="meta">${c.users?.channel || "web"}</div>
    `;
    div.onclick = async () => {
      selectedConversation = c;
      currentConvEl.textContent = `Диалог ${c.id.slice(0, 8)} • ${c.status}`;
      drawConversations();
      await loadMessages(c.id);
    };
    convsEl.appendChild(div);
  });
}

async function loadConversations() {
  const { data } = await supabase
    .from("conversations")
    .select("id, status, last_message, updated_at, assigned_operator, users(name, phone, channel)")
    .order("updated_at", { ascending: false })
    .limit(200);

  conversations = data || [];
  drawConversations();
}

async function loadMessages(conversationId) {
  const { data } = await supabase
    .from("messages")
    .select("sender, text, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  messagesEl.innerHTML = "";
  (data || []).forEach((m) => messagesEl.appendChild(renderMessage(m.sender, m.text)));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendTyping() {
  if (!selectedConversation) return;
  await fetch(`${SUPABASE_URL}/functions/v1/widgetSync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "typing", actor: "operator", conversationId: selectedConversation.id }),
  });
}

async function sendOperatorMessage() {
  if (!selectedConversation) return;
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  await fetch(`${SUPABASE_URL}/functions/v1/operatorSend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ conversationId: selectedConversation.id, text }),
  });
}

async function assignToMe() {
  if (!selectedConversation || !currentUser) return;
  await supabase
    .from("conversations")
    .update({ assigned_operator: currentUser.id, status: "in_progress" })
    .eq("id", selectedConversation.id);

  await loadConversations();
}

async function setPresence(online) {
  if (!currentUser) return;
  await supabase.from("operator_presence").upsert({
    operator_id: currentUser.id,
    is_online: online,
    updated_at: new Date().toISOString(),
  });
}

async function login() {
  authErr.textContent = "";
  const email = el("email").value.trim();
  const password = el("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    authErr.textContent = error.message;
    return;
  }

  currentUser = data.user;
  const role = currentUser?.user_metadata?.role;
  if (role !== "operator" && role !== "admin") {
    authErr.textContent = "У пользователя нет роли operator/admin";
    await supabase.auth.signOut();
    return;
  }

  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  await setPresence(true);
  await Promise.all([loadQuickReplies(), loadConversations()]);

  supabase
    .channel("dashboard-realtime")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
      if (payload.new.conversation_id === selectedConversation?.id) {
        messagesEl.appendChild(renderMessage(payload.new.sender, payload.new.text));
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      await loadConversations();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "typing_events" }, (payload) => {
      if (payload.new.conversation_id === selectedConversation?.id && payload.new.actor === "user") {
        typingEl.textContent = "Пользователь печатает...";
        setTimeout(() => (typingEl.textContent = ""), 1500);
      }
    })
    .subscribe();
}

el("login").onclick = login;
el("send").onclick = sendOperatorMessage;
el("assign").onclick = assignToMe;
searchEl.oninput = drawConversations;
filterEl.onchange = drawConversations;
inputEl.onkeydown = (e) => {
  if (e.key === "Enter") sendOperatorMessage();
  else sendTyping();
};

window.addEventListener("beforeunload", () => {
  setPresence(false);
});
