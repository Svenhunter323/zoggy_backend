// return amount in cents
function weightedPick(weights) {
    // weights: [{cents: 10, p: 0.7}, ...]
    const r = Math.random();
    let acc = 0;
    for (const w of weights) {
      acc += w.p;
      if (r <= acc) return w.cents;
    }
    // fallback
    return 0;
  }
  
  const FIRST_CHEST = [
    { cents: 10, p: 0.70 },   // $0.10
    { cents: 20, p: 0.30 }    // $0.20
  ];
  
  const STANDARD_CHEST = [
    { cents: 0,  p: 0.20 },   // $0
    { cents: 10, p: 0.60 },   // $0.10
    { cents: 20, p: 0.05 },   // $0.20
    { cents: 50, p: 0.05 },   // $0.50
    { cents: 100, p: 0.05 }   // $1.00
    // big wins (10–10,000) NEVER given to real users
  ];
  
  function drawReward(isFirst) {
    const cents = weightedPick(isFirst ? FIRST_CHEST : STANDARD_CHEST);
    return cents;
  }
  
  module.exports = { drawReward };
  