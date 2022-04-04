const functions = require('firebase-functions');
const { initializeApp } = require("firebase-admin/app");
initializeApp({
        apiKey: "AIzaSyA-b92xdvZMaI0uh8opLc9S1_qh55HNixY",
        authDomain: "hippolyta-game.firebaseapp.com",
        projectId: "hippolyta-game",
        storageBucket: "hippolyta-game.appspot.com",
        messagingSenderId: "1061620854015",
        appId: "1:1061620854015:web:c84f282a52f4ee420bf0ca"
});

exports.backend = functions.firestore.document('/games/{gameId}').onWrite(
  change => {
      console.log(change)
      const data = change.after.data()
      if (data.player1 && data.player2 && !data.board) {
        change.after.ref.update({
          board: newBoard(),
          state: 'player1_move',
          lastMove1: null,
          lastShot1: null,
          lastMove2: null,
          lastShot2: null,
        })
      }

      if (checkWin(JSON.parse(data.board), change.doc.id)) return;

      if (data.state === 'player1_move' && data.lastMove1 && !data.lastShot1) {
        const board = JSON.parse(data.board)
        const move = JSON.parse(data.lastMove1)
        if (validMove(board, move)) {
          const nextBoard = JSON.stringify(makeMove(board, move))
          change.after.ref.update({
            board: nextBoard,
            state: 'player1_shoot',
          })
        } else {
          change.after.ref.update({
            lastMove1: null,
          })
        }
      }

      if (data.state === 'player1_shoot' && data.lastMove1 && data.lastShot1) {
        const board = JSON.parse(data.board)
        const shot = JSON.parse(data.lastShot1)
        if (validShot(board, shot)) {
          const nextBoard = JSON.stringify(makeShot(board, shot, 'w'))
          change.after.ref.update({
            board: nextBoard,
            state: 'player2_move',
            lastMove2: null,
            lastShot2: null,
          })
        } else {
          change.after.ref.update({
            lastShot1: null,
          })
        }
      }

      if (data.state === 'player2_move' && data.lastMove2 && !data.lastShot2) {
        const board = JSON.parse(data.board)
        const move = JSON.parse(data.lastMove2)
        if (validMove(board, move)) {
          const nextBoard = JSON.stringify(makeMove(board, move))
          change.after.ref.update({
            board: nextBoard,
            state: 'player2_shoot',
          })
        } else {
          change.after.ref.update({
            lastMove2: null,
          })
        }
      }

      if (data.state === 'player2_shoot' && data.lastMove2 && data.lastShot2) {
        const board = JSON.parse(data.board)
        const shot = JSON.parse(data.lastShot2)
        if (validShot(board, shot)) {
          const nextBoard = JSON.stringify(makeShot(board, shot, 'w'))
          change.after.ref.update({
            board: nextBoard,
            state: 'player1_move',
            lastMove1: null,
            lastShot1: null,
          })
        } else {
          change.after.ref.update({
            lastShot2: null,
          })
        }
      }

    }
)

const newBoard = () => (JSON.stringify(
  [
    [null, null, null, {color: 'b', type: 'q'}, null, null],
    [null, null, null, null, null, null],
    [{color: 'w', type: 'q'}, null, null, null, null, null],
    [null, null, null, null, null, {color: 'w', type: 'q'}],
    [null, null, null, null, null, null],
    [null, null, {color: 'b', type: 'q'}, null, null, null],
  ]
))

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

const checkWin = (b, gameId) => {
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
    firestore().collection('games').doc(gameId).update({state: 'player2_wins'})
    return true
  } else if (!blackQueens.map(c => isStuck(c,b)).includes(false)) {
    firestore().collection('games').doc(gameId).update({state: 'player1_wins'})
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
