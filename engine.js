(function (root) {
  'use strict';
  const directions = [-1, 0, 1].flatMap(r => [-1, 0, 1].map(c => [r, c])).filter(([r, c]) => r || c);
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  function initialBoard() {
    const board = Array(64).fill(0);
    board[27] = board[36] = -1;
    board[28] = board[35] = 1;
    return board;
  }
  function flips(board, index, player) {
    if (!Number.isInteger(index) || index < 0 || index >= 64 || board[index]) return [];
    const found = [], row = Math.floor(index / 8), col = index % 8;
    for (const [dr, dc] of directions) {
      let r = row + dr, c = col + dc;
      const line = [];
      while (inside(r, c) && board[r * 8 + c] === -player) {
        line.push(r * 8 + c); r += dr; c += dc;
      }
      if (line.length && inside(r, c) && board[r * 8 + c] === player) found.push(...line);
    }
    return found;
  }
  function legalMoves(board, player) {
    const result = [];
    for (let i = 0; i < 64; i++) if (!board[i] && flips(board, i, player).length) result.push(i);
    return result;
  }
  function play(board, index, player) {
    const changed = flips(board, index, player);
    if (!changed.length) return null;
    const next = board.slice();
    for (const i of [index, ...changed]) next[i] = player;
    return next;
  }
  const weights = [100,-25,12,5,5,12,-25,100,-25,-45,-3,-3,-3,-3,-45,-25,12,-3,8,2,2,8,-3,12,5,-3,2,1,1,2,-3,5,5,-3,2,1,1,2,-3,5,12,-3,8,2,2,8,-3,12,-25,-45,-3,-3,-3,-3,-45,-25,100,-25,12,5,5,12,-25,100];
  function evaluate(board, player) {
    const empty = board.filter(v => !v).length;
    return board.reduce((score, v, i) => score + v * player * (weights[i] + (empty < 16 ? 5 : 0)), 0)
      + 7 * (legalMoves(board, player).length - legalMoves(board, -player).length);
  }
  function search(board, player, depth, alpha, beta) {
    const moves = legalMoves(board, player);
    if (!moves.length) {
      if (!legalMoves(board, -player).length) {
        const difference = board.reduce((a, b) => a + b * player, 0);
        return difference === 0 ? 0 : Math.sign(difference) * 100000 + difference;
      }
      return -search(board, -player, depth, -beta, -alpha);
    }
    if (depth <= 0) return evaluate(board, player);
    moves.sort((a, b) => weights[b] - weights[a]);
    let best = -Infinity;
    for (const move of moves) {
      const score = -search(play(board, move, player), -player, depth - 1, -beta, -alpha);
      best = Math.max(best, score); alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }
  function chooseMove(board, player, level = 'normal') {
    if (level === 'strongest') return analyzeStrong(board, player).move;
    const moves = legalMoves(board, player);
    if (!moves.length) return null;
    if (level === 'easy') return moves[Math.floor(Math.random() * moves.length)];
    const depth = level === 'hard' ? 4 : 2;
    let best = -Infinity, choice = moves[0];
    for (const move of moves) {
      const score = -search(play(board, move, player), -player, depth - 1, -Infinity, Infinity);
      if (score > best) { best = score; choice = move; }
    }
    return choice;
  }
  // Iterative deepening keeps the best fully searched result within a time budget.
  // A padded board avoids row-wrap checks in the inner search loop.
  function analyzeStrong(board, player, { timeMs = 3000, maxDepth = 64 } = {}) {
    const cells = Array.from({ length: 64 }, (_, i) => 11 + (i >> 3) * 10 + i % 8);
    const offsets = [-11, -10, -9, -1, 1, 9, 10, 11];
    const position = new Int8Array(100).fill(2);
    const squareWeights = new Int16Array(100);
    cells.forEach((p, i) => { position[p] = board[i]; squareWeights[p] = weights[i]; });
    const empty = board.filter(v => !v).length;
    const deadline = performance.now() + Math.max(1, timeMs);
    const timeout = Symbol('search timeout');
    const table = new Map();
    let nodes = 0;
    function movesFor(color) {
      const moves = [];
      for (const p of cells) {
        if (position[p]) continue;
        const flips = [];
        for (const step of offsets) {
          let q = p + step;
          if (position[q] !== -color) continue;
          do { q += step; } while (position[q] === -color);
          if (position[q] !== color) continue;
          for (q = p + step; position[q] === -color; q += step) flips.push(q);
        }
        if (flips.length) moves.push({ p, flips });
      }
      return moves;
    }
    function heuristic(color, moves) {
      let score = 0, frontier = 0, discs = 0, occupied = 0;
      for (const p of cells) {
        const v = position[p];
        if (!v) continue;
        occupied++;
        discs += v * color;
        score += v * color * squareWeights[p];
        if (offsets.some(step => position[p + step] === 0)) frontier += v * color;
      }
      // Once a corner is owned, its adjacent squares cease to be dangerous.
      for (const [corner, stepA, stepB] of [[11, 1, 10], [18, -1, 10], [81, 1, -10], [88, -1, -10]]) {
        if (!position[corner]) continue;
        for (const p of [corner + stepA, corner + stepB, corner + stepA + stepB]) {
          score += position[p] * color * (12 - squareWeights[p]);
        }
        for (const step of [stepA, stepB]) {
          for (let p = corner + step; position[p] === position[corner]; p += step) score += position[p] * color * 25;
        }
      }
      return score + 18 * (moves.length - movesFor(-color).length) - 9 * frontier
        + discs * (occupied > 48 ? 8 : -2);
    }
    function searchStrong(color, depth, alpha, beta) {
      nodes++;
      if ((nodes & 127) === 0 && performance.now() >= deadline) throw timeout;
      const key = color + ':' + position.join('');
      const cached = table.get(key);
      const originalAlpha = alpha, originalBeta = beta;
      if (cached && cached.depth >= depth) {
        if (cached.flag === 'exact') return cached.score;
        if (cached.flag === 'lower') alpha = Math.max(alpha, cached.score);
        else beta = Math.min(beta, cached.score);
        if (alpha >= beta) return cached.score;
      }
      const moves = movesFor(color);
      if (!moves.length) {
        if (movesFor(-color).length) return -searchStrong(-color, depth, -beta, -alpha);
        const difference = cells.reduce((sum, p) => sum + position[p] * color, 0);
        return difference ? Math.sign(difference) * 1000000 + difference : 0;
      }
      if (depth <= 0) return heuristic(color, moves);
      moves.sort((a, b) => (b.p === cached?.move ? 10000 : squareWeights[b.p]) - (a.p === cached?.move ? 10000 : squareWeights[a.p]));
      let best = -Infinity, bestMove = moves[0].p;
      for (const move of moves) {
        position[move.p] = color;
        for (const p of move.flips) position[p] = color;
        let score;
        try { score = -searchStrong(-color, depth - 1, -beta, -alpha); }
        finally {
          position[move.p] = 0;
          for (const p of move.flips) position[p] = -color;
        }
        if (score > best) { best = score; bestMove = move.p; }
        alpha = Math.max(alpha, best);
        if (alpha >= beta) break;
      }
      if (table.size > 120000) table.clear();
      table.set(key, { depth, score: best, move: bestMove,
        flag: best <= originalAlpha ? 'upper' : best >= originalBeta ? 'lower' : 'exact' });
      return best;
    }
    const rootMoves = movesFor(player);
    if (!rootMoves.length) return { move: null, depth: 0, nodes, exact: !movesFor(-player).length };
    rootMoves.sort((a, b) => squareWeights[b.p] - squareWeights[a.p]);
    let result = { move: cells.indexOf(rootMoves[0].p), depth: 0, score: null, exact: false };
    for (let depth = 1; depth <= Math.min(empty, maxDepth); depth++) {
      if (performance.now() >= deadline) break;
      try {
        const score = searchStrong(player, depth, -Infinity, Infinity);
        const best = table.get(player + ':' + position.join(''));
        result = { move: cells.indexOf(best.move), depth, score, exact: depth >= empty };
        if (result.exact) break;
      } catch (error) { if (error !== timeout) throw error; break; }
    }
    return { ...result, nodes };
  }
  const api = { initialBoard, flips, legalMoves, play, chooseMove, analyzeStrong };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Othello = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
