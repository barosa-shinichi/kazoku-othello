'use strict';
importScripts('engine.js');
self.onmessage = ({ data: { board, player, level } }) => {
  self.postMessage({ move: self.Othello.chooseMove(board, player, level) });
};
