// Rough calorie estimator for sessions and activities. Based on the Compendium
// of Physical Activities (Ainsworth) MET values; this is intentionally a coarse
// estimate, not medical advice.
//
//   kcal = MET * weight_kg * hours
//
// Weight defaults to 70 kg if the user hasn't recorded one.

const MET_BY_TYPE = {
  strength: 5.0,
  cardio: 8.0,
  hiit: 9.0,
  yoga: 3.0,
  sport: 7.0,
  recovery: 2.0,
  mobility: 2.5,
  walk: 3.5,
  run: 9.8,
  bike: 7.5,
  swim: 7.0,
  rowing: 7.0,
  other: 5.5,
};

const INTENSITY_MULTIPLIER = {
  // 1 (very light) -> 0.6x base, 10 (max) -> 1.4x base
  // smooth ramp through MET defaults
};

function metForType(sessionType) {
  const key = (sessionType || '').toLowerCase();
  return MET_BY_TYPE[key] !== undefined ? MET_BY_TYPE[key] : MET_BY_TYPE.other;
}

function intensityMultiplier(intensity) {
  if (!intensity || intensity < 1) return 1.0;
  const clamped = Math.min(10, Math.max(1, intensity));
  return 0.6 + (clamped - 1) * (0.8 / 9); // 1 -> 0.6, 10 -> 1.4
}

function estimateCalories({ sessionType, durationSec, intensity, weightKg }) {
  if (!durationSec || durationSec <= 0) return 0;
  const hours = durationSec / 3600;
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  const met = metForType(sessionType);
  const mult = intensityMultiplier(intensity);
  return Math.round(met * w * hours * mult);
}

function lbsToKg(lbs) { return lbs / 2.20462; }

module.exports = { estimateCalories, metForType, intensityMultiplier, lbsToKg };
