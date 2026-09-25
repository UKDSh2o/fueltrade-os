export function normalizeImo(value) {
  return String(value ?? "").toUpperCase().replace(/^IMO\s*/, "").replace(/\D/g, "");
}

export function isValidImo(value) {
  const imo = normalizeImo(value);
  if (!/^\d{7}$/.test(imo)) return false;
  const total = imo.slice(0, 6).split("").reduce((sum, digit, index) => sum + Number(digit) * (7 - index), 0);
  return total % 10 === Number(imo[6]);
}

export function normalizePosition(input, now = Date.now()) {
  const latitude = Number(input?.latitude ?? input?.lat);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng);
  const speedKnots = Number(input?.speedKnots ?? input?.speed ?? 0);
  const courseDegrees = Number(input?.courseDegrees ?? input?.course ?? 0);
  const positionAt = input?.positionAt ? Date.parse(input.positionAt) : Number(input?.timestamp ?? now);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { valid: false, reason: "Latitude must be between -90 and 90" };
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { valid: false, reason: "Longitude must be between -180 and 180" };
  if (!Number.isFinite(speedKnots) || speedKnots < 0 || speedKnots > 80) return { valid: false, reason: "Speed must be between 0 and 80 knots" };
  if (!Number.isFinite(courseDegrees) || courseDegrees < 0 || courseDegrees >= 360) return { valid: false, reason: "Course must be between 0 and 359 degrees" };
  if (!Number.isFinite(positionAt) || positionAt > now + 10 * 60_000) return { valid: false, reason: "Position time is invalid or too far in the future" };
  return { valid: true, latitude, longitude, speedKnots, courseDegrees, positionAt };
}

export function handoffDecision(recordedBy, actorId, decision) {
  if (!['accepted', 'disputed'].includes(decision)) return { allowed: false, reason: "Choose accept or dispute" };
  if (decision === 'accepted' && recordedBy === actorId) return { allowed: false, reason: "The recorder cannot accept their own custody handoff" };
  return { allowed: true, status: decision };
}
