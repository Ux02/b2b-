import express from 'express';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { execSync } from 'child_process';

const app = express();
const PORT = Number(process.env.PORT || 3090);
const WORKSPACE = process.env.WORKSPACE_DIR || '/root/.openclaw/workspace';
const MEMORY_DIR = path.join(WORKSPACE, 'memory');
const LOGS_DIR = path.join(WORKSPACE, 'logs');
const SCRIPTS_DIR = path.join(WORKSPACE, 'scripts');
const LOCAL_CONFIG = path.join(process.cwd(), 'config', 'alerts.json');

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function safeReadJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function tailLines(text, count = 30) {
  const lines = String(text || '').trim().split('\n').filter(Boolean);
  return lines.slice(-count);
}

function extractPercent(text) {
  const m = String(text || '').match(/(\d+)%/);
  return m ? Number(m[1]) : null;
}

function loadAlertConfig() {
  return {
    codex5hLowPercent: 20,
    codexWeekLowPercent: 20,
    gitChangesHigh: 100,
    errorKeywords: ['error', 'failed', 'fatal'],
    ...safeReadJson(LOCAL_CONFIG, {})
  };
}

function parseRuntime() {
  const ps = safeRead(path.join(MEMORY_DIR, 'project-state-runtime.md'));
  const codex = safeRead(path.join(MEMORY_DIR, 'control-panel-runtime.md'));
  const digest = safeRead(path.join(MEMORY_DIR, 'memory-digest.md'));

  const gitBranch = (ps.match(/git 分支：(.+)/) || [])[1] || 'unknown';
  const gitChanges = (ps.match(/工作区变更数：(.+)/) || [])[1] || 'unknown';
  const skills = (ps.match(/已装工作区 skills：(.+)/) || [])[1] || 'unknown';

  const codex5h = (codex.match(/5h Left:\s*([^\n]+)/i) || [])[1] || 'n/a';
  const codexWeek = (codex.match(/Week Left:\s*([^\n]+)/i) || [])[1] || 'n/a';

  return {
    gitBranch,
    gitChanges,
    skills,
    codex5h,
    codexWeek,
    codex5hPercent: extractPercent(codex5h),
    codexWeekPercent: extractPercent(codexWeek),
    digestSnippet: tailLines(digest, 8).join('\n')
  };
}

function getGitStatus() {
  try {
    const out = execSync('git status --short', { cwd: WORKSPACE, encoding: 'utf-8' });
    const lines = out.trim() ? out.trim().split('\n') : [];
    return { count: lines.length, lines: lines.slice(0, 30) };
  } catch {
    return { count: 0, lines: [] };
  }
}

function getLogFeed() {
  if (!fs.existsSync(LOGS_DIR)) return [];
  const files = fs
    .readdirSync(LOGS_DIR)
    .filter((f) => f.endsWith('.log'))
    .sort();

  return files.slice(-6).map((f) => {
    const full = path.join(LOGS_DIR, f);
    const stat = fs.statSync(full);
    const body = safeRead(full);
    return {
      file: f,
      updatedAt: dayjs(stat.mtime).format('YYYY-MM-DD HH:mm:ss'),
      tail: tailLines(body, 12)
    };
  });
}

function buildAlerts(runtime, logs, git, cfg) {
  const alerts = [];
  if (runtime.codex5hPercent !== null && runtime.codex5hPercent < cfg.codex5hLowPercent) {
    alerts.push({ level: 'high', text: `Codex 5h 额度偏低：${runtime.codex5hPercent}%` });
  }
  if (runtime.codexWeekPercent !== null && runtime.codexWeekPercent < cfg.codexWeekLowPercent) {
    alerts.push({ level: 'high', text: `Codex 周额度偏低：${runtime.codexWeekPercent}%` });
  }
  if (git.count > cfg.gitChangesHigh) {
    alerts.push({ level: 'medium', text: `工作区改动较多：${git.count} 条，建议拆批提交` });
  }

  const badLogs = logs.filter((l) =>
    (l.tail || []).some((line) => cfg.errorKeywords.some((k) => line.toLowerCase().includes(String(k).toLowerCase())))
  );
  if (badLogs.length > 0) {
    alerts.push({ level: 'medium', text: `最近日志出现异常关键词：${badLogs.map((x) => x.file).join(', ')}` });
  }

  if (alerts.length === 0) {
    alerts.push({ level: 'ok', text: '当前未发现明显告警。' });
  }
  return alerts;
}

function buildDailySummary(runtime, git, logs) {
  const topLog = logs[logs.length - 1];
  const lines = [
    `日期：${dayjs().format('YYYY-MM-DD')}`,
    `- 当前分支：${runtime.gitBranch}`,
    `- 工作区变更：${git.count} 条`,
    `- 已装 skills：${runtime.skills}`,
    `- Codex 5h：${runtime.codex5h}`,
    `- Codex 周：${runtime.codexWeek}`,
    `- 最近日志：${topLog ? `${topLog.file} (${topLog.updatedAt})` : '暂无'}`
  ];

  const risk = [];
  if (runtime.codex5hPercent !== null && runtime.codex5hPercent < 20) risk.push('5h 额度偏低');
  if (git.count > 100) risk.push('未提交改动偏多');
  lines.push(`- 风险提示：${risk.length ? risk.join('；') : '无明显风险'}`);

  return lines.join('\n');
}

function runScript(scriptName) {
  const allowed = new Set(['runtime-refresh-batch.sh', 'project-state-refresh.sh']);
  if (!allowed.has(scriptName)) throw new Error('script not allowed');
  const full = path.join(SCRIPTS_DIR, scriptName);
  if (!fs.existsSync(full)) throw new Error('script missing');
  const out = execSync(`bash ${full}`, { cwd: WORKSPACE, encoding: 'utf-8' });
  return out;
}

function appendDailySummary(summaryText) {
  const date = dayjs().format('YYYY-MM-DD');
  const file = path.join(MEMORY_DIR, `${date}.md`);
  const stamp = dayjs().format('HH:mm:ss');
  const block = `\n\n## Workbench 日报快照（${stamp}）\n${summaryText}\n`;
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.appendFileSync(file, block, 'utf-8');
  return file;
}

app.get('/api/overview', (_, res) => {
  const cfg = loadAlertConfig();
  const runtime = parseRuntime();
  const git = getGitStatus();
  const logs = getLogFeed();
  const alerts = buildAlerts(runtime, logs, git, cfg);
  const summary = buildDailySummary(runtime, git, logs);
  res.json({
    now: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    runtime,
    git,
    logs,
    alerts,
    summary,
    config: cfg
  });
});

app.post('/api/trigger', (req, res) => {
  try {
    const script = String(req.body?.script || '');
    const output = runScript(script);
    res.json({ ok: true, script, output: tailLines(output, 20).join('\n') });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || String(err) });
  }
});

app.post('/api/summary/save', (req, res) => {
  try {
    const runtime = parseRuntime();
    const git = getGitStatus();
    const logs = getLogFeed();
    const summary = buildDailySummary(runtime, git, logs);
    const savedTo = appendDailySummary(summary);
    res.json({ ok: true, savedTo, summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`workbench running at http://localhost:${PORT}`);
});
