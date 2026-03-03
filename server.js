const express  = require('express');
const cors     = require('cors');
const { v4: uuidv4 } = require('uuid');
const path     = require('path');
const db       = require('./db');


const app  = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// ── GET all leads ──────────────────────────────────
app.get('/api/leads', (req, res) => {
  const { client, source, status } = req.query;
  let q = 'SELECT * FROM leads WHERE 1=1';
  const p = [];
  if (client) { q += ' AND client = ?'; p.push(client); }
  if (source) { q += ' AND source = ?'; p.push(source); }
  if (status) { q += ' AND status = ?'; p.push(status); }
  q += ' ORDER BY created_at DESC';
  res.json(db.prepare(q).all(...p));
});


// ── CREATE lead (manual) ───────────────────────────
app.post('/api/leads', (req, res) => {
  const lead = {
    id: uuidv4(), ...req.body,
    date: req.body.date || new Date().toISOString().split('T')[0]
  };
  db.prepare(`
    INSERT INTO leads
      (id,name,email,phone,source,client,status,date,quoteNumber,saleAmount,notes,page_url,utm_campaign)
    VALUES
      (@id,@name,@email,@phone,@source,@client,@status,@date,@quoteNumber,@saleAmount,@notes,@page_url,@utm_campaign)
  `).run({ page_url:'', utm_campaign:'', quoteNumber:'', saleAmount:null, notes:'', ...lead });
  res.json({ success: true, lead });
});


// ── UPDATE lead ────────────────────────────────────
app.patch('/api/leads/:id', (req, res) => {
  const sets = Object.keys(req.body).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE leads SET ${sets} WHERE id = @id`).run({ ...req.body, id: req.params.id });
  res.json({ success: true });
});


// ── DELETE lead ────────────────────────────────────
app.delete('/api/leads/:id', (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});


// ── WEBHOOK (from WordPress snippet) ──────────────
app.post('/webhook/intake', (req, res) => {
  const key    = req.query.key || req.headers['x-api-key'];
  const client = db.prepare('SELECT * FROM clients WHERE api_key = ?').get(key);
  if (!client) return res.status(401).json({ error: 'Invalid API key' });


  const b = req.body;
  const med = (b.utm_medium  || '').toLowerCase();
  const src = (b.utm_source  || '').toLowerCase();
  const ref = (b.referrer    || '').toLowerCase();
  let source = 'Direct';
  if (med === 'cpc' || med === 'ppc')               source = 'PPC';
  else if (med === 'organic')                        source = 'SEO';
  else if (src === 'facebook' || src === 'instagram') source = 'Social';
  else if (ref)                                      source = 'Referral';
  else if (b.source)                                 source = b.source;


  const lead = {
    id: uuidv4(),
    name:         b.name    || 'Unknown',
    email:        b.email   || '',
    phone:        b.phone   || '',
    source,
    client:       client.name,
    status:       'New',
    date:         new Date().toISOString().split('T')[0],
    quoteNumber:  '',
    saleAmount:   null,
    notes:        b.notes || b.message || '',
    page_url:     b.page_url     || '',
    utm_campaign: b.utm_campaign || ''
  };


  db.prepare(`
    INSERT INTO leads
      (id,name,email,phone,source,client,status,date,quoteNumber,saleAmount,notes,page_url,utm_campaign)
    VALUES
      (@id,@name,@email,@phone,@source,@client,@status,@date,@quoteNumber,@saleAmount,@notes,@page_url,@utm_campaign)
  `).run(lead);


  console.log(`[LeadLens] ↓ ${lead.name} | ${lead.source} | ${lead.client}`);
  res.json({ success: true, lead_id: lead.id });
});


// ── GET clients + api keys ─────────────────────────
app.get('/api/clients', (req, res) => {
  res.json(db.prepare('SELECT * FROM clients').all());
});


// ── ADD client ─────────────────────────────────────
app.post('/api/clients', (req, res) => {
  const client = {
    id:      uuidv4(),
    name:    req.body.name,
    api_key: 'll_live_' + uuidv4().replace(/-/g,'').slice(0,16)
  };
  db.prepare('INSERT INTO clients (id,name,api_key) VALUES (@id,@name,@api_key)').run(client);
  res.json({ success: true, client });
});


// ── STATS ──────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const total   = db.prepare('SELECT COUNT(*) as n FROM leads').get().n;
  const won     = db.prepare("SELECT COUNT(*) as n FROM leads WHERE status='Closed Won'").get().n;
  const revenue = db.prepare("SELECT COALESCE(SUM(saleAmount),0) as n FROM leads WHERE status='Closed Won'").get().n;
  const bySrc   = db.prepare('SELECT source, COUNT(*) as count FROM leads GROUP BY source').all();
  res.json({ total, won, revenue, convRate: total ? Math.round((won/total)*100) : 0, bySrc });
});


// ── Catch-all → serve frontend ─────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
  console.log(`\n🔍 LeadLens → http://localhost:${PORT}`);
  console.log(`📡 Webhook  → http://localhost:${PORT}/webhook/intake?key=<api_key>\n`);
});
