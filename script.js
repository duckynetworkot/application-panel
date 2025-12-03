// script.js (updated)
// - Robust image loading (tries with crossOrigin, then without, falls back to placeholder)
// - Supports Option C: "Question text | true/false"
// - Replaces top .logo text if it contains a URL with an <img>
// - Required-field enforcement
// - Sends embed to the configured webhook and shows submitted summary
// - Matches your index.html IDs

const WEBHOOK_URL = "https://discord.com/api/webhooks/1445633277322068040/qSCrO1nYIif4fP6EwzO6pLO9iHuPtGEIITR9lvQ5vqXxI_VkFhyhpXvhURoLpHD_F6Pn";
const TOP_LOGO_DEFAULT = "https://cdn.discordapp.com/icons/1399923432161808515/b1e243e6ddcc36ce1adbf702ad5c34b6.webp?size=1024";
const PLACEHOLDER_IMG = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="100%" height="100%" fill="#132b4d"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9bb3d1" font-family="Arial" font-size="28">Image unavailable</text></svg>'
);

// DOM references (must match your HTML)
const appsContainer = document.getElementById("grid");
const panel = document.getElementById("applicationPanel");
const panelTitle = document.getElementById("appTitle");
const panelQuestions = document.getElementById("qList");
const closePanelBtn = document.getElementById("closePanel");
const submitBtn = document.getElementById("submitApp");
const submitMsg = document.getElementById("submitMsg");
const clearBtn = document.getElementById("demoClear");
const logoEl = document.querySelector(".logo");

let activeApp = null;
let currentMeta = [];

// -----------------------------
// Helpers
// -----------------------------
function escapeHtml(s){ if (s==null) return ""; return String(s).replace(/[&<>"']/g, m=> ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[m]); }
function truncate(s,n){ if (typeof s!=='string') return s; return s.length>n? s.slice(0,n-1)+'…': s; }

// Attempt to find a working image src.
// Try loading via an Image element with crossOrigin then without. If both error, return placeholder.
function loadImageSrc(url, timeout = 5000) {
  return new Promise((resolve) => {
    if (!url) return resolve(PLACEHOLDER_IMG);

    // normalize (some users paste with surrounding whitespace or quotes)
    url = String(url).trim().replace(/^"(.*)"$/, "$1");

    const tryLoad = (src, useCrossOrigin) => {
      return new Promise((res) => {
        const img = new Image();
        if (useCrossOrigin) img.crossOrigin = "anonymous";
        let done = false;
        const onOK = () => { if (done) return; done = true; cleanup(); res({ ok: true, src }); };
        const onFail = () => { if (done) return; done = true; cleanup(); res({ ok: false }); };
        const cleanup = () => { img.onload = img.onerror = null; clearTimeout(timer); };
        img.onload = onOK;
        img.onerror = onFail;
        img.src = src;
        const timer = setTimeout(() => { if (done) return; done = true; cleanup(); res({ ok: false }); }, timeout);
      });
    };

    (async () => {
      // first try with crossOrigin — helps when images allow CORS
      try {
        const r1 = await tryLoad(url, true);
        if (r1.ok) return resolve(url);
      } catch(e){ /* ignore */ }

      // try without crossOrigin
      try {
        const r2 = await tryLoad(url, false);
        if (r2.ok) return resolve(url);
      } catch(e){ /* ignore */ }

      // as a last attempt, try fetching the resource to see if remote server allows GET (may fail on CORS)
      try {
        const ctrl = new AbortController();
        const t = setTimeout(()=>ctrl.abort(), timeout);
        const resp = await fetch(url, { method: "GET", mode: "cors", signal: ctrl.signal });
        clearTimeout(t);
        if (resp.ok) {
          // if fetch succeeded, produce a blob URL to avoid cross-origin image tainting (useful if the response allows it)
          try {
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            return resolve(blobUrl);
          } catch(e) {
            // fallback to original
            return resolve(url);
          }
        }
      } catch(e){
        // ignore
      }

      // fallback
      return resolve(PLACEHOLDER_IMG);
    })();
  });
}

// Replace top .logo content if it contains a URL; otherwise set default logo image.
(async function setTopLogo() {
  if (!logoEl) return;
  const text = logoEl.textContent?.trim() || "";
  let url = null;

  // if the logo element contains an img already, do nothing
  if (logoEl.querySelector("img")) return;

  // detect URL in the element text (common in your file)
  const urlCandidate = (text.match(/https?:\/\/\S+/) || [])[0];
  if (urlCandidate) url = urlCandidate;
  else url = TOP_LOGO_DEFAULT;

  const src = await loadImageSrc(url);
  logoEl.innerHTML = `<img src="${escapeHtml(src)}" alt="logo">`;
})();

// -----------------------------
// Fetch & render applications
// -----------------------------
fetch("applications.json")
  .then(res => {
    if (!res.ok) throw new Error("Failed to load applications.json: " + res.status);
    return res.json();
  })
  .then(async data => {
    const apps = Array.isArray(data?.Applications) ? data.Applications : [];
    // render cards sequentially so we can await image checks (keeps UI responsive)
    for (const app of apps) {
      const card = document.createElement("div");
      card.className = "card";

      // resolve image src robustly
      const imgSrc = await loadImageSrc(app.frontImage);

      const thumb = document.createElement("div");
      thumb.className = "thumb";
      const img = document.createElement("img");
      img.alt = app.title || "preview";
      img.src = imgSrc;
      thumb.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<h3>${escapeHtml(app.title)}</h3><p class="desc">${escapeHtml(app.description||"")}</p>`;

      const btn = document.createElement("button");
      btn.className = "btn";
      btn.style.marginTop = "10px";
      btn.textContent = "Start Application";
      btn.addEventListener("click", () => openPanel(app));

      card.appendChild(thumb);
      card.appendChild(meta);
      card.appendChild(btn);

      appsContainer.appendChild(card);
    }
  })
  .catch(err => {
    console.error(err);
    appsContainer.innerHTML = `<div style="color:var(--text-muted)">Unable to load applications.</div>`;
  });

// -----------------------------
// Panel open / render
// -----------------------------
function openPanel(app) {
  activeApp = app;
  panelTitle.textContent = app.title || "Application";
  panelQuestions.innerHTML = "";
  currentMeta = [];

  (app.questions || []).forEach((q, idx) => {
    const parts = String(q).split("|");
    const questionText = (parts[0] || "").trim();
    const requiredRaw = (parts[1] || "").trim().toLowerCase();
    const required = requiredRaw === "true";

    currentMeta.push({ text: questionText, required });

    const qDiv = document.createElement("div");
    qDiv.className = "q";

    const labelHtml = escapeHtml(questionText) + (required ? ' <span style="color:#ff7777">*</span>' : '');
    qDiv.innerHTML = `<div>${labelHtml}</div>`;

    const ta = document.createElement("textarea");
    ta.dataset.qindex = String(idx);
    ta.dataset.required = required ? "true" : "false";
    qDiv.appendChild(ta);

    panelQuestions.appendChild(qDiv);
  });

  panel.classList.remove("hidden");
  const first = panelQuestions.querySelector("textarea");
  if (first) first.focus();
}

// -----------------------------
// Close panel
// -----------------------------
closePanelBtn?.addEventListener("click", () => {
  panel.classList.add("hidden");
  activeApp = null;
  currentMeta = [];
  panelQuestions.innerHTML = "";
  submitMsg.textContent = "";
});

// Clear answers
clearBtn?.addEventListener("click", () => {
  document.querySelectorAll("#qList textarea").forEach(t => t.value = "");
  submitMsg.style.color = "";
  submitMsg.textContent = "Answers cleared.";
  setTimeout(() => submitMsg.textContent = "", 1600);
});

// -----------------------------
// Submit application
// -----------------------------
submitBtn?.addEventListener("click", async () => {
  if (!activeApp) return alert("No active application selected.");

  const textareas = [...panelQuestions.querySelectorAll("textarea")];
  const answers = textareas.map(t => t.value.trim());

  // validate required
  const missing = [];
  for (let i = 0; i < currentMeta.length; i++) {
    if (currentMeta[i].required && (!answers[i] || answers[i].length === 0)) {
      missing.push(currentMeta[i].text);
      const ta = panelQuestions.querySelector(`textarea[data-qindex="${i}"]`);
      if (ta) {
        ta.style.outline = "2px solid rgba(255,120,120,0.6)";
        setTimeout(() => ta.style.outline = "", 3000);
      }
    }
  }

  if (missing.length) {
    submitMsg.style.color = "#ff7777";
    submitMsg.textContent = "Please fill in required fields.";
    alert("Please fill required fields:\n\n" + missing.map(m => "• " + m).join("\n"));
    return;
  }

  submitMsg.style.color = "#90ee90";
  submitMsg.textContent = "Submitting...";

  // build embed fields for Discord
  const fields = currentMeta.map((m, i) => ({
    name: truncate(m.text + (m.required ? " (required)" : ""), 256),
    value: truncate(answers[i] || "—", 1024),
    inline: false
  }));

  // include frontImage as embed image if possible
  const embed = {
    title: `${activeApp.title || "Application"} — New Submission`,
    description: activeApp.description || "",
    fields,
    timestamp: new Date().toISOString(),
    color: 0x3b82f6
  };

  // Attempt to resolve an image src (try loadImageSrc). Keep original URL if fails.
  try {
    const resolvedImg = await loadImageSrc(activeApp.frontImage);
    if (resolvedImg && resolvedImg !== PLACEHOLDER_IMG) embed.image = { url: resolvedImg };
  } catch (e) {
    // ignore, embed without image
  }

  const payload = {
    username: "Applications Panel",
    avatar_url: TOP_LOGO_DEFAULT,
    embeds: [embed]
  };

  // POST to webhook
  let sent = false;
  try {
    // Note: direct browser -> webhook may be blocked by CORS depending on environment.
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Webhook responded " + res.status);
    sent = true;
    submitMsg.style.color = "#90ee90";
    submitMsg.textContent = "✅ Application submitted and sent to Discord!";
  } catch (err) {
    console.error("Webhook error:", err);
    submitMsg.style.color = "#ff7777";
    submitMsg.textContent = "⚠️ Failed to send to Discord (see console).";
    // still show submission summary locally
  }

  // show summary card in-page
  showSubmissionSummary(activeApp, currentMeta, answers, sent);

  // clear and close after a moment
  setTimeout(() => {
    panelQuestions.querySelectorAll("textarea").forEach(t => t.value = "");
    if (sent) panel.classList.add("hidden");
    submitMsg.textContent = "";
    activeApp = null;
    currentMeta = [];
  }, 1400);
});

// -----------------------------
// Show submitted summary
// -----------------------------
function showSubmissionSummary(app, meta, answers, sentToDiscord) {
  const existing = document.getElementById("submissionSummary");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "submissionSummary";
  container.className = "panel";
  container.style.marginTop = "18px";

  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `<h3>Submitted: ${escapeHtml(app.title || "")} ${sentToDiscord ? '<span style="color:#90ee90">(sent)</span>' : '<span style="color:#ffb86b">(not sent)</span>'}</h3>`;
  container.appendChild(header);

  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.gap = "14px";
  body.style.alignItems = "flex-start";

  const left = document.createElement("div");
  left.style.flex = "1";

  if (app.description) {
    const p = document.createElement("p");
    p.className = "desc";
    p.textContent = app.description;
    left.appendChild(p);
  }

  meta.forEach((m, i) => {
    const fdiv = document.createElement("div");
    fdiv.style.marginTop = "8px";
    fdiv.innerHTML = `<strong>${escapeHtml(m.text)}${m.required? ' <span style="color:#ff7777">*</span>':''}</strong><div class="muted small" style="margin-top:4px;">${escapeHtml(answers[i] || "—")}</div>`;
    left.appendChild(fdiv);
  });

  body.appendChild(left);

  if (app.frontImage) {
    const right = document.createElement("div");
    right.style.width = "320px";
    right.innerHTML = `<div class="thumb" style="height:180px"><img src="${escapeHtml(app.frontImage)}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='${PLACEHOLDER_IMG}'"></div>`;
    body.appendChild(right);
  }

  container.appendChild(body);

  const appsSection = document.querySelector(".apps-section");
  if (appsSection && appsSection.parentNode) appsSection.parentNode.insertBefore(container, appsSection.nextSibling);
  else document.body.appendChild(container);
}
