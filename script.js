// =========================
// Load Applications
// =========================
fetch("applications.json")
  .then(res => res.json())
  .then(data => renderCards(data.Applications))
  .catch(err => console.error("Error loading applications.json:", err));

// Corrected IDs from index.html
const appsContainer = document.getElementById("grid");
const panel = document.getElementById("applicationPanel");
const panelTitle = document.getElementById("appTitle");
const panelQuestions = document.getElementById("qList");
const closePanelBtn = document.getElementById("closePanel");
const submitBtn = document.getElementById("submitApp");
const submitMsg = document.getElementById("submitMsg");

const WEBHOOK_URL = "https://discord.com/api/webhooks/1445633277322068040/qSCrO1nYIif4fP6EwzO6pLO9iHuPtGEIITR9lvQ5vqXxI_VkFhyhpXvhURoLpHD_F6Pn";

let activeApp = null;

// =========================
// Render Application Cards
// =========================
function renderCards(apps) {
  appsContainer.innerHTML = "";

  apps.forEach(app => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="thumb">
        <img src="${app.frontImage}" alt="${app.title}">
      </div>
      <div class="meta">
        <h3>${app.title}</h3>
        <p class="desc">${app.description}</p>
      </div>
      <button class="btn" style="margin-top:10px;">Start Application</button>
    `;

    card.querySelector("button").onclick = () => openPanel(app);
    appsContainer.appendChild(card);
  });
}

// =========================
// Open Application Panel
// =========================
function openPanel(app) {
  activeApp = app;

  panelTitle.textContent = app.title;
  panelQuestions.innerHTML = "";

  app.questions.forEach(q => {
    const [questionText, requiredRaw] = q.split("|").map(v => v.trim());
    const required = requiredRaw === "true";

    const div = document.createElement("div");
    div.className = "q";

    div.innerHTML = `
      <div>
        ${questionText}
        ${required ? `<span style="color:#ff7777;">*</span>` : ""}
      </div>
      <textarea data-required="${required}"></textarea>
    `;

    panelQuestions.appendChild(div);
  });

  panel.classList.remove("hidden");
}

// =========================
// Close Panel
// =========================
closePanelBtn.onclick = () => {
  panel.classList.add("hidden");
  activeApp = null;
  submitMsg.textContent = "";
};

// =========================
// Submit Application
// =========================
submitBtn.onclick = async () => {
  if (!activeApp) return;

  const textareas = [...panelQuestions.querySelectorAll("textarea")];
  const answers = textareas.map(t => t.value.trim());
  const questions = activeApp.questions.map(q => q.split("|")[0].trim());

  // Required validation
  for (let i = 0; i < textareas.length; i++) {
    if (textareas[i].dataset.required === "true" && answers[i].length === 0) {
      submitMsg.style.color = "#ff7777";
      submitMsg.textContent = "❌ Please fill in all required fields before submitting.";
      return;
    }
  }

  submitMsg.style.color = "#90ee90";
  submitMsg.textContent = "⏳ Submitting...";

  // Build embed fields
  let fields = [];

  for (let i = 0; i < questions.length; i++) {
    fields.push({
      name: questions[i],
      value: answers[i] === "" ? "*No answer provided*" : answers[i],
      inline: false
    });
  }

  // Discord webhook payload
  const payload = {
    username: "Application Panel",
    avatar_url: "https://cdn.discordapp.com/icons/1399923432161808515/b1e243e6ddcc36ce1adbf702ad5c34b6.webp?size=1024",
    embeds: [
      {
        title: `${activeApp.title} Application Submitted`,
        color: 3092790,
        thumbnail: {
          url: activeApp.frontImage
        },
        fields: fields,
        footer: {
          text: "Bloxburg Funeral Home • Application System"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    submitMsg.style.color = "#90ee90";
    submitMsg.textContent = "✅ Application submitted successfully!";

    setTimeout(() => {
      panel.classList.add("hidden");
      textareas.forEach(t => t.value = "");
    }, 1500);

  } catch (err) {
    console.error("Webhook error:", err);
    submitMsg.style.color = "#ff7777";
    submitMsg.textContent = "❌ Failed to submit application.";
  }
};
