'use client';
import { useEffect, useState } from 'react';
import { Activity, Anchor, BarChart3, Bell, ChevronRight, CircleDollarSign, FileCheck2, Gauge, Landmark, LayoutDashboard, MessageSquare, Route, Settings2, ShieldCheck, Ship, Umbrella, Users, Warehouse } from 'lucide-react';
import { dashboardRoles, dashboardTiles, normalizeDashboardTiles } from '../lib/dashboard-layout.js';

const navKeys={economics:'calculator',sourcing:'market',diligence:'diligence',contracts:'documents',insurance:'risk',vessel:'logistics',cargo:'logistics',eta:'logistics',port:'logistics',storage:'downstream',tasks:'approvals',incidents:'risk',messaging:'deal-room'};
const icons={economics:CircleDollarSign,market:BarChart3,sourcing:BarChart3,documents:FileCheck2,diligence:ShieldCheck,counterparties:Users,contracts:FileCheck2,finance:Landmark,insurance:Umbrella,vessel:Ship,cargo:Ship,eta:Anchor,port:Anchor,storage:Warehouse,logistics:Route,approvals:ShieldCheck,tasks:Activity,incidents:Bell,messaging:MessageSquare,risk:Gauge};

export default function CommandDashboard({reference,signals,onNavigate}) {
  const [role,setRole]=useState(()=>{try{const saved=localStorage.getItem('fueltrade.dashboardLens');return Object.hasOwn(dashboardRoles,saved)?saved:'trader'}catch{return 'trader'}});
  const [tiles,setTiles]=useState(()=>normalizeDashboardTiles('trader'));
  const [configure,setConfigure]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setNotice('');
    fetch(`/api/dashboard?role=${encodeURIComponent(role)}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load layout');setTiles(normalizeDashboardTiles(role,data.tiles))}).catch(error=>{if(error.name!=='AbortError'){setTiles(normalizeDashboardTiles(role));setNotice('Layout is temporarily unavailable. Showing defaults.')}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return ()=>controller.abort();
  },[role]);
  const toggle=id=>setTiles(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const save=async()=>{
    setSaving(true);setNotice('');
    try{const response=await fetch('/api/dashboard',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role,tiles})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save layout');setTiles(data.tiles);setConfigure(false);setNotice('Dashboard layout saved.')}catch(error){setNotice(error.message)}finally{setSaving(false)}
  };
  const signal={documents:signals.documents?`${signals.documents} files`:null,approvals:signals.approvals?`${signals.approvals} pending`:null,port:`${signals.ports} port calls`,logistics:`${signals.ports} port calls`,risk:`${signals.risk}/100 risk`,economics:signals.margin,market:signals.market,finance:signals.finance,messaging:signals.messages?`${signals.messages} notes`:null};
  return <section className="command-dashboard" aria-label="Deal Command Centre">
    <div className="command-heading"><div><p className="eyebrow">DEAL COMMAND CENTRE</p><h2>{dashboardRoles[role].label} workspace</h2><p>Open the part of {reference} you need. Layout choices do not change account permissions.</p></div><div className="command-controls"><label>Workspace view<select value={role} onChange={event=>{setRole(event.target.value);try{localStorage.setItem('fueltrade.dashboardLens',event.target.value)}catch{}setConfigure(false)}}>{Object.entries(dashboardRoles).map(([id,definition])=><option key={id} value={id}>{definition.label}</option>)}</select></label><button type="button" className="secondary" onClick={()=>setConfigure(current=>!current)} aria-expanded={configure}><Settings2 size={17}/> {configure?'Close':'Configure'}</button></div></div>
    {notice&&<p className="command-notice" role="status">{notice}</p>}
    {configure&&<div className="command-config"><div><h3>Choose your buttons</h3><p>These sections are available in the {dashboardRoles[role].label.toLowerCase()} layout. Full Deal stays visible.</p></div><div className="command-options">{dashboardRoles[role].allowed.map(id=><label key={id}><input type="checkbox" checked={tiles.includes(id)} onChange={()=>toggle(id)}/>{dashboardTiles[id].label}</label>)}</div><div className="command-config-actions"><button type="button" className="secondary" onClick={()=>setTiles(normalizeDashboardTiles(role))}>Restore defaults</button><button type="button" className="primary" disabled={saving||loading} onClick={save}>{saving?'Saving…':'Save layout'}</button></div></div>}
    <div className="command-grid" aria-busy={loading}>{tiles.map(id=>{const item=dashboardTiles[id];const Icon=icons[id]||LayoutDashboard;return <button type="button" key={id} className="command-tile" onClick={()=>onNavigate(navKeys[id]||id,item.anchor)}><span className="command-tile-icon"><Icon size={23}/></span><span className="command-tile-copy"><strong>{item.label}</strong><small>{signal[id]||item.description}</small></span><ChevronRight size={18}/></button>})}</div>
    <button type="button" className="command-full-deal" onClick={()=>onNavigate('full-deal','full-deal')}><span><LayoutDashboard size={25}/><span><strong>Full Deal</strong><small>Open the complete transaction workspace</small></span></span><ChevronRight size={22}/></button>
  </section>;
}
