const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');


const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);


const db = new Database(path.join(dbDir, 'leadlens.db'));


db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT,
    phone        TEXT,
    source       TEXT DEFAULT 'Direct',
    client       TEXT,
    status       TEXT DEFAULT 'New',
    date         TEXT,
    quoteNumber  TEXT,
    saleAmount   REAL,
    notes        TEXT,
    page_url     TEXT,
    utm_campaign TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );


  CREATE TABLE IF NOT EXISTS clients (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    api_key TEXT UNIQUE
  );


  INSERT OR IGNORE INTO clients (id, name, api_key) VALUES
    ('1', 'Apex Roofing',     'll_apex_abc123'),
    ('2', 'Blue Sky HVAC',    'll_hvac_def456'),
    ('3', 'Metro Dental',     'll_dental_ghi789'),
    ('4', 'FastLane Auto',    'll_auto_jkl012'),
    ('5', 'Summit Law Group', 'll_law_mno345');
`);



module.exports = db;
