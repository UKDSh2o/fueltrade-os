export const eventTypes = Object.freeze({
  MESSAGE:'message', EMAIL:'email', DOCUMENT:'document', TASK:'task', APPROVAL:'approval',
  ALERT:'alert', CALL:'call', STATUS:'status', MARKET:'market'
});

export function createDealEvent({dealId,type,actor='system',summary,channel='internal',severity='info',metadata={}}){
  if(!dealId) throw new Error('dealId is required');
  if(!Object.values(eventTypes).includes(type)) throw new Error('unsupported event type');
  if(!summary?.trim()) throw new Error('summary is required');
  return {id:`${dealId}-${Date.now()}`,dealId,type,actor,summary:summary.trim(),channel,severity,metadata,createdAt:new Date().toISOString()};
}

export function classifyUrgency(text=''){
  const value=text.toLowerCase();
  const critical=['fraud','sanction','payment blocked','vessel detained','bank details changed','lc expired'];
  const urgent=['urgent','immediately','deadline','expires','overdue','delay','demurrage','missing document'];
  if(critical.some(x=>value.includes(x))) return 'critical';
  if(urgent.some(x=>value.includes(x))) return 'urgent';
  return 'normal';
}

export function suggestedActions(event){
  const actions=[];
  const urgency=classifyUrgency(event.summary);
  if(urgency==='critical') actions.push({type:'notify',audience:['admin','trader','legal','finance'],priority:'critical'});
  else if(urgency==='urgent') actions.push({type:'notify',audience:['trader'],priority:'urgent'});
  if(event.type===eventTypes.EMAIL) actions.push({type:'extract',targets:['dates','amounts','documents','counterparties']});
  if(event.type===eventTypes.DOCUMENT) actions.push({type:'verify',targets:['expiry','signatures','deal-reference']});
  return actions;
}

export const outboundPolicy = {
  internal:{approval:'none'},
  routineEmail:{approval:'configurable'},
  commercialCommitment:{approval:'human-required'},
  legalCommitment:{approval:'human-required'},
  bankingInstruction:{approval:'human-required'},
  bankDetailChange:{approval:'dual-approval'}
};
