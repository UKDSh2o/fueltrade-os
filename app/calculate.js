const n = (value) => Number(value) || 0;

export function calculateTrade(trade) {
  const volume = n(trade.volumeMt);
  const buyValue = volume * n(trade.buyPrice);
  const revenue = volume * n(trade.sellPrice);
  const insurance = buyValue * n(trade.insurancePct) / 100;
  const finance = buyValue * n(trade.financePct) / 100 * n(trade.days) / 365;
  const unitOps = n(trade.freight) + n(trade.inspection) + n(trade.port) + n(trade.storage) + n(trade.trucking) + n(trade.legal);
  const operatingCosts = volume * unitOps;
  const preContingency = buyValue + insurance + finance + operatingCosts;
  const contingency = preContingency * n(trade.contingencyPct) / 100;
  const totalCost = preContingency + contingency;
  const netProfit = revenue - totalCost;
  const unitCost = volume ? totalCost / volume : 0;
  const unitMargin = volume ? netProfit / volume : 0;
  const netMarginPct = revenue ? netProfit / revenue * 100 : 0;
  const roiPct = totalCost ? netProfit / totalCost * 100 : 0;
  const workingCapital = buyValue + operatingCosts + insurance;
  return { buyValue,revenue,insurance,finance,operatingCosts,contingency,totalCost,netProfit,unitCost,unitMargin,netMarginPct,roiPct,workingCapital,breakEven:unitCost };
}

export function riskLevel(trade, result) {
  let score = 18;
  if (n(trade.contingencyPct) < 1.5) score += 18;
  if (n(trade.days) > 45) score += 16;
  if (result.netMarginPct < 5) score += 28;
  if (n(trade.volumeMt) >= 100000) score += 12;
  return { score:Math.min(score,100), label:score >= 60 ? 'High' : score >= 35 ? 'Moderate' : 'Controlled' };
}
