const chat = document.getElementById("chat");
const main = document.querySelector("main");
const form = document.getElementById("chat-form");
const input = document.getElementById("question");
const themeToggle = document.getElementById("theme-toggle");
const sidebarToggle = document.getElementById("sidebar-toggle");
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

    const item = document.createElement("div");
    item.className =
      "session-item" + (currentSession && session.id === currentSession.id ? " active" : "");

    const mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "session-main";

    const titleEl = document.createElement("div");
    titleEl.className = "session-title";
    titleEl.textContent = title;

    const timeEl = document.createElement("div");
    timeEl.className = "session-time";
    timeEl.textContent = timeAgo(session.updatedAt);

    mainBtn.appendChild(titleEl);
    mainBtn.appendChild(timeEl);
    mainBtn.addEventListener("click", () => selectSession(session.id));

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "session-menu-btn";
    menuBtn.setAttribute("aria-label", "Session options");
    menuBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">' +
      '<circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/>' +
      "</svg>";

    const menu = document.createElement("div");
    menu.className = "session-menu";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "session-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });
    menu.appendChild(deleteBtn);

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = menu.classList.contains("open");
      closeAllSessionMenus();
      if (!wasOpen) {
        menu.classList.add("open");
        menuBtn.classList.add("menu-open");
      }
    });

    item.appendChild(mainBtn);
    item.appendChild(menuBtn);
    item.appendChild(menu);
    sessionListEl.appendChild(item);
  }
}

function closeAllSessionMenus() {
  sessionListEl
    .querySelectorAll(".session-menu.open")
    .forEach((m) => m.classList.remove("open"));
  sessionListEl
    .querySelectorAll(".session-menu-btn.menu-open")
    .forEach((b) => b.classList.remove("menu-open"));
}

document.addEventListener("click", closeAllSessionMenus);

function deleteSession(id) {
  sessions = sessions.filter((s) => s.id !== id);
  saveSessions();
  if (currentSession && currentSession.id === id) {
    currentSession = null;
    chat.innerHTML = "";
    document.body.classList.remove("has-messages");
  }
  renderSessionList();
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
}

function startNewChat() {
  if (input.disabled) return;
  currentSession = null;
  chat.innerHTML = "";
  document.body.classList.remove("has-messages");
  renderSessionList();
  input.focus();
}

function setSidebarCollapsed(collapsed) {
  if (collapsed) {
    document.documentElement.setAttribute("data-sidebar", "collapsed");
    localStorage.setItem("sidebarCollapsed", "1");
  } else {
    document.documentElement.removeAttribute("data-sidebar");
    localStorage.removeItem("sidebarCollapsed");
  }
}

sidebarToggle.addEventListener("click", () => {
  const isCollapsed = document.documentElement.getAttribute("data-sidebar") === "collapsed";
  setSidebarCollapsed(!isCollapsed);
});
newChatBtn.addEventListener("click", startNewChat);

// Always start on the empty-state screen; a conversation only loads when
// the user explicitly picks "New chat" or a past session from the sidebar.
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
