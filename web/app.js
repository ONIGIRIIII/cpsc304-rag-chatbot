const chat = document.getElementById("chat");
const main = document.querySelector("main");
const form = document.getElementById("chat-form");
const input = document.getElementById("question");
const themeToggle = document.getElementById("theme-toggle");
const historyToggle = document.getElementById("history-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const newChatBtn = document.getElementById("new-chat");
const sessionListEl = document.getElementById("session-list");

const TYPE_DELAY_MS = 16;
const MIN_THINKING_MS = 650;
const MAX_SESSIONS = 10;
const SESSIONS_KEY = "cpsc304-sessions";

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

// ---- Session history (localStorage, last MAX_SESSIONS conversations) ----

let sessions = loadSessions();
let currentSession = null;

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions() {
  if (sessions.length > MAX_SESSIONS) {
    sessions = sessions.slice(0, MAX_SESSIONS);
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function ensureCurrentSession() {
  if (currentSession) return currentSession;
  currentSession = { id: crypto.randomUUID(), updatedAt: Date.now(), messages: [] };
  sessions.unshift(currentSession);
  saveSessions();
  return currentSession;
}

function recordMessage(role, text, sources) {
  const session = ensureCurrentSession();
  session.messages.push(sources ? { role, text, sources } : { role, text });
  session.updatedAt = Date.now();
  saveSessions();
  renderSessionList();
}

function timeAgo(ts) {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  return `${diffDay}d ago`;
}

function renderSessionList() {
  sessionListEl.innerHTML = "";

  if (sessions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "session-empty";
    empty.textContent = "No conversations yet";
    sessionListEl.appendChild(empty);
    return;
  }

  for (const session of sessions) {
    const firstUserMsg = session.messages.find((m) => m.role === "user");
    const title = firstUserMsg ? firstUserMsg.text : "New conversation";

    const item = document.createElement("button");
    item.type = "button";
    item.className =
      "session-item" + (currentSession && session.id === currentSession.id ? " active" : "");

    const titleEl = document.createElement("div");
    titleEl.className = "session-title";
    titleEl.textContent = title;

    const timeEl = document.createElement("div");
    timeEl.className = "session-time";
    timeEl.textContent = timeAgo(session.updatedAt);

    item.appendChild(titleEl);
    item.appendChild(timeEl);
    item.addEventListener("click", () => selectSession(session.id));
    sessionListEl.appendChild(item);
  }
}

function renderSessionMessages(session) {
  chat.innerHTML = "";
  if (!session.messages.length) {
    document.body.classList.remove("has-messages");
    return;
  }
  document.body.classList.add("has-messages");
  for (const msg of session.messages) {
    const el = document.createElement("div");
    el.className = `message ${msg.role}`;
    el.textContent = msg.text;
    chat.appendChild(el);
    if (msg.role === "assistant" && msg.sources) {
      renderSources(el, msg.sources);
    }
  }
  scrollToBottom();
}

function selectSession(id) {
  if (input.disabled) return;
  const session = sessions.find((s) => s.id === id);
  if (!session) return;
  currentSession = session;
  renderSessionMessages(session);
  renderSessionList();
  closeSidebar();
}

function startNewChat() {
  if (input.disabled) return;
  currentSession = null;
  chat.innerHTML = "";
  document.body.classList.remove("has-messages");
  renderSessionList();
  closeSidebar();
  input.focus();
}

function openSidebar() {
  renderSessionList();
  document.body.classList.add("sidebar-open");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

historyToggle.addEventListener("click", () => {
  document.body.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
});
sidebarBackdrop.addEventListener("click", closeSidebar);
newChatBtn.addEventListener("click", startNewChat);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSidebar();
});

// Restore the most recent conversation (if any) on page load.
if (sessions.length > 0) {
  currentSession = sessions[0];
  renderSessionMessages(currentSession);
}
renderSessionList();

// ---- Chat submit ----

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;

  addMessage("user", question);
  recordMessage("user", question);
  input.value = "";
  input.disabled = true;
  newChatBtn.disabled = true;
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
    recordMessage("assistant", fullText, sources);
    document.body.classList.remove("is-thinking");
    input.disabled = false;
    newChatBtn.disabled = false;
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
