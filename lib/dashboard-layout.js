export const dashboardRoles = Object.freeze({
  trader: {label:'Trader',defaults:['economics','market','counterparties','finance','logistics','risk','tasks','messaging'],allowed:['economics','market','counterparties','finance','logistics','risk','tasks','messaging','documents','diligence','approvals','sourcing','storage']},
  legal: {label:'Legal',defaults:['documents','diligence','counterparties','contracts','approvals','tasks','messaging'],allowed:['documents','diligence','counterparties','contracts','approvals','tasks','messaging','risk']},
  captain: {label:'Vessel captain',defaults:['vessel','cargo','eta','port','documents','incidents','messaging'],allowed:['vessel','cargo','eta','port','documents','incidents','messaging','logistics','tasks']},
  portOperator: {label:'Port operator',defaults:['eta','port','storage','logistics','documents','incidents','messaging'],allowed:['eta','port','storage','logistics','documents','incidents','messaging','cargo','tasks']},
  finance: {label:'Finance',defaults:['economics','finance','insurance','approvals','documents','risk','messaging'],allowed:['economics','finance','insurance','approvals','documents','risk','messaging','tasks','counterparties']},
  admin: {label:'Administrator',defaults:['economics','market','sourcing','documents','diligence','finance','insurance','vessel','logistics','port','storage','approvals','tasks','messaging'],allowed:['economics','market','sourcing','documents','diligence','counterparties','contracts','finance','insurance','vessel','cargo','eta','port','storage','logistics','approvals','tasks','incidents','messaging','risk']},
});

export const dashboardTiles = Object.freeze({
  economics:{label:'Economics',description:'Landed cost and margin',anchor:'trade-calculator'},
  market:{label:'Market intelligence',description:'Pricing and FX context',anchor:'market-intelligence'},
  sourcing:{label:'Sourcing & quotations',description:'Compare supplier offers',anchor:'market-intelligence'},
  documents:{label:'Documents',description:'Trade document vault',anchor:'documents'},
  diligence:{label:'Due diligence',description:'KYC and trade controls',anchor:'due-diligence'},
  counterparties:{label:'Counterparties',description:'Supplier and buyer records',anchor:'counterparties'},
  contracts:{label:'Contracts',description:'Agreement documents',anchor:'documents'},
  finance:{label:'Banking and LC',description:'Instrument and milestones',anchor:'finance'},
  insurance:{label:'Insurance',description:'Policy and cover',anchor:'risk'},
  vessel:{label:'Vessel and voyage',description:'Nomination and tracking record',anchor:'logistics'},
  cargo:{label:'Cargo',description:'Quantity and vessel record',anchor:'logistics'},
  eta:{label:'ETA',description:'Voyage timing',anchor:'logistics'},
  port:{label:'Port operations',description:'Calls and discharge',anchor:'logistics'},
  storage:{label:'Storage',description:'Tank and onward movement',anchor:'downstream'},
  logistics:{label:'Logistics',description:'Route and port calls',anchor:'logistics'},
  approvals:{label:'Approvals',description:'Decisions and sign-offs',anchor:'approvals'},
  tasks:{label:'Tasks and milestones',description:'Workflow actions',anchor:'approvals'},
  incidents:{label:'Incidents',description:'Operational risk cases',anchor:'risk'},
  messaging:{label:'Deal room',description:'Trade notes',anchor:'deal-room'},
  risk:{label:'Risk',description:'Insurance and cases',anchor:'risk'},
});

export function normalizeDashboardTiles(role, requested) {
  const definition=dashboardRoles[role];
  if (!definition) throw new Error('Unknown dashboard role');
  if (!Array.isArray(requested)) return [...definition.defaults];
  const allowed=new Set(definition.allowed);
  return [...new Set(requested.filter(id=>typeof id==='string'&&allowed.has(id)))];
}
