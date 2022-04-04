const startBackend = () => {
  console.log('starting backend')
  firebase.firestore().collection('games').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(change => {
      const data = change.doc.data()
      if (data.player1 && data.player2 && !data.board) {
        firebase.firestore().collection('games').doc(change.doc.id).update({board: newBoard()})
      }
    })
  })
}

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
