// script.js
// Loads applications.json, renders UI, validates required fields, posts to Discord webhook,
// and shows a summary of the submitted application including the frontImage as an embed-like card.

// ---------- User settings ----------
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1445633277322068040/qSCrO1nYIif4fP6EwzO6pLO9iHuPtGEIITR9lvQ5vqXxI_VkFhyhpXvhURoLpHD_F6Pn";
const TOP_LOGO_URL = "https://cdn.discordapp.com/icons/1399923432161808515/b1e243e6ddcc36ce1adbf702ad5c34b6.webp?size=1024";
// -----------------------------------

/**
 * Utility: parse question entry into { text: string, required: boolean }
 * Supports multiple formats:
 *  - string only: "Question?"
 *  - string with pipe: "Question?|true" or "Question?|false"
 *  - string with trailing boolean separated by whitespace: "Question?" true
 *  - array: ["Question?", true]
 *  - object: { q: "Question?", required: true }
 */
function parseQuestionEntry(entry) {
  if (typeof entry === "string") {
    // Try pipe syntax: "Question?|true"
    const pipeMatch = entry.match(/^(.*)\|\s*(true|false)\s*$/i);
    if (pipeMatch) {
      return { text: pipeMatch[1].trim(), required: pipeMatch[2].toLowerCase() === "true" };
    }

    // Try trailing boolean with a space: 'Question?" true' or 'Question?" false'
    const trailingMatch = entry.match(/^(.*)\s+(true|false)\s*$/i);
    if (trailingMatch) {
      return { text: trailingMatch[1].trim(), required: trailingMatch[2].toLowerCase() === "true" };
    }

    // default: not required
    return { text: entry.trim(), required: false };
  }

  if (Array.isArray(entry)) {
    const text = String(entry[0] ?? "").trim();
    const required = !!entry[1];
    return { text, required };
  }

  if (typeof entry === "object" && entry !== null) {
    const text = String(entry.q ?? entry.question ?? "").trim();
    const required = !!entry.required;
    return { text, required };
  }

  // fallback
  return { text: String(entry), required: false };
}

// DOM elements (must match your index.html)
const appsContainer = document.getElementById("grid");
const panel = document.getElementById("applicationPanel");
const panelTitle = document.getElementById("appTitle");
const panelQuestions = document.getElementById("qList");
const submitBtn = document.getElementById("submitApp");
const closeBtn = document.getElementById("closePanel");
const clearBtn = document.getElementById("demoClear");
const logoEl = document.querySelector(".logo");

let activeApp = null;
let currentQuestionMeta = []; // array of { text, required }

// Put the provided logo image into the top-left .logo area
function setTopLogo(url) {
  if (!logoEl) return;
  // replace contents with <img> so CSS sizing works; image sits inside existing styled container
  logoEl.innerHTML = `<img id="topLogoImg" src="${encodeURI(url)}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
}
setTopLogo(TOP_LOGO_URL);

// Fetch and render applications
fetch("applications.json")
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status} loading applications.json`);
    return res.json();
  })
  .then(data => {
    if (!data || !Array.isArray(data.Applications)) {
      throw new Error("applications.json missing Applications array");
    }
    renderCards(data.Applications);
  })
  .catch(err => {
    console.error("Error loading applications.json:", err);
    appsContainer.innerHTML = `<div style="color:var(--text-muted)">Unable to load applications.</div>`;
  });

function renderCards(apps) {
  appsContainer.innerHTML = "";

  apps.forEach(app => {
    const card = document.createElement("div");
    card.className = "card";

    // Use frontImage if present
    const imageHtml = app.frontImage
      ? `<div class="thumb"><img src="${app.frontImage}" alt="${escapeHtml(app.title)} preview"></div>`
      : "";

    card.innerHTML = `
      ${imageHtml}
      <div class="meta">
        <h3>${escapeHtml(app.title)}</h3>
        <p class="desc">${escapeHtml(app.description || "")}</p>
      </div>
      <button class="btn" style="margin-top:10px;">Start Application</button>
    `;

    card.querySelector("button").onclick = () => openPanel(app);
    appsContainer.appendChild(card);
  });
}

function openPanel(app) {
  activeApp = app;
  panelTitle.textContent = app.title || "Application";
  panelQuestions.innerHTML = "";
  currentQuestionMeta = [];

  // parse questions (supports string/array/object)
  const rawQuestions = Array.isArray(app.questions) ? app.questions : [];
  rawQuestions.forEach((qEntry, idx) => {
    const parsed = parseQuestionEntry(qEntry);
    currentQuestionMeta.push(parsed);

    const qDiv = document.createElement("div");
    qDiv.className = "q";

    // mark required visually
    const label = parsed.required ? `${escapeHtml(parsed.text)} <span style="color:#fca5a5">*required</span>` : escapeHtml(parsed.text);

    qDiv.innerHTML = `
      <div>${label}</div>
      <textarea data-qindex="${idx}" placeholder="Type your answer here..."></textarea>
    `;
    panelQuestions.appendChild(qDiv);
  });

  panel.classList.remove("hidden");
  // focus first field if present
  const first = panelQuestions.querySelector("textarea");
  if (first) first.focus();
}

// Close panel
closeBtn.onclick = () => {
  panel.classList.add("hidden");
  activeApp = null;
  panelQuestions.innerHTML = "";
  currentQuestionMeta = [];
};

// Submit application click
submitBtn.onclick = async () => {
  if (!activeApp) return alert("No active application.");

  const textareas = [...panelQuestions.querySelectorAll("textarea")];
  const answers = textareas.map(t => t.value.trim());

  // Validate required fields
  const missingRequired = [];
  for (let i = 0; i < currentQuestionMeta.length; i++) {
    if (currentQuestionMeta[i].required && (!answers[i] || answers[i].length === 0)) {
      missingRequired.push({ index: i, question: currentQuestionMeta[i].text });
    }
  }

  if (missingRequired.length > 0) {
    const list = missingRequired.map(m => `• ${m.question}`).join("\n");
    alert(`Please fill in all required fields:\n\n${list}`);
    // highlight missing fields (simple visual cue)
    missingRequired.forEach(m => {
      const ta = panelQuestions.querySelector(`textarea[data-qindex="${m.index}"]`);
      if (ta) {
        ta.style.outline = "2px solid rgba(255,120,120,0.6)";
        setTimeout(() => (ta.style.outline = ""), 3000);
      }
    });
    return;
  }

  // Build a payload summary for display & webhook
  const appTitle = activeApp.title || "Application";
  const appDescription = activeApp.description || "";
  const appImage = activeApp.frontImage || null;

  const fields = currentQuestionMeta.map((meta, i) => ({
    name: meta.text + (meta.required ? " (required)" : ""),
    value: answers[i] || "—"
  }));

  // Show immediate client-side summary to the user
  showSubmittedSummary({ title: appTitle, description: appDescription, image: appImage, fields });

  // Prepare Discord webhook embed
  const embed = {
    title: `${appTitle} — New Application`,
    description: appDescription,
    fields: fields.map(f => ({ name: truncate(f.name, 256), value: truncate(f.value, 1024), inline: false })),
    thumbnail: { url: TOP_LOGO_URL },
    image: appImage ? { url: appImage } : undefined,
    timestamp: new Date().toISOString(),
    color: 0x3b82f6
  };

  const payload = {
    username: "Applications Panel",
    avatar_url: TOP_LOGO_URL,
    embeds: [embed]
  };

  // POST to webhook
  try {
    const res = await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error("Webhook error", res.status, await res.text());
      alert("Application saved locally but failed to send to Discord webhook (see console).");
    } else {
      alert("Application submitted and sent to Discord!");
      // clear textareas after successful submit
      panelQuestions.querySelectorAll("textarea").forEach(t => (t.value = ""));
      panel.classList.add("hidden");
      activeApp = null;
    }
  } catch (err) {
    console.error("Error sending webhook:", err);
    alert("Application saved locally but failed to send to Discord webhook (network error).");
  }
};

// Clear answers button functionality
clearBtn.onclick = () => {
  document.querySelectorAll("textarea").forEach(t => (t.value = ""));
  alert("Answers cleared.");
};

// ---------- Helpers ----------

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, function (m) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m];
  });
}

function truncate(str, max) {
  if (typeof str !== "string") return str;
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// Show submitted summary on-page (simple embed-like card)
function showSubmittedSummary({ title, description, image, fields }) {
  // remove existing summary if present
  const existing = document.getElementById("submissionSummary");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "submissionSummary";
  container.className = "panel";
  container.style.marginTop = "18px";

  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `<h3>Submitted: ${escapeHtml(title)}</h3>`;
  container.appendChild(header);

  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.gap = "14px";
  body.style.alignItems = "flex-start";

  const left = document.createElement("div");
  left.style.flex = "1";

  if (description) {
    const p = document.createElement("p");
    p.className = "desc";
    p.textContent = description;
    left.appendChild(p);
  }

  fields.forEach(f => {
    const fdiv = document.createElement("div");
    fdiv.style.marginTop = "8px";
    fdiv.innerHTML = `<strong>${escapeHtml(f.name)}</strong><div class="muted small" style="margin-top:4px;">${escapeHtml(f.value)}</div>`;
    left.appendChild(fdiv);
  });

  body.appendChild(left);

  if (image) {
    const right = document.createElement("div");
    right.style.width = "220px";
    right.innerHTML = `<div class="thumb" style="height:120px;"><img src="${image}" style="width:100%;height:100%;object-fit:cover;"></div>`;
    body.appendChild(right);
  }

  container.appendChild(body);

  // insert after apps-section or at end of main
  const appsSection = document.querySelector(".apps-section");
  if (appsSection && appsSection.parentNode) {
    appsSection.parentNode.insertBefore(container, appsSection.nextSibling);
  } else {
    document.body.appendChild(container);
  }
}
