const TOKEN_KEY = 'b2b_admin_token';
let adminToken = localStorage.getItem(TOKEN_KEY) || '';

function headers(extra = {}) {
  const h = { ...extra };
  if (adminToken) h['x-admin-token'] = adminToken;
  return h;
}

async function req(url, options = {}) {
  const merged = {
    ...options,
    headers: headers(options.headers || {})
  };
  const r = await fetch(url, merged);
  if (!r.ok) throw new Error(await r.text());
  return r.headers.get('content-type')?.includes('application/json') ? r.json() : r.text();
}

async function checkAuth() {
  const msg = document.getElementById('authMsg');
  try {
    await req('/api/auth/check');
    msg.textContent = '登录状态：已通过';
    return true;
  } catch {
    msg.textContent = '登录状态：未通过，请输入口令';
    return false;
  }
}

function renderTemplates(templates) {
  const root = document.getElementById('templateList');
  root.innerHTML = '';
  templates.forEach((t, i) => {
    const box = document.createElement('div');
    box.className = 'card';
    box.style.marginTop = '8px';
    box.innerHTML = `
      <h3>第 ${i + 1} 封</h3>
      <div class="grid">
        <input data-k="step" value="${t.step}" placeholder="step" />
        <input data-k="delayHours" value="${t.delayHours}" placeholder="delayHours" />
      </div>
      <input data-k="subject" value="${String(t.subject || '').replace(/"/g, '&quot;')}" placeholder="邮件标题" style="margin-top:8px;width:100%;" />
      <textarea data-k="body" placeholder="邮件正文" style="margin-top:8px;width:100%;min-height:120px;border-radius:8px;border:1px solid #3c4a78;background:#0e1730;color:#e6eaf2;padding:10px;">${t.body || ''}</textarea>
    `;
    root.appendChild(box);
  });
}

function collectTemplates() {
  const blocks = [...document.querySelectorAll('#templateList > .card')];
  return blocks.map((b) => {
    const get = (k) => b.querySelector(`[data-k="${k}"]`).value;
    return {
      step: Number(get('step')),
      delayHours: Number(get('delayHours')),
      subject: get('subject'),
      body: get('body')
    };
  });
}

async function refresh() {
  const [report, leads] = await Promise.all([
    req('/api/report/weekly'),
    req('/api/leads')
  ]);
  document.getElementById('report').textContent = JSON.stringify(report, null, 2);

  const tbody = document.getElementById('leadsTable');
  tbody.innerHTML = '';
  leads.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${l.name}</td><td>${l.email}</td><td>${l.company}</td><td>${l.status}</td><td>${l.stepSent}</td><td>${l.source}</td>`;
    tbody.appendChild(tr);
  });
}

async function loadTemplates() {
  const data = await req('/api/templates');
  renderTemplates(data);
}

async function init() {
  document.getElementById('tokenInput').value = adminToken;
  const ok = await checkAuth();
  if (!ok) return;
  await Promise.all([refresh(), loadTemplates()]);
}

document.getElementById('saveTokenBtn').addEventListener('click', async () => {
  adminToken = document.getElementById('tokenInput').value.trim();
  localStorage.setItem(TOKEN_KEY, adminToken);
  document.getElementById('weeklyCsvLink').href = `/api/report/weekly.csv?token=${encodeURIComponent(adminToken)}`;
  await init();
});

document.getElementById('clearTokenBtn').addEventListener('click', () => {
  adminToken = '';
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
});

document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.tags = payload.tags ? payload.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
  const msg = document.getElementById('formMsg');
  try {
    await req('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    msg.textContent = '添加成功';
    e.target.reset();
    refresh();
  } catch (err) {
    msg.textContent = `失败：${err.message}`;
  }
});

document.getElementById('tickBtn').addEventListener('click', async () => {
  try {
    const res = await req('/api/tick', { method: 'POST' });
    alert(`执行完成，sent=${res.sent}, dueLeads=${res.dueLeads}`);
    refresh();
  } catch (err) {
    alert(`失败：${err.message}`);
  }
});

document.getElementById('refreshBtn').addEventListener('click', refresh);

document.getElementById('reloadTplBtn').addEventListener('click', loadTemplates);

document.getElementById('saveTplBtn').addEventListener('click', async () => {
  const msg = document.getElementById('tplMsg');
  try {
    const templates = collectTemplates();
    await req('/api/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates })
    });
    msg.textContent = '模板保存成功';
    await loadTemplates();
  } catch (err) {
    msg.textContent = `模板保存失败：${err.message}`;
  }
});

init();
