export const products = ['Jet A-1','EN590 10ppm','Gasoline 95 RON','D6 Virgin Fuel Oil','Marine Gas Oil','LNG','LPG','HVO','Biodiesel','Bitumen'];

export const routes = {
  'Rotterdam → Pristina': { destination: 'Kosovo', currency: 'EUR', fx: 0.85, freight: 63, ports:[['Rotterdam','Netherlands','NLRTM','loading'],['Pristina','Kosovo','XKPRN','final_discharge']] },
  'Fujairah → Colombo': { destination: 'Sri Lanka', currency: 'LKR', fx: 302.5, freight: 48, ports:[['Fujairah','United Arab Emirates','AEFJR','loading'],['Colombo','Sri Lanka','LKCMB','final_discharge']] },
  'ARA → Monrovia': { destination: 'Liberia', currency: 'USD', fx: 1, freight: 71, ports:[['ARA','Netherlands','NLRTM','loading'],['Monrovia','Liberia','LRMLW','final_discharge']] },
};

export const makePortCalls = (routeKey, volumeMt=25000) => (routes[routeKey]?.ports||[]).map((port,index)=>({key:`${routeKey}-${index}`,portName:port[0],country:port[1],locode:port[2],operation:port[3],eta:'',etd:'',quantityMt:volumeMt,portCost:0,status:'planned',notes:''}));

export const initialTrade = { reference:'FT-2026-0018', product:'Jet A-1', route:'Fujairah → Colombo', routePlan:makePortCalls('Fujairah → Colombo'), volumeMt:25000, buyPrice:782, sellPrice:936, freight:48, insurancePct:0.35, inspection:1.85, port:7.4, storage:4.8, trucking:0, legal:0.8, financePct:1.2, contingencyPct:2, days:32, incoterm:'CIF' };

export const scenarios = [
  { name:'Refinery direct', buyPrice:770, confidence:82, leadDays:36 },
  { name:'Corporate allocation', buyPrice:782, confidence:91, leadDays:32 },
  { name:'Approved trader', buyPrice:801, confidence:96, leadDays:24 },
];
