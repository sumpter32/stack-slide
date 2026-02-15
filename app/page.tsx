'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Block {
  id: number;
  x: number;
  width: number;
  color: string;
  placed: boolean;
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

const GAME_WIDTH = 320;
const BLOCK_HEIGHT = 20;
const BASE_WIDTH = 120;

export default function StackSlide() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'dead'>('menu');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [currentBlock, setCurrentBlock] = useState<Block | null>(null);
  const [fallingPieces, setFallingPieces] = useState<FallingPiece[]>([]);
  const [towerOffset, setTowerOffset] = useState(0);
  const [towerDir, setTowerDir] = useState(1);
  const [score, setScore] = useState(0);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(3);
  const [blockX, setBlockX] = useState(0);
  const [blockDir, setBlockDir] = useState(1);
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
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playSound(f, 'sine', 0.15), i * 50));
    } else {
      playSound(300 + Math.random() * 100, 'sine', 0.1);
    }
  }, [playSound]);

  const playFall = useCallback(() => {
    playSound(200, 'sawtooth', 0.2);
  }, [playSound]);

  const startGame = useCallback(() => {
    const baseBlock: Block = {
      id: 0,
      x: GAME_WIDTH / 2 - BASE_WIDTH / 2,
      width: BASE_WIDTH,
      color: COLORS[0],
      placed: true,
    };
    
    setBlocks([baseBlock]);
    setCurrentBlock({
      id: 1,
      x: 0,
      width: BASE_WIDTH,
      color: COLORS[1],
      placed: false,
    });
    setFallingPieces([]);
    setTowerOffset(0);
    setTowerDir(1);
    setScore(0);
    setPerfectStreak(0);
    setSpeed(3);
    setBlockX(0);
    setBlockDir(1);
    setGameState('playing');
  }, []);

  // Tower sliding
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const interval = setInterval(() => {
      setTowerOffset(prev => {
        const slideSpeed = 0.5 + blocks.length * 0.05;
        let next = prev + towerDir * slideSpeed;
        
        if (next > 30) {
          setTowerDir(-1);
          next = 30;
        } else if (next < -30) {
          setTowerDir(1);
          next = -30;
        }
        
        return next;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [gameState, towerDir, blocks.length]);

  // Current block sliding
  useEffect(() => {
    if (gameState !== 'playing' || !currentBlock) return;
    
    const interval = setInterval(() => {
      setBlockX(prev => {
        const blockSpeed = speed + blocks.length * 0.3;
        let next = prev + blockDir * blockSpeed;
        
        if (next > GAME_WIDTH - currentBlock.width) {
          setBlockDir(-1);
          next = GAME_WIDTH - currentBlock.width;
        } else if (next < 0) {
          setBlockDir(1);
          next = 0;
        }
        
        return next;
      });
    }, 30);
    
    return () => clearInterval(interval);
  }, [gameState, currentBlock, blockDir, speed, blocks.length]);

  // Falling pieces animation
  useEffect(() => {
    if (fallingPieces.length === 0) return;
    
    const interval = setInterval(() => {
      setFallingPieces(prev => 
        prev
          .map(p => ({ ...p, y: p.y + p.vy, vy: p.vy + 0.5, rotation: p.rotation + 5 }))
          .filter(p => p.y < 600)
      );
    }, 30);
    
    return () => clearInterval(interval);
  }, [fallingPieces.length]);

  const placeBlock = useCallback(() => {
    if (!currentBlock || gameState !== 'playing') return;
    
    const lastBlock = blocks[blocks.length - 1];
    const lastBlockX = lastBlock.x + towerOffset;
    
    // Calculate overlap
    const blockLeft = blockX;
    const blockRight = blockX + currentBlock.width;
    const lastLeft = lastBlockX;
    const lastRight = lastBlockX + lastBlock.width;
    
    const overlapLeft = Math.max(blockLeft, lastLeft);
    const overlapRight = Math.min(blockRight, lastRight);
    const overlapWidth = overlapRight - overlapLeft;
    
    if (overlapWidth <= 0) {
      // Complete miss!
      playFall();
      setFallingPieces(prev => [...prev, {
        id: Date.now(),
        x: blockX,
        y: 80,
        width: currentBlock.width,
        color: currentBlock.color,
        rotation: 0,
        vy: 2,
      }]);
      setGameState('dead');
      setHighScore(h => Math.max(h, score));
      return;
    }
    
    const isPerfect = Math.abs(overlapWidth - lastBlock.width) < 3;
    
    // Create falling pieces for overhang
    if (blockLeft < lastLeft) {
      setFallingPieces(prev => [...prev, {
        id: Date.now(),
        x: blockLeft,
        y: 80,
        width: lastLeft - blockLeft,
        color: currentBlock.color,
        rotation: 0,
        vy: 2,
      }]);
    }
    if (blockRight > lastRight) {
      setFallingPieces(prev => [...prev, {
        id: Date.now() + 1,
        x: lastRight,
        y: 80,
        width: blockRight - lastRight,
        color: currentBlock.color,
        rotation: 0,
        vy: 2,
      }]);
    }
    
    // Place block
    const newBlock: Block = {
      id: currentBlock.id,
      x: overlapLeft - towerOffset,
      width: isPerfect ? lastBlock.width : overlapWidth,
      color: currentBlock.color,
      placed: true,
    };
    
    setBlocks(prev => [...prev, newBlock]);
    
    // Score
    const points = isPerfect ? 50 + perfectStreak * 10 : 10;
    setScore(s => s + points);
    
    if (isPerfect) {
      setPerfectStreak(p => p + 1);
    } else {
      setPerfectStreak(0);
    }
    
    playPlace(isPerfect);
    
    // Next block
    const newWidth = isPerfect ? lastBlock.width : overlapWidth;
    if (newWidth < 10) {
      setGameState('dead');
      setHighScore(h => Math.max(h, score + points));
      return;
    }
    
    setCurrentBlock({
      id: currentBlock.id + 1,
      x: 0,
      width: newWidth,
      color: COLORS[(currentBlock.id + 1) % COLORS.length],
      placed: false,
    });
    setBlockDir(Math.random() > 0.5 ? 1 : -1);
    setBlockX(blockDir > 0 ? 0 : GAME_WIDTH - newWidth);
    setSpeed(s => Math.min(s + 0.1, 8));
    
  }, [currentBlock, blocks, blockX, towerOffset, gameState, score, perfectStreak, playPlace, playFall, blockDir]);

  // Touch/click handler
  useEffect(() => {
    const handleTap = () => {
      if (gameState === 'playing') {
        placeBlock();
      } else if (gameState !== 'playing') {
        startGame();
      }
    };
    
    window.addEventListener('click', handleTap);
    window.addEventListener('touchstart', handleTap);
    window.addEventListener('keydown', (e) => { if (e.key === ' ') handleTap(); });
    
    return () => {
      window.removeEventListener('click', handleTap);
      window.removeEventListener('touchstart', handleTap);
    };
  }, [gameState, placeBlock, startGame]);

  const towerHeight = blocks.length * BLOCK_HEIGHT;
  const viewOffset = Math.max(0, towerHeight - 200);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-sm px-4 mb-4">
        <div>
          <p className="text-3xl font-bold text-white">{score}</p>
          <p className="text-xs text-purple-300">Score</p>
        </div>
        {perfectStreak > 0 && (
          <div className="text-center animate-pulse">
            <p className="text-2xl font-bold text-yellow-400">🔥 x{perfectStreak}</p>
            <p className="text-xs text-yellow-300">PERFECT!</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-xl font-bold text-purple-200">{blocks.length - 1}</p>
          <p className="text-xs text-purple-300">Height</p>
        </div>
      </div>

      {/* Game area */}
      <div 
        className="relative bg-black/30 rounded-2xl overflow-hidden border-2 border-purple-500/30"
        style={{ width: GAME_WIDTH, height: 400 }}
      >
        {/* Tower container */}
        <div 
          className="absolute bottom-0 left-0 right-0 transition-transform duration-100"
          style={{ 
            transform: `translateX(${towerOffset}px) translateY(${viewOffset}px)`,
          }}
        >
          {/* Placed blocks */}
          {blocks.map((block, i) => (
            <div
              key={block.id}
              className="absolute transition-all duration-100"
              style={{
                left: block.x,
                bottom: i * BLOCK_HEIGHT,
                width: block.width,
                height: BLOCK_HEIGHT - 2,
                background: `linear-gradient(180deg, ${block.color}, ${block.color}aa)`,
                borderRadius: 4,
                boxShadow: `0 2px 10px ${block.color}44`,
              }}
            />
          ))}
        </div>

        {/* Current moving block */}
        {currentBlock && gameState === 'playing' && (
          <div
            className="absolute"
            style={{
              left: blockX,
              top: 80,
              width: currentBlock.width,
              height: BLOCK_HEIGHT - 2,
              background: `linear-gradient(180deg, ${currentBlock.color}, ${currentBlock.color}aa)`,
              borderRadius: 4,
              boxShadow: `0 0 20px ${currentBlock.color}66`,
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
              borderRadius: 4,
              transform: `rotate(${piece.rotation}deg)`,
              opacity: 0.7,
            }}
          />
        ))}

        {/* Menu overlay */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="text-5xl mb-4">🏗️</div>
            <h1 className="text-3xl font-bold text-white mb-2">Stack & Slide</h1>
            <p className="text-purple-300 text-center px-8 mb-6">
              Stack blocks on a sliding tower!<br/>
              Tap to place. Don't miss!
            </p>
            <div className="text-6xl mb-4">👆</div>
            <p className="text-white/80">Tap to Start</p>
          </div>
        )}

        {/* Game over */}
        {gameState === 'dead' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <div className="text-4xl mb-2">💥</div>
            <h2 className="text-2xl font-bold text-white mb-1">Game Over!</h2>
            <p className="text-4xl font-bold text-purple-300 mb-1">{score}</p>
            <p className="text-lg text-purple-400 mb-1">Height: {blocks.length - 1}</p>
            {score >= highScore && score > 0 && (
              <p className="text-yellow-400 mb-2">🏆 New Best!</p>
            )}
            <p className="text-white/60 mt-4">Tap to Retry</p>
          </div>
        )}

        {/* Guide line */}
        {gameState === 'playing' && blocks.length > 0 && (
          <div 
            className="absolute top-20 h-px bg-white/20"
            style={{
              left: blocks[blocks.length - 1].x + towerOffset,
              width: blocks[blocks.length - 1].width,
            }}
          />
        )}
      </div>

      <p className="mt-4 text-purple-400 text-sm">Tap anywhere to stack!</p>
      {highScore > 0 && <p className="text-purple-500 text-xs mt-1">Best: {highScore}</p>}
    </div>
  );
}
