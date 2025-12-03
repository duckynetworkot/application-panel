// Load applications.json and render cards
fetch("applications.json")
  .then(res => res.json())
  .then(data => renderCards(data.Applications))
  .catch(err => console.error("Error loading applications.json:", err));

// Correct elements to match EXACTLY the HTML
const appsContainer = document.getElementById("grid");
const panel = document.getElementById("applicationPanel");
const panelTitle = document.getElementById("appTitle");
const panelQuestions = document.getElementById("qList");
const submitBtn = document.getElementById("submitApp");
const closeBtn = document.getElementById("closePanel");
const clearBtn = document.getElementById("demoClear");

let activeApp = null;

// Render cards
function renderCards(apps) {
  appsContainer.innerHTML = "";

  apps.forEach(app => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="thumb">
        <img src="${app.frontImage}" />
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

function openPanel(app) {
  activeApp = app;
  panelTitle.textContent = app.title;
  panelQuestions.innerHTML = "";

  app.questions.forEach(q => {
    const qDiv = document.createElement("div");
    qDiv.className = "q";
    qDiv.innerHTML = `
      <div>${q}</div>
      <textarea></textarea>
    `;
    panelQuestions.appendChild(qDiv);
  });

  panel.classList.remove("hidden");
}

// Close panel
closeBtn.onclick = () => {
  panel.classList.add("hidden");
};

// Submit application
submitBtn.onclick = () => {
  const answers = [...panelQuestions.querySelectorAll("textarea")].map(a => a.value.trim());

  if (answers.some(a => a === "")) {
    alert("Please answer all questions.");
    return;
  }

  alert("Application Submitted!");
  panel.classList.add("hidden");
};

// Clear answers button
clearBtn.onclick = () => {
  document.querySelectorAll("textarea").forEach(t => t.value = "");
  alert("Answers cleared.");
};
