'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Block {
  x: number;
  width: number;
  color: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
const GAME_WIDTH = 280;
const BLOCK_HEIGHT = 22;
const START_WIDTH = 120;

export default function StackGame() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'over'>('menu');
  const [stack, setStack] = useState<Block[]>([]);
  const [movingBlock, setMovingBlock] = useState({ x: 0, width: START_WIDTH, dir: 1 });
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [ready, setReady] = useState(false);
  const [fallingParts, setFallingParts] = useState<{ x: number; y: number; w: number; c: string; vy: number; r: number }[]>([]);
  const audioRef = useRef<AudioContext | null>(null);

  const beep = useCallback((freq: number, dur = 0.1) => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const o = audioRef.current.createOscillator();
      const g = audioRef.current.createGain();
      o.connect(g); g.connect(audioRef.current.destination);
      o.frequency.value = freq;
      g.gain.value = 0.08;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioRef.current.currentTime + dur);
      o.stop(audioRef.current.currentTime + dur);
    } catch {}
  }, []);

  const start = useCallback(() => {
    const baseX = (GAME_WIDTH - START_WIDTH) / 2;
    setStack([{ x: baseX, width: START_WIDTH, color: COLORS[0] }]);
    setMovingBlock({ x: 0, width: START_WIDTH, dir: 1 });
    setScore(0);
    setCombo(0);
    setFallingParts([]);
    setReady(false);
    setGameState('playing');
    setTimeout(() => setReady(true), 400);
  }, []);

  // Moving block animation
  useEffect(() => {
    if (gameState !== 'playing') return;
    const speed = 3 + stack.length * 0.3;
    
    const id = setInterval(() => {
      setMovingBlock(prev => {
        let newX = prev.x + prev.dir * speed;
        let newDir = prev.dir;
        
        if (newX + prev.width > GAME_WIDTH) {
          newX = GAME_WIDTH - prev.width;
          newDir = -1;
        } else if (newX < 0) {
          newX = 0;
          newDir = 1;
        }
        
        return { ...prev, x: newX, dir: newDir };
      });
    }, 20);
    
    return () => clearInterval(id);
  }, [gameState, stack.length]);

  // Falling parts animation
  useEffect(() => {
    if (fallingParts.length === 0) return;
    const id = setInterval(() => {
      setFallingParts(prev => 
        prev.map(p => ({ ...p, y: p.y + p.vy, vy: p.vy + 1, r: p.r + 5 }))
            .filter(p => p.y < 500)
      );
    }, 30);
    return () => clearInterval(id);
  }, [fallingParts.length]);

  const drop = useCallback(() => {
    if (gameState !== 'playing' || !ready) return;

    const top = stack[stack.length - 1];
    const m = movingBlock;
    
    // Calculate overlap
    const overlapStart = Math.max(m.x, top.x);
    const overlapEnd = Math.min(m.x + m.width, top.x + top.width);
    const overlapWidth = overlapEnd - overlapStart;

    // Miss completely
    if (overlapWidth <= 0) {
      beep(150, 0.3);
      setFallingParts(prev => [...prev, {
        x: m.x, y: 50, w: m.width, 
        c: COLORS[(stack.length) % COLORS.length], 
        vy: 2, r: m.dir * 5
      }]);
      setGameState('over');
      setBestScore(b => Math.max(b, score));
      return;
    }

    // Check for perfect landing (within 8px tolerance)
    const isPerfect = overlapWidth >= top.width - 8;
    const finalWidth = isPerfect ? top.width : overlapWidth;
    const finalX = isPerfect ? top.x : overlapStart;

    // Add falling overhang
    if (!isPerfect) {
      if (m.x < top.x) {
        setFallingParts(prev => [...prev, {
          x: m.x, y: 50, w: top.x - m.x,
          c: COLORS[(stack.length) % COLORS.length],
          vy: 2, r: -10
        }]);
      }
      if (m.x + m.width > top.x + top.width) {
        setFallingParts(prev => [...prev, {
          x: top.x + top.width, y: 50, w: (m.x + m.width) - (top.x + top.width),
          c: COLORS[(stack.length) % COLORS.length],
          vy: 2, r: 10
        }]);
      }
    }

    // Add to stack
    const newBlock: Block = {
      x: finalX,
      width: finalWidth,
      color: COLORS[(stack.length) % COLORS.length]
    };
    setStack(prev => [...prev, newBlock]);

    // Score
    const newCombo = isPerfect ? combo + 1 : 0;
    setCombo(newCombo);
    const points = isPerfect ? 10 + newCombo * 5 : 5;
    setScore(s => s + points);

    // Sound
    if (isPerfect) {
      [440, 554, 659].forEach((f, i) => setTimeout(() => beep(f, 0.1), i * 50));
    } else {
      beep(330, 0.08);
    }

    // Game over if too thin
    if (finalWidth < 15) {
      setGameState('over');
      setBestScore(b => Math.max(b, score + points));
      return;
    }

    // Next block
    setMovingBlock({
      x: m.dir > 0 ? 0 : GAME_WIDTH - finalWidth,
      width: finalWidth,
      dir: m.dir
    });

  }, [gameState, ready, stack, movingBlock, score, combo, beep]);

  // Input
  useEffect(() => {
    const handle = (e: Event) => {
      e.preventDefault();
      if (gameState === 'playing') drop();
      else start();
    };
    const keyHandle = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'playing') drop();
        else start();
      }
    };
    
    window.addEventListener('mousedown', handle);
    window.addEventListener('touchstart', handle);
    window.addEventListener('keydown', keyHandle);
    return () => {
      window.removeEventListener('mousedown', handle);
      window.removeEventListener('touchstart', handle);
      window.removeEventListener('keydown', keyHandle);
    };
  }, [gameState, drop, start]);

  const viewOffset = Math.max(0, (stack.length - 12) * BLOCK_HEIGHT);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-purple-950 to-indigo-950">
      {/* Score */}
      <div className="flex items-center gap-8 mb-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-white">{score}</div>
          <div className="text-xs text-purple-300">SCORE</div>
        </div>
        {combo > 0 && gameState === 'playing' && (
          <div className="text-center animate-bounce">
            <div className="text-2xl font-bold text-yellow-400">🔥 x{combo + 1}</div>
            <div className="text-xs text-yellow-300">PERFECT!</div>
          </div>
        )}
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-300">{stack.length - 1}</div>
          <div className="text-xs text-purple-400">HEIGHT</div>
        </div>
      </div>

      {/* Game */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-purple-500/40 bg-black/30"
           style={{ width: GAME_WIDTH, height: 360 }}>
        
        {/* Stack */}
        <div className="absolute bottom-0 left-0 right-0" style={{ transform: `translateY(${viewOffset}px)` }}>
          {stack.map((block, i) => (
            <div key={i} className="absolute" style={{
              left: block.x,
              bottom: i * BLOCK_HEIGHT,
              width: block.width,
              height: BLOCK_HEIGHT - 2,
              background: `linear-gradient(to bottom, ${block.color}, ${block.color}dd)`,
              borderRadius: 4,
              boxShadow: `0 2px 10px ${block.color}44`
            }} />
          ))}
        </div>

        {/* Moving block */}
        {gameState === 'playing' && (
          <div className="absolute" style={{
            left: movingBlock.x,
            top: 50,
            width: movingBlock.width,
            height: BLOCK_HEIGHT - 2,
            background: `linear-gradient(to bottom, ${COLORS[stack.length % COLORS.length]}, ${COLORS[stack.length % COLORS.length]}dd)`,
            borderRadius: 4,
            boxShadow: `0 0 20px ${COLORS[stack.length % COLORS.length]}66`
          }} />
        )}

        {/* Target indicator */}
        {gameState === 'playing' && stack.length > 0 && (
          <div className="absolute opacity-40" style={{
            left: stack[stack.length - 1].x,
            top: 70,
            width: stack[stack.length - 1].width,
            height: 2,
            background: 'white'
          }} />
        )}

        {/* Falling parts */}
        {fallingParts.map((p, i) => (
          <div key={i} className="absolute" style={{
            left: p.x,
            top: p.y,
            width: p.w,
            height: BLOCK_HEIGHT - 2,
            background: p.c,
            borderRadius: 4,
            transform: `rotate(${p.r}deg)`,
            opacity: 0.8
          }} />
        ))}

        {/* Menu */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">🏗️</div>
            <h1 className="text-4xl font-bold text-white mb-2">STACK</h1>
            <p className="text-purple-300 mb-6">Tap to stack blocks!</p>
            <div className="bg-purple-500 px-8 py-3 rounded-full text-white font-bold text-lg">
              TAP TO START
            </div>
          </div>
        )}

        {/* Game Over */}
        {gameState === 'over' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
            <div className="text-5xl mb-2">💥</div>
            <h2 className="text-2xl font-bold text-white mb-2">GAME OVER</h2>
            <div className="text-5xl font-bold text-purple-300 mb-1">{score}</div>
            <p className="text-purple-400 mb-1">Height: {stack.length - 1}</p>
            {score >= bestScore && score > 0 && (
              <p className="text-yellow-400 text-lg mb-2">🏆 NEW BEST!</p>
            )}
            <div className="bg-purple-500 px-6 py-2 rounded-full text-white font-bold mt-3">
              TAP TO RETRY
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-purple-400 text-sm">Tap to drop • Perfect = Bonus!</p>
      {bestScore > 0 && <p className="text-purple-500 text-xs mt-1">Best: {bestScore}</p>}
    </div>
  );
}
