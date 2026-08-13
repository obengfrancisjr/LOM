/**
 * League of Memory (LOM) — UX + mechanics v2
 * Matched pairs stay face-up. Combos, earned powers, strict turn FSM.
 */

const CONFIG = {
    GRID_SIZE: 6,
    PAIRS: 18,
    TURN_DURATION_MS: 7000,
    MATCH_POINTS: 10,
    REVEAL_DELAY_MS: 850,
    SCAN_MS: 2800,
    BOT_TELEGRAPH_MS: 700,
    POWER_EVERY_MATCHES: 2,
    STORAGE_KEY: 'lom.v2',
    PLAYER_COLORS: ['#00f3ff', '#bc13fe', '#00ff9d', '#ffb800', '#ff6b6b', '#4dabf7'],
};

const PHASE = {
    LOBBY: 'lobby',
    IDLE: 'idle',
    FLIPPING: 'flipping',
    RESOLVING: 'resolving',
    BOT: 'bot',
    FROZEN: 'frozen',
    GAMEOVER: 'gameover',
};

const DIFFICULTY = {
    easy: { memory: 0.42, botMs: 1700, usePower: 0.1, forget: 0.25 },
    normal: { memory: 0.8, botMs: 1200, usePower: 0.25, forget: 0.08 },
    hard: { memory: 0.97, botMs: 750, usePower: 0.42, forget: 0.02 },
};

const BOT_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'];

const POWERS = {
    block: { id: 'block', name: 'Block', icon: '⛔', desc: 'Freeze the next opponent' },
    scanner: { id: 'scanner', name: 'Scanner', icon: '👁', desc: 'Reveal two hidden pairs' },
    shuffle: { id: 'shuffle', name: 'Shuffle', icon: '🔀', desc: 'Remix unmatched cards' },
};

const POWER_IDS = Object.keys(POWERS);

const ICONS = [
    '🚀', '🛸', '🪐', '🌌', '⭐', '☄️',
    '🤖', '👾', '🔋', '⚡', '📡', '🔭',
    '💎', '💠', '🧿', '🧬', '⚛️', '🦠',
];

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function loadSave() {
    try {
        const raw = localStorage.getItem(CONFIG.STORAGE_KEY) || localStorage.getItem('lom.v1');
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeSave(patch) {
    const next = { ...loadSave(), ...patch };
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* ignore quota / private mode */
    }
    return next;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.muted = Boolean(loadSave().muted);
    }

    ensure() {
        if (this.ctx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.28;
        this.masterGain.connect(this.ctx.destination);
    }

    resume() {
        this.ensure();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    setMuted(muted) {
        this.muted = muted;
        this.ensure();
        if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 0.28;
        writeSave({ muted });
    }

    playTone(freq, type, duration, slideTo = null) {
        if (this.muted) return;
        this.ensure();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(0.9, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playFlip() { this.playTone(820, 'sine', 0.09, 1250); }
    playMatch() {
        this.playTone(440, 'triangle', 0.25);
        setTimeout(() => this.playTone(554, 'triangle', 0.25), 90);
        setTimeout(() => this.playTone(659, 'triangle', 0.35), 180);
    }
    playMiss() { this.playTone(150, 'sawtooth', 0.18, 55); }
    playPower() { this.playTone(210, 'square', 0.45, 780); }
    playCombo(level) {
        const base = 520 + Math.min(level, 6) * 60;
        this.playTone(base, 'square', 0.2);
        setTimeout(() => this.playTone(base * 1.25, 'square', 0.25), 80);
    }
    playWin() {
        [523, 659, 783, 1046].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.32), i * 130);
        });
    }
}

const AudioCtrl = new SoundEngine();

const WorldBridge = {
    installed: false,
    verified: false,

    init() {
        const MiniKit = window.MiniKit;
        if (!MiniKit) return false;
        try {
            const result = MiniKit.install ? MiniKit.install() : { success: MiniKit.isInstalled?.() };
            this.installed = Boolean(result?.success || MiniKit.isInstalled?.());
        } catch {
            this.installed = Boolean(MiniKit.isInstalled?.());
        }
        return this.installed;
    },

    async verify() {
        const MiniKit = window.MiniKit;
        if (!MiniKit || !this.installed) return { ok: false, reason: 'not-in-world-app' };
        try {
            if (MiniKit.commandsAsync?.verify) {
                const { finalPayload } = await MiniKit.commandsAsync.verify({
                    action: 'play-lom',
                    verification_level: 'device',
                });
                this.verified = finalPayload?.status === 'success';
                return { ok: this.verified, payload: finalPayload };
            }
            if (MiniKit.commands?.verify) {
                MiniKit.commands.verify({ action: 'play-lom', verification_level: 'device' });
                return { ok: true };
            }
        } catch (err) {
            return { ok: false, reason: err?.message || 'verify-failed' };
        }
        return { ok: false, reason: 'sdk-missing-verify' };
    },
};

class Card {
    constructor(id, icon) {
        this.id = id;
        this.icon = icon;
        this.isFlipped = false;
        this.isMatched = false;
        this.ownerId = null;
    }
}

class Player {
    constructor(id, name, isBot, color) {
        this.id = id;
        this.name = name;
        this.isBot = isBot;
        this.color = color;
        this.score = 0;
        this.matches = 0;
        this.bestCombo = 0;
        this.powers = { block: 0, scanner: 0, shuffle: 0 };
        this.memory = new Map();
        this.frozen = false;
    }
}

class Game {
    constructor() {
        this.players = [];
        this.activePlayerIndex = 0;
        this.cards = [];
        this.flippedCards = [];
        this.phase = PHASE.LOBBY;
        this.turnToken = 0;
        this.combo = 0;
        this.bestComboRun = 0;
        this.blockedPlayerIndex = -1;
        this.timer = null;
        this.timerRaf = null;
        this.timerEndsAt = 0;
        this.pending = [];
        this.settings = {
            name: loadSave().name || 'YOU',
            bots: Number(loadSave().bots) || 3,
            difficulty: loadSave().difficulty || 'normal',
        };
        this.ui = {
            grid: document.getElementById('game-grid'),
            players: document.getElementById('players-panel'),
            status: document.getElementById('game-status'),
            turnName: document.getElementById('turn-name'),
            comboBadge: document.getElementById('combo-badge'),
            timerFill: document.getElementById('timer-fill'),
            timerDigits: document.getElementById('timer-digits'),
            timerBar: document.querySelector('.turn-timer-bar'),
            powerCards: document.getElementById('power-cards'),
            powerHint: document.getElementById('power-hint'),
            floatScore: document.getElementById('float-score'),
            modal: document.getElementById('modal-overlay'),
            modalTitle: document.getElementById('modal-title'),
            modalBody: document.getElementById('modal-body'),
            modalBtn: document.getElementById('modal-btn'),
            lobbyBtn: document.getElementById('lobby-btn'),
            bestScore: document.getElementById('best-score'),
            startOverlay: document.getElementById('start-overlay'),
            lobbyForm: document.getElementById('lobby-form'),
            playerName: document.getElementById('player-name'),
            verifyBtn: document.getElementById('verify-btn'),
            worldStatus: document.getElementById('world-status'),
            muteBtn: document.getElementById('mute-btn'),
            app: document.querySelector('.app-container'),
        };
        this.bindEvents();
        this.hydrateLobby();
        this.initWorld();
        this.syncMuteButton();
        this.setPhase(PHASE.LOBBY);
    }

    bindEvents() {
        this.ui.modalBtn.addEventListener('click', () => {
            this.ui.modal.classList.add('hidden');
            this.startNewGame();
        });
        this.ui.lobbyBtn.addEventListener('click', () => {
            this.teardown();
            this.ui.modal.classList.add('hidden');
            this.ui.startOverlay.classList.remove('hidden');
            this.setPhase(PHASE.LOBBY);
            this.toast('Lobby');
            this.ui.turnName.textContent = '—';
            this.hideCombo();
            this.setTimerDisplay(CONFIG.TURN_DURATION_MS / 1000, 1);
        });
        this.ui.lobbyForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.collectSettings();
            this.startGameFlow();
        });
        this.ui.verifyBtn.addEventListener('click', () => this.handleVerify());
        this.ui.muteBtn.addEventListener('click', () => {
            AudioCtrl.setMuted(!AudioCtrl.muted);
            this.syncMuteButton();
        });
        this.ui.grid.addEventListener('keydown', (event) => this.handleGridKey(event));
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.pauseTimerVisual();
        });
    }

    hydrateLobby() {
        this.ui.playerName.value = this.settings.name === 'YOU' ? '' : this.settings.name;
        const bots = String(this.settings.bots);
        const diff = this.settings.difficulty;
        const botsInput = this.ui.lobbyForm.querySelector(`input[name="bots"][value="${bots}"]`);
        const diffInput = this.ui.lobbyForm.querySelector(`input[name="diff"][value="${diff}"]`);
        if (botsInput) botsInput.checked = true;
        if (diffInput) diffInput.checked = true;
        const best = loadSave().bestScore;
        if (best) this.ui.worldStatus.textContent = `Best human score on this device: ${best}`;
    }

    initWorld() {
        const ready = WorldBridge.init();
        if (ready) {
            this.ui.verifyBtn.hidden = false;
            this.ui.worldStatus.textContent = 'World App detected. Verify is optional.';
        } else {
            this.ui.verifyBtn.hidden = true;
            this.ui.worldStatus.textContent = 'Playable in any browser. World ID is optional inside World App.';
        }
    }

    async handleVerify() {
        this.ui.verifyBtn.disabled = true;
        this.ui.worldStatus.textContent = 'Opening World ID…';
        const result = await WorldBridge.verify();
        this.ui.verifyBtn.disabled = false;
        if (result.ok) this.ui.worldStatus.textContent = 'Verified human. Enter the arena when ready.';
        else if (result.reason === 'not-in-world-app') {
            this.ui.worldStatus.textContent = 'Open this URL inside World App to verify. You can still play here.';
        } else {
            this.ui.worldStatus.textContent = 'Verification skipped or unavailable. You can still play.';
        }
    }

    collectSettings() {
        const name = (this.ui.playerName.value || 'YOU').trim().slice(0, 16) || 'YOU';
        const bots = Number(this.ui.lobbyForm.querySelector('input[name="bots"]:checked')?.value || 3);
        const difficulty = this.ui.lobbyForm.querySelector('input[name="diff"]:checked')?.value || 'normal';
        this.settings = { name, bots, difficulty };
        writeSave(this.settings);
    }

    setPhase(phase) {
        this.phase = phase;
        this.ui.app?.setAttribute('data-phase', phase);
        this.renderPowers();
    }

    canHumanAct() {
        const p = this.getCurrentPlayer();
        return Boolean(p) && !p.isBot && this.phase === PHASE.IDLE;
    }

    canHumanFlip() {
        const p = this.getCurrentPlayer();
        if (!p || p.isBot) return false;
        if (this.phase === PHASE.IDLE) return true;
        return this.phase === PHASE.FLIPPING && this.flippedCards.length < 2;
    }

    startGameFlow() {
        AudioCtrl.resume();
        this.ui.startOverlay.classList.add('hidden');
        this.setupPlayers();
        this.startNewGame();
        AudioCtrl.playPower();
    }

    setupPlayers() {
        const bots = Math.min(5, Math.max(1, this.settings.bots));
        this.players = [
            new Player(0, this.settings.name, false, CONFIG.PLAYER_COLORS[0]),
        ];
        shuffleInPlace([...BOT_NAMES]).slice(0, bots).forEach((name, i) => {
            this.players.push(new Player(i + 1, name, true, CONFIG.PLAYER_COLORS[(i + 1) % CONFIG.PLAYER_COLORS.length]));
        });
    }

    grantStarterPower(player) {
        player.powers = { block: 0, scanner: 0, shuffle: 0 };
        const pick = POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)];
        player.powers[pick] = 1;
    }

    grantRandomPower(player) {
        const pick = POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)];
        player.powers[pick] += 1;
        if (!player.isBot) {
            this.toast(`+1 ${POWERS[pick].name}`);
            this.ui.powerHint.textContent = `earned ${POWERS[pick].name}`;
        }
        return pick;
    }

    teardown() {
        this.stopTimer();
        this.clearPending();
        this.turnToken += 1;
        this.flippedCards = [];
        this.combo = 0;
        this.hideCombo();
    }

    startNewGame() {
        this.teardown();
        this.activePlayerIndex = 0;
        this.blockedPlayerIndex = -1;
        this.bestComboRun = 0;
        this.players.forEach((p) => {
            p.score = 0;
            p.matches = 0;
            p.bestCombo = 0;
            p.frozen = false;
            p.memory.clear();
            this.grantStarterPower(p);
        });
        this.generateCards();
        this.renderGrid();
        this.renderPlayers();
        this.renderPowers();
        this.startTurn();
    }

    generateCards() {
        const deck = [];
        for (let i = 0; i < CONFIG.PAIRS; i++) {
            const icon = ICONS[i % ICONS.length];
            deck.push(new Card(i * 2, icon));
            deck.push(new Card(i * 2 + 1, icon));
        }
        this.cards = shuffleInPlace(deck);
    }

    getCurrentPlayer() {
        return this.players[this.activePlayerIndex];
    }

    startTurn() {
        this.stopTimer();
        this.clearPending();
        this.flippedCards = [];
        this.combo = 0;
        this.hideCombo();
        const token = ++this.turnToken;

        if (this.cards.every((c) => c.isMatched)) {
            this.handleGameOver();
            return;
        }

        if (this.activePlayerIndex === this.blockedPlayerIndex) {
            const frozen = this.getCurrentPlayer();
            frozen.frozen = true;
            this.blockedPlayerIndex = -1;
            this.setPhase(PHASE.FROZEN);
            this.renderPlayers();
            this.ui.turnName.textContent = `${frozen.name} frozen`;
            this.toast(`${frozen.name} skips this turn`);
            this.setTimerDisplay(0, 0);
            this.schedule(() => {
                if (this.turnToken !== token) return;
                frozen.frozen = false;
                this.nextTurn();
            }, 1400);
            return;
        }

        this.renderPlayers();
        this.renderPowers();
        this.ui.turnName.textContent = `${this.getCurrentPlayer().name}'s turn`;
        this.toast(this.getCurrentPlayer().isBot ? `${this.getCurrentPlayer().name} is thinking…` : 'Your move');

        if (this.getCurrentPlayer().isBot) {
            this.setPhase(PHASE.BOT);
            this.processBotTurn(token);
        } else {
            this.setPhase(PHASE.IDLE);
            this.startTimer(token);
        }
    }

    endTurn() {
        this.stopTimer();
        this.combo = 0;
        this.hideCombo();
        this.nextTurn();
    }

    nextTurn() {
        if (this.cards.every((c) => c.isMatched)) {
            this.handleGameOver();
            return;
        }
        this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
        this.startTurn();
    }

    handleCardClick(index) {
        if (!this.canHumanFlip()) return;
        if (this.flippedCards.includes(index)) return;
        AudioCtrl.resume();
        this.flipCard(index);
    }

    handleGridKey(event) {
        const current = document.activeElement;
        if (!current || !current.id?.startsWith('card-')) return;
        const index = Number(current.id.slice(5));
        const col = index % CONFIG.GRID_SIZE;
        const row = Math.floor(index / CONFIG.GRID_SIZE);
        let next = index;
        if (event.key === 'ArrowRight') next = row * CONFIG.GRID_SIZE + ((col + 1) % CONFIG.GRID_SIZE);
        else if (event.key === 'ArrowLeft') next = row * CONFIG.GRID_SIZE + ((col + CONFIG.GRID_SIZE - 1) % CONFIG.GRID_SIZE);
        else if (event.key === 'ArrowDown') next = ((row + 1) % CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + col;
        else if (event.key === 'ArrowUp') next = ((row + CONFIG.GRID_SIZE - 1) % CONFIG.GRID_SIZE) * CONFIG.GRID_SIZE + col;
        else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleCardClick(index);
            return;
        } else return;
        event.preventDefault();
        document.getElementById(`card-${next}`)?.focus();
    }

    flipCard(index) {
        const card = this.cards[index];
        if (!card || card.isFlipped || card.isMatched) return false;
        if (this.flippedCards.length >= 2) return false;
        if (this.phase !== PHASE.IDLE && this.phase !== PHASE.BOT && this.phase !== PHASE.FLIPPING) return false;

        if (this.phase === PHASE.IDLE || this.phase === PHASE.BOT) this.setPhase(PHASE.FLIPPING);

        AudioCtrl.playFlip();
        card.isFlipped = true;
        this.paintCard(index);
        this.flippedCards.push(index);
        this.notifyBotsOfCard(index, card.icon);

        if (this.flippedCards.length === 2) {
            this.setPhase(PHASE.RESOLVING);
            this.stopTimer(false);
            this.checkMatch();
        }
        return true;
    }

    checkMatch() {
        const [idx1, idx2] = this.flippedCards;
        const card1 = this.cards[idx1];
        const card2 = this.cards[idx2];
        const token = this.turnToken;
        const player = this.getCurrentPlayer();

        if (card1.icon === card2.icon) {
            this.combo += 1;
            player.bestCombo = Math.max(player.bestCombo, this.combo);
            this.bestComboRun = Math.max(this.bestComboRun, this.combo);
            const points = CONFIG.MATCH_POINTS * this.combo;
            player.score += points;
            player.matches += 1;

            if (this.combo > 1) AudioCtrl.playCombo(this.combo);
            else AudioCtrl.playMatch();

            this.showCombo(this.combo);
            this.floatPoints(points, player.color);
            this.toast(this.combo > 1 ? `Combo x${this.combo} · +${points}` : `Match · +${points}`);

            this.schedule(() => {
                if (this.turnToken !== token) return;
                card1.isMatched = true;
                card2.isMatched = true;
                card1.ownerId = player.id;
                card2.ownerId = player.id;
                card1.isFlipped = true;
                card2.isFlipped = true;
                this.paintCard(idx1, true);
                this.paintCard(idx2, true);
                this.renderPlayers();

                if (player.matches > 0 && player.matches % CONFIG.POWER_EVERY_MATCHES === 0) {
                    this.grantRandomPower(player);
                    this.renderPowers();
                    AudioCtrl.playPower();
                }

                if (this.cards.every((c) => c.isMatched)) {
                    this.handleGameOver();
                    return;
                }

                this.flippedCards = [];
                if (player.isBot) {
                    this.setPhase(PHASE.BOT);
                    this.processBotTurn(token);
                } else {
                    this.setPhase(PHASE.IDLE);
                    this.startTimer(token, true);
                }
            }, 480);
        } else {
            AudioCtrl.playMiss();
            this.combo = 0;
            this.hideCombo();
            this.toast('Miss');
            this.ui.grid.classList.add('board-miss');
            [idx1, idx2].forEach((idx) => document.getElementById(`card-${idx}`)?.classList.add('miss'));

            // Bots always remember both revealed cards on a miss
            this.notifyBotsOfCard(idx1, card1.icon, 1);
            this.notifyBotsOfCard(idx2, card2.icon, 1);

            this.schedule(() => {
                if (this.turnToken !== token) return;
                this.ui.grid.classList.remove('board-miss');
                card1.isFlipped = false;
                card2.isFlipped = false;
                this.paintCard(idx1);
                this.paintCard(idx2);
                this.flippedCards = [];
                this.endTurn();
            }, CONFIG.REVEAL_DELAY_MS);
        }
    }

    handleGameOver() {
        this.stopTimer();
        this.clearPending();
        this.setPhase(PHASE.GAMEOVER);
        AudioCtrl.playWin();

        const ranked = [...this.players].sort((a, b) =>
            b.score - a.score
            || b.matches - a.matches
            || (b.bestCombo || 0) - (a.bestCombo || 0)
            || Number(a.isBot) - Number(b.isBot)
        );
        const winner = ranked[0];
        const runner = ranked[1];
        const isDraw = Boolean(runner) && winner.score === runner.score && winner.matches === runner.matches;
        const human = this.players.find((p) => !p.isBot);
        const save = loadSave();
        const best = Math.max(Number(save.bestScore) || 0, human?.score || 0);
        writeSave({
            bestScore: best,
            lastWinner: isDraw ? 'draw' : winner.name,
            bestCombo: Math.max(Number(save.bestCombo) || 0, this.bestComboRun),
        });

        this.ui.turnName.textContent = 'Final';
        this.ui.modalTitle.textContent = isDraw ? 'Draw' : (winner.isBot ? 'Sector lost' : 'Sector cleared');
        this.ui.modalBody.innerHTML = ranked.map((p, i) =>
            `<div class="standings ${!isDraw && p === winner ? 'winner' : ''}" style="--p:${p.color}">
                <span>${i + 1}. ${escapeHtml(p.name)}</span>
                <span>${p.score} pts · ${p.matches} pairs · best x${p.bestCombo || 1}</span>
            </div>`
        ).join('');
        this.ui.bestScore.textContent = human
            ? `Your score ${human.score} · best ${best} · run combo x${this.bestComboRun}${WorldBridge.verified ? ' · verified' : ''}`
            : '';
        this.ui.modal.classList.remove('hidden');
        this.ui.modalBtn.focus();
        this.toast('Arena complete');
    }

    startTimer(token, refill = false) {
        this.stopTimer(false);
        const duration = CONFIG.TURN_DURATION_MS;
        this.timerEndsAt = performance.now() + duration;
        this.ui.timerFill.style.transition = 'none';
        this.ui.timerFill.style.width = '100%';
        void this.ui.timerFill.offsetHeight;
        this.ui.timerFill.style.transition = `width ${duration}ms linear`;
        this.ui.timerFill.style.width = '0%';
        this.ui.timerBar?.classList.toggle('urgent', false);
        if (refill) this.ui.timerBar?.classList.add('refilled');
        this.setTimerDisplay(duration / 1000, 1);

        const tick = () => {
            if (this.turnToken !== token) return;
            const left = Math.max(0, this.timerEndsAt - performance.now());
            const ratio = left / duration;
            this.setTimerDisplay(left / 1000, ratio);
            this.ui.timerBar?.classList.toggle('urgent', left <= 2000);
            if (left > 0) this.timerRaf = requestAnimationFrame(tick);
        };
        this.timerRaf = requestAnimationFrame(tick);

        this.timer = setTimeout(() => {
            if (this.turnToken !== token) return;
            if (this.phase === PHASE.RESOLVING) return;
            this.flippedCards.forEach((idx) => {
                this.cards[idx].isFlipped = false;
                this.paintCard(idx);
            });
            this.flippedCards = [];
            this.combo = 0;
            this.hideCombo();
            this.toast("Time's up");
            this.schedule(() => {
                if (this.turnToken !== token) return;
                this.endTurn();
            }, 280);
        }, duration);
    }

    pauseTimerVisual() {
        /* keep timeout authoritative; visual freezes if tab hidden */
    }

    stopTimer(resetDisplay = true) {
        clearTimeout(this.timer);
        this.timer = null;
        if (this.timerRaf) cancelAnimationFrame(this.timerRaf);
        this.timerRaf = null;
        this.ui.timerFill.style.transition = 'none';
        this.ui.timerBar?.classList.remove('urgent', 'refilled');
        if (resetDisplay) this.setTimerDisplay(0, 0);
    }

    setTimerDisplay(seconds, ratio) {
        const s = Math.max(0, seconds);
        this.ui.timerDigits.textContent = s.toFixed(1);
        this.ui.timerBar?.setAttribute('aria-valuenow', String(Math.ceil(s)));
        if (ratio != null && this.timer === null) {
            this.ui.timerFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
        }
    }

    schedule(fn, ms) {
        const id = setTimeout(fn, ms);
        this.pending.push(id);
        return id;
    }

    clearPending() {
        this.pending.forEach((id) => clearTimeout(id));
        this.pending = [];
    }

    activatePower(powerType) {
        if (!this.canHumanAct()) return;
        if (this.flippedCards.length > 0) return;
        this.consumePower(this.getCurrentPlayer(), powerType);
    }

    consumePower(player, powerType) {
        if (player.powers[powerType] <= 0) return false;
        if (powerType === 'scanner' && !this.hiddenPairCount()) {
            this.toast('Nothing left to scan');
            return false;
        }
        if (powerType === 'shuffle' && this.openIndices().length < 2) {
            this.toast('Nothing left to shuffle');
            return false;
        }
        AudioCtrl.playPower();
        player.powers[powerType] -= 1;
        this.renderPowers();
        if (powerType === 'block') this.useBlockPower(player);
        if (powerType === 'scanner') this.useScannerPower(player);
        if (powerType === 'shuffle') this.useShufflePower(player);
        return true;
    }

    useBlockPower(player) {
        let next = (this.activePlayerIndex + 1) % this.players.length;
        // Prefer freezing an opponent, not yourself in weird edge cases
        if (this.players[next].id === player.id && this.players.length > 1) {
            next = (next + 1) % this.players.length;
        }
        this.blockedPlayerIndex = next;
        this.players[next].frozen = true;
        this.renderPlayers();
        this.toast(`${this.players[next].name} will be frozen`);
        this.ui.powerHint.textContent = 'block armed';
    }

    useScannerPower(player) {
        const hidden = this.cards
            .map((c, i) => ({ c, i }))
            .filter((item) => !item.c.isMatched && !item.c.isFlipped);

        const groups = {};
        hidden.forEach(({ c, i }) => {
            if (!groups[c.icon]) groups[c.icon] = [];
            groups[c.icon].push(i);
        });
        const pairs = Object.values(groups).filter((g) => g.length >= 2).map((g) => g.slice(0, 2));
        const reveal = shuffleInPlace(pairs).slice(0, 2).flat();
        if (!reveal.length) return;

        reveal.forEach((idx) => {
            document.getElementById(`card-${idx}`)?.classList.add('preview');
            // Scanner intel is private: only the caster (or bots, if a bot scanned) learns
            if (player.isBot) this.notifyBotsOfCard(idx, this.cards[idx].icon, 1);
        });
        this.toast('Scanning sector…');
        this.ui.powerHint.textContent = 'scanner live';
        this.schedule(() => {
            reveal.forEach((idx) => document.getElementById(`card-${idx}`)?.classList.remove('preview'));
            if (!player.isBot) this.ui.powerHint.textContent = '';
        }, CONFIG.SCAN_MS);
    }

    useShufflePower(player) {
        this.toast('Hyper-shuffling…');
        this.ui.powerHint.textContent = 'board remix';
        const indices = [];
        const icons = [];
        this.cards.forEach((c, i) => {
            if (!c.isMatched && !c.isFlipped) {
                indices.push(i);
                icons.push(c.icon);
            }
        });
        shuffleInPlace(icons);
        indices.forEach((idx, k) => {
            this.cards[idx].icon = icons[k];
        });
        // Wipe bot memory of unmatched positions
        this.players.forEach((p) => {
            if (!p.isBot) return;
            for (const key of [...p.memory.keys()]) {
                if (!this.cards[key]?.isMatched) p.memory.delete(key);
            }
        });
        this.schedule(() => {
            this.renderGrid();
            if (!player.isBot) this.ui.powerHint.textContent = '';
        }, 260);
    }

    processBotTurn(token) {
        const bot = this.getCurrentPlayer();
        const profile = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;

        this.ui.turnName.textContent = `${bot.name} thinking…`;
        this.schedule(() => {
            if (this.turnToken !== token || this.getCurrentPlayer() !== bot) return;

            // Optional power before move
            if (this.phase === PHASE.BOT) this.maybeBotPower(bot, profile);

            this.schedule(() => {
                if (this.turnToken !== token || this.getCurrentPlayer() !== bot) return;
                this.ui.turnName.textContent = `${bot.name}'s turn`;

                const known = this.findMatchInMemory(bot);
                if (known) {
                    this.flipCard(known[0]);
                    this.schedule(() => {
                        if (this.turnToken !== token) return;
                        this.flipCard(known[1]);
                    }, 420);
                    return;
                }

                const unknown = this.openIndices().filter((i) => !bot.memory.has(i));
                const pool = unknown.length ? unknown : this.openIndices();
                if (!pool.length) return;
                const first = pool[Math.floor(Math.random() * pool.length)];
                this.flipCard(first);
                const remembered = this.findCardWithIconInMemory(bot, this.cards[first].icon, first);

                this.schedule(() => {
                    if (this.turnToken !== token) return;
                    if (remembered !== null) {
                        this.flipCard(remembered);
                        return;
                    }
                    const rest = this.openIndices().filter((i) => i !== first);
                    if (rest.length) this.flipCard(rest[Math.floor(Math.random() * rest.length)]);
                }, 620);
            }, CONFIG.BOT_TELEGRAPH_MS);
        }, profile.botMs);
    }

    maybeBotPower(bot, profile) {
        if (Math.random() > profile.usePower) return false;
        if (bot.powers.scanner && this.openIndices().length >= 8) {
            return this.consumePower(bot, 'scanner');
        }
        const human = this.players.find((p) => !p.isBot);
        if (bot.powers.shuffle && human && human.score >= bot.score) {
            return this.consumePower(bot, 'shuffle');
        }
        if (bot.powers.block) {
            return this.consumePower(bot, 'block');
        }
        return false;
    }

    openIndices() {
        return this.cards
            .map((c, i) => i)
            .filter((i) => !this.cards[i].isMatched && !this.cards[i].isFlipped);
    }

    hiddenPairCount() {
        const groups = {};
        this.cards.forEach((c) => {
            if (c.isMatched || c.isFlipped) return;
            groups[c.icon] = (groups[c.icon] || 0) + 1;
        });
        return Object.values(groups).filter((n) => n >= 2).length;
    }

    notifyBotsOfCard(index, icon, forceRate = null) {
        const profile = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
        const rate = forceRate == null ? profile.memory : forceRate;
        this.players.forEach((p) => {
            if (!p.isBot) return;
            if (Math.random() < rate) p.memory.set(index, icon);
            // Occasional forget on easy/normal
            if (p.memory.size > 8 && Math.random() < profile.forget) {
                const keys = [...p.memory.keys()];
                p.memory.delete(keys[Math.floor(Math.random() * keys.length)]);
            }
        });
    }

    findMatchInMemory(bot) {
        const seen = {};
        for (const [idx, icon] of bot.memory.entries()) {
            const card = this.cards[idx];
            if (!card || card.isMatched || card.isFlipped) continue;
            if (card.icon !== icon) {
                bot.memory.delete(idx);
                continue;
            }
            if (!seen[icon]) seen[icon] = [];
            seen[icon].push(idx);
            if (seen[icon].length === 2) return seen[icon];
        }
        return null;
    }

    findCardWithIconInMemory(bot, icon, excludeIndex) {
        for (const [idx, memIcon] of bot.memory.entries()) {
            const card = this.cards[idx];
            if (memIcon === icon && idx !== excludeIndex && card && !card.isMatched && !card.isFlipped) {
                return idx;
            }
        }
        return null;
    }

    toast(msg) {
        this.ui.status.textContent = msg;
        this.ui.status.classList.remove('pop');
        void this.ui.status.offsetWidth;
        this.ui.status.classList.add('pop');
    }

    showCombo(level) {
        if (level <= 1) {
            this.ui.comboBadge.classList.add('hidden');
            this.ui.comboBadge.textContent = 'COMBO x1';
            return;
        }
        this.ui.comboBadge.textContent = `COMBO x${level}`;
        this.ui.comboBadge.classList.remove('hidden');
        this.ui.comboBadge.classList.remove('pop');
        void this.ui.comboBadge.offsetWidth;
        this.ui.comboBadge.classList.add('pop');
    }

    hideCombo() {
        this.ui.comboBadge.classList.add('hidden');
    }

    floatPoints(points, color) {
        const el = this.ui.floatScore;
        el.textContent = `+${points}`;
        el.style.setProperty('--float-color', color || '#00ff9d');
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    paintCard(index, justMatched = false) {
        const card = this.cards[index];
        const el = document.getElementById(`card-${index}`);
        if (!el || !card) return;

        const open = card.isFlipped || card.isMatched;
        el.classList.toggle('flipped', open);
        el.classList.toggle('matched', card.isMatched);
        el.classList.toggle('just-matched', justMatched);
        el.classList.remove('miss');
        el.setAttribute('aria-pressed', String(open));
        el.disabled = card.isMatched;

        if (card.isMatched) {
            el.classList.add('claimed');
            const owner = this.players.find((p) => p.id === card.ownerId);
            const color = owner?.color || '#00ff9d';
            el.style.setProperty('--owner', color);
            el.setAttribute('aria-label', `Matched ${card.icon}`);
            // Keep visible to AT as landmarks — do NOT aria-hidden
            el.removeAttribute('aria-hidden');
        } else {
            el.classList.remove('claimed');
            el.style.removeProperty('--owner');
            el.setAttribute('aria-label', open ? `Card ${card.icon}` : `Card ${index + 1} face down`);
            el.removeAttribute('aria-hidden');
        }

        const face = el.querySelector('.card-front');
        if (face) face.textContent = card.icon;
        if (justMatched) {
            this.schedule(() => el.classList.remove('just-matched'), 700);
        }
    }

    renderGrid() {
        const frag = document.createDocumentFragment();
        this.cards.forEach((card, index) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'card';
            el.id = `card-${index}`;
            el.setAttribute('role', 'gridcell');
            const row = Math.floor(index / CONFIG.GRID_SIZE) + 1;
            const col = (index % CONFIG.GRID_SIZE) + 1;
            el.setAttribute('aria-rowindex', String(row));
            el.setAttribute('aria-colindex', String(col));

            const open = card.isFlipped || card.isMatched;
            if (open) el.classList.add('flipped');
            if (card.isMatched) {
                el.classList.add('matched', 'claimed');
                el.disabled = true;
                const owner = this.players.find((p) => p.id === card.ownerId);
                if (owner) el.style.setProperty('--owner', owner.color);
            }

            el.setAttribute('aria-pressed', String(open));
            el.setAttribute('aria-label', card.isMatched ? `Matched ${card.icon}` : open ? `Card ${card.icon}` : `Card ${index + 1} face down`);
            el.innerHTML = `<span class="card-inner"><span class="card-front">${card.icon}</span><span class="card-back" aria-hidden="true"></span></span>`;
            el.addEventListener('click', () => this.handleCardClick(index));
            frag.appendChild(el);
        });
        this.ui.grid.replaceChildren(frag);
    }

    renderPlayers() {
        const frag = document.createDocumentFragment();
        this.players.forEach((p, idx) => {
            const el = document.createElement('div');
            const active = idx === this.activePlayerIndex;
            const willFreeze = idx === this.blockedPlayerIndex || p.frozen;
            el.className = `player-card ${active ? 'active' : ''} ${p.isBot ? 'is-bot' : ''} ${willFreeze ? 'frozen' : ''}`;
            el.style.setProperty('--p', p.color);
            el.setAttribute('aria-current', active ? 'true' : 'false');
            el.innerHTML = `
                <div class="player-avatar">${escapeHtml(p.name.slice(0, 2).toUpperCase())}</div>
                <div class="player-name">${escapeHtml(p.name)}</div>
                <div class="player-score">${p.score}</div>
                ${willFreeze ? '<div class="freeze-tag">FROZEN</div>' : ''}`;
            frag.appendChild(el);
        });
        this.ui.players.replaceChildren(frag);
        this.ui.players.children[this.activePlayerIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    }

    renderPowers() {
        const player = this.getCurrentPlayer();
        if (!player || this.phase === PHASE.LOBBY || this.phase === PHASE.GAMEOVER) {
            this.ui.powerCards.innerHTML = '<div class="opp-turn">Powers ready in arena</div>';
            return;
        }

        if (player.isBot || this.phase === PHASE.BOT || this.phase === PHASE.FROZEN) {
            this.ui.powerCards.innerHTML = `<div class="opp-turn">${escapeHtml(player.name)} turn</div>`;
            return;
        }

        if (this.phase === PHASE.RESOLVING) {
            this.ui.powerCards.innerHTML = '<div class="opp-turn">Resolving…</div>';
            return;
        }

        const frag = document.createDocumentFragment();
        Object.values(POWERS).forEach((power) => {
            const count = player.powers[power.id];
            const el = document.createElement('button');
            el.type = 'button';
            el.className = `power-card ${count === 0 ? 'disabled' : ''}`;
            el.disabled = count === 0 || !this.canHumanAct();
            el.title = power.desc;
            el.setAttribute('aria-label', `${power.name}. ${power.desc}. ${count} left`);
            el.innerHTML = `<span class="power-count">${count}</span><span class="icon">${power.icon}</span><span>${power.name}</span>`;
            el.addEventListener('click', () => this.activatePower(power.id));
            frag.appendChild(el);
        });
        this.ui.powerCards.replaceChildren(frag);
        if (this.ui.powerHint && !this.ui.powerHint.textContent) {
            const total = POWER_IDS.reduce((n, id) => n + player.powers[id], 0);
            this.ui.powerHint.textContent = total ? `${total} ready` : 'earn every 2 matches';
        }
    }

    syncMuteButton() {
        this.ui.muteBtn.textContent = AudioCtrl.muted ? '🔇' : '🔊';
        this.ui.muteBtn.setAttribute('aria-pressed', String(AudioCtrl.muted));
        this.ui.muteBtn.setAttribute('aria-label', AudioCtrl.muted ? 'Unmute sound' : 'Mute sound');
    }
}

function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.location.protocol.startsWith('http')) return;
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
    window.lomGame = new Game();
    registerWorker();
});
