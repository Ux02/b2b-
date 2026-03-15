async function req(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(await r.text());
  return r.headers.get('content-type')?.includes('application/json') ? r.json() : r.text();
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

refresh();
