const severeTopics = new Set(['sanction', 'sanction.linked', 'wanted', 'crime.fin', 'debarment']);

export function buildScreeningQuery({ name, country = '', schema = 'Company' }) {
  const subjectName = String(name ?? '').trim().slice(0, 240);
  const subjectCountry = String(country ?? '').trim().slice(0, 80);
  const subjectSchema = ['Company', 'Organization', 'Person', 'Vessel', 'LegalEntity'].includes(schema) ? schema : 'Company';
  if (!subjectName) throw new Error('A subject name is required');
  return {
    schema: subjectSchema,
    properties: {
      name: [subjectName],
      ...(subjectCountry ? { country: [subjectCountry] } : {}),
    },
  };
}

export function summarizeScreeningResponse(payload) {
  const response = payload?.responses?.q ?? {};
  const matches = Array.isArray(response.results) ? response.results.slice(0, 5) : [];
  const normalized = matches.map(item => {
    const topics = Array.isArray(item?.properties?.topics) ? item.properties.topics.map(String) : [];
    return {
      id: String(item?.id ?? '').slice(0, 200),
      caption: String(item?.caption ?? 'Unnamed result').slice(0, 300),
      schema: String(item?.schema ?? '').slice(0, 80),
      score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
      match: Boolean(item?.match),
      topics: topics.slice(0, 30),
      datasets: Array.isArray(item?.datasets) ? item.datasets.map(String).slice(0, 30) : [],
    };
  });
  const highestScore = normalized.reduce((score, item) => Math.max(score, item.score), 0);
  const severe = normalized.some(item => item.topics.some(topic => severeTopics.has(topic)));
  const riskLevel = severe && highestScore >= 0.7 ? 'critical' : highestScore >= 0.85 ? 'high' : highestScore >= 0.7 ? 'medium' : normalized.length ? 'low' : 'clear';
  return { matches: normalized, highestScore, riskLevel, requiresReview: normalized.length > 0 };
}

export function canTransitionDocument(from, to, canApprove = false) {
  const transitions = {
    received: ['in_review', 'archived'],
    in_review: canApprove ? ['approved', 'rejected'] : [],
    rejected: ['in_review', 'archived'],
    approved: canApprove ? ['archived'] : [],
    archived: [],
  };
  return Boolean(transitions[from]?.includes(to));
}
