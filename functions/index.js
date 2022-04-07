const functions = require('firebase-functions');
const { initializeApp } = require("firebase-admin/app");

exports.backend = functions.firestore.document('/games/{gameId}').onWrite(
  change => {
      const data = change.after.data()
      if (data.player1 && data.player2 && !data.board) {
        change.after.ref.update({
          board: newBoard(data.boardSize || 6),
          state: 'player1_move',
          lastMoveAndShot1: null,
          lastMoveAndShot2: null,
        })
      }

      if (data.board && checkWin(JSON.parse(data.board), change.after.ref)) return 0;

      if (data.state === 'player1_move' && data.lastMoveAndShot1) {
        const board = JSON.parse(data.board)
        const {move, shot} = JSON.parse(data.lastMoveAndShot1)
        if (validShot(validMove(board, move), shot)) {
          const nextBoard = JSON.stringify(makeShot(makeMove(board, move), shot, 'w'))
          const moveHistory = JSON.parse(data.moveHistory || '[]')
          const on = new Date().toISOString()
          moveHistory.push({move, shot, on})
          change.after.ref.update({
            board: nextBoard,
            state: 'player2_move',
            lastMoveAndShot2: null,
            moveHistory: JSON.stringify(moveHistory),
          })
        } else {
          change.after.ref.update({
            lastMoveAndShot1: null,
          })
        }
      }

      if (data.state === 'player2_move' && data.lastMoveAndShot2) {
        const board = JSON.parse(data.board)
        const {move, shot} = JSON.parse(data.lastMoveAndShot2)
        if (validShot(validMove(board, move), shot)) {
          const nextBoard = JSON.stringify(makeShot(makeMove(board, move), shot, 'b'))
          const moveHistory = JSON.parse(data.moveHistory || '[]')
          const on = new Date().toISOString()
          moveHistory.push({move, shot, on})
          change.after.ref.update({
            board: nextBoard,
            state: 'player1_move',
            lastMoveAndShot1: null,
            moveHistory: JSON.stringify(moveHistory),
          })
        } else {
          change.after.ref.update({
            lastMoveAndShot2: null,
          })
        }
      }
    }
)

const newBoard = (size) => {
  let b
  if (size === '6') {
    b = [
      [null, null, null, {color: 'b', type: 'q'}, null, null],
      [null, null, null, null, null, null],
      [{color: 'w', type: 'q'}, null, null, null, null, null],
      [null, null, null, null, null, {color: 'w', type: 'q'}],
      [null, null, null, null, null, null],
      [null, null, {color: 'b', type: 'q'}, null, null, null],
    ]
  } else {
    b = [
      [null, null, null, {color: 'b', type: 'q'}, null, null, {color: 'b', type: 'q'}, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [{color: 'b', type: 'q'}, null, null, null, null, null, null, null, null, {color: 'b', type: 'q'}],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [{color: 'w', type: 'q'}, null, null, null, null, null, null, null, null, {color: 'w', type: 'q'}],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, {color: 'w', type: 'q'}, null, null, {color: 'w', type: 'q'}, null, null, null],
    ]
  }
  return JSON.stringify(b);
}

const validMove = (board, move) => {
  return true
}

const validShot = (board, move) => {
  return true
}

const makeMove = (board, move) => {
  const piece = board[move.y][move.x]
  board[move.y][move.x] = null
  board[move.ny][move.nx] = piece
  return board
}

const makeShot = (board, shot, color) => {
  board[shot.ny][shot.nx] = {color: color, type: 'a' }
  return board
}

const checkWin = (b, game) => {
  const whiteQueens = []
  const blackQueens = []

  b.forEach((r, y) => {
    r.forEach((piece, x) => {
      if (piece) {
        if (piece.type === 'q' && piece.color === 'w') {
          whiteQueens.push([x,y])
        } else if (piece.type === 'q' && piece.color === 'b') {
          blackQueens.push([x,y])
        }
      }
    })
  })

  if (!whiteQueens.map(c => isStuck(c, b)).includes(false)) {
    game.update({state: 'player2_wins'})
    return true
  } else if (!blackQueens.map(c => isStuck(c,b)).includes(false)) {
    game.update({state: 'player1_wins'})
    return true
  }
}

const isStuck = (coord, b) => {
  const x = coord[0]
  const y = coord[1]
  let stuck = true
  const offsets = [[1,0], [1,-1], [0,-1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1,1]]

  for(c of offsets) {
    if (y+c[1] >= 0 && x+c[0] >= 0 && y+c[1] < b.length && x+c[0] < b.length && b[y+c[1]][x+c[0]] === null) {
      stuck = false
      break;
    }
  }

  return stuck;
}
