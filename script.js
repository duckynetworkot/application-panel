// Load applications.json and render cards
fetch("applications.json")
  .then(res => res.json())
  .then(data => renderCards(data.Applications))
  .catch(err => console.error("Error loading applications.json:", err));

// Correct element IDs to match index.html
const appsContainer = document.getElementById("grid");
const panel = document.getElementById("applicationPanel");
const panelTitle = document.getElementById("appTitle");
const panelQuestions = document.getElementById("qList");

const submitBtn = document.getElementById("submitApp");
const closeBtn = document.getElementById("closePanel");
const clearBtn = document.getElementById("demoClear");

let activeApp = null;

// Render cards in the grid
function renderCards(apps) {
  appsContainer.innerHTML = "";

  apps.forEach(app => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="thumb">
        <img src="${app.frontImage}" alt="Preview">
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

// Open panel and display questions
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
  window.scrollTo({ top: panel.offsetTop, behavior: "smooth" });
}

// Close panel
closeBtn.onclick = () => {
  panel.classList.add("hidden");
  activeApp = null;
};

// Submit answers
submitBtn.onclick = () => {
  const answers = [...panelQuestions.querySelectorAll("textarea")].map(t => t.value.trim());

  if (answers.some(a => a.length === 0)) {
    alert("Please answer all questions before submitting.");
    return;
  }

  alert("Application submitted!");
  panel.classList.add("hidden");
};

// Clear answers button
clearBtn.onclick = () => {
  [...document.querySelectorAll("textarea")].forEach(t => t.value = "");
  alert("Answers cleared.");
};
