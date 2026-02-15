'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Block {
  id: number;
  x: number;
  width: number;
  color: string;
}

interface FallingPiece {
  id: number;
  x: number;
  y: number;
  width: number;
  color: string;
  rotation: number;
  vy: number;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', 
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
];

const GAME_WIDTH = 300;
const BLOCK_HEIGHT = 18;
const BASE_WIDTH = 140;

export default function StackSlide() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'dead'>('menu');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ width: number; color: string } | null>(null);
  const [blockX, setBlockX] = useState(0);
  const [blockDir, setBlockDir] = useState(1);
  const [fallingPieces, setFallingPieces] = useState<FallingPiece[]>([]);
  const [score, setScore] = useState(0);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(2);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((freq: number, type: OscillatorType = 'sine', dur = 0.1) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type;
      gain.gain.value = 0.1;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }, []);

  const playPlace = useCallback((perfect: boolean) => {
    if (perfect) {
      [523, 659, 784].forEach((f, i) => setTimeout(() => playSound(f, 'sine', 0.12), i * 60));
    } else {
      playSound(350, 'sine', 0.08);
    }
  }, [playSound]);

  const startGame = useCallback(() => {
    const baseBlock: Block = {
      id: 0,
      x: GAME_WIDTH / 2 - BASE_WIDTH / 2,
      width: BASE_WIDTH,
      color: COLORS[0],
    };
    
    setBlocks([baseBlock]);
    setCurrentBlock({
      width: BASE_WIDTH,
      color: COLORS[1],
    });
    setBlockX(-BASE_WIDTH);
    setBlockDir(1);
    setFallingPieces([]);
    setScore(0);
    setPerfectStreak(0);
    setSpeed(2);
    setGameState('playing');
  }, []);

  // Block movement
  useEffect(() => {
    if (gameState !== 'playing' || !currentBlock) return;
    
    const interval = setInterval(() => {
      setBlockX(prev => {
        const blockSpeed = speed + blocks.length * 0.15;
        let next = prev + blockDir * blockSpeed;
        
        if (next > GAME_WIDTH) {
          setBlockDir(-1);
          next = GAME_WIDTH;
        } else if (next < -currentBlock.width) {
          setBlockDir(1);
          next = -currentBlock.width;
        }
        
        return next;
      });
    }, 20);
    
    return () => clearInterval(interval);
  }, [gameState, currentBlock, blockDir, speed, blocks.length]);

  // Falling pieces
  useEffect(() => {
    if (fallingPieces.length === 0) return;
    
    const interval = setInterval(() => {
      setFallingPieces(prev => 
        prev
          .map(p => ({ ...p, y: p.y + p.vy, vy: p.vy + 0.8, rotation: p.rotation + 8 }))
          .filter(p => p.y < 500)
      );
    }, 25);
    
    return () => clearInterval(interval);
  }, [fallingPieces.length]);

  const placeBlock = useCallback(() => {
    if (!currentBlock || gameState !== 'playing') return;
    
    const lastBlock = blocks[blocks.length - 1];
    
    // Simple overlap calculation
    const blockLeft = blockX;
    const blockRight = blockX + currentBlock.width;
    const lastLeft = lastBlock.x;
    const lastRight = lastBlock.x + lastBlock.width;
    
    const overlapLeft = Math.max(blockLeft, lastLeft);
    const overlapRight = Math.min(blockRight, lastRight);
    const overlapWidth = overlapRight - overlapLeft;
    
    // Complete miss
    if (overlapWidth <= 5) {
      playSound(150, 'sawtooth', 0.3);
      setFallingPieces(prev => [...prev, {
        id: Date.now(),
        x: blockX,
        y: 60,
        width: currentBlock.width,
        color: currentBlock.color,
        rotation: 0,
        vy: 1,
      }]);
      setGameState('dead');
      setHighScore(h => Math.max(h, score));
      return;
    }
    
    // Check if perfect (within 5px tolerance)
    const isPerfect = Math.abs(overlapWidth - lastBlock.width) < 5;
    
    // Create falling overhang pieces
    if (blockLeft < lastLeft) {
      setFallingPieces(prev => [...prev, {
        id: Date.now(),
        x: blockLeft,
        y: 60,
        width: Math.min(lastLeft - blockLeft, currentBlock.width),
        color: currentBlock.color,
        rotation: -5,
        vy: 1,
      }]);
    }
    if (blockRight > lastRight) {
      setFallingPieces(prev => [...prev, {
        id: Date.now() + 1,
        x: lastRight,
        y: 60,
        width: Math.min(blockRight - lastRight, currentBlock.width),
        color: currentBlock.color,
        rotation: 5,
        vy: 1,
      }]);
    }
    
    // Place the block
    const finalWidth = isPerfect ? lastBlock.width : Math.max(overlapWidth, 20);
    const newBlock: Block = {
      id: blocks.length,
      x: overlapLeft,
      width: finalWidth,
      color: currentBlock.color,
    };
    
    setBlocks(prev => [...prev, newBlock]);
    
    // Score
    const streakBonus = isPerfect ? perfectStreak * 5 : 0;
    const points = isPerfect ? 25 + streakBonus : 10;
    setScore(s => s + points);
    
    if (isPerfect) {
      setPerfectStreak(p => p + 1);
    } else {
      setPerfectStreak(0);
    }
    
    playPlace(isPerfect);
    
    // Check if block too small
    if (finalWidth < 15) {
      setGameState('dead');
      setHighScore(h => Math.max(h, score + points));
      return;
    }
    
    // Next block
    setCurrentBlock({
      width: finalWidth,
      color: COLORS[(blocks.length + 1) % COLORS.length],
    });
    setBlockDir(Math.random() > 0.5 ? 1 : -1);
    setBlockX(blockDir > 0 ? -finalWidth : GAME_WIDTH);
    setSpeed(s => Math.min(s + 0.15, 6));
    
  }, [currentBlock, blocks, blockX, gameState, score, perfectStreak, playPlace, playSound, blockDir]);

  // Input handlers
  useEffect(() => {
    const handleTap = (e: Event) => {
      e.preventDefault();
      if (gameState === 'playing') {
        placeBlock();
      } else {
        startGame();
      }
    };
    
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (gameState === 'playing') {
          placeBlock();
        } else {
          startGame();
        }
      }
    };
    
    window.addEventListener('click', handleTap);
    window.addEventListener('touchstart', handleTap);
    window.addEventListener('keydown', handleKey);
    
    return () => {
      window.removeEventListener('click', handleTap);
      window.removeEventListener('touchstart', handleTap);
      window.removeEventListener('keydown', handleKey);
    };
  }, [gameState, placeBlock, startGame]);

  const towerHeight = blocks.length * BLOCK_HEIGHT;
  const viewOffset = Math.max(0, towerHeight - 250);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-900 to-purple-900">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-xs px-4 mb-3">
        <div>
          <p className="text-3xl font-bold text-white">{score}</p>
          <p className="text-xs text-indigo-300">Score</p>
        </div>
        {perfectStreak > 0 && gameState === 'playing' && (
          <div className="text-center animate-pulse">
            <p className="text-xl font-bold text-yellow-400">🔥 x{perfectStreak}</p>
            <p className="text-xs text-yellow-300">PERFECT!</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-2xl font-bold text-indigo-200">{blocks.length - 1}</p>
          <p className="text-xs text-indigo-300">Height</p>
        </div>
      </div>

      {/* Game area */}
      <div 
        className="relative bg-black/40 rounded-2xl overflow-hidden border-2 border-indigo-500/30"
        style={{ width: GAME_WIDTH, height: 380 }}
      >
        {/* Tower */}
        <div 
          className="absolute bottom-0 left-0 right-0"
          style={{ transform: `translateY(${viewOffset}px)` }}
        >
          {blocks.map((block, i) => (
            <div
              key={block.id}
              className="absolute"
              style={{
                left: block.x,
                bottom: i * BLOCK_HEIGHT,
                width: block.width,
                height: BLOCK_HEIGHT - 2,
                background: `linear-gradient(180deg, ${block.color}, ${block.color}cc)`,
                borderRadius: 3,
                boxShadow: `0 2px 8px ${block.color}44`,
              }}
            />
          ))}
        </div>

        {/* Moving block */}
        {currentBlock && gameState === 'playing' && (
          <div
            className="absolute"
            style={{
              left: blockX,
              top: 60,
              width: currentBlock.width,
              height: BLOCK_HEIGHT - 2,
              background: `linear-gradient(180deg, ${currentBlock.color}, ${currentBlock.color}cc)`,
              borderRadius: 3,
              boxShadow: `0 0 15px ${currentBlock.color}88`,
            }}
          />
        )}

        {/* Target guide line */}
        {gameState === 'playing' && blocks.length > 0 && (
          <div 
            className="absolute bg-white/30 h-0.5"
            style={{
              left: blocks[blocks.length - 1].x,
              top: 78,
              width: blocks[blocks.length - 1].width,
            }}
          />
        )}

        {/* Falling pieces */}
        {fallingPieces.map(piece => (
          <div
            key={piece.id}
            className="absolute"
            style={{
              left: piece.x,
              top: piece.y,
              width: piece.width,
              height: BLOCK_HEIGHT - 2,
              background: piece.color,
              borderRadius: 3,
              transform: `rotate(${piece.rotation}deg)`,
              opacity: 0.8,
            }}
          />
        ))}

        {/* Menu */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="text-5xl mb-3">🏗️</div>
            <h1 className="text-3xl font-bold text-white mb-2">Stack & Slide</h1>
            <p className="text-indigo-300 text-center px-6 mb-6 text-sm">
              Tap to stack blocks!<br/>
              Land perfectly for bonus points!
            </p>
            <div className="bg-indigo-500 text-white px-8 py-3 rounded-full font-bold text-lg">
              TAP TO START
            </div>
          </div>
        )}

        {/* Game over */}
        {gameState === 'dead' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <div className="text-4xl mb-2">💥</div>
            <h2 className="text-2xl font-bold text-white mb-2">Game Over!</h2>
            <p className="text-4xl font-bold text-indigo-300">{score}</p>
            <p className="text-indigo-400 mb-1">Height: {blocks.length - 1}</p>
            {score >= highScore && score > 0 && (
              <p className="text-yellow-400 text-lg">🏆 New Best!</p>
            )}
            <div className="bg-indigo-500 text-white px-6 py-2 rounded-full font-bold mt-4">
              TAP TO RETRY
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-indigo-400 text-sm">Tap anywhere to place block!</p>
      {highScore > 0 && <p className="text-indigo-500 text-xs mt-1">Best: {highScore}</p>}
    </div>
  );
}
