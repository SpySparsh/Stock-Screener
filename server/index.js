const Alpaca = require('@alpacahq/alpaca-trade-api');

// Load .env
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Alpaca config
const ALPACA_WS_URL = 'wss://stream.data.alpaca.markets/v2/iex';
const API_KEY = process.env.APCA_API_KEY_ID;
const API_SECRET = process.env.APCA_API_SECRET_KEY;

const alpaca = new Alpaca({
  keyId: API_KEY,
  secretKey: API_SECRET,
  paper: true
});

let alpacaSocket = null;
let isAuthenticated = false;
let subscribedTickers = new Set();
const lastTradeTime = {};
const possibleHalts = {};  // for confirmation
const avgVolumeCache = {};
const metricsCache = {}; // 🌐 global



// Track 5-min price history in memory
const priceHistory = {};

function updatePriceHistory(trade) {
  const symbol = trade.S;
  const timestamp = new Date(trade.t).getTime();
  const price = trade.p;

  if (!priceHistory[symbol]) {
    priceHistory[symbol] = [];
  }

  priceHistory[symbol].push({ time: timestamp, price });

  // Keep only last 5 min of data
  const cutoff = Date.now() - 5 * 60 * 1000;
  priceHistory[symbol] = priceHistory[symbol].filter(p => p.time > cutoff);
}

function get5MinChange(symbol) {
  const prices = priceHistory[symbol];
  if (!prices || prices.length < 2) return 0;
  const first = prices[0].price;
  const last = prices[prices.length - 1].price;
  return ((last - first) / first) * 100;
}

// Track HOD for each symbol
const highOfDay = {};

function updateWebSocketSubscriptions(newTickers) {
  if (!alpacaSocket || alpacaSocket.readyState !== WebSocket.OPEN) return;

  const newSet = new Set(newTickers);
  const toUnsub = [...subscribedTickers].filter(t => !newSet.has(t));
  const toSub = [...newSet].filter(t => !subscribedTickers.has(t));

  if (toUnsub.length > 0) {
    alpacaSocket.send(JSON.stringify({
      action: 'unsubscribe',
      trades: toUnsub
    }));
    console.log('❌ Unsubscribed:', toUnsub);
  }

  if (toSub.length > 0) {
    alpacaSocket.send(JSON.stringify({
      action: 'subscribe',
      trades: toSub
    }));
    console.log('✅ Subscribed:', toSub);
  }

  toUnsub.forEach(t => subscribedTickers.delete(t));
  toSub.forEach(t => subscribedTickers.add(t));

}



// Connect to Alpaca WebSocket
async function connectAlpacaWebSocket() {
  alpacaSocket = new WebSocket(ALPACA_WS_URL);
  let intervalStarted = false;

  alpacaSocket.on('open', () => {
    console.log('✅ Alpaca WebSocket connected');

    // Step 1: Authenticate
    alpacaSocket.send(JSON.stringify({
      action: 'auth',
      key: API_KEY,
      secret: API_SECRET
    }));
    

  });

  alpacaSocket.on('message', (data) => {
    const msg = JSON.parse(data);

    // Step 2: Confirm authentication
    if (msg[0]?.msg === 'authenticated') {
      console.log('🔐 Authenticated with Alpaca');
      isAuthenticated = true;

      // Step 3: Subscribe to ticker trades
    //   (async () => {
    //     const initialTickers = await fetchTopGainers();
    //     console.log('✅ Initial tickers subscribed:', initialTickers);
    //     updateWebSocketSubscriptions(initialTickers);
    //   }
    // )();
    if (!intervalStarted) {
      intervalStarted = true;
      const runEveryMinute = async () => {
  const freshTickers = await fetchTopGainers();
  updateWebSocketSubscriptions(freshTickers);
  setTimeout(runEveryMinute, 60000);
};
runEveryMinute();
    }

    }

    // Step 4: Handle incoming trade data
    if (msg[0]?.T === 't') {
  const trade = msg[0];
  updatePriceHistory(trade);

  const symbol = trade.S;
  const price = trade.p;
  const percentChange = get5MinChange(symbol);

  const now = Date.now();

  // Detect halt (no trade for 10 seconds)
  if (lastTradeTime[symbol]) {
    const timeSinceLast = now - lastTradeTime[symbol];

    if (timeSinceLast > 10000) {
      // Possible halt + resume
      possibleHalts[symbol] = {
        resumedAt: now,
        lastSeen: lastTradeTime[symbol],
        lastPrice: trade.p
      };

      console.log(`⚡ HALT RESUME: ${symbol} resumed after ${Math.round(timeSinceLast / 1000)}s halt`);
    }
  }

  lastTradeTime[symbol] = now;

  // Initialize HOD if needed
  if (!highOfDay[symbol]) {
    highOfDay[symbol] = price;
  }

  // Update HOD if new high
  let isHODBreak = false;
  if (price > highOfDay[symbol]) {
    highOfDay[symbol] = price;
    isHODBreak = true;
    console.log(`🚀 ${symbol} broke HOD: $${price.toFixed(2)}`);
  }

  // Apply filter logic
  if (price > 1 && price < 20 && percentChange > 0.1) {
    const isHaltResume = !!possibleHalts[symbol] && (now - possibleHalts[symbol].resumedAt < 2000); // flag only for 2s
    const latestMetrics = metricsCache[symbol];
    if (!latestMetrics) return; 
    io.emit('trade', {
      ...trade,
      percentChange: percentChange.toFixed(2),
      hodBreak: isHODBreak,
      haltResume: isHaltResume,
      rvol5min: latestMetrics?.rvol5min ?? null,
      rvol: latestMetrics?.rvol ?? null,
      volume: latestMetrics?.volume5min ?? null,
      gapPercent: latestMetrics?.gapPercent ?? null
    });

  }
}


  });

  alpacaSocket.on('close', () => {
    console.log('❌ Alpaca WebSocket closed. Reconnecting in 3s...');
    setTimeout(connectAlpacaWebSocket, 3000); // Bonus: auto reconnect
  });

  alpacaSocket.on('error', (err) => {
    console.error('🚨 Alpaca WebSocket error:', err.message);
  });
}

async function getAllActiveSymbols(limit = 300) {
  const assets = await alpaca.getAssets({ status: 'active', asset_class: 'us_equity' });

  // Filter: tradable, not halted, and optional price range if needed
  const tradable = assets
    .filter(asset => asset.tradable && !asset.symbol.includes('.'))
    .slice(0, limit) // Limit to 300–500 for snapshot batching

  return tradable.map(a => a.symbol);
}

async function preloadAverageVolumes(symbols) {
  for (const symbol of symbols) {
    if (avgVolumeCache[symbol]) continue; // already cached

    try {
      const bars = alpaca.getBarsV2(symbol, {
        timeframe: '1Day',
        limit: 10
      });

      let total = 0;
      let count = 0;

      for await (const bar of bars) {
        total += bar.Volume;
        count++;
      }

      avgVolumeCache[symbol] = count ? total / count : 0;
    } catch (e) {
      console.warn(`⚠️ Avg volume fail for ${symbol}: ${e.message}`);
    }
  }
}

async function getLiveSnapshotFilteredSymbols() {
  const allSymbols = await getAllActiveSymbols(100); // Grab top 300 tickers
  await preloadAverageVolumes(allSymbols);

  const filtered = [];

  const batchSize = 100;
  for (let i = 0; i < allSymbols.length; i += batchSize) {
    const batch = allSymbols.slice(i, i + batchSize);
    const snapshots = await alpaca.getSnapshots(batch);

    for (const snap of snapshots) {
      const symbol = snap.symbol;
      const price = snap?.LatestTrade?.Price;
      const volume = snap?.DailyBar?.Volume;
      const open = snap?.DailyBar?.OpenPrice;

      if (!price || !open || !volume) continue;

      const avg10DayVol = avgVolumeCache[symbol] || 0;
      
      const rvol = avg10DayVol > 0 ? volume / avg10DayVol : 0;
      const change = ((price - open) / open) * 100;

      filtered.push({
        symbol,
        volume,
        avg10DayVol,
        rvol,
        price,
        open,
        change
      });
    }
  }

  return filtered.slice(0,60) // Trim to top 50 best candidates
}

async function get5MinRelativeVolumeAndChange(symbol) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const premarketStart = new Date(`${today}T08:00:00Z`);
    const now = new Date();

    const bars = alpaca.getBarsV2(symbol, {
      timeframe: '1Min',
      start: premarketStart.toISOString(),
      end: now.toISOString(),
      adjustment: 'raw',
      feed: 'iex'
    });

    let totalPremarketVol = 0;
    const allBars = [];

    for await (const bar of bars) {
      totalPremarketVol += bar.Volume;
      allBars.push(bar);
    }

    if (allBars.length < 6) {
      return { rvol5min: 0, percentChange: 0, volume5min: 0, gapPercent: 0 };
    }

    const last5 = allBars.slice(-5);
    const volume5min = last5.reduce((sum, b) => sum + b.Volume, 0);
    const open = last5[0].OpenPrice;
    const close = last5[last5.length - 1].ClosePrice;
    const percentChange = ((close - open) / open) * 100;

    const num5MinChunks = Math.floor(allBars.length / 5);
    const avg5MinVol = num5MinChunks > 0 ? totalPremarketVol / num5MinChunks : 0;
    const rvol5min = avg5MinVol > 0 ? volume5min / avg5MinVol : 0;

    // ✅ GAP % logic: use earliest 2 bars
    const yesterdayClose = allBars[0].ClosePrice;
    const todayOpen = allBars[1]?.OpenPrice;
    const gapPercent = (yesterdayClose && todayOpen)
      ? ((todayOpen - yesterdayClose) / yesterdayClose) * 100
      : 0;

    return {
      rvol5min,
      percentChange,
      volume5min,
      gapPercent
    };

  } catch (e) {
    console.warn(`⚠️ get5MinRVOLAndChange failed for ${symbol}: ${e.message}`);
    return { rvol5min: 0, percentChange: 0, volume5min: 0, gapPercent: 0 };
  }
}



async function fetchBarsAndMetrics({ symbol, rvol }) {
  try {
    const { rvol5min, percentChange, volume5min, gapPercent } = await get5MinRelativeVolumeAndChange(symbol);

    return {
      symbol,
      percentChange,
      rvol,
      volume5min,
      rvol5min,
      gapPercent  // ✅ forward this value
    };
  } catch (e) {
    console.warn(`❌ Failed to fetch bars for ${symbol}: ${e.message}`);
    return null;
  }
}


const pLimit = require('p-limit');

async function fetchTopGainers() {
  const symbolInfoList = await getLiveSnapshotFilteredSymbols();
  console.log(`🔍 Checking ${symbolInfoList.length} symbols for top gainers...`);

  const limit = pLimit(5); // <= Throttle to 5 concurrent fetches

  const metricPromises = symbolInfoList.map(info =>
    limit(() => fetchBarsAndMetrics(info))
  );

  const results = await Promise.allSettled(metricPromises);

  const final = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
    .filter(r => r.rvol5min >= 1 && r.rvol >= 0)
    .sort((a, b) => b.percentChange - a.percentChange);
  console.table(final.slice(0, 25).map(r => ({
    Symbol: r.symbol,
    "5min % Change": r.percentChange.toFixed(2),
    Volume: r.volume5min.toLocaleString(),
    RVOL: r.rvol?.toFixed(2),
    "5-Min RVOL": r.rvol5min?.toFixed(2),
    "Gap %": r.gapPercent?.toFixed(2) ?? "—"
  })));
  final.forEach(m => {
    metricsCache[m.symbol] = m; // store all fields per symbol
  });
  console.log("✅ Cached metrics:", Object.keys(metricsCache));
  return final.slice(0,25).map(s => s.symbol);
  
}

connectAlpacaWebSocket(); // Start connection

// Socket.IO frontend connection
io.on('connection', (socket) => {
  console.log('📡 Frontend connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ Frontend disconnected:', socket.id);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
