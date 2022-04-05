mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'))

const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
}

let peerConnection = null
let roomDialog = null
let nameDialog = null
let roomId = null
let dataChannel
let userName = 'Guest'
let oppoName = 'Opponent'
let answererBecomingOfferer = false

const hide = (q) => {
  document.querySelector(q).style.display = 'none';
}

const show = (q, d) => {
  const $e = document.querySelector(q)
  $e.classList.remove('hidden')
  $e.style.display = d || 'inline-block';
}

function init() {
  document.querySelector('#hangupBtn').addEventListener('click', hangUp)
  document.querySelector('#leaveDailyBtn').addEventListener('click', leaveDaily)
  document.querySelector('#createBtn').addEventListener('click', () => { createRoom() })
  document.querySelector('#refreshBtn').addEventListener('click', refreshRooms)
  document.querySelector('#createDailyBtn').addEventListener('click', createDailyGame)
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'))
  nameDialog = new mdc.dialog.MDCDialog(document.querySelector('#name-dialog'))
  // nameDialog.open()
  document.querySelector('#submitName').addEventListener('click', submitName)
  document.querySelector('#user-name').addEventListener('keypress', typeUserName)
  document.querySelector('#playAsWhite').addEventListener('click', () => playDailyGame('white'))
  document.querySelector('#playAsBlack').addEventListener('click', () => playDailyGame('black'))
  document.querySelector('#playAsRandom').addEventListener('click', () => playDailyGame(Math.round(Math.random()) ? 'white' : 'black'))
  document.querySelector('#signInBtn').addEventListener('click', signIn)
  if (location.host === 'localhost') {
    firebase.firestore().settings({host: 'localhost:4102', ssl: false})
  }
  const unsub = firebase.auth().onAuthStateChanged(user => {
    unsub()
    if (user) {
      show('#createDailyBtn')
      show('#refreshBtn')
    } else {
      show('#signInBtn')
    }
  })
}

async function signIn() {
  await signInAndSaveUser()
  hide('#signInBtn')
  show('#createDailyBtn')
  show('#refreshBtn')
}

async function signInAndSaveUser() {
  const result = await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
  const db = firebase.firestore()
  let user
  user = await db.collection('users').doc(firebase.auth().getUid())
  if (!user) {
    user = await db.collection('users').doc()
  }
  user.set({id: firebase.auth().getUid(), name: firebase.auth().currentUser.displayName})
}

async function createDailyGame() {
  if (!firebase.auth().currentUser) { await signInAndSaveUser() }
  hide('#rooms')
  hide('#dailies')
  hide('#mydailies')
  hide('#createBtn')
  hide('#createDailyBtn')
  hide('#refreshBtn')
  show('#playAsBlack')
  show('#playAsWhite')
  show('#playAsRandom')
}

async function playDailyGame(color) {
  hide('#playAsBlack')
  hide('#playAsWhite')
  hide('#playAsRandom')
  const game = await firebase.firestore().collection('games').doc()
  await game.set({
    creatorId: firebase.auth().getUid(),
    player1: color === 'white' ? firebase.auth().getUid() : null,
    player2: color === 'black' ? firebase.auth().getUid() : null,
    state: 'waitingForOpponent',
    createdOn: new Date().toISOString(),
  })
  gotoDailyById(game.id)
}

async function typeUserName(e) {
  if (e.key === 'Enter') {
    submitName()
    nameDialog.close()
  }
}

async function submitName() {
  userName = document.querySelector('#user-name').value
}

async function refreshRooms() {
  const $list = document.querySelector('#rooms ul')
  const db = firebase.firestore();
  const rooms = await db.collection('rooms').get()
  $list.innerHTML = ''
  rooms.docs.forEach(r => {
    const $item = document.createElement('li')
    const $text = document.createElement('span')
    $text.innerText = r.data().offerer
    $item.appendChild($text)
    const $button = document.createElement('button')
    $button.classList.add('mdc-button', 'mdc-button--raised')
    const $i = document.createElement('i')
    $i.classList.add('material-icons', 'mdc-button__icon')
    $i.innerText = 'group'
    const $span = document.createElement('span')
    $span.classList.add('mdc-button__label')
    $span.innerText = 'Join game'
    $button.appendChild($i)
    $button.appendChild($span)
    $button.addEventListener('click', (e) => { joinRoomById(r.id) })
    $item.appendChild($button)
    $list.appendChild($item)
  })

  const $dlist = document.querySelector('#dailies ul')
  const games = await db.collection('games').get()
  $dlist.innerHTML = ''
  games.docs.forEach(async (r) => {
    const $item = document.createElement('li')
    const $text = document.createElement('span')
    const $p1 = document.createElement('span')
    const $p2 = document.createElement('span')
    const player1 = r.data().player1
    const player2 = r.data().player2
    const $button = document.createElement('button')
    $button.classList.add('mdc-button', 'mdc-button--raised')
    const $i = document.createElement('i')
    $i.classList.add('material-icons', 'mdc-button__icon')
    $i.innerText = 'group'
    const $span = document.createElement('span')
    $span.classList.add('mdc-button__label')

    if (player1 === firebase.auth().getUid() || player2 === firebase.auth().getUid()) { return }

    if (player1 && !player2) {
      const user = await db.collection('users').doc(player1).get()
      $p1.innerText = user.data().name
      $span.innerText = 'Join as black'
      $item.appendChild($p1)
      $item.appendChild($button)
    } else if (player2 && !player1) {
      const user = await db.collection('users').doc(player2).get()
      $p2.innerText = user.data().name
      $span.innerText = 'Join as white'
      $item.appendChild($button)
      $item.appendChild($p2)
    } else if (player1 && player2) {
      const user1 = await db.collection('users').doc(player1).get()
      const user2 = await db.collection('users').doc(player2).get()
      $p1.innerText = user1.data().name
      $p2.innerText = user2.data().name
      $item.appendChild($p1)
      $item.appendChild($p2)
    }
    $button.appendChild($i)
    $button.appendChild($span)
    $button.addEventListener('click', (e) => { joinDailyById(r.id) })
    $dlist.appendChild($item)
  })

  const $mddlist = document.querySelector('#mydailies ul')
  const myCreatorGames = await db.collection('games').where('creatorId', '==', firebase.auth().getUid()).get()
  const myOppoGames = await db.collection('games').where('oppoId', '==', firebase.auth().getUid()).get()
  const myGames = {}
  myCreatorGames.forEach(g => myGames[g.id] = g.data())
  myOppoGames.forEach(g => myGames[g.id] = g.data())

  $mddlist.innerHTML = ''
  Object.entries(myGames).forEach(async (v, k) => {
    const id = v[0]
    const g = v[1]
    const $item = document.createElement('li')
    const $text = document.createElement('span')
    $text.classList.add('details')
    const $date = document.createElement('span')
    $date.classList.add('date')
    const creator = await db.collection('users').doc(g.creatorId).get()
    let date
    if (g.createdOn) {
      date = luxon.DateTime.fromISO(g.createdOn).toLocaleString({ month: 'short', day: 'numeric' })
    } else {
      date = 'Unknown date'
    }
    $date.innerText = date

    if (g.oppoId) {
      const oppo = await db.collection('users').doc(g.oppoId).get()
      $text.innerText = `${creator.data().name} vs ${oppo.data().name}`
    } else {
      $text.innerText = `Waiting for opponent`
    }
    $item.appendChild($date)
    $item.appendChild($text)
    const $button = document.createElement('button')
    $button.classList.add('mdc-button', 'mdc-button--raised')
    const $i = document.createElement('i')
    $i.classList.add('material-icons', 'mdc-button__icon')
    const $span = document.createElement('span')
    $span.classList.add('mdc-button__label')
    if (g.state.includes("_wins")) {
      $i.innerText = 'visibility'
      $span.innerText = 'View game'
    } else {
      $i.innerText = 'group'
      $span.innerText = 'Join game'
    }
    $button.appendChild($i)
    $button.appendChild($span)
    $button.addEventListener('click', (e) => { gotoDailyById(id) })
    $item.appendChild($button)
    $mddlist.appendChild($item)
  })
}

async function createRoom(roomId) {
  hide('#rooms')
  hide('#createBtn')
  hide('#refreshBtn')
  hide('#leaveDailyBtn')
  show('#hangupBtn')
  const db = firebase.firestore()

  let roomRef
  const roomExists = !!roomId
  if (!roomExists) {
    roomRef = await db.collection('rooms').doc();
  } else {
    roomRef = await db.collection('rooms').doc(roomId);
  }

  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners()

  const callerCandidatesCollection = roomRef.collection('callerCandidates');

  peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) {
      return;
    }
    callerCandidatesCollection.add(event.candidate.toJSON());
  });

  const offer = await peerConnection.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true});
  await peerConnection.setLocalDescription(offer);

  peerConnection.addEventListener('connectionstatechange', async () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
    if (peerConnection.connectionState === 'failed') {
      await peerConnection.close()
      console.log(`resetting with roomid=${roomId}`)
      createRoom(roomId)
    }
  });

  const roomWithOffer = {
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
    offerer: userName,
    answer: null,
    answerer: null,
  };
  await roomRef.set(roomWithOffer);
  if (roomExists) {
    debugger;
    const candidates = await roomRef.collection('callerCandidates').get()
    await candidates.docs.forEach(async (c) => { await roomRef.collection('callerCandidates').doc(c.id).delete() })
  }
  console.log(`roomId: ${roomId}, roomRef.id: ${roomRef.id}`)
  roomId = roomRef.id;
  document.querySelector(
      '#currentRoom').innerText = `Current room is ${roomRef.id} - You are the caller!`;

  if (!roomExists || answererBecomingOfferer) {
    answererBecomingOfferer = false
    roomRef.onSnapshot(async snapshot => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data && data.answer) {
        roomRef.collection('calleeCandidates').onSnapshot(snapshot => {
          snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
              let data = change.doc.data();
              await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
          });
        });

        const rtcSessionDescription = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(rtcSessionDescription);
        oppoName = data.answerer
        addChatMsg(`${oppoName} joined the game.`)
      }
    });
  }

  addChatMsg('Waiting for opponent to join.')
}

async function joinRoomById(roomId) {
  hide('#rooms')
  document.querySelector(
      '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;

  const db = firebase.firestore()
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();

  if (roomSnapshot.exists) {
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();

    peerConnection.addEventListener('connectionstatechange', async () => {
      console.log(`Connection state change: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'failed') {
        await peerConnection.close()
        unsubscribeCallerCandidates()
        answererBecomingOfferer = true
        createRoom(roomId)
      }
    })

    const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
    peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        return;
      }
      calleeCandidatesCollection.add(event.candidate.toJSON());
    });

    const offer = roomSnapshot.data().offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer({offerToReceiveAudio: true, offerToReceiveVideo: true});
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
      answerer: userName,
    };
    await roomRef.update(roomWithAnswer);

    const unsubscribeCallerCandidates = roomRef.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          await peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  }
}

async function joinDailyById(gameId) {
  if (!firebase.auth().currentUser) { await signInAndSaveUser() }
  const db = firebase.firestore()
  const game = await db.collection('games').doc(gameId)
  const data = (await game.get()).data()
  await game.update({
    oppoId: firebase.auth().getUid(),
    player1: data.player1 || firebase.auth().getUid(),
    player2: data.player2 || firebase.auth().getUid(),
  })
  gotoDailyById(gameId)
}

let dontDraw = false
let unsubGame

async function gotoDailyById(gameId) {
  show('#game')
  if (!firebase.auth().currentUser) { await signInAndSaveUser() }
  const $board = document.querySelector('#board')
  $board.innerHTML = '' // clear the existing chess board HTML
  const $chatLog = document.querySelector('#chatLog')
  $chatLog.innerText = ''
  const db = firebase.firestore()
  const $p1 = document.querySelector('#player1')
  const $p2 = document.querySelector('#player2')
  const game = await db.collection('games').doc(gameId)
  const data = (await game.get()).data()
  const { player1, player2 } = data
  if (player1) {
    const p1 = await db.collection('users').doc(player1).get()
    $p1.innerText = p1.data().name
  } else {
    $p1.innerText = 'Waiting'
  }
  if (player2) {
    const p2 = await db.collection('users').doc(player2).get()
    $p2.innerText = p2.data().name
  } else {
    $p2.innerText = 'Waiting'
  }
  game.onSnapshot(async (data) => {
    const d = data.data()
    if (d.board && !dontDraw) {
      draw(JSON.parse(d.board))
    }
    dontDraw = false
    if (d.player2 && $p2.innerText === 'Waiting') {
      const p2 = await db.collection('users').doc(d.player2).get()
      $p2.innerText = p2.data().name
    }
    if (d.player1 && $p1.innerText === 'Waiting') {
      const p1 = await db.collection('users').doc(d.player1).get()
      $p1.innerText = p1.data().name
    }
    if (d.state === 'player1_move') {
      $p1.classList.add('active')
      $p2.classList.remove('active')
      if (player1 === firebase.auth().getUid() && d.lastMoveAndShot1 === null) {
        await activateMoveTurn('w', d.board, gameId)
      }
      showLastMoveAndShot(d.board, d.lastMoveAndShot2)
    } else if (d.state === 'player2_move') {
      $p2.classList.add('active')
      $p1.classList.remove('active')
      if (player2 === firebase.auth().getUid() && d.lastMoveAndShot2 === null) {
        await activateMoveTurn('b', d.board, gameId)
      }
      showLastMoveAndShot(d.board, d.lastMoveAndShot1)
    } else if (d.state === 'player1_wins') {
      addChatMsg('White wins!')
      Array.from(document.getElementsByClassName('highlight')).forEach($e =>
        $e.classList.remove('highlight')
      )
      abort.abort()
      draw(JSON.parse(d.board))
    } else if (d.state === 'player2_wins') {
      addChatMsg('Black wins!')
      Array.from(document.getElementsByClassName('highlight')).forEach($e =>
        $e.classList.remove('highlight')
      )
      abort.abort()
      draw(JSON.parse(d.board))
    }
  })
  hide('#rooms')
  hide('#dailies')
  hide('#mydailies')
  hide('#createBtn')
  hide('#createDailyBtn')
  hide('#refreshBtn')
  hide('#leaveDailyBtn')
  show('#game', 'block')
}

let abort

async function showLastMoveAndShot(board, moveAndShot) {
  if (!moveAndShot) return;
  Array.from(document.getElementsByClassName('lastMove')).forEach($e =>
    $e.classList.remove('lastMove')
  )
  Array.from(document.getElementsByClassName('lastShot')).forEach($e =>
    $e.classList.remove('lastShot')
  )
  const b = JSON.parse(board)
  const mands = JSON.parse(moveAndShot)
  const m = mands.move
  const s = mands.shot
  let key = `s${m.ny * b.length + m.nx}`
  let $square = document.getElementById(key)
  $square.classList.add('lastMove')
  key = `s${s.ny * b.length + s.nx}`
  $square = document.getElementById(key)
  $square.classList.add('lastShot')
}

async function activateMoveTurn(color, board, gameId) {
  const b = JSON.parse(board)
  abort = new AbortController()
  b.forEach((r, y) => {
    r.forEach((piece, x) => {
      if (piece?.color === color && piece?.type === 'q') {
        const key = `s${y * b.length + x}`
        const $square = document.getElementById(key)
        $square.classList.add('highlight')
        $square.addEventListener('click', (e) => selectedMoveSquare(e, b, x, y, gameId, color), {signal: abort.signal})
      }
    })
  })
}

async function activateShootTurn(color, b, lm, gameId) {
  abort = new AbortController()
  const x = lm.nx
  const y = lm.ny
  const key = `s${y * b.length + x}`
  const $square = document.getElementById(key)
  $square.classList.add('selected')
  highlightPossibleShootSquares(b, x, y, gameId, color, lm)
}

async function selectedMoveSquare(e, b, x, y, gameId, color) {
  const $selectedSquare = e.target
  Array.from(document.getElementsByClassName('square')).forEach($e =>
    $e.classList.remove('highlight', 'selected', 'possibleMove', 'possibleShoot')
  )
  $selectedSquare.classList.add('selected')
  highlightPossibleMoveSquares(b, x, y, gameId, color)
}

async function highlightPossibleShootSquares(b, x, y, gameId, color, lm) {
  [[1,0], [1,-1], [0,-1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1,1]].forEach(c => {
    let dx = c[0]
    let dy = c[1]
    while(b[y+dy] && b[y+dy][x+dx] === null) {
      const key = `s${(y + dy) * b.length + x + dx}`
      const $square = document.getElementById(key)
      $square.classList.add('possibleShoot')
      $square.addEventListener('click', shootToSquare.bind(this, b, x, y, x + dx, y + dy, gameId, color, lm), {signal: abort.signal})
      dx += c[0]
      dy += c[1]
    }
  })
}

async function highlightPossibleMoveSquares(b, x, y, gameId, color) {
  [[1,0], [1,-1], [0,-1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1,1]].forEach(c => {
    let dx = c[0]
    let dy = c[1]
    while(b[y+dy] && b[y+dy][x+dx] === null) {
      const key = `s${(y + dy) * b.length + x + dx}`
      const $square = document.getElementById(key)
      $square.classList.add('possibleMove')
      $square.addEventListener('click', moveToSquare.bind(this, b, x, y, x + dx, y + dy, gameId, color), {signal: abort.signal})
      dx += c[0]
      dy += c[1]
    }
  })
}

async function moveToSquare(b, x, y, nx, ny, gameId, color) {
  abort.abort()
  Array.from(document.getElementsByClassName('square')).forEach($e =>
    $e.classList.remove('highlight', 'selected', 'possibleMove')
  )
  const key = color === 'w' ? 'lastMove1' : 'lastMove2'
  const lastMove = {x,y,nx,ny}
  // await firebase.firestore().collection('games').doc(gameId).update({[key]: JSON.stringify({x,y,nx,ny})})
  const piece = b[y][x]
  b[y][x] = null
  b[ny][nx] = piece
  draw(b)
  activateShootTurn(color, b, lastMove, gameId)
}

async function shootToSquare(b, x, y, nx, ny, gameId, color, lm) {
  abort.abort()
  Array.from(document.getElementsByClassName('square')).forEach($e =>
    $e.classList.remove('highlight', 'selected', 'possibleMove')
  )
  const key = color === 'w' ? 'lastMoveAndShot1' : 'lastMoveAndShot2'
  b[ny][nx] = {color: color, type: 'a'}
  draw(b)
  dontDraw = true
  await firebase.firestore().collection('games').doc(gameId).update({[key]: JSON.stringify({
    move: lm,
    shot: {x,y,nx,ny},
  })})
}

async function leaveDaily(e) {
    prevBoardString = null
    hide('#leaveDailyBtn')
    hide('#game')
    //show('#createBtn')
    show('#createDailyBtn')
    show('#refreshBtn')
    //show('#rooms', 'block')
    show('#dailies', 'block')
    show('#mydailies', 'block')
}

async function hangUp(e) {
  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector('#currentRoom').innerText = '';

  // Delete room on hangup
  if (roomId) {
    const db = firebase.firestore()
    const roomRef = db.collection('rooms').doc(roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.ref.delete();
    });
    await roomRef.delete();
  }

  document.location.reload(true);
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

async function addChatMsg(msg) {
  document.querySelector('#chatLog').innerText += `\n${msg}`
}
let prevBoardString
async function draw(board) {
  if (JSON.stringify(board) == prevBoardString) return
  prevBoardString = JSON.stringify(board)
  const $board = document.querySelector('#board')
  $board.innerHTML = '' // clear the existing chess board HTML

  // create the chessboard HTML
  for(id of Array(board.length * board[0].length).keys()) {
    const $div = document.createElement('div')
    const $label1 = document.createElement('label')
    const $label2 = document.createElement('div')
    const $darkener = document.createElement('div')
    $darkener.classList.add('darkener')
    $label1.classList.add('piece')
    $label2.classList.add('control')
    $div.classList.add('square')
    $div.style.flexBasis = (100/board.length) + '%'
    $div.id = `s${id}`
    if ((id%2 ? 0 : 1) === Math.floor(id/board.length)%2) {
      $div.appendChild($darkener)
    }
    $div.appendChild($label1)
    $div.appendChild($label2)
    $board.appendChild($div)
  }

  board.forEach((r, y) => {
    r.forEach((piece, x) => {
      if (piece) {
        const key = `s${y * board.length + x}`
        const $square = document.getElementById(key)
        const $piece = $square.getElementsByClassName('piece')[0]
        $piece.innerHTML = (svgs[piece?.type || ''] || {})[piece?.color || ''] || ''
      }
    })
  })
}

init()
// refreshRooms()
