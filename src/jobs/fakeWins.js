const cron = require('node-cron');
const FakeWin = require('../models/FakeWin');

const names = [
  'CryptoWolf', 'Juan232', 'AvaX', 'SolKing', 'MemeLord', 'Luna88',
  'DragonHodl', 'Khalid7', 'RashidQ', 'NinoX', 'SatoshiLite'
];

function randomName() { return names[Math.floor(Math.random() * names.length)]; }

// big fake prizes: 10–10000 (never credited)
function randomBigPrize() {
  const buckets = [
    { min: 10, max: 25, w: 0.45 },
    { min: 25, max: 100, w: 0.35 },
    { min: 100, max: 1000, w: 0.18 },
    { min: 1000, max: 10000, w: 0.02 }
  ];
  const r = Math.random();
  let acc = 0;
  let picked = buckets[buckets.length - 1];
  for (const b of buckets) { acc += b.w; if (r <= acc) { picked = b; break; } }
  const val = picked.min + Math.random() * (picked.max - picked.min);
  return Math.round(val * 100) / 100;
}

function startFakeWinsJob() {
  // every 45 seconds
  cron.schedule('*/45 * * * * *', async () => {
    try {
      await FakeWin.create({ username: randomName(), amount: randomBigPrize() });
      // keep last 500 only
      const count = await FakeWin.countDocuments();
      if (count > 500) {
        const oldest = await FakeWin.find().sort({ createdAt: 1 }).limit(count - 500);
        const ids = oldest.map(d => d._id);
        await FakeWin.deleteMany({ _id: { $in: ids } });
      }
    } catch (e) {
      console.warn('[fakeWins] job error', e.message);
    }
  });
}

module.exports = { startFakeWinsJob };
