import { useEffect, useMemo, useState } from 'react';
import { Activity, Anchor, BarChart3, Bell, ChevronRight, CircleDollarSign, Droplets, FileCheck2, Gauge, LayoutDashboard, Menu, RefreshCw, Route, Save, Search, Settings, ShieldCheck, TrendingUp, Users, X } from 'lucide-react';
import { calculateTrade, riskLevel } from './calculate.js';
import { initialTrade, products, routes, scenarios } from './data.js';

const money = (v, digits=0) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:digits}).format(v);
const num = (v, digits=1) => new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(v);

function Metric({ label, value, sub, icon:Icon, tone='blue' }) {
  return <article className="metric"><div className={`metric-icon ${tone}`}><Icon size={19}/></div><div><p>{label}</p><strong>{value}</strong><span>{sub}</span></div></article>;
}

function Field({ label, value, onChange, suffix, type='number', children }) {
  return <label className="field"><span>{label}</span><div className="input-wrap">{children || <input type={type} value={value} onChange={e=>onChange(type==='number' ? Number(e.target.value) : e.target.value)}/>} {suffix&&<em>{suffix}</em>}</div></label>;
}

function App() {
  const [trade,setTrade] = useState(()=>{ try{return JSON.parse(localStorage.getItem('fueltrade-draft'))||initialTrade}catch{return initialTrade} });
  const [mobile,setMobile] = useState(false);
  const [saved,setSaved] = useState(false);
  const result = useMemo(()=>calculateTrade(trade),[trade]);
  const risk = useMemo(()=>riskLevel(trade,result),[trade,result]);
  const route = routes[trade.route];
  const update = (key,value)=>setTrade(t=>({...t,[key]:value}));
  const selectRoute = value=>setTrade(t=>({...t,route:value,freight:routes[value].freight}));
  const save = ()=>{ localStorage.setItem('fueltrade-draft',JSON.stringify(trade)); setSaved(true); setTimeout(()=>setSaved(false),1600); };
  useEffect(()=>{ document.title=`${trade.reference} · FuelTrade OS`; },[trade.reference]);

  return <div className="app-shell">
    <aside className={mobile?'open':''}>
      <div className="brand"><div className="brandmark"><Droplets size={22}/></div><div><b>FuelTrade</b><span>OPERATING SYSTEM</span></div><button className="close" onClick={()=>setMobile(false)}><X/></button></div>
      <nav>
        <small>WORKSPACE</small>
        <a className="active"><LayoutDashboard/> Command centre</a><a><CircleDollarSign/> Trade calculator</a><a><BarChart3/> Market intelligence</a><a><Route/> Logistics</a>
        <small>OPERATIONS</small>
        <a><FileCheck2/> Documents <i>8</i></a><a><ShieldCheck/> Due diligence</a><a><Users/> Counterparties</a><a><Settings/> Settings</a>
      </nav>
      <div className="system"><span><i></i> Systems operational</span><small>Data layer ready</small></div>
      <div className="profile"><div>DS</div><p><b>Trading Principal</b><span>Administrator</span></p><ChevronRight size={16}/></div>
    </aside>
    <main>
      <header><button className="menu" onClick={()=>setMobile(true)}><Menu/></button><div className="search"><Search size={18}/><span>Search trades, vessels or documents…</span><kbd>⌘ K</kbd></div><div className="head-actions"><button><Bell size={19}/><i></i></button><span className="market"><i></i> Market feeds ready</span></div></header>
      <div className="content">
        <div className="title-row"><div><p className="eyebrow">COMMAND CENTRE</p><h1>Trade intelligence</h1><p>Model landed economics, compare exposure and make faster decisions.</p></div><div className="title-actions"><button className="secondary"><RefreshCw size={16}/> Reset</button><button className="primary" onClick={save}><Save size={16}/>{saved?'Saved':'Save scenario'}</button></div></div>

        <section className="trade-banner"><div><span>ACTIVE MODEL</span><input value={trade.reference} onChange={e=>update('reference',e.target.value)}/></div><div className="route-line"><div className="port">FUJ</div><span><b>{trade.route.split(' → ')[0]}</b><small>Load port</small></span><div className="journey"><Anchor size={17}/><i></i><small>{trade.days} days</small></div><span><b>{trade.route.split(' → ')[1]}</b><small>{route.destination}</small></span><div className="port destination">{route.destination.slice(0,3).toUpperCase()}</div></div><div className="status"><i></i> Draft model</div></section>

        <section className="metrics">
          <Metric label="Projected revenue" value={money(result.revenue)} sub={`${num(trade.volumeMt,0)} MT at ${money(trade.sellPrice,0)}`} icon={TrendingUp}/>
          <Metric label="Total landed cost" value={money(result.totalCost)} sub={`${money(result.unitCost,2)} per MT`} icon={Anchor} tone="violet"/>
          <Metric label="Net trade profit" value={money(result.netProfit)} sub={`${num(result.netMarginPct,2)}% net margin`} icon={CircleDollarSign} tone="green"/>
          <Metric label="Risk exposure" value={`${risk.score} / 100`} sub={`${risk.label} risk profile`} icon={Gauge} tone="amber"/>
        </section>

        <div className="grid">
          <section className="panel model"><div className="panel-head"><div><h2>Trade model</h2><p>Adjust commercial and operational assumptions</p></div><span className="live-dot">AUTO-CALCULATED</span></div>
            <div className="form-grid">
              <Field label="Product"><select value={trade.product} onChange={e=>update('product',e.target.value)}>{products.map(x=><option key={x}>{x}</option>)}</select></Field>
              <Field label="Trade volume" value={trade.volumeMt} onChange={v=>update('volumeMt',v)} suffix="MT"/>
              <Field label="Trade route"><select value={trade.route} onChange={e=>selectRoute(e.target.value)}>{Object.keys(routes).map(x=><option key={x}>{x}</option>)}</select></Field>
              <Field label="Incoterm"><select value={trade.incoterm} onChange={e=>update('incoterm',e.target.value)}>{['CIF','CFR','FOB','DAP'].map(x=><option key={x}>{x}</option>)}</select></Field>
              <Field label="Purchase price" value={trade.buyPrice} onChange={v=>update('buyPrice',v)} suffix="$/MT"/>
              <Field label="Sale price" value={trade.sellPrice} onChange={v=>update('sellPrice',v)} suffix="$/MT"/>
            </div>
            <div className="cost-title"><h3>Cost stack</h3><span>Per metric tonne unless marked %</span></div>
            <div className="cost-grid">
              {[['freight','Freight','$/MT'],['insurancePct','Insurance','%'],['inspection','Inspection','$/MT'],['port','Port charges','$/MT'],['storage','Storage','$/MT'],['trucking','Inland logistics','$/MT'],['legal','Legal & DD','$/MT'],['financePct','Finance rate','%'],['contingencyPct','Contingency','%']].map(([key,label,suffix])=><Field key={key} label={label} value={trade[key]} onChange={v=>update(key,v)} suffix={suffix}/>) }
            </div>
          </section>

          <section className="panel economics"><div className="panel-head"><div><h2>Deal economics</h2><p>Live profitability analysis</p></div><Activity size={20}/></div>
            <div className="hero-profit"><span>NET PROFIT</span><strong className={result.netProfit<0?'negative':''}>{money(result.netProfit)}</strong><p><b>{num(result.netMarginPct,2)}%</b> of gross revenue</p></div>
            <div className="margin-bar"><i style={{width:`${Math.max(0,Math.min(100,result.netMarginPct*5))}%`}}></i></div>
            <div className="economics-list">
              <div><span>Gross revenue</span><b>{money(result.revenue)}</b></div><div><span>Product purchase</span><b>− {money(result.buyValue)}</b></div><div><span>Operating costs</span><b>− {money(result.operatingCosts)}</b></div><div><span>Insurance & finance</span><b>− {money(result.insurance+result.finance)}</b></div><div><span>Risk contingency</span><b>− {money(result.contingency)}</b></div>
            </div>
            <div className="mini-stats"><div><span>ROI</span><b>{num(result.roiPct,2)}%</b></div><div><span>Unit margin</span><b>{money(result.unitMargin,2)}</b></div><div><span>Break-even</span><b>{money(result.breakEven,2)}</b></div><div><span>Capital required</span><b>{money(result.workingCapital)}</b></div></div>
            <div className="fx"><div><span>LOCAL CURRENCY VIEW</span><b>{route.currency} {num(result.netProfit*route.fx,0)}</b></div><small>Indicative FX: 1 USD = {route.fx} {route.currency}</small></div>
          </section>
        </div>

        <section className="panel scenarios"><div className="panel-head"><div><h2>Sourcing scenarios</h2><p>Compare approved acquisition routes using the current model</p></div><button className="text-button">View all <ChevronRight size={15}/></button></div>
          <div className="table"><div className="tr th"><span>Source</span><span>Buy price</span><span>Landed cost</span><span>Net profit</span><span>Margin</span><span>Confidence</span></div>{scenarios.map((s,i)=>{const r=calculateTrade({...trade,buyPrice:s.buyPrice});return <div className={`tr ${i===1?'selected':''}`} key={s.name}><span><i className="source-icon">{i===0?'R':i===1?'C':'T'}</i><b>{s.name}</b><small>{s.leadDays}-day lead</small></span><span>{money(s.buyPrice,0)}<small>per MT</small></span><span>{money(r.unitCost,2)}<small>per MT</small></span><span className="positive">{money(r.netProfit)}<small>total</small></span><span><b>{num(r.netMarginPct,2)}%</b><small>net</small></span><span><i className="confidence"><em style={{width:`${s.confidence}%`}}></em></i><small>{s.confidence}% verified</small></span></div>})}</div>
        </section>
      </div>
    </main>
  </div>;
}

export default App;
