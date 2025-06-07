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
      const simulatedHoldingMinutes = 30;
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
    if (!signature) {
      alert("Signature required. Please re-connect wallet.");
      return;
    }
    if (window._spinCooldown && Date.now() - window._spinCooldown < 2500) {
      alert("Slow down!");
      return;
    }
    window._spinCooldown = Date.now();
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

  const podiumBG = ["bg-yellow-300 text-black", "bg-gray-300 text-black", "bg-orange-300 text-black"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center casino-bg text-white p-4 relative overflow-hidden">
      <div className="mt-12 w-full max-w-xl z-20">
        <h2 className="text-3xl font-black mb-5 text-center neon-text drop-shadow-lg">
          🏆 Leaderboard (Week {getWeekNumber()})
        </h2>
        <ul className="bg-black/80 rounded-2xl p-5 space-y-3 border-4 border-pink-300 neon-glow">
          {leaderboard.map((entry, index) => (
            <li
              key={entry.wallet}
              className={`flex justify-between text-xl font-bold px-4 py-3 rounded-2xl shadow-lg ${index < 3 ? podiumBG[index] : "bg-gray-900 bg-opacity-70"} border-2 border-yellow-100`}
            >
              <span>
                #{index + 1} - {entry.wallet.slice(0, 4)}...{entry.wallet.slice(-4)}
                {index === 0 && (
                  <span className="ml-3 px-2 py-0.5 bg-yellow-400 text-black font-black rounded-lg shadow-inner animate-pulse">
                    🏆 NFT Winner
                  </span>
                )}
                {index === 1 && <span className="ml-2">🥈</span>}
                {index === 2 && <span className="ml-2">🥉</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

