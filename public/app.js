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
    const $p1 = document.createElement('div')
    $p1.classList.add('dailyJoinWrapper')
    const $p2 = document.createElement('div')
    $p2.classList.add('dailyJoinWrapper')
    const player1 = r.data().player1
    const player2 = r.data().player2
    const $button = document.createElement('button')
    $button.classList.add('mdc-button', 'mdc-button--raised')
    const $i = document.createElement('i')
    $i.classList.add('material-icons', 'mdc-button__icon')
    $i.innerText = 'group'
    const $span = document.createElement('span')
    $span.classList.add('mdc-button__label')


    if (player1 && !player2) {
      const user = await db.collection('users').doc(player1).get()
      $p1.innerText = user.data().name
      $p2.appendChild($button)
      $span.innerText = 'Join as black'
    } else if (player2 && !player1) {
      const user = await db.collection('users').doc(player2).get()
      $p2.innerText = user.data().name
      $p1.appendChild($button)
      $span.innerText = 'Join as white'
    } else if (player1 && player2) {
      const user1 = await db.collection('users').doc(player1).get()
      const user2 = await db.collection('users').doc(player2).get()
      $p1.innerText = user1.data().name
      $p2.innerText = user2.data().name
    }
    $item.appendChild($p1)
    $item.appendChild($p2)
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
    const creator = await db.collection('users').doc(g.creatorId).get()
    if (g.oppoId) {
      const oppo = await db.collection('users').doc(g.oppoId).get()
      $text.innerText = `${creator.data().name} vs ${oppo.data().name}`
    } else {
      $text.innerText = `${creator.data().name} is waiting for opponent.`
    }
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
  const db = firebase.firestore();
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
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#refreshBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = false;
  document.querySelector(
      '#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;

  const db = firebase.firestore();
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
    state: 'player1_turn',
    player1: data.player1 || firebase.auth().getUid(),
    player2: data.player2 || firebase.auth().getUid(),
  })
  gotoDailyById(gameId)
}

async function gotoDailyById(gameId) {
  if (!firebase.auth().currentUser) { await signInAndSaveUser() }
  const db = firebase.firestore()
  const $p1 = document.querySelector('#player1')
  const $p2 = document.querySelector('#player2')
  const game = await db.collection('games').doc(gameId)
  const data = (await game.get()).data()
  const { player1, player2 } = data
  const p1 = await db.collection('users').doc(player1).get()
  const p2 = await db.collection('users').doc(player2).get()
  $p1.innerText = p1.data().name
  $p2.innerText = p2.data().name
  game.onSnapshot(async (data) => {
    const d = data.data()
    addChatMsg(`Status is ${d.state}`)
    if (d.board) draw(JSON.parse(d.board))
    if (d.state === 'player1_turn' && player1 === firebase.auth().getUid()) {
      await activateTurn('w', d.board)
    } else if (d.state === 'player2_turn' && player2 === firebase.auth().getUid()) {
      await activateTurn('b', d.board)
    }
  })
  hide('#rooms')
  hide('#dailies')
  hide('#mydailies')
  hide('#createBtn')
  hide('#createDailyBtn')
  hide('#refreshBtn')
  show('#leaveDailyBtn')
  show('#game', 'block')
}

let $selectedSquare
let abort = new AbortController()

async function activateTurn(color, board) {
  const b = JSON.parse(board)
  b.forEach((r, y) => {
    r.forEach((piece, x) => {
      if (piece?.color === color && piece?.type === 'q') {
        const key = `s${y * b.length + x}`
        const $square = document.getElementById(key)
        $square.classList.add('highlight')
        $square.addEventListener('click', (e) => selectedSquare(e, b, x, y), {signal: abort.signal})
      }
    })
  })
}

async function selectedSquare(e, board, x, y) {
  $selectedSquare = e.target
  Array.from(document.getElementsByClassName('square')).forEach($e =>
    $e.classList.remove('highlight', 'selected', 'possibleMove')
  )
  $selectedSquare.classList.add('selected')
  highlightPossibleSquares(board, x, y)
}

async function highlightPossibleSquares(b, x, y) {
  [[1,0], [1,-1], [0,-1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1,1]].forEach(c => {
    let dx = c[0]
    let dy = c[1]
    while(b[y+dy] && b[y+dy][x+dx] === null) {
      const key = `s${(y + dy) * b.length + x + dx}`
      const $square = document.getElementById(key)
      $square.classList.add('possibleMove')
      $square.addEventListener('click', moveToSquare.bind(this, b, x, y, x + dx, y + dy), {signal: abort.signal})
      dx += c[0]
      dy += c[1]
    }
  })
}

async function moveToSquare(b, x, y, nx, ny) {
  abort.abort()
  Array.from(document.getElementsByClassName('square')).forEach($e =>
    $e.classList.remove('highlight', 'selected', 'possibleMove')
  )
  console.log('moving from', x, y, 'to', nx, ny)
}
async function leaveDaily(e) {
    hide('#leaveDailyBtn')
    hide('#game')
    show('#createBtn')
    show('#createDailyBtn')
    show('#refreshBtn')
    show('#rooms', 'block')
    show('#dailies', 'block')
    show('#mydailies', 'block')
}

async function hangUp(e) {
  if (peerConnection) {
    peerConnection.close();
  }

  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';

  // Delete room on hangup
  if (roomId) {
    const db = firebase.firestore();
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

async function draw(board) {
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
