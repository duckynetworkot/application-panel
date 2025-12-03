/* script.js
   Static applications panel. Demo-only submission stores answers in localStorage.
*/

const APPS_JSON = 'applications.json';
let currentApp = null;

// Helpers
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

async function loadApps(){
  try{
    const res = await fetch(APPS_JSON + '?_=' + Date.now());
    if(!res.ok) throw new Error('Failed to fetch applications.json');
    const data = await res.json();
    return data.Applications || [];
  }catch(err){
    console.error(err);
    document.getElementById('notice').textContent = 'Error loading applications.json — open console for details.';
    return [];
  }
}

function makeCard(app){
  const card = document.createElement('div');
  card.className = 'card';

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const img = document.createElement('img');
  img.src = app.frontImage || ('https://picsum.photos/seed/' + encodeURIComponent(app.title) + '/800/400');
  img.alt = app.title;
  thumb.appendChild(img);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const title = document.createElement('h3');
  title.textContent = app.title;
  meta.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'desc';
  desc.textContent = app.description || '';

  const startRow = document.createElement('div');
  startRow.className = 'start-row';
  const startBtn = document.createElement('button');
  startBtn.className = 'btn';
  startBtn.textContent = 'Start Application';
  startBtn.onclick = () => openApplication(app);
  startRow.appendChild(startBtn);

  card.appendChild(thumb);
  card.appendChild(meta);
  card.appendChild(desc);
  card.appendChild(startRow);

  return card;
}

function renderApps(list){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  if(list.length === 0){
    grid.innerHTML = '<div class="notice">No applications found in applications.json</div>';
    return;
  }
  list.forEach(app => grid.appendChild(makeCard(app)));
}

// Panel (questions)
function openApplication(app){
  currentApp = app;
  $('#appTitle').textContent = app.title;
  const qList = $('#qList');
  qList.innerHTML = '';
  app.questions.forEach((q, idx) => {
    const container = document.createElement('div');
    container.className = 'q';
    const label = document.createElement('div');
    label.textContent = `${idx + 1}. ${q}`;
    const ta = document.createElement('textarea');
    ta.dataset.qidx = idx;
    // Pre-fill if answers exist (demo)
    const saved = getSavedAnswers(app.title);
    if(saved && saved[idx]) ta.value = saved[idx];
    container.appendChild(label);
    container.appendChild(ta);
    qList.appendChild(container);
  });
  $('#submitMsg').textContent = '';
  $('#applicationPanel').classList.remove('hidden');
  window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});
}

function closeApplication(){
  currentApp = null;
  $('#applicationPanel').classList.add('hidden');
}

function getSavedAnswers(title){
  try{
    const key = 'app_answers_' + title;
    return JSON.parse(localStorage.getItem(key) || 'null');
  }catch(e){ return null }
}

function saveAnswers(title, answers){
  try{
    const key = 'app_answers_' + title;
    localStorage.setItem(key, JSON.stringify(answers));
  }catch(e){ console.warn('Could not save answers', e) }
}

function submitApplication(){
  if(!currentApp) return;
  const textareas = Array.from($('#qList textarea'));
  const answers = textareas.map(t => t.value.trim());
  // Demo behavior: save locally and show message
  saveAnswers(currentApp.title, answers);
  $('#submitMsg').textContent = 'Application submitted (demo). Answers saved locally.';
  setTimeout(()=> $('#submitMsg').textContent = '', 3000);
}

// Demo: clear stored answers
function clearStoredAnswers(){
  const keys = Object.keys(localStorage).filter(k => k.startsWith('app_answers_'));
  keys.forEach(k => localStorage.removeItem(k));
  $('#notice').textContent = 'All saved demo answers cleared.';
  setTimeout(()=> $('#notice').textContent = 'Tip: This is a static demo. “Submit” stores answers locally (demo).', 3000);
}

// Wire UI
document.addEventListener('DOMContentLoaded', async () => {
  const apps = await loadApps();
  renderApps(apps);

  $('#closePanel').addEventListener('click', closeApplication);
  $('#submitApp').addEventListener('click', submitApplication);
  $('#demoClear').addEventListener('click', clearStoredAnswers);
});
