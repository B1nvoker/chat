(function () {
  const API_URL = "https://YOUR_PROJECT.supabase.co";

  let conversationId = localStorage.getItem("chat_conversation");

  const chatBtn = document.createElement("div");
  chatBtn.innerText = "💬";
  chatBtn.style = "position:fixed;bottom:20px;right:20px;cursor:pointer;font-size:24px;";
  document.body.appendChild(chatBtn);

  const chatBox = document.createElement("div");
  chatBox.style = "position:fixed;bottom:70px;right:20px;width:300px;height:400px;background:#fff;border:1px solid #ccc;display:none;flex-direction:column;";
  document.body.appendChild(chatBox);

  const messagesDiv = document.createElement("div");
  messagesDiv.style = "flex:1;overflow:auto;padding:10px;";
  chatBox.appendChild(messagesDiv);

  const input = document.createElement("input");
  input.placeholder = "Введите сообщение...";
  chatBox.appendChild(input);

  chatBtn.onclick = () => {
    chatBox.style.display = chatBox.style.display === "none" ? "flex" : "none";
  };

  // авто-приветствие
  setTimeout(() => {
    addMessage("bot", "Здравствуйте 👋 Чем можем помочь?");
  }, 2000);

  function addMessage(sender, text) {
    const msg = document.createElement("div");
    msg.innerText = text;
    msg.style.margin = "5px";
    messagesDiv.appendChild(msg);
  }

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const text = input.value;
      input.value = "";

      addMessage("user", text);

      await fetch(API_URL + "/functions/v1/sendMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          text,
        }),
      });
    }
  });
})();
