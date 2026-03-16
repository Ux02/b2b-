import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { readDb, writeDb, id } from './store.js';
import { sequence, render } from './templates.js';
import { sendMail } from './mailer.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 3030);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const APP_SECRET = process.env.APP_SECRET || 'replace_me';
const TICK_INTERVAL_SECONDS = Number(process.env.TICK_INTERVAL_SECONDS || 0);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const IS_VERCEL = String(process.env.VERCEL || '') === '1';

function now() { return Date.now(); }

function signToken(payload) {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  return Buffer.from(`${raw}.${sig}`).toString('base64url');
}

function verifyToken(token) {
  const decoded = Buffer.from(token, 'base64url').toString('utf-8');
  const i = decoded.lastIndexOf('.');
  if (i < 0) return null;
  const raw = decoded.slice(0, i);
  const sig = decoded.slice(i + 1);
  const expected = crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  if (expected !== sig) return null;
  return JSON.parse(raw);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return next();
  const token = req.get('x-admin-token') || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function getActiveSequence(db) {
  return Array.isArray(db.templates) && db.templates.length > 0 ? db.templates : sequence;
}

function normalizeTemplates(payload) {
  if (!Array.isArray(payload)) throw new Error('templates must be array');
  const sorted = payload
    .map((t, i) => ({
      step: Number(t.step || i + 1),
      delayHours: Math.max(0, Number(t.delayHours || 0)),
      subject: String(t.subject || '').trim(),
      body: String(t.body || '').trim()
    }))
    .sort((a, b) => a.step - b.step);

  if (sorted.length < 1) throw new Error('templates cannot be empty');
  for (const t of sorted) {
    if (!t.subject || !t.body) throw new Error('subject/body required');
  }
  return sorted;
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/api/auth/check', requireAdmin, (_, res) => res.json({ ok: true }));

app.post('/api/leads', requireAdmin, async (req, res) => {
  const { name, email, company, source = 'manual', tags = [] } = req.body || {};
  if (!name || !email || !company) {
    return res.status(400).json({ error: 'name/email/company 必填' });
  }

  const db = await readDb();
  const lead = {
    id: id('lead'), name, email, company, source, tags,
    status: 'active',
    createdAt: now(),
    stepSent: 0,
    nextSendAt: now()
  };
  db.leads.push(lead);
  await writeDb(db);
  res.json({ ok: true, lead });
});

app.get('/api/leads', requireAdmin, async (_, res) => {
  const db = await readDb();
  res.json(db.leads);
});

app.get('/api/templates', requireAdmin, async (_, res) => {
  const db = await readDb();
  res.json(getActiveSequence(db));
});

app.put('/api/templates', requireAdmin, async (req, res) => {
  try {
    const normalized = normalizeTemplates(req.body?.templates ?? req.body);
    const db = await readDb();
    db.templates = normalized;
    await writeDb(db);
    res.json({ ok: true, templates: normalized });
  } catch (err) {
    res.status(400).json({ error: err.message || 'invalid templates' });
  }
});

export async function runTick() {
  const db = await readDb();
  const active = db.leads.filter(l => l.status === 'active' && l.nextSendAt <= now());
  const currentSequence = getActiveSequence(db);
  let sent = 0;

  for (const lead of active) {
    const nextStep = lead.stepSent + 1;
    const tpl = currentSequence.find(s => s.step === nextStep);
    if (!tpl) {
      lead.status = 'done';
      continue;
    }

    const vars = {
      name: lead.name,
      company: lead.company,
      sender: '林',
      senderTitle: '自动化增长工程师'
    };
    const unsubToken = signToken({ leadId: lead.id, ts: now() });
    const unsubUrl = `${BASE_URL}/unsubscribe?token=${unsubToken}`;

    const text = `${render(tpl.body, vars)}\n\n---\n退订请点：${unsubUrl}`;
    try {
      const info = await sendMail({ to: lead.email, subject: render(tpl.subject, vars), text });
      db.emailLogs.push({
        id: id('mail'),
        leadId: lead.id,
        step: nextStep,
        subject: render(tpl.subject, vars),
        to: lead.email,
        messageId: info.messageId,
        sentAt: now()
      });
      lead.stepSent = nextStep;
      sent++;
      lead.nextSendAt = now() + Number(tpl.delayHours || 0) * 3600 * 1000;
      if (nextStep >= currentSequence.length) lead.status = 'done';
    } catch (err) {
      db.emailLogs.push({
        id: id('mailerr'),
        leadId: lead.id,
        step: nextStep,
        to: lead.email,
        error: String(err?.message || err),
        sentAt: now()
      });
      lead.nextSendAt = now() + 6 * 3600 * 1000;
    }
  }

  await writeDb(db);
  return { ok: true, sent, dueLeads: active.length };
}

app.post('/api/tick', requireAdmin, async (_, res) => {
  const result = await runTick();
  res.json(result);
});

app.get('/unsubscribe', async (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== 'string') return res.status(400).send('invalid');
  const payload = verifyToken(token);
  if (!payload?.leadId) return res.status(400).send('invalid');

  const db = await readDb();
  const lead = db.leads.find(l => l.id === payload.leadId);
  if (!lead) return res.status(404).send('not found');

  lead.status = 'unsubscribed';
  await writeDb(db);
  res.send('你已退订，后续不会再收到跟进邮件。');
});

async function buildWeeklyReport() {
  const db = await readDb();
  const oneWeek = now() - 7 * 24 * 3600 * 1000;
  const leads = db.leads.filter(l => l.createdAt >= oneWeek).length;
  const mails = db.emailLogs.filter(m => m.sentAt >= oneWeek && !m.error).length;
  const errors = db.emailLogs.filter(m => m.sentAt >= oneWeek && m.error).length;
  const unsubscribed = db.leads.filter(l => l.status === 'unsubscribed').length;

  return {
    period: '7d', leads, mails, errors, unsubscribed,
    activeLeads: db.leads.filter(l => l.status === 'active').length,
    doneLeads: db.leads.filter(l => l.status === 'done').length
  };
}

app.get('/api/report/weekly', requireAdmin, async (_, res) => {
  res.json(await buildWeeklyReport());
});

app.get('/api/report/weekly.csv', requireAdmin, async (_, res) => {
  const r = await buildWeeklyReport();
  const csv = [
    'period,leads,mails,errors,unsubscribed,activeLeads,doneLeads',
    `${r.period},${r.leads},${r.mails},${r.errors},${r.unsubscribed},${r.activeLeads},${r.doneLeads}`
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="weekly-report.csv"');
  res.send(csv);
});

app.use(express.static(path.resolve(process.cwd(), 'public')));

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`b2b-mail-mvp running on ${BASE_URL}`);
    console.log(`health: ${BASE_URL}/health`);
    console.log(`dashboard: ${BASE_URL}`);
    if (ADMIN_TOKEN) console.log('admin auth: enabled (x-admin-token required)');
    if (TICK_INTERVAL_SECONDS > 0) {
      console.log(`auto tick enabled: every ${TICK_INTERVAL_SECONDS}s`);
      setInterval(async () => {
        try {
          const r = await runTick();
          if (r.sent > 0 || r.dueLeads > 0) {
            console.log(`[tick] due=${r.dueLeads}, sent=${r.sent}`);
          }
        } catch (err) {
          console.error('[tick] failed', err?.message || err);
        }
      }, TICK_INTERVAL_SECONDS * 1000);
    }
  });
}

export default app;
