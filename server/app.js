import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const permissions = {
  admin: ['deal:read','deal:write','message:read','message:write','user:manage'],
  trader: ['deal:read','deal:write','message:read','message:write'],
  legal: ['deal:read','message:read','message:write'],
  finance: ['deal:read','message:read','message:write'],
  captain: ['deal:read','message:read','message:write'],
  portOperator: ['deal:read','message:read','message:write']
};
const hash = value => createHash('sha256').update(value).digest('hex');
const passwordHash = (password, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password,salt,64).toString('hex')}`;
const verify = (password, stored) => { const [salt, digest] = stored.split(':'); const actual = scryptSync(password,salt,64); const expected = Buffer.from(digest,'hex'); return actual.length === expected.length && timingSafeEqual(actual,expected); };
const json = (res, status, value, headers={}) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}); res.end(JSON.stringify(value)); };
const body = async req => { let raw=''; for await (const chunk of req) { raw += chunk; if(raw.length>1_000_000) throw new Error('Payload too large'); } return JSON.parse(raw || '{}'); };

export function createApp({ dbPath = resolve('data/fueltrade.sqlite'), bootstrapEmail = process.env.BOOTSTRAP_EMAIL, bootstrapPassword = process.env.BOOTSTRAP_PASSWORD, secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath),{recursive:true});
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS deals(id INTEGER PRIMARY KEY, reference TEXT UNIQUE NOT NULL, data TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deal_members(deal_id INTEGER NOT NULL REFERENCES deals(id), user_id INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY(deal_id,user_id));
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, deal_id INTEGER NOT NULL REFERENCES deals(id), user_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), deal_id INTEGER, action TEXT NOT NULL, created_at TEXT NOT NULL);`);
  if (!db.prepare('SELECT id FROM users LIMIT 1').get() && bootstrapEmail && bootstrapPassword?.length >= 12) db.prepare('INSERT INTO users(email,password_hash,role) VALUES(?,?,?)').run(bootstrapEmail.toLowerCase(),passwordHash(bootstrapPassword),'admin');
  const log = (userId,dealId,action) => db.prepare('INSERT INTO audit(user_id,deal_id,action,created_at) VALUES(?,?,?,?)').run(userId,dealId,action,new Date().toISOString());
  const member = (dealId,user) => user.role === 'admin' || !!db.prepare('SELECT 1 FROM deal_members WHERE deal_id=? AND user_id=?').get(dealId,user.id);
  const handler = async (req,res) => {
    try {
      const url = new URL(req.url,'http://localhost');
      if (!url.pathname.startsWith('/api/')) return json(res,404,{error:'Not found'});
      if (req.method !== 'GET') { const origin = req.headers.origin; if(origin && new URL(origin).host !== req.headers.host) return json(res,403,{error:'Origin rejected'}); if(req.headers['content-type']?.split(';')[0] !== 'application/json') return json(res,415,{error:'JSON required'}); }
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res,200,{ok:true});
      if (url.pathname === '/api/login' && req.method === 'POST') {
        const input = await body(req); const user = typeof input.email === 'string' && db.prepare('SELECT * FROM users WHERE email=?').get(input.email.toLowerCase());
        if (!user || typeof input.password !== 'string' || !verify(input.password,user.password_hash)) return json(res,401,{error:'Invalid credentials'});
        const token=randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,Date.now()+8*3600_000);
        return json(res,200,{id:user.id,email:user.email,role:user.role},{'set-cookie':`ft_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${secureCookies?'; Secure':''}`});
      }
      const token=req.headers.cookie?.match(/(?:^|; )ft_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      const user=token && db.prepare('SELECT u.id,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),Date.now());
      if (!user) return json(res,401,{error:'Authentication required'});
      if (url.pathname === '/api/logout' && req.method === 'POST') { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); return json(res,200,{ok:true},{'set-cookie':'ft_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'}); }
      if (url.pathname === '/api/me' && req.method === 'GET') return json(res,200,user);
      if (url.pathname === '/api/users' && req.method === 'POST') {
        if (!permissions[user.role].includes('user:manage')) return json(res,403,{error:'Forbidden'});
        const input=await body(req); if (!/^\S+@\S+\.\S+$/.test(input.email||'') || !permissions[input.role] || typeof input.password!=='string' || input.password.length<12) return json(res,400,{error:'Invalid user'});
        const result=db.prepare('INSERT INTO users(email,password_hash,role) VALUES(?,?,?)').run(input.email.toLowerCase(),passwordHash(input.password),input.role); log(user.id,null,'user.created'); return json(res,201,{id:Number(result.lastInsertRowid),email:input.email,role:input.role});
      }
      if (url.pathname === '/api/deals' && req.method === 'GET') return json(res,200,db.prepare(`SELECT d.id,d.reference,d.data,d.updated_at FROM deals d WHERE ?='admin' OR EXISTS(SELECT 1 FROM deal_members m WHERE m.deal_id=d.id AND m.user_id=?) ORDER BY d.id DESC`).all(user.role,user.id).map(d=>({...d,data:JSON.parse(d.data)})));
      if (url.pathname === '/api/deals' && req.method === 'POST') {
        if (!permissions[user.role].includes('deal:write')) return json(res,403,{error:'Forbidden'});
        const input=await body(req); if (typeof input.reference!=='string' || !/^[\w-]{3,64}$/.test(input.reference) || !input.data || typeof input.data!=='object' || Array.isArray(input.data)) return json(res,400,{error:'Invalid deal'});
        const result=db.prepare('INSERT INTO deals(reference,data,created_by,updated_at) VALUES(?,?,?,?)').run(input.reference,JSON.stringify(input.data),user.id,new Date().toISOString()); const id=Number(result.lastInsertRowid);
        db.prepare('INSERT INTO deal_members VALUES(?,?)').run(id,user.id); log(user.id,id,'deal.created'); return json(res,201,{id});
      }
      const dealMatch=url.pathname.match(/^\/api\/deals\/(\d+)(?:\/(messages|members))?$/);
      if (dealMatch) {
        const id=Number(dealMatch[1]), sub=dealMatch[2]; const deal=db.prepare('SELECT * FROM deals WHERE id=?').get(id);
        if (!deal || !member(id,user)) return json(res,404,{error:'Deal not found'});
        if (!sub && req.method==='GET') return json(res,200,{...deal,data:JSON.parse(deal.data)});
        if (!sub && req.method==='PUT') {
          if (!permissions[user.role].includes('deal:write')) return json(res,403,{error:'Forbidden'});
          const input=await body(req); if(!input.data || typeof input.data!=='object' || Array.isArray(input.data) || JSON.stringify(input.data).length>100_000) return json(res,400,{error:'Invalid deal data'});
          db.prepare('UPDATE deals SET data=?,updated_at=? WHERE id=?').run(JSON.stringify(input.data),new Date().toISOString(),id); log(user.id,id,'deal.updated'); return json(res,200,{ok:true});
        }
        if (sub==='messages' && req.method==='GET') return json(res,200,db.prepare('SELECT m.id,m.body,m.created_at,u.email AS author FROM messages m JOIN users u ON u.id=m.user_id WHERE m.deal_id=? ORDER BY m.id DESC LIMIT 100').all(id).reverse());
        if (sub==='messages' && req.method==='POST') {
          const input=await body(req); if(typeof input.body!=='string' || !input.body.trim() || input.body.length>4000) return json(res,400,{error:'Invalid message'});
          const result=db.prepare('INSERT INTO messages(deal_id,user_id,body,created_at) VALUES(?,?,?,?)').run(id,user.id,input.body.trim(),new Date().toISOString()); log(user.id,id,'message.created'); return json(res,201,{id:Number(result.lastInsertRowid)});
        }
        if (sub==='members' && req.method==='POST') {
          if(user.role!=='admin') return json(res,403,{error:'Forbidden'});
          const input=await body(req); const target=db.prepare('SELECT id FROM users WHERE id=?').get(input.userId); if(!target) return json(res,400,{error:'Unknown user'});
          db.prepare('INSERT OR IGNORE INTO deal_members VALUES(?,?)').run(id,target.id); log(user.id,id,'member.added'); return json(res,200,{ok:true});
        }
      }
      return json(res,404,{error:'Not found'});
    } catch(error) { if(error instanceof SyntaxError) return json(res,400,{error:'Invalid JSON'}); if(error.message==='Payload too large') return json(res,413,{error:error.message}); if(error.code?.startsWith('SQLITE_CONSTRAINT')) return json(res,409,{error:'Conflict'}); console.error(error); return json(res,500,{error:'Internal error'}); }
  };
  return {db,server:http.createServer(handler)};
}
if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const {server}=createApp(); server.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log('FuelTrade API listening'));
}
