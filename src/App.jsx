import { useEffect, useMemo, useState } from 'react';
import { Activity, Anchor, BarChart3, Bell, Bot, ChevronRight, CircleDollarSign, Droplets, FileCheck2, Gauge, LayoutDashboard, Mail, Menu, MessageSquare, Phone, Plus, Route, Save, Search, Settings, ShieldCheck, TrendingUp, Users, Video, X } from 'lucide-react';
import { calculateTrade, riskLevel } from './calculate.js';
import { initialTrade, routes } from './data.js';
import { dashboardForRole, roles, communicationChannels } from './workspace.js';

const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
const tileIcons={economics:CircleDollarSign,market:BarChart3,documents:FileCheck2,'due-diligence':ShieldCheck,logistics:Route,messaging:MessageSquare,tasks:Activity,'full-deal':LayoutDashboard,counterparties:Users,insurance:ShieldCheck,banking:CircleDollarSign,voyage:Anchor,cargo:Droplets,eta:Gauge,port:Anchor,berth:Anchor,discharge:Droplets,inspection:ShieldCheck,storage:LayoutDashboard,contracts:FileCheck2,approvals:FileCheck2,incidents:Bell,lc:FileCheck2,payments:CircleDollarSign};
const channelIcons={internal:MessageSquare,email:Mail,whatsapp:Phone,telegram:MessageSquare,voice:Phone,video:Video,conference:Users};

function App(){
 const [trade,setTrade]=useState(()=>{try{return JSON.parse(localStorage.getItem('fueltrade-draft'))||initialTrade}catch{return initialTrade}});
 const [role,setRole]=useState('trader');
 const [view,setView]=useState('command');
 const [mobile,setMobile]=useState(false);
 const [saved,setSaved]=useState(false);
 const [messages,setMessages]=useState([{id:1,author:'Trade Copilot',body:'Deal room ready. I will surface deadlines, missing documents and material changes here.',time:'09:12'}]);
 const [draft,setDraft]=useState('');
 const result=useMemo(()=>calculateTrade(trade),[trade]);
 const risk=useMemo(()=>riskLevel(trade,result),[trade,result]);
 const tiles=useMemo(()=>dashboardForRole(role),[role]);
 const route=routes[trade.route];
 const save=()=>{localStorage.setItem('fueltrade-draft',JSON.stringify(trade));setSaved(true);setTimeout(()=>setSaved(false),1400)};
 const openTile=id=>setView(id==='messaging'?'messaging':id==='full-deal'?'deal':'command');
 const send=()=>{if(!draft.trim())return;setMessages(x=>[...x,{id:Date.now(),author:'You',body:draft.trim(),time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}]);setDraft('')};
 useEffect(()=>{document.title=`${trade.reference} · FuelTrade OS`},[trade.reference]);

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
   <header><button className="menu" onClick={()=>setMobile(true)}><Menu/></button><div className="search"><Search size={18}/><span>Search this deal, messages or documents…</span></div><div className="head-actions"><select className="role-select" value={role} onChange={e=>{setRole(e.target.value);setView('command')}}>{Object.entries(roles).map(([id,r])=><option key={id} value={id}>{r.label}</option>)}</select><button><Bell size={19}/><i></i></button></div></header>
   <div className="content">
    <section className="deal-top"><div><p className="eyebrow">ACTIVE DEAL · {trade.incoterm}</p><h1>{trade.reference}</h1><p>{trade.product} · {trade.volumeMt.toLocaleString()} MT · {trade.route}</p></div><div className="title-actions"><button className="secondary" onClick={()=>setView('messaging')}><MessageSquare size={16}/> Deal room</button><button className="primary" onClick={save}><Save size={16}/>{saved?'Saved':'Save deal'}</button></div></section>
    <section className="metrics">
     <Metric label="Revenue" value={money(result.revenue)} sub="Projected trade value" icon={TrendingUp}/>
     <Metric label="Net profit" value={money(result.netProfit)} sub={result.netMarginPct.toFixed(2)+'% net margin'} icon={CircleDollarSign}/>
     <Metric label="Risk exposure" value={risk.score+' / 100'} sub={risk.label+' risk'} icon={Gauge}/>
     <Metric label="Voyage" value={trade.days+' days'} sub={route.destination} icon={Anchor}/>
    </section>

    {view==='command'&&<><div className="section-head"><div><h2>{roles[role].label} command centre</h2><p>Your agreed essentials. Add more permitted modules as needed.</p></div><button className="secondary"><Plus size={15}/> Configure dashboard</button></div><section className="tile-grid">{tiles.map(t=>{const Icon=tileIcons[t.id]||LayoutDashboard;return <button className={'deal-tile '+(t.id==='full-deal'?'full':'')} key={t.id} onClick={()=>openTile(t.id)}><span className="tile-icon"><Icon/></span><div><b>{t.label}</b><small>{t.description}</small></div><ChevronRight/></button>})}</section></>}

    {view==='messaging'&&<section className="workspace-panel messaging-view"><div className="section-head"><div><p className="eyebrow">DEAL ROOM</p><h2>Unified communications</h2><p>Internal collaboration with external channel adapters linked to this deal.</p></div><button className="primary"><Bot size={16}/> Ask Copilot</button></div><div className="channel-strip">{communicationChannels.map(c=>{const Icon=channelIcons[c.id]||MessageSquare;return <button key={c.id} className={c.id==='internal'?'selected':''}><Icon size={16}/><span>{c.label}</span><small>{c.status==='ready'?'LIVE':'CONNECT'}</small></button>})}</div><div className="chat-layout"><div className="thread"><div className="thread-title"><b># deal-room</b><span>{trade.reference} · authorized participants only</span></div><div className="messages">{messages.map(m=><div className="message" key={m.id}><div>{m.author==='Trade Copilot'?'AI':'DS'}</div><p><b>{m.author}<small>{m.time}</small></b><span>{m.body}</span></p></div>)}</div><div className="composer"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Message the deal team or @Copilot…"/><button onClick={send}>Send</button></div></div><aside className="deal-context"><h3>Deal context</h3><p><span>Route</span><b>{trade.route}</b></p><p><span>Product</span><b>{trade.product}</b></p><p><span>Volume</span><b>{trade.volumeMt.toLocaleString()} MT</b></p><p><span>Risk</span><b>{risk.label}</b></p><div className="ai-note"><Bot/><b>Copilot watching</b><span>Deadlines · documents · approvals · material changes</span></div></aside></div></section>}

    {view==='deal'&&<section className="workspace-panel full-deal-view"><div className="section-head"><div><p className="eyebrow">FULL DEAL</p><h2>Authorized transaction workspace</h2><p>Commercial, operational and communications context in one auditable record.</p></div></div><div className="deal-summary-grid"><div><span>Commercial</span><b>{trade.product}</b><p>{trade.volumeMt.toLocaleString()} MT · {trade.incoterm}</p></div><div><span>Economics</span><b>{money(result.netProfit)}</b><p>{result.netMarginPct.toFixed(2)}% net margin</p></div><div><span>Logistics</span><b>{trade.route}</b><p>{trade.days} day modeled voyage</p></div><div><span>Risk</span><b>{risk.score}/100</b><p>{risk.label} profile</p></div></div><div className="timeline"><h3>Deal timeline</h3><div><i></i><p><b>Deal workspace initialized</b><span>Commercial model and role permissions available.</span></p></div><div><i></i><p><b>Communications room available</b><span>Internal Deal Chat enabled; external adapters ready for connection.</span></p></div><div><i></i><p><b>Integration phase</b><span>Email, realtime calling and approved external channels are next.</span></p></div></div></section>}
   </div>
  </main>
 </div>
}

function Metric({label,value,sub,icon:Icon}){return <article className="metric"><div className="metric-icon"><Icon size={19}/></div><div><p>{label}</p><strong>{value}</strong><span>{sub}</span></div></article>}
export default App;
