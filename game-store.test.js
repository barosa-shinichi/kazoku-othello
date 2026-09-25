'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const Store = require('./game-store.js');
function opening() {
  return { board: E.initialBoard(), turn: 1, lastMove: null, moveNumber: 0, finished: false, notice: '' };
}
function savedGame() {
  const initial = opening();
  return {
    version: 1, state: { ...initial, board: E.play(initial.board, 19, 1), turn: -1, lastMove: 19, moveNumber: 1 },
    history: [initial], mode: 'local', players: { '1': 'neko', '-1': 'kuma' },
    difficulty: 'strongest', hints: false, victoryDismissed: false
  };
}
test('saving preserves the board, undo history and family settings', () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) };
  const original = savedGame();
  assert.equal(Store.write(storage, original), true);
  assert.deepEqual(Store.read(storage), original);
});
test('invalid or partially written saves are ignored', () => {
  const cases = [null, {}, { ...savedGame(), version: 3 }, { ...savedGame(), history: [] },
    { ...savedGame(), players: { '1': 'panda', '-1': 'panda' } },
    { ...savedGame(), state: { ...opening(), board: [1, -1] } },
    { ...savedGame(), state: { ...savedGame().state, turn: 0 } }];
  for (const value of cases) assert.equal(Store.read({ getItem: () => JSON.stringify(value) }), null);
  assert.equal(Store.read({ getItem: () => '{broken' }), null);
});
test('storage denial does not break gameplay', () => {
  const denied = { setItem: () => { throw Error('full'); }, getItem: () => { throw Error('denied'); } };
  assert.equal(Store.write(denied, savedGame()), false);
  assert.equal(Store.read(denied), null);
});
