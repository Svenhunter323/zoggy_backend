// return amount in cents
function weightedPick(weights) {
  // weights: [{cents: fn, p: 0.7}, ...]
  const r = Math.random();
  let acc = 0;
  for (const w of weights) {
    acc += w.p;
    if (r <= acc) return w.cents();
  }
  // fallback (numeric drift)
  return weights[weights.length - 1].cents();
}

// helper: random integer between min and max (inclusive)
function randRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST_CHEST = [
  { p: 0.60, cents: () => randRange(400, 1500) },   // $4 – $15
  { p: 0.40, cents: () => randRange(1501, 5000) }   // $15.01 – $50
];

const STANDARD_CHEST = [
  { p: 0.70, cents: () => randRange(50, 300) },     // $0.50 – $3.00
  { p: 0.30, cents: () => randRange(310, 1000) }    // $3.10 – $10.00
];

function drawReward(isFirst) {
  return weightedPick(isFirst ? FIRST_CHEST : STANDARD_CHEST);
}

module.exports = { drawReward };
