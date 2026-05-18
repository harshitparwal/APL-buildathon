// ==========================================
// ADMIN & FIREBASE SETUP
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('admin') === 'true';

// firebaseConfig is loaded externally from firebase-config.js
// Initialize Firebase
let db = null;
if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();


    if (isAdmin) {
        // Reset match state on admin load to clear any stuck sessions
        db.ref('global_state/matchActive').set(false);
        // Ensure state resets if admin closes the browser tab mid-match
        db.ref('global_state/matchActive').onDisconnect().set(false);
    }

    // Listen for all game events
    db.ref('events').on('child_added', (snapshot) => {
        handleSyncEvent(snapshot.val());
    });

    // Listen for global state (Match Active toggle)
    db.ref('global_state/matchActive').on('value', (snapshot) => {
        const isActive = snapshot.val();
        if (!isAdmin) {
            if (isActive) {
                document.getElementById('audience-waiting')?.classList.add('hidden');
                document.getElementById('btn-join-sim')?.classList.remove('hidden');
            } else {
                document.getElementById('audience-waiting')?.classList.remove('hidden');
                document.getElementById('btn-join-sim')?.classList.add('hidden');

                // If the audience is actively viewing the simulation (mode-selection is hidden) 
                // and the Admin disconnects abruptly, pull them to the Result screen.
                if (document.getElementById('mode-selection')?.classList.contains('hidden')) {
                    endMatch(true);
                }
            }
        }
    });
}

// Fallback for local testing if Firebase is blocked
const channel = new BroadcastChannel('fanpulse_sync');

function broadcastEvent(type, payload) {
    if (db) {
        db.ref('events').push({ type, payload });
    } else {
        channel.postMessage({ type, payload });
        handleSyncEvent({ type, payload });
    }
}

channel.onmessage = (event) => {
    if (!db) handleSyncEvent(event.data);
};

// Handle Audience/Admin UI on load
document.addEventListener('DOMContentLoaded', () => {
    if (isAdmin) {
        document.getElementById('admin-controls').style.display = 'flex';
        document.getElementById('match-title-input').disabled = false;
    } else {
        document.getElementById('audience-controls').style.display = 'flex';
        document.getElementById('match-title-input').disabled = true;
    }

    // Audience Join Button
    document.getElementById('btn-join-sim')?.addEventListener('click', () => {
        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('scoreboard').classList.remove('hidden');
        document.getElementById('interactive-row').classList.remove('hidden');
        document.getElementById('call-the-ball').classList.remove('hidden');
        document.getElementById('live-pulse').classList.remove('hidden');
    });
});

// ==========================================
// STATE & DOM ELEMENTS
// ==========================================
let pulseScore = 50; // 0 to 100

// Match State
let matchRuns = 0;
let matchWickets = 0;
let matchBalls = 0;
const MAX_BALLS = 30; // 5 overs
let userScore = 0;
let matchActive = true;

function resetMatchState() {
    matchRuns = 0;
    matchWickets = 0;
    matchBalls = 0;
    userScore = 0;
    pulseScore = 50;
    matchActive = true;
    autoSimActive = false;

    if (matchScoreEl) matchScoreEl.textContent = '0/0';
    if (matchOversEl) matchOversEl.innerHTML = `0.0 <span style="font-size: 1rem; color: var(--warning);">(5)</span>`;
    if (userScoreEl) userScoreEl.textContent = '0';
    pulseBar.style.width = `50%`;
    if (matchStatusEl) matchStatusEl.style.display = 'none';

    document.getElementById('result-screen')?.classList.add('hidden');
    document.getElementById('ephemeral-chat')?.classList.add('hidden');
    document.getElementById('armchair-umpire')?.classList.add('hidden');
}

function endMatch(isFromNetwork = false) {
    if (matchActive === false) return; // Prevent loops

    autoSimActive = false;
    matchActive = false;
    clearTimeout(autoSimTimeout);

    document.getElementById('scoreboard')?.classList.add('hidden');
    document.getElementById('interactive-row')?.classList.add('hidden');
    document.getElementById('call-the-ball')?.classList.add('hidden');
    document.getElementById('live-pulse')?.classList.add('hidden');
    document.getElementById('ephemeral-chat')?.classList.add('hidden');
    document.getElementById('armchair-umpire')?.classList.add('hidden');
    document.getElementById('btn-stop-sim')?.classList.add('hidden');

    const matchTitleInput = document.getElementById('match-title-input');
    if (matchTitleInput && isAdmin) matchTitleInput.disabled = false;

    if (isAdmin && db && !isFromNetwork) {
        db.ref('global_state/matchActive').set(false);
        db.ref('events').push({ type: 'match_ended' });
    }

    const overs = Math.floor(matchBalls / 6) + '.' + (matchBalls % 6);
    const scoreEl = document.getElementById('res-score');
    if (scoreEl) scoreEl.textContent = `${matchRuns}/${matchWickets}`;
    const oversEl = document.getElementById('res-overs');
    if (oversEl) oversEl.textContent = overs;
    const pointsEl = document.getElementById('res-points');
    if (pointsEl) pointsEl.textContent = userScore;
    const pulseEl = document.getElementById('res-pulse');
    if (pulseEl) pulseEl.textContent = `${Math.round(pulseScore)}%`;

    const wasInGame = document.getElementById('mode-selection')?.classList.contains('hidden');
    
    if (wasInGame) {
        document.getElementById('result-screen')?.classList.remove('hidden');
    }
    
    document.getElementById('mode-selection')?.classList.remove('hidden');
}

const matchScoreEl = document.getElementById('match-score');
const matchOversEl = document.getElementById('match-overs');
const userScoreEl = document.getElementById('user-score');
const matchStatusEl = document.getElementById('match-status');

let currentPrediction = null; // Store user's prediction
let currentVote = null; // Store user's vote

// Call the Ball
const sectionCallTheBall = document.getElementById('call-the-ball');
const predTimer = document.getElementById('prediction-timer');
const predButtons = document.querySelectorAll('.pred-btn');
const predResult = document.getElementById('prediction-result');
let predictionActive = false;

// Pulse
const pulseBar = document.getElementById('pulse-bar');
const reactButtons = document.querySelectorAll('.react-btn');

// Umpire
const sectionUmpire = document.getElementById('armchair-umpire');
const voteButtons = document.querySelectorAll('.vote-btn');
const voteResults = document.getElementById('vote-results');
const voteFinalVerdict = document.getElementById('vote-final-verdict');
const barOut = document.getElementById('bar-out');
const barNotOut = document.getElementById('bar-not-out');
const pctOut = document.getElementById('pct-out');
const pctNotOut = document.getElementById('pct-not-out');
let votes = { out: 0, notOut: 0 };

// Chat
const sectionChat = document.getElementById('ephemeral-chat');
const chatRoomTitle = document.getElementById('chat-room-title');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChat = document.getElementById('send-chat');

// ==========================================
// EVENT HANDLERS (Sending Data)
// ==========================================

// 1. Reactions
reactButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        // Simple mock logic: 🔥/🤯 increase pulse, 😡/🥶 decrease
        let change = (emoji === '🔥' || emoji === '🤯') ? 5 : -5;
        broadcastEvent('reaction', { emoji, change });

        // Visual feedback on button
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => btn.style.transform = 'scale(1)', 100);
    });
});

// 2. Predictions
predButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        predButtons.forEach(b => {
            b.classList.remove('selected');
            b.disabled = true;
        });
        btn.classList.add('selected');
        currentPrediction = btn.getAttribute('data-val');

        if (!predictionActive) {
            predResult.innerHTML = `You predicted: <strong>${btn.textContent}</strong>. <br><span style="font-size: 0.9rem; color: var(--warning);">Validating outcome...</span>`;
            setTimeout(() => {
                if (!matchActive) return;
                const results = ['dot', 'single', 'boundary', 'wicket'];
                const randomResult = results[Math.floor(Math.random() * results.length)];
                let exactRuns = 0;
                if (randomResult === 'single') exactRuns = Math.floor(Math.random() * 3) + 1;
                else if (randomResult === 'boundary') exactRuns = Math.random() > 0.5 ? 4 : 6;
                broadcastEvent('admin_resolve_ball', { result: randomResult, runs: exactRuns });

                setTimeout(() => {
                    if (!autoSimActive && matchActive) {
                        predButtons.forEach(b => b.disabled = false);
                        predResult.textContent = 'Make your prediction!';
                    }
                }, 4000);
            }, 2500);
        } else {
            predResult.textContent = `You predicted: ${btn.textContent}. Waiting for ball...`;
        }
    });
});

// 3. Umpire Votes
voteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const vote = btn.getAttribute('data-val');
        currentVote = vote;
        broadcastEvent('umpire_vote', { vote });
        voteResults.style.display = 'block';
        voteButtons.forEach(b => {
            b.disabled = true;
            b.classList.remove('selected');
        });
        btn.classList.add('selected');
    });
});

// 4. Chat
sendChat.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text) {
        broadcastEvent('chat_msg', { text, sender: 'Fan' + Math.floor(Math.random() * 1000) });
        chatInput.value = '';
    }
});
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat.click();
});

// ==========================================
// EVENT SYNC (Receiving Data)
// ==========================================
function handleSyncEvent(data) {
    if (!data) return;
    const { type, payload } = data;

    if (type === 'match_reset') {
        if (!autoSimActive) {
            resetMatchState();
            const matchTitleInput = document.getElementById('match-title-input');
            if (matchTitleInput && payload && payload.title) {
                matchTitleInput.value = payload.title;
            }
        }
    }
    else if (type === 'match_ended') {
        endMatch(true);
    }
    else if (type === 'reaction') {
        pulseScore = Math.max(0, Math.min(100, pulseScore + payload.change));
        pulseBar.style.width = `${pulseScore}%`;
    }
    else if (type === 'umpire_vote') {
        if (payload.vote === 'out') votes.out++;
        else votes.notOut++;
        updateVoteUI();
    }
    else if (type === 'chat_msg') {
        const msgEl = document.createElement('div');
        msgEl.className = 'msg';
        msgEl.innerHTML = `<strong>${payload.sender}:</strong> ${payload.text}`;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    else if (type === 'admin_next_ball') {
        startPredictionTimer();
    }
    else if (type === 'admin_review') {
        sectionUmpire.classList.remove('hidden');
        const drsTimer = document.getElementById('drs-timer');
        let timeLeft = 10;
        if (drsTimer) {
            drsTimer.textContent = `Review ends in: ${timeLeft}s`;
            drsTimer.style.display = 'block';
        }

        if (window.drsInterval) clearInterval(window.drsInterval);
        window.drsInterval = setInterval(() => {
            timeLeft--;
            if (drsTimer) drsTimer.textContent = `Review ends in: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(window.drsInterval);
                voteButtons.forEach(b => b.disabled = true);
            }
        }, 1000);

        votes = { out: 0, notOut: 0 };
        currentVote = null;
        voteButtons.forEach(b => {
            b.disabled = false;
            b.classList.remove('selected');
        });
        updateVoteUI();
        voteResults.style.display = 'block';
        if (voteFinalVerdict) {
            voteFinalVerdict.style.display = 'none';
            voteFinalVerdict.innerHTML = '';
        }

        // Auto resolve after 10s to ensure the user gets a result
        setTimeout(() => {
            if (sectionUmpire.classList.contains('hidden') || voteFinalVerdict.style.display === 'block') return;
            const finalVerdict = Math.random() > 0.5 ? 'out' : 'not-out';
            broadcastEvent('admin_resolve_review', { result: finalVerdict });
        }, 10000);
    }
    else if (type === 'admin_big_moment') {
        sectionChat.classList.remove('hidden');
        const runs = payload.runs || 6;
        chatRoomTitle.textContent = runs === 4 ? "What a FOUR!" : "What a SIX!";
        chatMessages.innerHTML = '';
        
        const chatTimer = document.getElementById('chat-timer');
        let chatTimeLeft = 30;
        if (chatTimer) chatTimer.textContent = `${chatTimeLeft}s`;
        
        if (window.chatInterval) clearInterval(window.chatInterval);
        window.chatInterval = setInterval(() => {
            chatTimeLeft--;
            if (chatTimer) chatTimer.textContent = `${chatTimeLeft}s`;
            if (chatTimeLeft <= 0) clearInterval(window.chatInterval);
        }, 1000);

        setTimeout(() => {
            sectionChat.classList.add('hidden');
        }, 30000);
    }
    else if (type === 'admin_resolve_ball') {
        if (!matchActive) return;
        predictionActive = false;

        const actualResult = payload.result;
        const runs = payload.runs || 0;

        if (actualResult === 'wicket') matchWickets++;
        else matchRuns += runs;

        matchBalls++;

        if (matchScoreEl) matchScoreEl.textContent = `${matchRuns}/${matchWickets}`;
        if (matchOversEl) {
            const overs = Math.floor(matchBalls / 6);
            const balls = matchBalls % 6;
            matchOversEl.innerHTML = `${overs}.${balls} <span style="font-size: 1rem; color: var(--warning);">(5)</span>`;
        }

        let actualText = 'Dot Ball';
        if (actualResult === 'single') actualText = `${runs} Run${runs > 1 ? 's' : ''}`;
        else if (actualResult === 'boundary') actualText = `${runs} Runs (Boundary)`;
        else if (actualResult === 'wicket') actualText = 'Wicket';

        if (currentPrediction) {
            if (currentPrediction === actualResult) {
                userScore += 10;
                if (userScoreEl) userScoreEl.textContent = userScore;
                predResult.innerHTML = `Result: ${actualText} <br><span style="color: var(--success); font-weight: bold;">✅ You were correct! +10 Points</span>`;
            } else {
                predResult.innerHTML = `Result: ${actualText} <br><span style="color: var(--danger); font-weight: bold;">❌ You were incorrect!</span>`;
            }
        } else {
            predResult.innerHTML = `Result: ${actualText} <br><span style="color: var(--warning);">You didn't make a prediction.</span>`;
        }
        currentPrediction = null;

        if (matchWickets >= 10 || matchBalls >= MAX_BALLS) {
            endMatch();
            return;
        }
    }
    else if (type === 'admin_resolve_review') {
        const actualResult = payload.result;
        const actualText = actualResult === 'out' ? 'OUT' : 'NOT OUT';

        if (window.drsInterval) clearInterval(window.drsInterval);
        const drsTimer = document.getElementById('drs-timer');
        if (drsTimer) drsTimer.style.display = 'none';

        if (actualResult === 'not-out' && matchWickets > 0) {
            matchWickets--;
            if (matchScoreEl) matchScoreEl.textContent = `${matchRuns}/${matchWickets}`;
        }

        if (voteFinalVerdict) {
            let msg = `<div style="padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.2);">`;
            msg += `<h3 style="margin-bottom: 5px;">VERDICT: <span style="${actualResult === 'out' ? 'color: var(--danger)' : 'color: var(--success)'}">${actualText}</span></h3>`;
            if (currentVote) {
                if (currentVote === actualResult) {
                    userScore += 5;
                    if (userScoreEl) userScoreEl.textContent = userScore;
                    msg += `<div style="color: var(--success); font-weight: bold;">✅ Good call! +5 Points</div>`;
                } else {
                    msg += `<div style="color: var(--danger); font-weight: bold;">❌ You got it wrong!</div>`;
                }
            } else {
                msg += `<div style="color: var(--warning); font-weight: bold;">You didn't vote.</div>`;
            }
            msg += `</div>`;
            voteFinalVerdict.innerHTML = msg;
            voteFinalVerdict.style.display = 'block';
        }
        currentVote = null;

        setTimeout(() => {
            sectionUmpire.classList.add('hidden');
        }, 3000);
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function updateVoteUI() {
    const total = votes.out + votes.notOut;
    if (total === 0) return;

    const outPct = Math.round((votes.out / total) * 100);
    const notOutPct = 100 - outPct;

    barOut.style.width = `${outPct}%`;
    barNotOut.style.width = `${notOutPct}%`;
    pctOut.textContent = `${outPct}% OUT`;
    pctNotOut.textContent = `${notOutPct}% NOT OUT`;
}

let predInterval = null;
function startPredictionTimer() {
    predictionActive = true;
    predResult.textContent = '';
    predButtons.forEach(b => {
        b.classList.remove('selected');
        b.disabled = false;
    });

    let timeLeft = 10;
    predTimer.textContent = `Predict next ball! (${timeLeft}s)`;
    predTimer.style.color = 'var(--warning)';

    if (predInterval) clearInterval(predInterval);
    predInterval = setInterval(() => {
        timeLeft--;
        predTimer.textContent = `Predict next ball! (${timeLeft}s)`;

        if (timeLeft <= 0) {
            clearInterval(predInterval);
            predInterval = null;
            predictionActive = false;
            predTimer.textContent = "Predictions locked! Waiting for delivery...";
            predTimer.style.color = 'var(--danger)';
            predButtons.forEach(b => b.disabled = true);
        }
    }, 1000);
}

// ==========================================
// ADMIN CONTROLS (Simulating Game State)
// ==========================================
let autoSimActive = false;
let autoSimTimeout = null;
const btnAutoSim = document.getElementById('btn-auto-sim');

if (btnAutoSim) {
    btnAutoSim.addEventListener('click', () => {
        resetMatchState();
        autoSimActive = true;
        matchActive = true;

        document.getElementById('mode-selection')?.classList.add('hidden');
        document.getElementById('scoreboard')?.classList.remove('hidden');
        document.getElementById('interactive-row')?.classList.remove('hidden');
        document.getElementById('call-the-ball')?.classList.remove('hidden');
        document.getElementById('live-pulse')?.classList.remove('hidden');
        document.getElementById('btn-stop-sim')?.classList.remove('hidden');

        const matchTitleInput = document.getElementById('match-title-input');
        if (matchTitleInput) matchTitleInput.disabled = true;

        if (db) {
            db.ref('events').remove(); // Wipe old events
            db.ref('global_state/matchActive').set(true);
            db.ref('events').push({ type: 'match_reset', payload: { title: matchTitleInput ? matchTitleInput.value : "IND vs AUS" } });
        }

        scheduleNextBall(2000); // Start the first one quickly
    });
}

const btnStopSim = document.getElementById('btn-stop-sim');
if (btnStopSim) {
    btnStopSim.addEventListener('click', () => {
        endMatch();
    });
}

function scheduleNextBall(delayMs = null) {
    if (!autoSimActive || !matchActive) return;
    const delay = delayMs !== null ? delayMs : (Math.random() * 20000 + 10000); // 10-30s

    autoSimTimeout = setTimeout(() => {
        if (!autoSimActive || !matchActive) return;
        broadcastEvent('admin_next_ball', {});

        // 10s prediction timer + 10-15s random delivery delay
        const deliveryDelay = 10000 + (Math.random() * 5000 + 10000);
        setTimeout(() => {
            if (!autoSimActive || !matchActive) return;
            const results = ['dot', 'single', 'boundary', 'wicket'];
            const randomResult = results[Math.floor(Math.random() * results.length)];

            let exactRuns = 0;
            if (randomResult === 'single') exactRuns = Math.floor(Math.random() * 3) + 1;
            else if (randomResult === 'boundary') exactRuns = Math.random() > 0.5 ? 4 : 6;

            broadcastEvent('admin_resolve_ball', { result: randomResult, runs: exactRuns });

            // Handle side effects of the result
            if (randomResult === 'wicket' && Math.random() < 0.5) {
                // 50% chance for Umpire Review on wicket
                setTimeout(() => {
                    if (!autoSimActive) return;
                    broadcastEvent('admin_review', {});
                    // Review takes 10s to resolve + 3s wait = 13s
                    scheduleNextBall(13000);
                }, 3000);
            } else if (randomResult === 'boundary') {
                setTimeout(() => {
                    if (!autoSimActive || !matchActive) return;
                    broadcastEvent('admin_big_moment', { runs: exactRuns });
                    // Big moment chat is open for 30s + 3s wait = 33s
                    scheduleNextBall(33000);
                }, 2000);
            } else {
                scheduleNextBall(5000); // Normal delay 5s wait
            }

        }, deliveryDelay);
    }, delay);
}

// Initial UI setup
pulseBar.style.width = `${pulseScore}%`;
