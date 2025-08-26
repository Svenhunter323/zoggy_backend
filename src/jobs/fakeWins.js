const cron = require('node-cron');
const FakeWin = require('../models/FakeWin');

// Expanded name pools (3-5k handles)
const cryptoNames = [
  'pepe247', 'satoshiX', 'cryptoKing88', 'btcMaster', 'ethLord', 'dogeWolf', 'shibaMoon',
  'adaQueen', 'solPrince', 'avaxHero', 'dotKnight', 'linkChain', 'uniSwap99', 'pancakeFlip',
  'defiGuru', 'nftCollector', 'metaVerse', 'web3Ninja', 'blockMiner', 'hashPower',
  'cryptoPunk', 'bayc_holder', 'moonBoy', 'diamondHands', 'hodlStrong', 'toTheMoon',
  'lamboSoon', 'rektOrRich', 'altCoinKing', 'shitCoinLord', 'pumpAndDump', 'bearMarket',
  'bullRun2024', 'cryptoWhale', 'satoshiVision', 'bitcoinCash', 'ethereumMax', 'cardanoAda',
  'polkaDot88', 'chainLink99', 'uniswapV3', 'sushiSwap', 'compoundFi', 'aaveProtocol',
  'makerDao', 'yearnFi', 'curveDao', 'balancerV2', 'synthetix', 'zeroX_protocol',
  'theGraph88', 'fileCoin99', 'heliumHnt', 'solanaLabs', 'avalanche99', 'terraLuna',
  'cosmosAtom', 'algorandAlgo', 'tezosXtz', 'vechainVet', 'zilliqa99', 'ontologyOnt'
];

const gamingNames = [
  'plinkoPro', 'slotMaster', 'rouletteKing', 'blackjack21', 'pokerFace88', 'bingoWinner',
  'scratchCard', 'lotteryLuck', 'casinoRoyale', 'vegasVibes', 'monteCarloM', 'macauMagic',
  'spinToWin', 'jackpotHunter', 'luckyNumber7', 'goldenSlots', 'megaSpin', 'bonusRound',
  'freeSpins99', 'wildSymbol', 'scatterPay', 'multiplierX', 'progressiveJP', 'maxBet',
  'allIn_player', 'highRoller', 'vipGamer', 'elitePlayer', 'proGambler', 'betMaster',
  'winStreak99', 'luckySeven', 'fortuneWheel', 'treasureHunt', 'goldRush88', 'diamondMine',
  'emeraldCity', 'rubySlots', 'sapphireWin', 'pearlDiver', 'crystalCave', 'mysticForest',
  'dragonSlayer', 'knightQuest', 'wizardSpell', 'fairyTale', 'pirateGold', 'vikingRaid',
  'spartanWar', 'romanEmpire', 'egyptianGold', 'aztecTreasure', 'mayaTemple', 'incaGold',
  'atlantisLost', 'olympusGods', 'valhallHero', 'norseMyth', 'celticMagic', 'samuraiCode'
];

const neutralNames = [
  'marta_lee', 'john_smith', 'sarah_jones', 'mike_brown', 'lisa_wilson', 'david_taylor',
  'emma_davis', 'chris_miller', 'anna_garcia', 'james_rodriguez', 'maria_martinez',
  'robert_anderson', 'jessica_thomas', 'michael_jackson', 'ashley_white', 'matthew_harris',
  'amanda_martin', 'daniel_thompson', 'stephanie_garcia', 'joshua_martinez', 'michelle_robinson',
  'andrew_clark', 'melissa_rodriguez', 'anthony_lewis', 'kimberly_lee', 'mark_walker',
  'donna_hall', 'steven_allen', 'carol_young', 'paul_hernandez', 'sharon_king',
  'kenneth_wright', 'sandra_lopez', 'joshua_hill', 'donna_scott', 'brian_green',
  'lisa_adams', 'gary_baker', 'betty_gonzalez', 'donald_nelson', 'helen_carter',
  'george_mitchell', 'deborah_perez', 'frank_roberts', 'ruth_turner', 'gregory_phillips',
  'catherine_campbell', 'raymond_parker', 'maria_evans', 'jack_edwards', 'debra_collins'
];

// Combine all name pools
const allNames = [...cryptoNames, ...gamingNames, ...neutralNames];

// Avatar options
const avatars = [
  'avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6', 'avatar7', 'avatar8',
  'avatar9', 'avatar10', 'avatar11', 'avatar12', 'avatar13', 'avatar14', 'avatar15', 'avatar16'
];

// Country data with codes, flags, and names
const countries = [
  { code: 'US', flag: '🇺🇸', name: 'United States' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'UK', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: 'SE', flag: '🇸🇪', name: 'Sweden' },
  { code: 'NO', flag: '🇳🇴', name: 'Norway' },
  { code: 'DK', flag: '🇩🇰', name: 'Denmark' },
  { code: 'FI', flag: '🇫🇮', name: 'Finland' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: 'NZ', flag: '🇳🇿', name: 'New Zealand' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: 'HK', flag: '🇭🇰', name: 'Hong Kong' },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: 'IN', flag: '🇮🇳', name: 'India' },
  { code: 'TH', flag: '🇹🇭', name: 'Thailand' }
];

// State tracking for sophisticated cadence
let lastBigWin = null; // Last $10k+ win timestamp
let lastMediumWin = null; // Last $2k+ win timestamp
let smallWinsQueue = []; // Queue of small wins to emit after big wins
let nextWinTime = Date.now(); // Next scheduled win time
let usedNames = new Map(); // Track name usage with timestamps
let lastMicroBurst = Date.now(); // Last micro-burst timestamp
let lastLull = Date.now(); // Last lull timestamp
let isInLull = false; // Currently in a lull period
let microBurstQueue = []; // Queue for micro-burst events

// Get a random name that hasn't been used in the last 90 minutes
function getAvailableName() {
  const now = Date.now();
  const ninetyMinutesAgo = now - (90 * 60 * 1000);
  
  // Clean up old name usage records
  for (const [name, timestamp] of usedNames.entries()) {
    if (timestamp < ninetyMinutesAgo) {
      usedNames.delete(name);
    }
  }
  
  // Find available names
  const availableNames = allNames.filter(name => !usedNames.has(name));
  
  // If no names available, use oldest used name
  if (availableNames.length === 0) {
    // // console.warn('[fakeWins] All names used recently, reusing oldest');
    return allNames[Math.floor(Math.random() * allNames.length)];
  }
  
  const selectedName = availableNames[Math.floor(Math.random() * availableNames.length)];
  usedNames.set(selectedName, now);
  return selectedName;
}

// Get random avatar and country
function getRandomAvatar() {
  return avatars[Math.floor(Math.random() * avatars.length)];
}

function getRandomCountry() {
  return countries[Math.floor(Math.random() * countries.length)];
}

// Generate small wins ($5-$50) for post-big-win bursts
function generateSmallWin() {
  const amount = 5 + Math.random() * 45; // $5-$50
  return Math.round(amount * 100) / 100;
}

// Generate medium wins ($100-$1999)
function generateMediumWin() {
  const buckets = [
    { min: 100, max: 500, w: 0.6 },
    { min: 500, max: 1000, w: 0.25 },
    { min: 1000, max: 1999, w: 0.15 }
  ];
  return selectFromBuckets(buckets);
}

// Generate large wins ($2000-$9999)
function generateLargeWin() {
  const buckets = [
    { min: 2000, max: 5000, w: 0.7 },
    { min: 5000, max: 8000, w: 0.2 },
    { min: 8000, max: 9999, w: 0.1 }
  ];
  return selectFromBuckets(buckets);
}

// Generate mega wins ($10000+)
function generateMegaWin() {
  const buckets = [
    { min: 10000, max: 25000, w: 0.6 },
    { min: 25000, max: 50000, w: 0.3 },
    { min: 50000, max: 100000, w: 0.1 }
  ];
  return selectFromBuckets(buckets);
}

function selectFromBuckets(buckets) {
  const r = Math.random();
  let acc = 0;
  let picked = buckets[buckets.length - 1];
  for (const b of buckets) { 
    acc += b.w; 
    if (r <= acc) { 
      picked = b; 
      break; 
    } 
  }
  const val = picked.min + Math.random() * (picked.max - picked.min);
  return Math.round(val * 100) / 100;
}

// Frequency rule enforcement
function canShowMegaWin() {
  if (!lastBigWin) return true;
  const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
  return lastBigWin < threeHoursAgo;
}

function canShowLargeWin() {
  if (!lastMediumWin) return true;
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  return lastMediumWin < oneHourAgo;
}

// Schedule 5-10 small wins after big wins
function scheduleSmallWinsBurst() {
  const burstCount = 5 + Math.floor(Math.random() * 6); // 5-10 small wins
  const now = Date.now();
  
  for (let i = 0; i < burstCount; i++) {
    const delay = 30 + (i * (20 + Math.random() * 40)); // 30s + 20-60s between wins
    const countryData = getRandomCountry();
    smallWinsQueue.push({
      amount: generateSmallWin(),
      scheduledAt: now + (delay * 1000),
      username: getAvailableName(),
      avatar: getRandomAvatar(),
      country: countryData
    });
  }
  
  // // console.log(`[fakeWins] Scheduled ${burstCount} small wins burst`);
}

// Schedule micro-bursts (3-5 events with 2-6s gaps every 6-10 min)
function scheduleMicroBurst() {
  const now = Date.now();
  const timeSinceLastBurst = now - lastMicroBurst;
  const minInterval = 6 * 60 * 1000; // 6 minutes
  const maxInterval = 10 * 60 * 1000; // 10 minutes
  
  if (timeSinceLastBurst < minInterval) return false;
  
  // Random chance to trigger burst if we're in the window
  if (timeSinceLastBurst > maxInterval || Math.random() < 0.3) {
    const burstCount = 3 + Math.floor(Math.random() * 3); // 3-5 events
    
    for (let i = 0; i < burstCount; i++) {
      const delay = i * (2 + Math.random() * 4); // 2-6s gaps
      const countryData = getRandomCountry();
      microBurstQueue.push({
        scheduledAt: now + (delay * 1000),
        username: getAvailableName(),
        avatar: getRandomAvatar(),
        country: countryData
      });
    }
    
    lastMicroBurst = now;
    // console.log(`[fakeWins] Scheduled ${burstCount} event micro-burst`);
    return true;
  }
  
  return false;
}

// Check if we should enter a lull period (4-5min pause per 10-15 min)
function shouldEnterLull() {
  const now = Date.now();
  const timeSinceLastLull = now - lastLull;
  const minInterval = 10 * 60 * 1000; // 10 minutes
  const maxInterval = 15 * 60 * 1000; // 15 minutes
  
  if (timeSinceLastLull > maxInterval || (timeSinceLastLull > minInterval && Math.random() < 0.2)) {
    isInLull = true;
    lastLull = now;
    const lullDuration = (4 + Math.random()) * 60 * 1000; // 4-5 minutes
    
    setTimeout(() => {
      isInLull = false;
      // console.log('[fakeWins] Lull period ended');
    }, lullDuration);
    
    // console.log(`[fakeWins] Entering ${Math.round(lullDuration/60000)}min lull period`);
    return true;
  }
  
  return false;
}

// Get human-like base interval (60-120s)
function getBaseInterval() {
  return (60 + Math.random() * 60) * 1000; // 60-120 seconds
}

function determineNextWin() {
  const now = Date.now();
  
  // Check if we're in a lull period
  if (isInLull) {
    return {
      amount: null,
      type: 'lull',
      delay: 30000, // Check again in 30 seconds
      username: null,
      avatar: null,
      country: null
    };
  }
  
  // Check for micro-burst events first
  if (microBurstQueue.length > 0) {
    const nextBurst = microBurstQueue.shift();
    if (now >= nextBurst.scheduledAt) {
      return {
        amount: generateSmallWin(),
        type: 'micro-burst',
        delay: 0,
        username: nextBurst.username,
        avatar: nextBurst.avatar,
        country: nextBurst.country
      };
    } else {
      // Put it back and wait
      microBurstQueue.unshift(nextBurst);
      return {
        amount: null,
        type: 'waiting',
        delay: nextBurst.scheduledAt - now,
        username: null,
        avatar: null,
        country: null
      };
    }
  }
  
  // Check if we have queued small wins to process
  if (smallWinsQueue.length > 0) {
    const nextSmallWin = smallWinsQueue.shift();
    if (now >= nextSmallWin.scheduledAt) {
      return {
        amount: nextSmallWin.amount,
        type: 'small-burst',
        delay: 0,
        username: nextSmallWin.username,
        avatar: nextSmallWin.avatar,
        country: nextSmallWin.country
      };
    } else {
      // Put it back and wait
      smallWinsQueue.unshift(nextSmallWin);
      return {
        amount: null,
        type: 'waiting',
        delay: nextSmallWin.scheduledAt - now,
        username: null,
        avatar: null,
        country: null
      };
    }
  }
  
  // Check if we should schedule a micro-burst
  scheduleMicroBurst();
  
  // Check if we should enter a lull
  if (shouldEnterLull()) {
    return {
      amount: null,
      type: 'lull',
      delay: 30000,
      username: null,
      avatar: null,
      country: null
    };
  }
  
  // Determine regular win type based on frequency limits and probability
  const rand = Math.random();
  
  // 2% chance for mega win (if allowed)
  if (rand < 0.02 && canShowMegaWin()) {
    const amount = generateMegaWin();
    const countryData = getRandomCountry();
    lastBigWin = Date.now();
    scheduleSmallWinsBurst();
    return {
      amount,
      type: 'mega',
      delay: getBaseInterval(),
      username: getAvailableName(),
      avatar: getRandomAvatar(),
      country: countryData
    };
  }
  
  // 8% chance for large win (if allowed)
  if (rand < 0.10 && canShowLargeWin()) {
    const amount = generateLargeWin();
    const countryData = getRandomCountry();
    lastMediumWin = Date.now();
    scheduleSmallWinsBurst();
    return {
      amount,
      type: 'large',
      delay: getBaseInterval(),
      username: getAvailableName(),
      avatar: getRandomAvatar(),
      country: countryData
    };
  }
  
  // 30% chance for medium win
  if (rand < 0.40) {
    const countryData = getRandomCountry();
    return {
      amount: generateMediumWin(),
      type: 'medium',
      delay: getBaseInterval(),
      username: getAvailableName(),
      avatar: getRandomAvatar(),
      country: countryData
    };
  }
  
  // Default to small win
  const countryData = getRandomCountry();
  return {
    amount: generateSmallWin(),
    type: 'small',
    delay: getBaseInterval(),
    username: getAvailableName(),
    avatar: getRandomAvatar(),
    country: countryData
  };
}

async function processNextWin() {
  try {
    const win = determineNextWin();
    
    // Skip if no win to process (lull period or waiting)
    if (!win.amount) {
      nextWinTime = Date.now() + win.delay;
      if (win.type !== 'waiting') {
        // console.log(`[fakeWins] ${win.type} - next check in ${Math.round(win.delay/1000)}s`);
      }
      return;
    }
    
    // Create the fake win with enhanced data
    await FakeWin.create({ 
      username: win.username,
      amount: win.amount,
      avatar: win.avatar,
      country: win.country
    });
    
    // // console.log(`[fakeWins] Generated ${win.type} win: ${win.username} ($${win.amount}) from ${win.country.name} (next in ${Math.round(win.delay/1000)}s)`);
    
    // Schedule next win
    nextWinTime = Date.now() + win.delay;
    
    // Cleanup old wins (keep last 500)
    const count = await FakeWin.countDocuments();
    if (count > 500) {
      const oldest = await FakeWin.find().sort({ createdAt: 1 }).limit(count - 500);
      const ids = oldest.map(d => d._id);
      await FakeWin.deleteMany({ _id: { $in: ids } });
    }
  } catch (e) {
    // console.warn('[fakeWins] job error', e.message);
    // Retry in 30 seconds on error
    nextWinTime = Date.now() + 30000;
  }
}

function startFakeWinsJob() {
  // console.log('[fakeWins] Starting sophisticated fake wins system with human-like cadence');
  // console.log('[fakeWins] Features: 3k+ names, 90min reuse prevention, micro-bursts, lulls, strict frequency limits');
  
  try {
    // Check every 5 seconds for more responsive timing
    // Cron format: second minute hour day month dayOfWeek
    cron.schedule('*/5 * * * * *', async () => {
      try {
        if (Date.now() >= nextWinTime) {
          await processNextWin();
        }
      } catch (error) {
        // console.error('[fakeWins] Error in cron job:', error.message);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    
    // Initialize with first win after a short delay
    setTimeout(() => {
      processNextWin().catch(error => {
        // console.error('[fakeWins] Error in initial win:', error.message);
      });
    }, 3000);
    
    // console.log('[fakeWins] Job scheduled successfully');
  } catch (error) {
    // console.error('[fakeWins] Failed to start job:', error.message);
    // Fallback to setInterval if cron fails
    setInterval(async () => {
      try {
        if (Date.now() >= nextWinTime) {
          await processNextWin();
        }
      } catch (error) {
        // console.error('[fakeWins] Error in interval job:', error.message);
      }
    }, 5000);
    // console.log('[fakeWins] Using setInterval fallback');
  }
}

module.exports = { startFakeWinsJob };
