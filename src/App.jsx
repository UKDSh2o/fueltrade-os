import { useEffect, useMemo, useState } from 'react';
import { Activity, Anchor, BarChart3, Bell, Bot, ChevronRight, CircleDollarSign, Droplets, FileCheck2, Gauge, LayoutDashboard, Mail, Menu, MessageSquare, Phone, Plus, Route, Save, Search, Settings, ShieldCheck, TrendingUp, Users, Video, X } from 'lucide-react';
import { calculateTrade, riskLevel } from './calculate.js';
import { initialTrade, routes } from './data.js';
import { dashboardForRole, roles, communicationChannels } from './workspace.js';

const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
const tileIcons={economics:CircleDollarSign,market:BarChart3,documents:FileCheck2,'due-diligence':ShieldCheck,logistics:Route,messaging:MessageSquare,tasks:Activity,'full-deal':LayoutDashboard,counterparties:Users,insurance:ShieldCheck,banking:CircleDollarSign,voyage:Anchor,cargo:Droplets,eta:Gauge,port:Anchor,berth:Anchor,discharge:Droplets,inspection:ShieldCheck,storage:LayoutDashboard,contracts:FileCheck2,approvals:FileCheck2,incidents:Bell,lc:FileCheck2,payments:CircleDollarSign};
const channelIcons={internal:MessageSquare,email:Mail,whatsapp:Phone,telegram:MessageSquare,voice:Phone,video:Video,conference:Users};

function App(){
 const [trade,setTrade]=useState(initialTrade);
 const [role,setRole]=useState('trader');
 const [identity,setIdentity]=useState(null);
 const [authState,setAuthState]=useState('loading');
 const [credentials,setCredentials]=useState({email:'',password:''});
 const [authError,setAuthError]=useState('');
 const [dealId,setDealId]=useState(null);
 const [view,setView]=useState('command');
 const [mobile,setMobile]=useState(false);
 const [saved,setSaved]=useState(false);
 const [messages,setMessages]=useState([{id:1,author:'Trade Copilot',body:'Deal room ready. I will surface deadlines, missing documents and material changes here.',time:'09:12'}]);
 const [draft,setDraft]=useState('');
 const result=useMemo(()=>calculateTrade(trade),[trade]);
 const risk=useMemo(()=>riskLevel(trade,result),[trade,result]);
 const tiles=useMemo(()=>dashboardForRole(role),[role]);
 const route=routes[trade.route];
 const save=async()=>{try{const response=await fetch(dealId?`/api/deals/${dealId}`:'/api/deals',{method:dealId?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(dealId?{data:trade}:{reference:trade.reference,data:trade})});if(!response.ok)throw new Error((await response.json()).error);if(!dealId)setDealId((await response.json()).id);setSaved(true);setTimeout(()=>setSaved(false),1400)}catch(error){setAuthError(error.message)}};
 const openTile=id=>setView(id==='messaging'?'messaging':id==='full-deal'?'deal':'command');
 const send=async()=>{if(!draft.trim()||!dealId)return;const response=await fetch(`/api/deals/${dealId}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:draft.trim()})});if(!response.ok){setAuthError((await response.json()).error);return}setDraft('');loadMessages(dealId)};
 const loadMessages=async id=>{const response=await fetch(`/api/deals/${id}/messages`);if(response.ok)setMessages((await response.json()).map(m=>({id:m.id,author:m.author,body:m.body,time:new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})})))};
 const loadDeals=async()=>{const response=await fetch('/api/deals');if(!response.ok)return;const deals=await response.json();if(deals.length){setDealId(deals[0].id);setTrade(deals[0].data);loadMessages(deals[0].id)}};
 useEffect(()=>{fetch('/api/me').then(async response=>{if(response.ok){const user=await response.json();setIdentity(user);setRole(user.role);loadDeals()}setAuthState('ready')}).catch(()=>{setAuthError('API unavailable. Start the API server.');setAuthState('ready')})},[]);
 const login=async event=>{event.preventDefault();setAuthError('');try{const response=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)});if(!response.ok)throw new Error((await response.json()).error);const user=await response.json();setIdentity(user);setRole(user.role);loadDeals()}catch(error){setAuthError(error.message)}};
 const logout=async()=>{await fetch('/api/logout',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});setIdentity(null);setDealId(null);setMessages([])};
 useEffect(()=>{document.title=`${trade.reference} · FuelTrade OS`},[trade.reference]);

 if(authState==='loading')return <div className="auth-screen">Loading workspace…</div>;
 if(!identity)return <div className="auth-screen"><form onSubmit={login}><h1>FuelTrade OS</h1><p>Sign in to your deal workspace</p><label>Email<input type="email" required autoComplete="username" value={credentials.email} onChange={e=>setCredentials({...credentials,email:e.target.value})}/></label><label>Password<input type="password" required autoComplete="current-password" value={credentials.password} onChange={e=>setCredentials({...credentials,password:e.target.value})}/></label><button className="primary">Sign in</button>{authError&&<p role="alert">{authError}</p>}</form></div>;
 return <div className="app-shell">
  <aside className={mobile?'open':''}>
   <div className="brand"><div className="brandmark"><Droplets size={22}/></div><div><b>FuelTrade</b><span>OPERATING SYSTEM</span></div><button className="close" onClick={()=>setMobile(false)}><X/></button></div>
   <nav><small>DEAL OS</small>
    <a className={view==='command'?'active':''} onClick={()=>setView('command')}><LayoutDashboard/> Command centre</a>
    <a className={view==='deal'?'active':''} onClick={()=>setView('deal')}><FileCheck2/> Full deal</a>
    <a className={view==='messaging'?'active':''} onClick={()=>setView('messaging')}><MessageSquare/> Messaging <i>3</i></a>
    <small>INTELLIGENCE</small><a><BarChart3/> Market intelligence</a><a><Route/> Logistics</a><a><ShieldCheck/> Risk & DD</a>
   </nav>
   <div className="system"><span><i></i> Systems operational</span><small>Role-aware workspace</small></div>
   <div className="profile"><div>{roles[role].label.slice(0,2).toUpperCase()}</div><p><b>{roles[role].label}</b><span>{trade.reference}</span></p><ChevronRight size={16}/></div>
  </aside>
  <main>
   <header><button className="menu" onClick={()=>setMobile(true)}><Menu/></button><div className="search"><Search size={18}/><span>Search this deal, messages or documents…</span></div><div className="head-actions"><span className="role-select">{roles[role].label}</span><button onClick={logout}>Sign out</button><button><Bell size={19}/><i></i></button></div></header>
   <div className="content">{authError&&<p role="alert">{authError}</p>}
    <section className="deal-top"><div><p className="eyebrow">ACTIVE DEAL · {trade.incoterm}</p><h1>{trade.reference}</h1><p>{trade.product} · {trade.volumeMt.toLocaleString()} MT · {trade.route}</p></div><div className="title-actions"><button className="secondary" onClick={()=>setView('messaging')}><MessageSquare size={16}/> Deal room</button>{['admin','trader'].includes(role)&&<button className="primary" onClick={save}><Save size={16}/>{saved?'Saved':'Save deal'}</button>}</div></section>
    <section className="metrics">
     <Metric label="Revenue" value={money(result.revenue)} sub="Projected trade value" icon={TrendingUp}/>
     <Metric label="Net profit" value={money(result.netProfit)} sub={result.netMarginPct.toFixed(2)+'% net margin'} icon={CircleDollarSign}/>
     <Metric label="Risk exposure" value={risk.score+' / 100'} sub={risk.label+' risk'} icon={Gauge}/>
     <Metric label="Voyage" value={trade.days+' days'} sub={route.destination} icon={Anchor}/>
    </section>

    {view==='command'&&<><div className="section-head"><div><h2>{roles[role].label} command centre</h2><p>Your agreed essentials. Add more permitted modules as needed.</p></div><button className="secondary"><Plus size={15}/> Configure dashboard</button></div><section className="tile-grid">{tiles.map(t=>{const Icon=tileIcons[t.id]||LayoutDashboard;return <button className={'deal-tile '+(t.id==='full-deal'?'full':'')} key={t.id} onClick={()=>openTile(t.id)}><span className="tile-icon"><Icon/></span><div><b>{t.label}</b><small>{t.description}</small></div><ChevronRight/></button>})}</section></>}

    {view==='messaging'&&<section className="workspace-panel messaging-view"><div className="section-head"><div><p className="eyebrow">DEAL ROOM</p><h2>Unified communications</h2><p>Internal collaboration with external channel adapters linked to this deal.</p></div><span className="adapter-note">Copilot connection pending</span></div><div className="channel-strip">{communicationChannels.map(c=>{const Icon=channelIcons[c.id]||MessageSquare;return <button key={c.id} className={c.id==='internal'?'selected':''}><Icon size={16}/><span>{c.label}</span><small>{c.id==='internal'&&dealId?'READY':'PLANNED'}</small></button>})}</div><div className="chat-layout"><div className="thread"><div className="thread-title"><b># deal-room</b><span>{trade.reference} · authorized participants only</span></div><div className="messages">{messages.map(m=><div className="message" key={m.id}><div>{m.author==='Trade Copilot'?'AI':'DS'}</div><p><b>{m.author}<small>{m.time}</small></b><span>{m.body}</span></p></div>)}</div><div className="composer"><input disabled={!dealId} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={dealId?"Message the deal team…":"Save the deal to enable chat"}/><button onClick={send}>Send</button></div></div><aside className="deal-context"><h3>Deal context</h3><p><span>Route</span><b>{trade.route}</b></p><p><span>Product</span><b>{trade.product}</b></p><p><span>Volume</span><b>{trade.volumeMt.toLocaleString()} MT</b></p><p><span>Risk</span><b>{risk.label}</b></p><div className="ai-note"><Bot/><b>Copilot planned</b><span>Automation requires a connected service.</span></div></aside></div></section>}

    {view==='deal'&&<section className="workspace-panel full-deal-view"><div className="section-head"><div><p className="eyebrow">FULL DEAL</p><h2>Authorized transaction workspace</h2><p>Commercial, operational and communications context in one auditable record.</p></div></div><div className="deal-summary-grid"><div><span>Commercial</span><b>{trade.product}</b><p>{trade.volumeMt.toLocaleString()} MT · {trade.incoterm}</p></div><div><span>Economics</span><b>{money(result.netProfit)}</b><p>{result.netMarginPct.toFixed(2)}% net margin</p></div><div><span>Logistics</span><b>{trade.route}</b><p>{trade.days} day modeled voyage</p></div><div><span>Risk</span><b>{risk.score}/100</b><p>{risk.label} profile</p></div></div><div className="timeline"><h3>Deal timeline</h3><div><i></i><p><b>Deal workspace initialized</b><span>Commercial model and role permissions available.</span></p></div><div><i></i><p><b>Communications room available</b><span>Internal Deal Chat enabled; external adapters ready for connection.</span></p></div><div><i></i><p><b>Integration phase</b><span>Email, realtime calling and approved external channels are next.</span></p></div></div></section>}
   </div>
  </main>
 </div>
}

function Metric({label,value,sub,icon:Icon}){return <article className="metric"><div className="metric-icon"><Icon size={19}/></div><div><p>{label}</p><strong>{value}</strong><span>{sub}</span></div></article>}
export default App;
