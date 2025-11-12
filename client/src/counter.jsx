import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://stock-screener-b6t5.onrender.com');

function App() {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      console.log('✅ Connected to server');
    });

    socket.on('trade', (trade) => {
      console.log('📩 Received trade:', trade);
      setTrades(prev => [trade, ...prev].slice(0, 25));
    });

    return () => {
      socket.off('trade');
      socket.off('connect');
    };
  }, []);



  return (
      <div className="min-h-screen bg-black text-white p-6 overflow-x-auto">
        <h1 className="text-2xl font-bold mb-4">📊 Real-Time Screener</h1>
        <table className="w-full text-sm table-auto border border-gray-700">
          <thead className="bg-gray-800 text-left">
            <tr>
              <th className="p-2">Symbol</th>
              <th className="p-2">Price</th>
              <th className="p-2">Size</th>
              <th className="p-2">% Change (5m)</th>
              <th className="p-2">5-min RVOL</th>
              <th className="p-2">RVOL</th>
              <th className="p-2">Volume</th>
              <th className="p-2">Gap %</th>
              <th className="p-2">Strategy</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i} className={`border-t border-gray-800 ${t.hodBreak ? "bg-green-800/30" : ""}`}>
                <td className="p-2 font-bold">{t.S}</td>
                <td className="p-2">${t.p.toFixed(2)}</td>
                <td className="p-2">{t.s}</td>
                <td className="p-2 text-yellow-300">{t.percentChange}%</td>
                <td className="p-2 text-purple-300">{t.rvol5min?.toFixed(2) ?? "—"}</td>
                <td className="p-2 text-blue-300">{t.rvol?.toFixed(2) ?? "—"}</td>
                <td className="p-2">{t.volume?.toLocaleString() ?? "—"}</td>
                <td className="p-2 text-cyan-300">{t.gapPercent?.toFixed(2) ?? "—"}%</td>
                <td className="p-2">
                  {t.hodBreak && <span className="text-green-400 font-semibold">HOD Break</span>}
                  {t.haltResume && <span className="text-red-500 ml-2 font-semibold">Halt Resume 🚀</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
}

export default App;
