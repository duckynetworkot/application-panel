// Load applications.json and render cards
fetch("applications.json")
  .then(res => res.json())
  .then(data => renderCards(data.Applications))
  .catch(err => console.error("Error loading applications.json:", err));

const appsContainer = document.getElementById("apps");
const panel = document.getElementById("panel");
const panelTitle = document.getElementById("panel-title");
const panelQuestions = document.getElementById("panel-questions");

let activeApp = null;

function renderCards(apps) {
  appsContainer.innerHTML = "";

  apps.forEach(app => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
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

// Open the question panel
function openPanel(app) {
  activeApp = app;
  panelTitle.textContent = app.title;
  panelQuestions.innerHTML = "";

  app.questions.forEach(q => {
    const div = document.createElement("div");
    div.className = "q";
    div.innerHTML = `
      <div>${q}</div>
      <textarea></textarea>
    `;
    panelQuestions.appendChild(div);
  });

  panel.classList.remove("hidden");
}

// Close panel
function closePanel() {
  panel.classList.add("hidden");
  activeApp = null;
}

// Submit answers
function submitApp() {
  const answers = [...panelQuestions.querySelectorAll("textarea")].map(t => t.value.trim());

  if (answers.some(a => a.length === 0)) {
    alert("Please answer all questions before submitting.");
    return;
  }

  alert("Application submitted!");
  closePanel();
}
