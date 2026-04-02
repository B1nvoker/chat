(function () {
  const API_URL = "https://YOUR_PROJECT.supabase.co";
  const KEYS = {
    userId: "chat_user_id",
    conversationId: "chat_conversation_id",
    name: "chat_user_name",
    phone: "chat_user_phone",
  };

  let userId = localStorage.getItem(KEYS.userId);
  let conversationId = localStorage.getItem(KEYS.conversationId);
  let lastMessageAt = null;
  let unread = 0;

  const root = document.createElement("div");
  root.style = "position:fixed;bottom:20px;right:20px;z-index:9999;font-family:Inter,Arial,sans-serif;";

  const chatBtn = document.createElement("button");
  chatBtn.type = "button";
  chatBtn.innerHTML = '💬 <span id="chat-badge" style="display:none;background:#ef4444;color:#fff;border-radius:999px;padding:2px 6px;font-size:12px;margin-left:6px;"></span>';
  chatBtn.style = "cursor:pointer;font-size:18px;padding:12px 14px;border-radius:999px;border:none;background:#2563eb;color:#fff;box-shadow:0 8px 18px rgba(37,99,235,.35);";

  const box = document.createElement("div");
  box.style = "display:none;position:absolute;bottom:56px;right:0;width:340px;height:500px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 16px 34px rgba(15,23,42,.18);overflow:hidden;";

  box.innerHTML = `
    <div style="padding:12px;background:#2563eb;color:#fff;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;gap:8px;align-items:center;">
        <div style="width:28px;height:28px;border-radius:999px;background:#fff;color:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;">O</div>
        <div>
          <div style="font-weight:600;line-height:1;">Поддержка</div>
          <div id="operator-status" style="font-size:12px;opacity:.95;">Проверяем статус...</div>
        </div>
      </div>
      <button id="min-btn" style="border:none;background:transparent;color:#fff;font-size:20px;cursor:pointer;">—</button>
    </div>
    <div style="padding:8px;border-bottom:1px solid #e5e7eb;display:flex;gap:6px;">
      <input id="lead-name" placeholder="Ваше имя" style="flex:1;padding:6px;border:1px solid #d1d5db;border-radius:8px;" />
      <input id="lead-phone" placeholder="Телефон" style="flex:1;padding:6px;border:1px solid #d1d5db;border-radius:8px;" />
    </div>
    <div id="msgs" style="height:320px;overflow:auto;padding:10px;background:#f8fafc;"></div>
    <div id="typing" style="height:18px;padding:0 10px 8px;color:#64748b;font-size:12px;"></div>
    <div style="padding:10px;border-top:1px solid #e5e7eb;display:flex;gap:6px;align-items:center;">
      <input id="file" type="file" style="width:86px;font-size:12px;" />
      <input id="input" placeholder="Введите сообщение" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:8px;" />
      <button id="send" style="border:none;background:#2563eb;color:#fff;padding:8px 10px;border-radius:8px;cursor:pointer;">→</button>
    </div>
  `;

  root.appendChild(box);
  root.appendChild(chatBtn);
  document.body.appendChild(root);

  const badge = chatBtn.querySelector("#chat-badge");
  const minBtn = box.querySelector("#min-btn");
  const input = box.querySelector("#input");
  const sendBtn = box.querySelector("#send");
  const msgs = box.querySelector("#msgs");
  const typingEl = box.querySelector("#typing");
  const statusEl = box.querySelector("#operator-status");
  const nameInput = box.querySelector("#lead-name");
  const phoneInput = box.querySelector("#lead-phone");
  const fileInput = box.querySelector("#file");

  nameInput.value = localStorage.getItem(KEYS.name) || "";
  phoneInput.value = localStorage.getItem(KEYS.phone) || "";

  function setUnread(v) {
    unread = v;
    badge.style.display = unread > 0 ? "inline" : "none";
    badge.textContent = unread > 99 ? "99+" : String(unread);
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function addMsg(sender, text, createdAt = new Date().toISOString()) {
    const wrap = document.createElement("div");
    wrap.style = `display:flex;margin:8px 0;${sender === "user" ? "justify-content:flex-end;" : "justify-content:flex-start;"}`;

    const bubble = document.createElement("div");
    bubble.style = `max-width:78%;padding:8px 10px;border-radius:12px;${
      sender === "user"
        ? "background:#2563eb;color:#fff;border-bottom-right-radius:4px;"
        : "background:#fff;border:1px solid #e2e8f0;border-bottom-left-radius:4px;"
    }`;

    bubble.innerHTML = `<div style="white-space:pre-wrap;">${text}</div><div style="font-size:11px;opacity:.7;margin-top:4px;">${formatTime(createdAt)}</div>`;
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    lastMessageAt = createdAt;
  }

  async function syncWidget() {
    if (!conversationId) return;
    const params = new URLSearchParams({ conversationId });
    if (lastMessageAt) params.set("since", lastMessageAt);

    const res = await fetch(`${API_URL}/functions/v1/widgetSync?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();

    statusEl.textContent = data.operatorOnline ? "Оператор онлайн" : "Оператор офлайн";
    typingEl.textContent = data.typing ? "Оператор печатает..." : "";

    (data.messages || []).forEach((m) => {
      addMsg(m.sender, m.text, m.created_at);
      if (box.style.display === "none" && m.sender !== "user") {
        setUnread(unread + 1);
      }
    });
  }

  async function sendTyping() {
    if (!conversationId) return;
    await fetch(`${API_URL}/functions/v1/widgetSync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "typing", actor: "user", conversationId }),
    });
  }

  async function sendMessage() {
    const text = input.value.trim();
    const fileName = fileInput.files?.[0]?.name;
    if (!text && !fileName) return;

    localStorage.setItem(KEYS.name, nameInput.value.trim());
    localStorage.setItem(KEYS.phone, phoneInput.value.trim());

    const payloadText = fileName ? `${text}\n[Файл: ${fileName}]` : text;

    input.value = "";
    fileInput.value = "";
    addMsg("user", payloadText);

    const res = await fetch(`${API_URL}/functions/v1/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: payloadText,
        channel: "web",
        userId,
        conversationId,
        name: nameInput.value.trim() || null,
        phone: phoneInput.value.trim() || null,
      }),
    });

    if (!res.ok) {
      addMsg("bot", "Не удалось отправить сообщение. Попробуйте снова.");
      return;
    }

    const data = await res.json();
    if (data.userId && !userId) {
      userId = data.userId;
      localStorage.setItem(KEYS.userId, userId);
    }
    if (data.conversationId && !conversationId) {
      conversationId = data.conversationId;
      localStorage.setItem(KEYS.conversationId, conversationId);
    }
  }

  chatBtn.onclick = async () => {
    const opening = box.style.display === "none";
    box.style.display = opening ? "block" : "none";
    if (opening) {
      setUnread(0);
      await syncWidget();
    }
  };

  minBtn.onclick = () => {
    box.style.display = "none";
  };

  sendBtn.onclick = sendMessage;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
    else sendTyping();
  });

  // автоответ, если оператор офлайн
  setTimeout(() => {
    addMsg("bot", "Здравствуйте 👋 Мы ответим в течение 5 минут.");
  }, 3000);

  setInterval(syncWidget, 2000);

  // Подгрузить историю сразу, если уже есть сессия.
  syncWidget();
})();
