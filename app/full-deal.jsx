'use client';

const sections = [
  ['Commercial model','trade-calculator'],
  ['Sourcing and quotes','market-intelligence'],
  ['Due diligence','due-diligence'],
  ['Documents','documents'],
  ['Logistics and ports','logistics'],
  ['Finance and payments','finance'],
  ['Insurance and risk','risk'],
  ['Approvals','approvals'],
  ['Deal room','deal-room'],
  ['Access settings','access-settings'],
];

export default function FullDeal({trade,result,risk,documents,controls,finance,policy,voyage,sourcing,approvals,members,milestones,onNavigate}) {
  const completeControls=Object.values(controls).filter(Boolean).length;
  const quotes=sourcing.quotes?.length||0;
  const pending=approvals.filter(item=>item.status==='pending').length;
  const rows=[
    ['Trade',`${trade.product} · ${Number(trade.volumeMt||0).toLocaleString()} MT`,`${trade.incoterm} · ${trade.route}`],
    ['Economics',`${result.netMarginPct.toFixed(2)}% net margin`,`$${Math.round(result.netProfit).toLocaleString()} projected net profit`],
    ['Sourcing',`${quotes} ${quotes===1?'quote':'quotes'}`,sourcing.selectedQuoteKey?'Quote selected':'No quote selected'],
    ['Due diligence',`${completeControls}/${Object.keys(controls).length} controls recorded`,approvalStatus(completeControls,Object.keys(controls).length)],
    ['Documents',`${documents.length} ${documents.length===1?'file':'files'}`,'Stored in this trade workspace'],
    ['Finance',finance.instrumentType?.replaceAll('_',' ')||'No instrument',finance.status||'Draft'],
    ['Insurance',policy.insurer||'No insurer recorded',policy.status||'Draft'],
    ['Voyage',voyage.vesselName||'No vessel nominated',voyage.eta?`ETA ${voyage.eta}`:'ETA pending'],
    ['Workflow',`${milestones.filter(item=>item.status==='complete').length}/${milestones.length} stages complete`,`${pending} pending approvals`],
    ['Access',`${members.length} ${members.length===1?'participant record':'participant records'}`,'Pending entries are not active accounts'],
  ];
  return <section className="full-deal-panel" id="full-deal">
    <div className="panel-head"><div><h2>Full Deal</h2><p>{trade.reference} · Current records across the workspace</p></div><span className="full-deal-risk">Risk score {risk.score}/100</span></div>
    <div className="full-deal-grid">{rows.map(([label,value,detail])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div>
    <h3>Open a section</h3><div className="full-deal-links">{sections.map(([label,id])=><button key={id} onClick={()=>onNavigate(id,id)}>{label}<span aria-hidden="true">→</span></button>)}</div>
    <p className="full-deal-note">This summary reflects records saved for your signed-in account. Participant entries do not yet grant access to other people.</p>
  </section>;
}
function approvalStatus(done,total){return done===total?'All controls marked complete':'Review outstanding controls'}
