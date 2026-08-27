const chat = document.getElementById("chat");
const main = document.querySelector("main");
const form = document.getElementById("chat-form");
const input = document.getElementById("question");
const themeToggle = document.getElementById("theme-toggle");

const TYPE_DELAY_MS = 16;
const MIN_THINKING_MS = 650;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrollToBottom() {
  main.scrollTop = main.scrollHeight;
}

function addMessage(role, text) {
  document.body.classList.add("has-messages");
  const el = document.createElement("div");
  el.className = `message ${role}`;
  el.textContent = text;
  chat.appendChild(el);
  scrollToBottom();
  return el;
}

function showTyping(el) {
  el.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderSources(el, sources) {
  if (!sources || sources.length === 0) return;
  const box = document.createElement("div");
  box.className = "sources";
  box.textContent =
    "Sources: " +
    sources.map((s) => `${s.deck} (slide ${s.page})`).join(", ");
  el.appendChild(box);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  addMessage("user", question);
  input.value = "";
  input.disabled = true;
  document.body.classList.add("is-thinking");

  const assistantEl = addMessage("assistant", "");
  showTyping(assistantEl);

  let fullText = "";
  let networkDone = false;
  let sources = [];
  const startTime = performance.now();

  const typewriter = (async () => {
    let shown = "";
    while (true) {
      const elapsed = performance.now() - startTime;
      if (shown.length < fullText.length && elapsed >= MIN_THINKING_MS) {
        shown = fullText.slice(0, shown.length + 1);
        assistantEl.innerHTML = escapeHtml(shown) + '<span class="caret"></span>';
        scrollToBottom();
        await sleep(TYPE_DELAY_MS);
      } else if (networkDone && shown.length >= fullText.length) {
        assistantEl.textContent = shown;
        break;
      } else {
        await sleep(30);
      }
    }
  })();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "token") {
          fullText += event.content;
        } else if (event.type === "done") {
          sources = event.sources;
        }
      }
    }
  } catch (err) {
    fullText = "Error: could not reach the server.";
  } finally {
    networkDone = true;
    await typewriter;
    renderSources(assistantEl, sources);
    document.body.classList.remove("is-thinking");
    input.disabled = false;
    input.focus();
  }
});

function currentTheme() {
  const stored = localStorage.getItem("theme");
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

themeToggle.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});
