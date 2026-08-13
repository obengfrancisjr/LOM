/**
 * League of Memory (LOM) — playable arena
 * Local 1-vs-AI memory game, World Mini App aware, no blocking ID gate.
 */

const CONFIG = {
    GRID_SIZE: 6,
    PAIRS: 18,
    TURN_DURATION_MS: 7000,
    MATCH_POINTS: 10,
    REVEAL_DELAY_MS: 900,
    SCAN_MS: 3000,
    STORAGE_KEY: 'lom.v1',
};

const DIFFICULTY = {
    easy: { memory: 0.45, botMs: 1800, usePower: 0.08 },
    normal: { memory: 0.78, botMs: 1400, usePower: 0.22 },
    hard: { memory: 0.96, botMs: 900, usePower: 0.38 },
};

const BOT_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'];

const POWERS = {
    block: { id: 'block', name: 'Block', icon: '⛔', desc: 'Freeze the next opponent' },
    scanner: { id: 'scanner', name: 'Scanner', icon: '👁', desc: 'Reveal two hidden pairs' },
    shuffle: { id: 'shuffle', name: 'Shuffle', icon: '🔀', desc: 'Remix unmatched cards' },
};

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
        return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function writeSave(patch) {
    const next = { ...loadSave(), ...patch };
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* private mode / quota — ignore */
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

    playFlip() { this.playTone(800, 'sine', 0.1, 1200); }
    playMatch() {
        this.playTone(440, 'triangle', 0.3);
        setTimeout(() => this.playTone(554, 'triangle', 0.3), 100);
        setTimeout(() => this.playTone(659, 'triangle', 0.4), 200);
    }
    playMiss() { this.playTone(160, 'sawtooth', 0.18, 60); }
    playPower() { this.playTone(200, 'square', 0.5, 800); }
    playWin() {
        [523, 659, 783, 1046].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.35), i * 140);
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
    }
}

class Player {
    constructor(id, name, isBot) {
        this.id = id;
        this.name = name;
        this.isBot = isBot;
        this.score = 0;
        this.powers = { block: 1, scanner: 1, shuffle: 1 };
        this.memory = new Map();
    }
}

class Game {
    constructor() {
        this.players = [];
        this.activePlayerIndex = 0;
        this.cards = [];
        this.flippedCards = [];
        this.isProcessing = false;
        this.timer = null;
        this.blockedPlayerIndex = -1;
        this.turnToken = 0;
        this.botTimers = [];
        this.settings = {
            name: loadSave().name || 'YOU',
            bots: Number(loadSave().bots) || 3,
            difficulty: loadSave().difficulty || 'normal',
        };
        this.ui = {
            grid: document.getElementById('game-grid'),
            players: document.getElementById('players-panel'),
            status: document.getElementById('game-status'),
            timerFill: document.getElementById('timer-fill'),
            timerBar: document.querySelector('.turn-timer-bar'),
            powerCards: document.getElementById('power-cards'),
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
        };
        this.bindEvents();
        this.hydrateLobby();
        this.initWorld();
        this.syncMuteButton();
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
            if (document.hidden) this.stopTimer();
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
            this.ui.worldStatus.textContent = 'World App detected. Optional: verify to mark this session as human.';
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
        if (result.ok) {
            this.ui.worldStatus.textContent = 'Verified human. Enter the arena when ready.';
        } else if (result.reason === 'not-in-world-app') {
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

    startGameFlow() {
        AudioCtrl.resume();
        this.ui.startOverlay.classList.add('hidden');
        this.setupPlayers();
        this.startNewGame();
        AudioCtrl.playPower();
    }

    setupPlayers() {
        const bots = Math.min(5, Math.max(1, this.settings.bots));
        this.players = [new Player(0, this.settings.name, false)];
        shuffleInPlace([...BOT_NAMES]).slice(0, bots).forEach((name, i) => {
            this.players.push(new Player(i + 1, name, true));
        });
    }

    teardown() {
        this.stopTimer();
        this.clearBotTimers();
        this.turnToken += 1;
        this.isProcessing = false;
        this.flippedCards = [];
    }

    startNewGame() {
        this.teardown();
        this.activePlayerIndex = 0;
        this.blockedPlayerIndex = -1;
        this.players.forEach((p) => {
            p.score = 0;
            p.powers = { block: 1, scanner: 1, shuffle: 1 };
            p.memory.clear();
        });
        this.generateCards();
        this.renderGrid();
        this.renderPlayers();
        this.renderPowers();
        this.updateStatus();
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
        this.clearBotTimers();
        this.flippedCards = [];
        this.isProcessing = false;
        const token = ++this.turnToken;

        if (this.activePlayerIndex === this.blockedPlayerIndex) {
            const frozen = this.getCurrentPlayer();
            this.updateStatus(`${frozen.name} is frozen`);
            this.blockedPlayerIndex = -1;
            this.renderPlayers();
            this.schedule(() => {
                if (this.turnToken !== token) return;
                this.nextTurn();
            }, 1600);
            return;
        }

        this.renderPlayers();
        this.renderPowers();
        this.updateStatus();

        if (this.getCurrentPlayer().isBot) {
            this.processBotTurn(token);
        } else {
            this.startTimer(token);
        }
    }

    endTurn() {
        this.stopTimer();
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
        if (this.isProcessing) return;
        if (this.getCurrentPlayer().isBot) return;
        AudioCtrl.resume();
        this.flipCard(index);
    }

    handleGridKey(event) {
        const current = document.activeElement;
        if (!current || !current.id.startsWith('card-')) return;
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

        AudioCtrl.playFlip();
        card.isFlipped = true;
        this.paintCard(index);
        this.flippedCards.push(index);
        this.notifyBotsOfCard(index, card.icon);

        if (this.flippedCards.length === 2) {
            this.isProcessing = true;
            this.stopTimer();
            this.checkMatch();
        }
        return true;
    }

    checkMatch() {
        const [idx1, idx2] = this.flippedCards;
        const card1 = this.cards[idx1];
        const card2 = this.cards[idx2];
        const token = this.turnToken;

        if (card1.icon === card2.icon) {
            AudioCtrl.playMatch();
            this.schedule(() => {
                if (this.turnToken !== token) return;
                card1.isMatched = true;
                card2.isMatched = true;
                this.paintCard(idx1);
                this.paintCard(idx2);
                const player = this.getCurrentPlayer();
                player.score += CONFIG.MATCH_POINTS;
                this.updateStatus(`${player.name} scored`);
                this.renderPlayers();
                if (this.cards.every((c) => c.isMatched)) {
                    this.handleGameOver();
                    return;
                }
                this.flippedCards = [];
                this.isProcessing = false;
                if (player.isBot) this.processBotTurn(token);
                else this.startTimer(token);
            }, 520);
        } else {
            AudioCtrl.playMiss();
            this.schedule(() => {
                if (this.turnToken !== token) return;
                card1.isFlipped = false;
                card2.isFlipped = false;
                this.paintCard(idx1);
                this.paintCard(idx2);
                this.endTurn();
            }, CONFIG.REVEAL_DELAY_MS);
        }
    }

    handleGameOver() {
        this.stopTimer();
        this.clearBotTimers();
        AudioCtrl.playWin();
        const ranked = [...this.players].sort((a, b) => b.score - a.score);
        const winner = ranked[0];
        const human = this.players.find((p) => !p.isBot);
        const save = loadSave();
        const best = Math.max(Number(save.bestScore) || 0, human?.score || 0);
        writeSave({ bestScore: best, lastWinner: winner.name });

        this.ui.modalTitle.textContent = winner.isBot ? 'Sector lost' : 'Sector cleared';
        this.ui.modalBody.innerHTML = `${ranked.map((p, i) =>
            `<div class="standings ${p === winner ? 'winner' : ''}">${i + 1}. ${escapeHtml(p.name)} — ${p.score}</div>`
        ).join('')}`;
        this.ui.bestScore.textContent = human
            ? `Your score ${human.score} · best ${best}${WorldBridge.verified ? ' · verified human' : ''}`
            : '';
        this.ui.modal.classList.remove('hidden');
        this.ui.modalBtn.focus();
    }

    startTimer(token) {
        const duration = CONFIG.TURN_DURATION_MS;
        this.ui.timerFill.style.transition = 'none';
        this.ui.timerFill.style.width = '100%';
        void this.ui.timerFill.offsetHeight;
        this.ui.timerFill.style.transition = `width ${duration}ms linear`;
        this.ui.timerFill.style.width = '0%';
        if (this.ui.timerBar) this.ui.timerBar.setAttribute('aria-valuenow', '7');

        this.timer = setTimeout(() => {
            if (this.turnToken !== token) return;
            this.flippedCards.forEach((idx) => {
                this.cards[idx].isFlipped = false;
                this.paintCard(idx);
            });
            this.flippedCards = [];
            this.updateStatus("Time's up");
            this.schedule(() => {
                if (this.turnToken !== token) return;
                this.endTurn();
            }, 350);
        }, duration);
    }

    stopTimer() {
        clearTimeout(this.timer);
        this.timer = null;
        this.ui.timerFill.style.transition = 'none';
    }

    schedule(fn, ms) {
        const id = setTimeout(fn, ms);
        this.botTimers.push(id);
        return id;
    }

    clearBotTimers() {
        this.botTimers.forEach((id) => clearTimeout(id));
        this.botTimers = [];
    }

    activatePower(powerType) {
        const player = this.getCurrentPlayer();
        if (player.isBot || this.flippedCards.length > 0 || this.isProcessing) return;
        this.consumePower(player, powerType);
    }

    consumePower(player, powerType) {
        if (player.powers[powerType] <= 0) return false;
        AudioCtrl.playPower();
        player.powers[powerType] -= 1;
        this.renderPowers();
        if (powerType === 'block') this.useBlockPower(player);
        if (powerType === 'scanner') this.useScannerPower();
        if (powerType === 'shuffle') this.useShufflePower();
        return true;
    }

    useBlockPower(player) {
        let next = (this.activePlayerIndex + 1) % this.players.length;
        if (this.players.length > 2 && this.players[next] === player) {
            next = (next + 1) % this.players.length;
        }
        this.blockedPlayerIndex = next;
        this.updateStatus(`${this.players[next].name} will be frozen`);
    }

    useScannerPower() {
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

        if (!reveal.length) {
            this.updateStatus('Nothing left to scan');
            return;
        }

        reveal.forEach((idx) => {
            document.getElementById(`card-${idx}`)?.classList.add('preview');
            this.notifyBotsOfCard(idx, this.cards[idx].icon);
        });
        this.updateStatus('Scanning sector…');
        this.schedule(() => {
            reveal.forEach((idx) => document.getElementById(`card-${idx}`)?.classList.remove('preview'));
        }, CONFIG.SCAN_MS);
    }

    useShufflePower() {
        this.updateStatus('Hyper-shuffling…');
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
        this.players.forEach((p) => {
            if (p.isBot) p.memory.clear();
        });
        this.schedule(() => this.renderGrid(), 280);
    }

    processBotTurn(token) {
        const bot = this.getCurrentPlayer();
        const profile = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;

        this.schedule(() => {
            if (this.turnToken !== token || this.getCurrentPlayer() !== bot) return;
            if (this.maybeBotPower(bot, profile) && this.turnToken !== token) return;

            const known = this.findMatchInMemory(bot);
            if (known) {
                this.flipCard(known[0]);
                this.schedule(() => {
                    if (this.turnToken !== token) return;
                    this.flipCard(known[1]);
                }, 480);
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
            }, 700);
        }, profile.botMs);
    }

    maybeBotPower(bot, profile) {
        if (Math.random() > profile.usePower) return false;
        if (bot.powers.scanner && this.openIndices().length >= 8) {
            return this.consumePower(bot, 'scanner');
        }
        if (bot.powers.shuffle && this.humanHasStrongMemory()) {
            return this.consumePower(bot, 'shuffle');
        }
        if (bot.powers.block) {
            return this.consumePower(bot, 'block');
        }
        return false;
    }

    humanHasStrongMemory() {
        const human = this.players.find((p) => !p.isBot);
        return Boolean(human && human.score >= 30);
    }

    openIndices() {
        return this.cards.map((c, i) => i).filter((i) => !this.cards[i].isMatched && !this.cards[i].isFlipped);
    }

    notifyBotsOfCard(index, icon) {
        const rate = (DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal).memory;
        this.players.forEach((p) => {
            if (p.isBot && Math.random() < rate) p.memory.set(index, icon);
        });
    }

    findMatchInMemory(bot) {
        const seen = {};
        for (const [idx, icon] of bot.memory.entries()) {
            if (this.cards[idx].isMatched || this.cards[idx].isFlipped) continue;
            if (this.cards[idx].icon !== icon) continue;
            if (!seen[icon]) seen[icon] = [];
            seen[icon].push(idx);
            if (seen[icon].length === 2) return seen[icon];
        }
        return null;
    }

    findCardWithIconInMemory(bot, icon, excludeIndex) {
        for (const [idx, memIcon] of bot.memory.entries()) {
            if (memIcon === icon && idx !== excludeIndex && !this.cards[idx].isMatched && !this.cards[idx].isFlipped) {
                return idx;
            }
        }
        return null;
    }

    updateStatus(msg) {
        this.ui.status.textContent = msg || `${this.getCurrentPlayer().name}'s turn`;
    }

    paintCard(index) {
        const card = this.cards[index];
        const el = document.getElementById(`card-${index}`);
        if (!el || !card) return;
        el.classList.toggle('flipped', card.isFlipped || card.isMatched);
        el.classList.toggle('matched', card.isMatched);
        el.setAttribute('aria-pressed', String(card.isFlipped || card.isMatched));
        const face = el.querySelector('.card-front');
        if (face) face.textContent = card.icon;
        if (card.isMatched) el.setAttribute('aria-hidden', 'true');
        else el.removeAttribute('aria-hidden');
    }

    renderGrid() {
        const frag = document.createDocumentFragment();
        this.cards.forEach((card, index) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'card';
            el.id = `card-${index}`;
            el.setAttribute('role', 'gridcell');
            el.setAttribute('aria-label', `Card ${index + 1}`);
            el.setAttribute('aria-pressed', String(card.isFlipped || card.isMatched));
            if (card.isMatched) {
                el.classList.add('matched', 'flipped');
                el.setAttribute('aria-hidden', 'true');
            } else if (card.isFlipped) {
                el.classList.add('flipped');
            }
            const row = Math.floor(index / CONFIG.GRID_SIZE) + 1;
            const col = (index % CONFIG.GRID_SIZE) + 1;
            el.setAttribute('aria-rowindex', String(row));
            el.setAttribute('aria-colindex', String(col));
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
            el.className = `player-card ${idx === this.activePlayerIndex ? 'active' : ''} ${p.isBot ? 'is-bot' : ''}`;
            el.setAttribute('aria-current', idx === this.activePlayerIndex ? 'true' : 'false');
            el.innerHTML = `<div class="player-avatar">${escapeHtml(p.name.slice(0, 2).toUpperCase())}</div>
                <div class="player-name">${escapeHtml(p.name)}</div>
                <div class="player-score">${p.score}</div>`;
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
        if (player.isBot) {
            this.ui.powerCards.innerHTML = '<div class="opp-turn">Opponent turn</div>';
            return;
        }
        const frag = document.createDocumentFragment();
        Object.values(POWERS).forEach((power) => {
            const count = player.powers[power.id];
            const el = document.createElement('button');
            el.type = 'button';
            el.className = `power-card ${count === 0 ? 'disabled' : ''}`;
            el.disabled = count === 0;
            el.title = power.desc;
            el.setAttribute('aria-label', `${power.name}. ${power.desc}. ${count} left`);
            el.innerHTML = `<span class="power-count">${count}</span><span class="icon">${power.icon}</span><span>${power.name}</span>`;
            el.addEventListener('click', () => this.activatePower(power.id));
            frag.appendChild(el);
        });
        this.ui.powerCards.replaceChildren(frag);
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
