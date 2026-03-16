const cardsEl = document.getElementById('cards');
const gitEl = document.getElementById('git');
const logsEl = document.getElementById('logs');
const timeEl = document.getElementById('time');
const refreshBtn = document.getElementById('refreshBtn');
const runBatchBtn = document.getElementById('runBatchBtn');
const saveSummaryBtn = document.getElementById('saveSummaryBtn');
const alertsEl = document.getElementById('alerts');
const summaryEl = document.getElementById('summary');

function card(k, v) {
  return `<div class="card"><div class="k">${k}</div><div class="v">${v}</div></div>`;
}

async function load() {
  const r = await fetch('/api/overview');
  const data = await r.json();

  timeEl.textContent = `更新时间：${data.now}`;
  const rt = data.runtime || {};

  cardsEl.innerHTML = [
    card('Git 分支', rt.gitBranch || '-'),
    card('工作区变更数', rt.gitChanges || '-'),
    card('Skills', rt.skills || '-'),
    card('Codex 5h 剩余', rt.codex5h || '-'),
    card('Codex 周剩余', rt.codexWeek || '-'),
    card('Git 变更(实时)', data.git?.count ?? 0)
  ].join('');

  gitEl.textContent = (data.git?.lines || []).join('\n') || '暂无变更';
  summaryEl.textContent = data.summary || '暂无摘要';

  const alerts = data.alerts || [];
  alertsEl.innerHTML = alerts
    .map((a) => `<div class="alert alert-${a.level}">${a.text}</div>`)
    .join('');

  const logs = data.logs || [];
  logsEl.innerHTML = logs.length
    ? logs
        .map(
          (l) => `
      <div class="log-item">
        <div class="log-title">${l.file} · ${l.updatedAt}</div>
        <pre>${(l.tail || []).join('\n')}</pre>
      </div>
    `
        )
        .join('')
    : '<div class="log-item">暂无日志</div>';
}

async function runBatchRefresh() {
  runBatchBtn.disabled = true;
  runBatchBtn.textContent = '执行中...';
  try {
    const r = await fetch('/api/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: 'runtime-refresh-batch.sh' })
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || '触发失败');
    alert('刷新完成');
    await load();
  } catch (err) {
    alert(`执行失败：${err.message || err}`);
  } finally {
    runBatchBtn.disabled = false;
    runBatchBtn.textContent = '运行刷新批处理';
  }
}

async function saveSummary() {
  saveSummaryBtn.disabled = true;
  saveSummaryBtn.textContent = '保存中...';
  try {
    const r = await fetch('/api/summary/save', { method: 'POST' });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || '保存失败');
    alert(`已写入：${data.savedTo}`);
  } catch (err) {
    alert(`保存失败：${err.message || err}`);
  } finally {
    saveSummaryBtn.disabled = false;
    saveSummaryBtn.textContent = '保存今日日报';
  }
}

refreshBtn.addEventListener('click', load);
runBatchBtn.addEventListener('click', runBatchRefresh);
saveSummaryBtn.addEventListener('click', saveSummary);
load();
setInterval(load, 60000);
