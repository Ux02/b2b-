import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import { readDb, writeDb, id } from './store.js';
import { sequence, render } from './templates.js';
import { sendMail } from './mailer.js';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3030);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const APP_SECRET = process.env.APP_SECRET || 'replace_me';

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

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api/leads', (req, res) => {
  const { name, email, company, source = 'manual', tags = [] } = req.body || {};
  if (!name || !email || !company) {
    return res.status(400).json({ error: 'name/email/company 必填' });
  }

  const db = readDb();
  const lead = {
    id: id('lead'), name, email, company, source, tags,
    status: 'active',
    createdAt: now(),
    stepSent: 0,
    nextSendAt: now()
  };
  db.leads.push(lead);
  writeDb(db);
  res.json({ ok: true, lead });
});

app.get('/api/leads', (_, res) => {
  const db = readDb();
  res.json(db.leads);
});

app.post('/api/tick', async (_, res) => {
  const db = readDb();
  const active = db.leads.filter(l => l.status === 'active' && l.nextSendAt <= now());
  let sent = 0;

  for (const lead of active) {
    const nextStep = lead.stepSent + 1;
    const tpl = sequence.find(s => s.step === nextStep);
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
      lead.nextSendAt = now() + tpl.delayHours * 3600 * 1000;
      if (nextStep >= sequence.length) lead.status = 'done';
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

  writeDb(db);
  res.json({ ok: true, sent, dueLeads: active.length });
});

app.get('/unsubscribe', (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== 'string') return res.status(400).send('invalid');
  const payload = verifyToken(token);
  if (!payload?.leadId) return res.status(400).send('invalid');

  const db = readDb();
  const lead = db.leads.find(l => l.id === payload.leadId);
  if (!lead) return res.status(404).send('not found');

  lead.status = 'unsubscribed';
  writeDb(db);
  res.send('你已退订，后续不会再收到跟进邮件。');
});

app.get('/api/report/weekly', (_, res) => {
  const db = readDb();
  const oneWeek = now() - 7 * 24 * 3600 * 1000;
  const leads = db.leads.filter(l => l.createdAt >= oneWeek).length;
  const mails = db.emailLogs.filter(m => m.sentAt >= oneWeek && !m.error).length;
  const errors = db.emailLogs.filter(m => m.sentAt >= oneWeek && m.error).length;
  const unsubscribed = db.leads.filter(l => l.status === 'unsubscribed').length;

  res.json({
    period: '7d',
    leads,
    mails,
    errors,
    unsubscribed,
    activeLeads: db.leads.filter(l => l.status === 'active').length,
    doneLeads: db.leads.filter(l => l.status === 'done').length
  });
});

app.listen(PORT, () => {
  console.log(`b2b-mail-mvp running on ${BASE_URL}`);
  console.log(`health: ${BASE_URL}/health`);
});
