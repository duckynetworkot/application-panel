/* script.js - Unified site script
   - Loads slideshow.json, applications.json, planning.json from root (./)
   - Staff auth with manual IDs (validStaffIDs)
   - Application & planning submit -> webhook
   - Shows submission summary
   - Robust but simple image onerror fallbacks
*/

// ---------- CONFIG ----------
const WEBHOOK_URL = "https://discord.com/api/webhooks/1445633277322068040/qSCrO1nYIif4fP6EwzO6pLO9iHuPtGEIITR9lvQ5vqXxI_VkFhyhpXvhURoLpHD_F6Pn";
const TOP_LOGO_URL = "https://cdn.discordapp.com/icons/1399923432161808515/b1e243e6ddcc36ce1adbf702ad5c34b6.webp?size=1024";
const PLACEHOLDER_IMG = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="100%" height="100%" fill="#132b4d"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9bb3d1" font-family="Arial" font-size="28">Image unavailable</text></svg>');

// Manual staff IDs - edit here to add/remove allowed staff
const validStaffIDs = [
  "BFH-001",
  "BFH-002",
  "BFH-003",
  "BFH-MANAGER",
  "BFH-OWNER"
];

// ---------- Helpers ----------
function qs(sel, root=document) { return root.querySelector(sel); }
function qsa(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }
function escapeHtml(s){ if (s==null) return ""; return String(s).replace(/[&<>"']/g, m=> ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[m]); }
function truncate(s,n){ if (typeof s!=='string') return s; return s.length>n? s.slice(0,n-1)+'…': s; }

// Simple image creation with onerror fallback
function mkImg(src, alt="img") {
  const img = document.createElement('img');
  img.src = src || PLACEHOLDER_IMG;
  img.alt = alt;
  img.loading = 'lazy';
  img.onerror = () => { img.src = PLACEHOLDER_IMG; };
  return img;
}

// Put top logo (replace text if the .logo contains a URL string)
(function setTopLogo() {
  const logoEl = qs('.logo');
  if (!logoEl) return;
  const text = (logoEl.textContent || "").trim();
  const urlMatch = text.match(/https?:\/\/\S+/);
  const url = urlMatch ? urlMatch[0] : TOP_LOGO_URL;
  logoEl.innerHTML = '';
  const img = mkImg(url, 'logo');
  logoEl.appendChild(img);
})();

// ---------- SLIDESHOW ----------
(function initSlideshow(){
  const container = qs('#slideshow');
  if (!container) return;

  fetch('./slideshow.json').then(r => {
    if (!r.ok) throw new Error('no slideshow.json');
    return r.json();
  }).then(data => {
    const slides = Array.isArray(data.slides) ? data.slides : [];
    if (!slides.length) {
      // fallback: single placeholder
      const s = document.createElement('div');
      s.className = 'slide active';
      s.appendChild(mkImg(PLACEHOLDER_IMG));
      container.appendChild(s);
      return;
    }

    slides.forEach((url, idx) => {
      const s = document.createElement('div');
      s.className = 'slide' + (idx === 0 ? ' active' : '');
      s.innerHTML = '';
      s.appendChild(mkImg(url, `slide-${idx}`));
      container.appendChild(s);
    });

    const nodes = qsa('.slide', container);
    let cur = 0;
    const total = nodes.length;
    const prevBtn = qs('#prevSlide');
    const nextBtn = qs('#nextSlide');

    function show(i){
      nodes.forEach(n => n.classList.remove('active'));
      nodes[i].classList.add('active');
      cur = i;
    }

    prevBtn?.addEventListener('click', ()=> show((cur-1+total)%total));
    nextBtn?.addEventListener('click', ()=> show((cur+1)%total));
    setInterval(()=> show((cur+1)%total), 15000);
  }).catch(err => {
    // if slideshow load fails, create a placeholder slide
    const s = document.createElement('div');
    s.className = 'slide active';
    s.appendChild(mkImg(PLACEHOLDER_IMG));
    container.appendChild(s);
    console.warn('slideshow.json not found or invalid', err);
  });
})();

// ---------- APPLICATIONS (applications.html) ----------
(function initApplications(){
  const grid = qs('#grid');
  if (!grid) return;

  const panel = qs('#applicationPanel');
  const titleEl = qs('#appTitle');
  const qList = qs('#qList');
  const closeBtn = qs('#closePanel');
  const submitBtn = qs('#submitApp');
  const submitMsg = qs('#submitMsg');
  const clearBtn = qs('#demoClear');
  let activeApp = null;
  let meta = [];

  // load apps
  fetch('./applications.json').then(r => r.json()).then(data => {
    const apps = Array.isArray(data.Applications) ? data.Applications : [];
    apps.forEach(app => {
      const card = document.createElement('div'); card.className = 'card';
      const thumb = document.createElement('div'); thumb.className = 'thumb';
      thumb.appendChild(mkImg(app.frontImage, app.title || 'preview'));
      const metaDiv = document.createElement('div'); metaDiv.className = 'meta';
      metaDiv.innerHTML = `<h3>${escapeHtml(app.title)}</h3><p class="desc">${escapeHtml(app.description||"")}</p>`;
      const btn = document.createElement('button'); btn.className = 'btn'; btn.style.marginTop = '10px'; btn.textContent = 'Start Application';
      btn.addEventListener('click', () => openApp(app));
      card.appendChild(thumb); card.appendChild(metaDiv); card.appendChild(btn);
      grid.appendChild(card);
    });
  }).catch(err => {
    grid.innerHTML = '<div class="muted">Unable to load applications</div>';
    console.error(err);
  });

  function openApp(app) {
    activeApp = app; meta = []; qList.innerHTML = ''; titleEl.textContent = app.title || 'Application';
    (app.questions || []).forEach((q, i) => {
      let questionText = '', required = false;
      if (typeof q === 'string') {
        const parts = q.split('|').map(s => s.trim());
        questionText = parts[0] || '';
        required = (parts[1] || '').toLowerCase() === 'true';
      } else if (Array.isArray(q)) {
        questionText = q[0] || '';
        required = !!q[1];
      } else if (typeof q === 'object' && q !== null) {
        questionText = q.text || q.q || '';
        required = !!q.required;
      }

      meta.push({ text: questionText, required });
      const div = document.createElement('div'); div.className = 'q';
      div.innerHTML = `<div>${escapeHtml(questionText)} ${required? '<span style="color:#ff7777">*</span>':''}</div>`;
      const ta = document.createElement('textarea'); ta.dataset.i = i; ta.dataset.required = required ? 'true' : 'false';
      div.appendChild(ta);
      qList.appendChild(div);
    });
    panel.classList.remove('hidden');
    const first = qList.querySelector('textarea');
    if (first) first.focus();
  }

  closeBtn?.addEventListener('click', () => { panel.classList.add('hidden'); activeApp = null; meta = []; qList.innerHTML = ''; submitMsg.textContent = ''; });
  clearBtn?.addEventListener('click', () => { qsa('#qList textarea').forEach(t => t.value = ''); submitMsg.style.color = ''; submitMsg.textContent = 'Answers cleared.'; setTimeout(()=> submitMsg.textContent = '', 1400); });

  submitBtn?.addEventListener('click', async () => {
    if (!activeApp) return alert('No active application.');
    const textareas = qsa('#qList textarea');
    const answers = textareas.map(t => t.value.trim());
    const missing = [];
    meta.forEach((m,i) => { if (m.required && (!answers[i] || answers[i].length === 0)) missing.push(m.text); });

    if (missing.length) {
      submitMsg.style.color = '#ff7777';
      submitMsg.textContent = 'Please fill in all required fields.';
      alert('Please fill in required fields:\n\n' + missing.map(m => '• ' + m).join('\n'));
      textareas.forEach((ta, idx) => { if (meta[idx]?.required && !ta.value.trim()) { ta.style.outline = '2px solid rgba(255,120,120,0.6)'; setTimeout(()=> ta.style.outline='', 3000); } });
      return;
    }

    submitMsg.style.color = '#90ee90';
    submitMsg.textContent = 'Submitting...';

    const fields = meta.map((m,i) => ({ name: truncate(m.text + (m.required? ' (required)' : ''), 256), value: truncate(answers[i] || '—', 1024) }));

    const embed = { title: `${activeApp.title} — New Application`, description: activeApp.description || '', fields, timestamp: new Date().toISOString(), color: 0x3b82f6 };
    if (activeApp.frontImage) embed.image = { url: activeApp.frontImage };

    const payload = { username: 'Applications Panel', avatar_url: TOP_LOGO_URL, embeds: [embed] };

    try {
      const res = await fetch(WEBHOOK_URL, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Webhook failed ' + res.status);
      submitMsg.style.color = '#90ee90'; submitMsg.textContent = '✅ Submitted!';
      showSubmissionSummary(activeApp, meta, answers, true);
      setTimeout(()=> { panel.classList.add('hidden'); qsa('#qList textarea').forEach(t => t.value = ''); submitMsg.textContent = ''; }, 1200);
    } catch (err) {
      console.error('Webhook error', err);
      submitMsg.style.color = '#ff7777'; submitMsg.textContent = '⚠️ Failed to send (see console)';
      showSubmissionSummary(activeApp, meta, answers, false);
    }
  });

  function showSubmissionSummary(app, meta, answers, sent) {
    const existing = qs('#submissionSummary'); if (existing) existing.remove();
    const cont = document.createElement('div'); cont.id = 'submissionSummary'; cont.className = 'panel'; cont.style.marginTop = '18px';
    cont.innerHTML = `<div class="panel-header"><h3>Submitted: ${escapeHtml(app.title || '')} ${sent? '<span style="color:#90ee90">(sent)</span>': '<span style="color:#ffb86b">(not sent)</span>'}</h3></div>`;
    const body = document.createElement('div'); body.style.display = 'flex'; body.style.gap = '14px'; body.style.alignItems = 'flex-start';
    const left = document.createElement('div'); left.style.flex = '1';
    if (app.description) { const p = document.createElement('p'); p.className = 'desc'; p.textContent = app.description; left.appendChild(p); }
    meta.forEach((m,i) => { const d = document.createElement('div'); d.style.marginTop = '8px'; d.innerHTML = `<strong>${escapeHtml(m.text)}${m.required? ' <span style="color:#ff7777">*</span>':''}</strong><div class="muted small" style="margin-top:4px;">${escapeHtml(answers[i] || '—')}</div>`; left.appendChild(d); });
    body.appendChild(left);
    if (app.frontImage) { const right = document.createElement('div'); right.style.width = '320px'; right.innerHTML = `<div class="thumb" style="height:180px"><img src="${escapeHtml(app.frontImage)}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='${PLACEHOLDER_IMG}'"></div>`; body.appendChild(right); }
    cont.appendChild(body);
    const appsSection = qs('.apps-section'); if (appsSection && appsSection.parentNode) appsSection.parentNode.insertBefore(cont, appsSection.nextSibling); else document.body.appendChild(cont);
  }
})();

// ---------- PLANNING (planning.html) ----------
(function initPlanning(){
  const grid = qs('#planningGrid'); if (!grid) return;
  const panel = qs('#planningPanel'); const titleEl = qs('#planTitle'); const qList = qs('#planQList'); const closeBtn = qs('#closePlan'); const submitBtn = qs('#submitPlan'); const msgEl = qs('#planMsg');
  let activePlan = null; let meta = [];

  fetch('./planning.json').then(r => r.json()).then(data => {
    const plans = Array.isArray(data.Planning) ? data.Planning : [];
    plans.forEach(p => {
      const card = document.createElement('div'); card.className = 'card';
      const thumb = document.createElement('div'); thumb.className = 'thumb'; thumb.appendChild(mkImg(p.frontImage, p.title));
      const metaDiv = document.createElement('div'); metaDiv.className = 'meta'; metaDiv.innerHTML = `<h3>${escapeHtml(p.title)}</h3><p class="desc">${escapeHtml(p.description||'')}</p>`;
      const btn = document.createElement('button'); btn.className = 'btn'; btn.style.marginTop = '10px'; btn.textContent = 'Start';
      btn.addEventListener('click', () => openPlan(p));
      card.appendChild(thumb); card.appendChild(metaDiv); card.appendChild(btn); grid.appendChild(card);
    });
  }).catch(err => { grid.innerHTML = '<div class="muted">Unable to load planning options</div>'; console.error(err); });

  function openPlan(p) {
    activePlan = p; meta = []; qList.innerHTML = ''; titleEl.textContent = p.title || 'Planning';
    (p.questions || []).forEach((q,i) => {
      let txt = '', required = false;
      if (typeof q === 'string') { const parts = q.split('|').map(s=>s.trim()); txt = parts[0]; required = (parts[1]||'').toLowerCase() === 'true'; }
      else if (typeof q === 'object') { txt = q.text || q.label || ''; required = !!q.required; }
      meta.push({ text: txt, required });
      const div = document.createElement('div'); div.className = 'q'; div.innerHTML = `<div>${escapeHtml(txt)} ${required? '<span style="color:#ff7777">*</span>':''}</div>`;
      const ta = document.createElement('textarea'); ta.dataset.i = i; ta.dataset.required = required ? 'true' : 'false';
      div.appendChild(ta); qList.appendChild(div);
    });
    panel.classList.remove('hidden');
  }

  closeBtn?.addEventListener('click', () => { panel.classList.add('hidden'); activePlan = null; meta = []; qList.innerHTML = ''; msgEl.textContent = ''; });

  submitBtn?.addEventListener('click', async () => {
    if (!activePlan) return;
    const tas = qsa('#planQList textarea'); const answers = tas.map(t => t.value.trim());
    const missing = []; meta.forEach((m,i) => { if (m.required && !answers[i]) missing.push(m.text); });
    if (missing.length) { msgEl.style.color = '#ff7777'; msgEl.textContent = 'Please fill required fields: ' + missing.join(', '); return; }
    msgEl.style.color = '#90ee90'; msgEl.textContent = 'Submitting...';
    const fields = meta.map((m,i) => ({ name: truncate(m.text,256), value: truncate(answers[i]||'—',1024) }));
    const embed = { title: `${activePlan.title} — Planning Request`, description: activePlan.description||'', fields, timestamp: new Date().toISOString(), color: 0x3b82f6 };
    if (activePlan.frontImage) embed.image = { url: activePlan.frontImage };
    const payload = { username: 'Planning Panel', avatar_url: TOP_LOGO_URL, embeds: [embed] };
    try {
      const res = await fetch(WEBHOOK_URL, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Webhook failed ' + res.status);
      msgEl.style.color = '#90ee90'; msgEl.textContent = 'Submitted!';
      setTimeout(()=> { panel.classList.add('hidden'); qList.innerHTML = ''; msgEl.textContent = ''; }, 1000);
    } catch (err) {
      console.error(err); msgEl.style.color = '#ff7777'; msgEl.textContent = 'Failed to send (see console)'; 
    }
  });
})();

// ---------- STAFF (staff.html) ----------
(function initStaff(){
  const authSection = qs('#staffAuth'); if (!authSection) return;
  const staffPanel = qs('#staffPanel'); const staffIdInput = qs('#staffIdInput'); const authBtn = qs('#staffAuthBtn'); const authMsg = qs('#staffAuthMsg');
  const staffManageBtn = qs('#staffManageBtn'); const staffContent = qs('#staffContent'); const staffNav = qs('#staffNav'); const signOutBtn = qs('#staffSignOut');

  let currentStaffId = null;

  // Hover animation already handled by CSS .btn:hover

  authBtn.addEventListener('click', () => {
    const val = (staffIdInput.value || '').trim();
    if (!val) { authMsg.style.color = '#ff7777'; authMsg.textContent = 'Please enter a Staff ID.'; return; }
    if (!validStaffIDs.includes(val)) {
      authMsg.style.color = '#ff7777';
      authMsg.innerHTML = '<strong>Invalid Staff ID.</strong>';
      // shake animation for feedback:
      staffIdInput.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 350, iterations: 1 });
      return;
    }
    currentStaffId = val;
    localStorage.setItem('bfh_staff_id', currentStaffId);
    authMsg.style.color = '#90ee90'; authMsg.textContent = 'Access granted.';
    authSection.classList.add('hidden');
    staffPanel.classList.remove('hidden');
    renderStaffHome();
  });

  // Manage IDs (opens a simple prompt to add/remove IDs). This is client-side only.
  staffManageBtn.addEventListener('click', () => {
    const action = prompt('Type "add" to add an ID, "remove" to remove an ID, or "list" to list current IDs:').trim().toLowerCase();
    if (!action) return;
    if (action === 'list') {
      alert('Current IDs:\n\n' + validStaffIDs.join('\n'));
      return;
    }
    if (action === 'add') {
      const newId = prompt('Enter new Staff ID to add (e.g. BFH-004):');
      if (!newId) return alert('Cancelled.');
      if (validStaffIDs.includes(newId.trim())) return alert('ID already exists.');
      validStaffIDs.push(newId.trim());
      alert('Added: ' + newId);
      return;
    }
    if (action === 'remove') {
      const rem = prompt('Enter Staff ID to remove:');
      if (!rem) return alert('Cancelled.');
      const i = validStaffIDs.indexOf(rem.trim());
      if (i === -1) return alert('ID not found.');
      validStaffIDs.splice(i,1);
      alert('Removed: ' + rem);
      return;
    }
    alert('Unknown action.');
  });

  signOutBtn?.addEventListener('click', () => {
    currentStaffId = null; localStorage.removeItem('bfh_staff_id');
    staffPanel.classList.add('hidden'); authSection.classList.remove('hidden'); staffContent.innerHTML = '';
  });

  staffNav?.addEventListener('click', (e) => {
    const action = e.target?.dataset?.staffAction;
    if (!action) return;
    if (action === 'home') renderStaffHome();
    if (action === 'clock') renderClockCard();
    if (action === 'docs') renderDocs();
  });

  function renderStaffHome() {
    staffContent.innerHTML = `<p class="desc">Signed in as <strong>${escapeHtml(currentStaffId || '')}</strong></p><p class="desc">Use the Clock-In/Out to log shifts.</p>`;
  }

  function renderDocs() {
    staffContent.innerHTML = `<h4>Documents</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn secondary" onclick="window.open('/handbook.pdf')">Open Handbook</button></div>`;
  }

  function renderClockCard() {
    staffContent.innerHTML = `
      <div class="card">
        <div class="thumb" style="height:80px;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,var(--accent1),var(--accent2));color:#06121f;font-weight:700;border-radius:8px">Clocking</div>
        <h3 style="margin-top:10px">Clock In / Clock Out</h3>
        <div style="margin-top:10px">
          <input id="clockStaffId" value="${escapeHtml(currentStaffId || '')}" readonly />
          <input id="rpName" placeholder="RP NAME" />
          <textarea id="clockReason" placeholder="Why are you clocking in/out?" style="min-height:80px;margin-top:8px"></textarea>
          <div style="display:flex;gap:8px;margin-top:10px"><button id="doClockIn" class="btn">Clock-In</button><button id="doClockOut" class="btn secondary">Clock-Out</button></div>
          <div id="clockMsg" class="muted small" style="margin-top:8px"></div>
        </div>
      </div>
    `;
    qs('#doClockIn').addEventListener('click', ()=> doClock('in'));
    qs('#doClockOut').addEventListener('click', ()=> doClock('out'));
  }

  async function doClock(type) {
    const staffId = qs('#clockStaffId')?.value || '';
    const rp = qs('#rpName')?.value || '';
    const reason = qs('#clockReason')?.value || '';
    const msgEl = qs('#clockMsg');
    if (!rp || !reason) { msgEl.style.color = '#ff7777'; msgEl.textContent = 'Please fill RP Name and Reason'; return; }
    msgEl.style.color = ''; msgEl.textContent = 'Submitting...';
    const fields = [ { name:'Staff ID', value: staffId }, { name:'RP Name', value: rp }, { name:'Action', value: type==='in' ? 'Clock-In' : 'Clock-Out' }, { name:'Reason', value: reason } ];
    if (type === 'out') {
      const mins = prompt('How many minutes were you clocked in for? (in minutes)');
      fields.push({ name: 'Minutes', value: mins || '—' });
    }
    const embed = { title: `Staff ${type==='in' ? 'Clock-In' : 'Clock-Out'} — ${staffId}`, fields, timestamp: new Date().toISOString(), color: 0x3b82f6 };
    const payload = { username: 'Staff Panel', avatar_url: TOP_LOGO_URL, embeds: [embed] };
    try {
      const res = await fetch(WEBHOOK_URL, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Webhook failed ' + res.status);
      msgEl.style.color = '#90ee90'; msgEl.textContent = 'Logged.';
    } catch (err) {
      console.error(err); msgEl.style.color = '#ff7777'; msgEl.textContent = 'Failed to log (see console)';
    }
  }

  // if staff id stored locally, auto-login
  const saved = localStorage.getItem('bfh_staff_id');
  if (saved && validStaffIDs.includes(saved)) {
    staffIdInput.value = saved;
    authBtn.click();
  }
})();
