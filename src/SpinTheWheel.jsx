// Spin The Wheel – Casino Style Meme Game
import { useEffect, useState, useRef } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import { Connection, PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://marqmgkduixmafrtonjy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcnFtZ2tkdWl4bWFmcnRvbmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MTMxODksImV4cCI6MjA2NDQ4OTE4OX0.7w_qoxjiv8YVNwrqnXBUmwXB736Rcl9rEdPIzKAEVfM"
);

const wheelOutcomes = [
  { label: "Go All In", points: 500, rarity: "legendary", meme: "go-all-in.png" },
  { label: "Rug Pull", points: -100, rarity: "rare", meme: "rugpull.png" },
  { label: "Buy More", points: 250, rarity: "common", meme: "buy-more.png" },
  { label: "Nice Spin", points: 69, rarity: "meme", meme: "nice69.png" },
  { label: "Hold Strong", points: 100, rarity: "common", meme: "hold.png" },
  { label: "Cope & Retry", points: 0, rarity: "joke", meme: "cope.png" },
  { label: "Rekt Again", points: -50, rarity: "meme", meme: "rekt.png" },
  { label: "Sniped Entry", points: 420, rarity: "rare", meme: "snipe.png" },
  { label: "Skill Issue", points: 1, rarity: "joke", meme: "skillissue.png" },
  { label: "Diamond Hands", points: 300, rarity: "epic", meme: "diamondhands.png" },
  { label: "Lucky Spin", points: 1000, rarity: "legendary", meme: "lucky.png" }
];

const SPIN_TOKEN_MINT = new PublicKey("INSERT_YOUR_SPIN_TOKEN_MINT_ADDRESS");
const connection = new Connection("https://api.mainnet-beta.solana.com");
const chips = ["🎲", "🪙", "💎", "🍀", "💰", "🃏"];

const getWeekNumber = () => {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
};

export default function SpinTheWheel() {
  const { publicKey } = useWallet();
  const [spins, setSpins] = useState(0);
  const [result, setResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [points, setPoints] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const spinAudioRef = useRef(null);
  const winAudioRef = useRef(null);
  const [showConfetti, setShowConfetti] = useState(false);
  // Animate background chips
  const [bgChips, setBgChips] = useState(
    Array.from({ length: 10 }, (_, i) => ({
      chip: chips[Math.floor(Math.random() * chips.length)],
      top: Math.random() * 90,
      left: Math.random() * 90,
      speed: 4 + Math.random() * 4,
    }))
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setBgChips((prev) =>
        prev.map((chip) => ({
          ...chip,
          top: (chip.top + chip.speed) % 100,
          left: chip.left,
        }))
      );
    }, 120);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!publicKey) return;
    getSpinEligibility(publicKey);
    getStoredLeaderboard();
  }, [publicKey]);

  const getSpinEligibility = async (wallet) => {
    try {
      const tokens = await connection.getParsedTokenAccountsByOwner(wallet, {
        mint: SPIN_TOKEN_MINT
      });
      const balance = tokens?.value?.[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
      const simulatedHoldingMinutes = 30; // TODO: Replace with real holding-time tracking!
      // 1 extra spin per 1,000,000 tokens
      const bonusSpins = Math.floor(balance / 1_000_000);
      const spinsAvailable = Math.floor(simulatedHoldingMinutes / 5) + bonusSpins;
      setSpins(spinsAvailable);
    } catch (e) {
      console.error("Error fetching token info:", e);
      setSpins(0);
    }
  };

  const getStoredLeaderboard = async () => {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("wallet, points")
      .order("points", { ascending: false });
    if (data) setLeaderboard(data);
  };

  const updateLeaderboard = async (wallet, newPoints, signature) => {
    // Anti-bot: Require a signature of the wallet address for proof-of-ownership
    if (!signature) {
      alert("Signature required. Please re-connect wallet.");
      return;
    }
    // Simple anti-spam: Lock out for 2.5 seconds between updates (matches spin delay)
    if (window._spinCooldown && Date.now() - window._spinCooldown < 2500) {
      alert("Slow down!");
      return;
    }
    window._spinCooldown = Date.now();
    // Points logic
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("wallet", wallet)
      .single();
    const updatedPoints = (existing?.points || 0) + newPoints;
    await supabase.from("leaderboard").upsert({
      wallet,
      points: updatedPoints,
      week: getWeekNumber()
    });
    getStoredLeaderboard();
  };

  const handleSpin = async () => {
    if (spins <= 0 || spinning) return;
    setSpinning(true);
    spinAudioRef.current?.play();
    const randomIndex = Math.floor(Math.random() * wheelOutcomes.length);
    const outcome = wheelOutcomes[randomIndex];
    // Anti-bot: require signature for leaderboard update
    let signature;
    try {
      if (window.solana && publicKey) {
        const message = new TextEncoder().encode("SPIN_PROOF:" + publicKey.toBase58());
        const signed = await window.solana.signMessage(message, 'utf8');
        signature = Buffer.from(signed.signature).toString('base64');
      }
    } catch (e) {
      console.error('Signature error', e);
      alert("Wallet signature failed");
    }
    setTimeout(() => {
      winAudioRef.current?.play();
      setResult(outcome);
      setSpins(spins - 1);
      const newTotal = points + outcome.points;
      setPoints(newTotal);
      updateLeaderboard(publicKey.toBase58(), outcome.points, signature);
      setSpinning(false);
    }, 2500);
  };

  // Confetti burst for rare/legendary
  useEffect(() => {
    if (result && (result.rarity === "legendary" || result.rarity === "rare")) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1800);
    }
  }, [result]);

  const rarityFX = (rarity) => {
    switch (rarity) {
      case "legendary": return "bg-gradient-to-r from-yellow-400 to-pink-500 text-white p-4 animate-pulse";
      case "epic": return "bg-purple-700 text-white p-3 animate-bounce";
      case "rare": return "bg-blue-700 text-white p-2 animate-pulse";
      default: return "";
    }
  };

  const shareOnX = () => {
    if (!result || !publicKey) return;
    const tweet = `I just spun the wheel on $SPIN and landed on '${result.label}' for ${result.points} points! 🔥\nCheck your luck 👉 spin.fun #SpinTheWheel`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
    window.open(url, '_blank');
  };

  // Leaderboard highlight for top 3
  const podiumBG = ["bg-yellow-300 text-black", "bg-gray-300 text-black", "bg-orange-300 text-black"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center casino-bg text-white p-4 relative overflow-hidden">
      {/* Floating casino chips */}
      {bgChips.map((chip, i) => (
        <motion.span
          key={i}
          className="text-3xl absolute select-none pointer-events-none"
          style={{
            top: `${chip.top}%`,
            left: `${chip.left}%`,
            opacity: 0.18,
            zIndex: 0,
          }}
          animate={{ y: ["0%", "60%", "0%"] }}
          transition={{ repeat: Infinity, duration: 10 + i * 0.1, ease: "linear" }}
        >
          {chip.chip}
        </motion.span>
      ))}
      {/* Neon casino border */}
      <div className="absolute inset-0 border-8 border-pink-500 rounded-2xl pointer-events-none neon-glow z-10" />
      <h1 className="text-5xl font-extrabold mb-4 drop-shadow-lg tracking-widest neon-text z-20">🎰 Spin The Wheel</h1>
      <WalletMultiButton className="mb-6 z-20" />

      <audio ref={spinAudioRef} src="/spin.mp3" preload="auto" />
      <audio ref={winAudioRef} src="/win.mp3" preload="auto" />

      {publicKey && (
        <>
          <p className="mb-2 z-20">Available Spins: {spins}</p>
          <p className="mb-2 text-yellow-300 z-20 font-mono text-2xl">Total Points: {points}</p>
          <motion.div
            animate={spinning ? { rotate: 1080 } : { rotate: 0, scale: 1 }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            className="w-64 h-64 bg-[url('/wheel.png')] bg-contain bg-no-repeat mb-6 border-8 border-yellow-400 neon-glow z-20 shadow-2xl"
          />
          {/* SPINNING... Overlay */}
          <AnimatePresence>
            {spinning && (
              <motion.div
                key="spinOverlay"
                className="fixed inset-0 flex flex-col items-center justify-center z-40 bg-black/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-5xl font-black neon-text animate-pulse mb-8">SPINNING<span className="animate-bounce">...</span></div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-40 h-40 bg-[url('/wheel.png')] bg-contain bg-no-repeat mx-auto neon-glow"
                />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Casino Spin Button */}
          <motion.button
            whileHover={{ scale: 1.12, boxShadow: "0 0 20px #f472b6, 0 0 40px #fde047" }}
            whileTap={{ scale: 0.94 }}
            disabled={spinning || spins <= 0}
            onClick={handleSpin}
            className="px-12 py-6 text-3xl rounded-3xl font-extrabold shadow-xl neon-btn casino-btn-gradient relative z-30
              border-4 border-yellow-400 disabled:opacity-50
              transition-all duration-200"
          >
            <span className="animate-pulse">{spinning ? "Spinning..." : "SPIN"}</span>
            <span className="absolute right-3 top-3 text-yellow-400 animate-bounce">💰</span>
          </motion.button>
          {/* Confetti burst */}
          <AnimatePresence>
            {showConfetti && (
              <motion.div
                key="confetti"
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
              >
                <div className="text-8xl select-none animate-ping">🎉</div>
                <div className="text-8xl select-none animate-bounce">🪙</div>
                <div className="text-8xl select-none animate-pulse">💎</div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Result reveal */}
          <AnimatePresence>
            {result && !spinning && (
              <motion.div
                key={result.label}
                className={`mt-6 text-center rounded-2xl shadow-2xl border-4 ${rarityFX(result.rarity)} z-40 casino-card-bg`}
                initial={{ scale: 0.8, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 40 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
              >
                <p className="text-2xl font-black mb-2 drop-shadow-lg neon-text">{result.label}</p>
                <p className="text-yellow-300 text-2xl font-mono">{result.points} Points</p>
                <img src={`/${result.meme}`} alt="meme" className="mt-4 rounded-xl w-60 h-60 object-cover mx-auto shadow-lg casino-img-border" />
                <button
                  onClick={shareOnX}
                  className="mt-6 px-6 py-3 bg-pink-500 rounded-xl font-extrabold neon-btn casino-btn-gradient shadow-xl hover:bg-pink-700"
                >
                  Share This Spin on X
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Casino-style Leaderboard */}
          <div className="mt-12 w-full max-w-xl z-20">
            <h2 className="text-3xl font-black mb-5 text-center neon-text drop-shadow-lg">🏆 Leaderboard (Week {getWeekNumber()})</h2>
            <ul className="bg-black/80 rounded-2xl p-5 space-y-3 border-4 border-pink-300 neon-glow">
              {leaderboard.map((entry, index) => (
                <li
                  key={entry.wallet}
                  className={`flex justify-between text-xl font-bold px-4 py-3 rounded-2xl shadow-lg
                  ${index < 3 ? podiumBG[index] : "bg-gray-900 bg-opacity-70"} border-2 border-yellow-100`}
                >
                  <span>
                    #{index + 1} - {entry.wallet.slice(0, 4)}...{entry.wallet.slice(-4)}
                    {index === 0 && (
                      <span className="ml-3 px-2 py-0.5 bg-yellow-400 text-black font-black rounded-lg shadow-inner animate-pulse">🏆 NFT Winner</span>
                    )}
                    {index === 1 && <span className="ml-2">🥈</span>}
                    {index === 2 && <span className="ml-2">🥉</span>}
                  </