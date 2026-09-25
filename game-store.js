(function (root) {
  'use strict';
  const KEY = 'family-othello-save-v1';
  function validState(state) {
    return state && Array.isArray(state.board) && state.board.length === 64
      && state.board.every(v => v === 0 || v === 1 || v === -1)
      && (state.turn === 1 || state.turn === -1)
      && Number.isInteger(state.moveNumber) && state.moveNumber >= 0 && state.moveNumber <= 60
      && state.board.filter(Boolean).length === state.moveNumber + 4
      && (state.lastMove === null ? state.moveNumber === 0 : Number.isInteger(state.lastMove)
        && state.lastMove >= 0 && state.lastMove < 64 && state.board[state.lastMove] !== 0)
      && typeof state.finished === 'boolean' && typeof state.notice === 'string' && state.notice.length <= 500;
  }
  function validate(data) {
    const member = key => typeof key === 'string' && /^[a-z0-9_-]{1,32}$/.test(key);
    return !!(data && data.version === 1 && validState(data.state)
      && Array.isArray(data.history) && data.history.length === data.state.moveNumber
      && data.history.every((state, index) => validState(state) && state.moveNumber === index && !state.finished)
      && ['cpu', 'local'].includes(data.mode)
      && data.players && member(data.players['1']) && member(data.players['-1'])
      && data.players['1'] !== data.players['-1']
      && ['easy', 'normal', 'hard', 'strongest'].includes(data.difficulty)
      && typeof data.hints === 'boolean' && typeof data.victoryDismissed === 'boolean');
  }
  function read(storage) {
    try {
      const data = JSON.parse(storage.getItem(KEY));
      return validate(data) ? data : null;
    } catch { return null; }
  }
  function write(storage, data) {
    try { storage.setItem(KEY, JSON.stringify(data)); return true; }
    catch { return false; }
  }
  const api = { KEY, read, write, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
