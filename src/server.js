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

app.use(express.static(path.join(process.cwd(), 'public')));

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function tailLines(text, count = 30) {
  const lines = String(text || '').trim().split('\n');
  return lines.slice(-count);
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

app.get('/api/overview', (_, res) => {
  const runtime = parseRuntime();
  const git = getGitStatus();
  const logs = getLogFeed();
  res.json({
    now: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    runtime,
    git,
    logs
  });
});

app.listen(PORT, () => {
  console.log(`workbench running at http://localhost:${PORT}`);
});
