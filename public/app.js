const cardsEl = document.getElementById('cards');
const gitEl = document.getElementById('git');
const logsEl = document.getElementById('logs');
const timeEl = document.getElementById('time');
const refreshBtn = document.getElementById('refreshBtn');

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

refreshBtn.addEventListener('click', load);
load();
setInterval(load, 60000);
