'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
test('opening has four legal moves per player', () => {
  const board = E.initialBoard();
  assert.deepEqual(E.legalMoves(board, 1), [19, 26, 37, 44]);
  assert.deepEqual(E.legalMoves(board, -1), [20, 29, 34, 43]);
  const next = E.play(board, 19, 1);
  assert.equal(next.filter(v => v === 1).length, 4);
  assert.equal(next.filter(v => v === -1).length, 1);
  assert.equal(board[19], 0);
  assert.equal(E.play(board, 0, 1), null);
  assert.equal(E.play(board, 27, 1), null);
});
test('captures in all eight directions', () => {
  const board = Array(64).fill(0);
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    board[(3 + dr) * 8 + 3 + dc] = -1;
    board[(3 + 2 * dr) * 8 + 3 + 2 * dc] = 1;
  }
  assert.equal(E.flips(board, 27, 1).length, 8);
});
test('captures cannot wrap around board edges', () => {
  const board = Array(64).fill(0); board[8] = -1; board[9] = 1;
  assert.deepEqual(E.flips(board, 7, 1), []);
});
test('pass and early end with empty squares', () => {
  const board = Array(64).fill(1); board[0] = 0; board[1] = -1;
  assert.deepEqual(E.legalMoves(board, -1), []);
  assert.deepEqual(E.legalMoves(board, 1), [0]);
  assert.equal(E.chooseMove(board, -1), null);
  board[1] = 1;
  assert.deepEqual(E.legalMoves(board, 1), []);
  assert.deepEqual(E.legalMoves(board, -1), []);
});
test('every AI difficulty returns a legal move', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const board = E.initialBoard();
    assert.ok(E.legalMoves(board, 1).includes(E.chooseMove(board, 1, difficulty)));
  }
});
test('complete AI game preserves counts and finishes legally', () => {
  let board = E.initialBoard(), player = 1, moves = 0;
  while (moves < 61) {
    const legal = E.legalMoves(board, player);
    if (!legal.length) { if (!E.legalMoves(board, -player).length) break; player *= -1; continue; }
    const occupied = board.filter(Boolean).length;
    const move = E.chooseMove(board, player, 'normal');
    assert.ok(legal.includes(move));
    board = E.play(board, move, player);
    assert.equal(board.filter(Boolean).length, occupied + 1);
    assert.ok(board.every(v => [-1, 0, 1].includes(v)));
    moves++; player *= -1;
  }
  assert.ok(moves <= 60);
  assert.equal(E.legalMoves(board, 1).length + E.legalMoves(board, -1).length, 0);
});

test('strong AI respects a short search budget without changing the board', () => {
  const board = E.initialBoard(), before = board.slice();
  const result = E.analyzeStrong(board, 1, { timeMs: 80 });
  assert.ok(E.legalMoves(board, 1).includes(result.move));
  assert.ok(result.depth >= 1);
  assert.deepEqual(board, before);
  assert.equal(E.analyzeStrong(Array(64).fill(1), -1).move, null);
});

test('strong AI agrees with exhaustive endgame search, including forced passes', () => {
  let passes = 0;
  function solve(board, color) {
    const moves = E.legalMoves(board, color);
    if (!moves.length) {
      if (E.legalMoves(board, -color).length) { passes++; return -solve(board, -color); }
      return board.reduce((sum, v) => sum + v * color, 0);
    }
    return Math.max(...moves.map(move => -solve(E.play(board, move, color), -color)));
  }
  for (let seed = 1; seed <= 6; seed++) {
    let board = E.initialBoard(), color = 1, random = seed;
    while (board.filter(v => !v).length > 7) {
      const moves = E.legalMoves(board, color);
      if (!moves.length) { if (!E.legalMoves(board, -color).length) break; color *= -1; continue; }
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      board = E.play(board, moves[random % moves.length], color); color *= -1;
    }
    for (const player of [1, -1]) {
      if (!E.legalMoves(board, player).length) continue;
      const bestScore = solve(board, player);
      const result = E.analyzeStrong(board, player, { timeMs: 1500 });
      assert.equal(result.exact, true);
      assert.equal(-solve(E.play(board, result.move, player), -player), bestScore);
    }
  }
  assert.ok(passes > 0);
});
