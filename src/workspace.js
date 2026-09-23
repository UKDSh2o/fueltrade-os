export const roles = {
  trader: {
    label: 'Trader',
    defaultTiles: ['economics','market','counterparties','documents','logistics','messaging','tasks','full-deal']
  },
  legal: {
    label: 'Legal',
    defaultTiles: ['documents','due-diligence','contracts','approvals','messaging','tasks','full-deal']
  },
  captain: {
    label: 'Vessel Captain',
    defaultTiles: ['voyage','cargo','eta','port','documents','messaging','incidents','full-deal']
  },
  portOperator: {
    label: 'Port Operator',
    defaultTiles: ['eta','berth','discharge','inspection','storage','documents','messaging','full-deal']
  },
  finance: {
    label: 'Finance',
    defaultTiles: ['economics','banking','lc','payments','insurance','approvals','messaging','full-deal']
  },
  admin: {
    label: 'Administrator',
    defaultTiles: ['economics','market','documents','due-diligence','logistics','banking','insurance','messaging','tasks','full-deal']
  }
};

export const tileCatalog = {
  economics:{label:'Deal Economics',description:'Margin, P&L and exposure'},
  market:{label:'Market Intelligence',description:'Pricing, FX and market signals'},
  counterparties:{label:'Counterparties',description:'Buyer, seller and intermediary DD'},
  documents:{label:'Documents',description:'Trade and shipping document room'},
  'due-diligence':{label:'Due Diligence',description:'Compliance and verification'},
  contracts:{label:'Contracts',description:'SPA, NDA and legal instruments'},
  approvals:{label:'Approvals',description:'Pending decisions and sign-offs'},
  logistics:{label:'Logistics',description:'Vessel, trucking and storage'},
  voyage:{label:'Voyage',description:'Route and voyage status'},
  cargo:{label:'Cargo',description:'Cargo quantity and specification'},
  eta:{label:'ETA',description:'Arrival and milestone timing'},
  port:{label:'Port',description:'Port operations'},
  berth:{label:'Berth',description:'Berth allocation and readiness'},
  discharge:{label:'Discharge',description:'Discharge operations'},
  inspection:{label:'Inspection',description:'Testing and inspection'},
  storage:{label:'Storage',description:'Tank allocation and inventory'},
  banking:{label:'Banking',description:'Banks and transaction finance'},
  lc:{label:'Letter of Credit',description:'LC terms and lifecycle'},
  payments:{label:'Payments',description:'Payment milestones'},
  insurance:{label:'Insurance',description:'CIF and operational cover'},
  incidents:{label:'Incidents',description:'Operational incident log'},
  tasks:{label:'Tasks',description:'Actions, deadlines and owners'},
  messaging:{label:'Messaging',description:'Deal chat, email, calls and channels'},
  'full-deal':{label:'Full Deal',description:'Complete authorized deal workspace'}
};

export const communicationChannels = [
  {id:'internal',label:'Deal Chat',status:'ready',mode:'native'},
  {id:'email',label:'Email',status:'adapter',mode:'oauth'},
  {id:'whatsapp',label:'WhatsApp',status:'adapter',mode:'external'},
  {id:'telegram',label:'Telegram',status:'adapter',mode:'external'},
  {id:'voice',label:'Voice',status:'adapter',mode:'realtime'},
  {id:'video',label:'Video',status:'adapter',mode:'realtime'},
  {id:'conference',label:'Conference',status:'adapter',mode:'realtime'}
];

export const integrationRegistry = [
  {id:'gmail',category:'email',name:'Gmail API',cost:'free-quota',auth:'OAuth 2.0'},
  {id:'microsoft',category:'email',name:'Microsoft Graph',cost:'free-api',auth:'OAuth 2.0'},
  {id:'imap',category:'email',name:'IMAP / SMTP',cost:'self-hosted',auth:'provider'},
  {id:'livekit',category:'realtime',name:'LiveKit',cost:'open-source',auth:'server-token'},
  {id:'matrix',category:'messaging',name:'Matrix',cost:'open-source',auth:'homeserver'},
  {id:'telegram',category:'messaging',name:'Telegram Bot API',cost:'free-api',auth:'bot-token'},
  {id:'whatsapp',category:'messaging',name:'WhatsApp Business',cost:'provider',auth:'business-api'}
];

export function dashboardForRole(role='trader', customTiles=[]) {
  const definition = roles[role] || roles.trader;
  return [...new Set([...definition.defaultTiles, ...customTiles])]
    .filter(id => tileCatalog[id])
    .map(id => ({id,...tileCatalog[id]}));
}
