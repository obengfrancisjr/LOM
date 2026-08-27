/**
 * Night Match — League of Memory
 * Practice 4×4, first-run coach, targeted Block, bot personas, owner patterns.
 */

const CONFIG = {
    GRID_SIZE: 6,
    PAIRS: 18,
    TURN_DURATION_MS: 7000,
    MATCH_POINTS: 10,
    REVEAL_DELAY_MS: 560,
    SCAN_MS: 3000,
    BOT_TELEGRAPH_MS: 140,
    BOT_FLIP_MS: 560,
    FLIP_MS: 500,
    POWER_EVERY_MATCHES: 2,
    STORAGE_KEY: 'lom.v2',
    PLAYER_COLORS: ['#00f3ff', '#bc13fe', '#8fd9b4', '#e0b86a', '#e05a7a', '#7ab8f0'],
    PRACTICE: { GRID_SIZE: 4, PAIRS: 8, TURN_DURATION_MS: 11000 },
    ENDGAME_OPEN: 6,
};

const PHASE = {
    LOBBY: 'lobby',
    IDLE: 'idle',
    FLIPPING: 'flipping',
    RESOLVING: 'resolving',
    TARGETING: 'targeting',
    BOT: 'bot',
    FROZEN: 'frozen',
    GAMEOVER: 'gameover',
};

const DIFFICULTY = {
    easy:   { memory: 0.16, botMs: 700, usePower: 0.03, forget: 0.55, flub: 0.48, missMemory: 0.18, cap: 4 },
    normal: { memory: 0.52, botMs: 420, usePower: 0.18, forget: 0.16, flub: 0.16, missMemory: 0.50, cap: 8 },
    hard:   { memory: 0.92, botMs: 240,  usePower: 0.40, forget: 0.03, flub: 0.04, missMemory: 0.92, cap: 14 },
};

const BOT_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega'];

const BOT_PERSONAS = {
    Alpha: { prefer: 'scanner', useMult: 1.15 },
    Beta: { prefer: 'block', useMult: 0.85 },
    Gamma: { prefer: 'shuffle', useMult: 1.05 },
    Delta: { prefer: 'block', useMult: 0.7 },
    Omega: { prefer: 'scanner', useMult: 1.25 },
};

const COACH_STEPS = [
    { title: 'Flip two cards', body: 'A match stays face-up. Use those landmarks.' },
    { title: 'Chain for combo', body: 'Keep matching to refill the timer and stack x2, x3…' },
    { title: 'Tap a rival to Block', body: 'Powers are earned every 2 matches. Block freezes who you tap.' },
];

const SW = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';

function seal(inner) {
    return `<svg class="seal" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g ${SW}>${inner}</g></svg>`;
}

const ICONS = [
    { id: 'crescent', label: 'Crescent', svg: seal('<path d="M42 14a22 22 0 1 0 0 36 18 18 0 0 1 0-36z"/>') },
    { id: 'star', label: 'Star', svg: seal('<path d="M32 6l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/>') },
    { id: 'ring', label: 'Ring', svg: seal('<circle cx="32" cy="32" r="11"/><ellipse cx="32" cy="32" rx="26" ry="8" transform="rotate(-22 32 32)"/>') },
    { id: 'spiral', label: 'Spiral', svg: seal('<path d="M32 32c0-6 6-8 10-8s10 6 10 14-10 18-20 18-22-10-22-22 14-26 28-26"/>') },
    { id: 'comet', label: 'Comet', svg: seal('<circle cx="44" cy="20" r="8"/><path d="M38 26L12 52M32 22L16 44M42 30L22 52"/>') },
    { id: 'hex', label: 'Hex', svg: seal('<path d="M32 8l18 10v20L32 56 14 46V26z"/>') },
    { id: 'triad', label: 'Triad', svg: seal('<path d="M32 10l20 36H12z"/><path d="M32 24l10 18H22z"/>') },
    { id: 'gem', label: 'Gem', svg: seal('<path d="M32 8l16 16-16 32L16 24z"/><path d="M16 24h32"/>') },
    { id: 'iris', label: 'Iris', svg: seal('<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="4"/>') },
    { id: 'bolt', label: 'Bolt', svg: seal('<path d="M36 8L18 34h14L28 56l18-26H32z"/>') },
    { id: 'signal', label: 'Signal', svg: seal('<path d="M20 40a16 16 0 0 1 24 0"/><path d="M14 34a24 24 0 0 1 36 0"/><path d="M8 28a32 32 0 0 1 48 0"/><circle cx="32" cy="48" r="3"/>') },
    { id: 'lens', label: 'Lens', svg: seal('<circle cx="32" cy="32" r="16"/><path d="M32 10v8M32 46v8M10 32h8M46 32h8"/>') },
    { id: 'helix', label: 'Helix', svg: seal('<path d="M24 8c12 8 12 16 0 24s-12 16 0 24"/><path d="M40 8c-12 8-12 16 0 24s12 16 0 24"/>') },
    { id: 'orbit', label: 'Orbit', svg: seal('<circle cx="32" cy="32" r="6"/><ellipse cx="32" cy="32" rx="24" ry="12" transform="rotate(30 32 32)"/><circle cx="53" cy="21" r="3"/>') },
    { id: 'cluster', label: 'Cluster', svg: seal('<circle cx="26" cy="26" r="10"/><circle cx="40" cy="26" r="10"/><circle cx="33" cy="40" r="10"/>') },
    { id: 'crest', label: 'Crest', svg: seal('<path d="M32 8c10 6 18 8 18 8v16c0 14-10 22-18 26-8-4-18-12-18-26V16s8-2 18-8z"/>') },
    { id: 'wave', label: 'Wave', svg: seal('<path d="M8 40c8-16 8-16 16 0s8 16 16 0 8-16 16 0"/><path d="M8 28c8-16 8-16 16 0s8 16 16 0 8-16 16 0"/>') },
    { id: 'torch', label: 'Torch', svg: seal('<path d="M32 6l8 16H24z"/><path d="M26 22h12v20H26z"/><path d="M22 42h20v6H22z"/><path d="M24 48h16v6H24z"/>') },
];

function sealById(id) {
    return ICONS.find((item) => item.id === id) || ICONS[0];
}

const PSW = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const POWERS = {
    block: {
        id: 'block',
        name: 'Block',
        desc: 'Tap a rival to freeze them',
        icon: `<svg ${PSW}><rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="M8 8l8 8M16 8l-8 8"/></svg>`,
    },
    scanner: {
        id: 'scanner',
        name: 'Scanner',
        desc: 'Reveal two hidden pairs',
        icon: `<svg ${PSW}><circle cx="12" cy="14" r="2.4"/><path d="M6 14a6 6 0 0 1 12 0"/><path d="M3.5 14a8.5 8.5 0 0 1 17 0"/></svg>`,
    },
    shuffle: {
        id: 'shuffle',
        name: 'Shuffle',
        desc: 'Remix unmatched cards',
        icon: `<svg ${PSW}><rect x="3.5" y="5" width="8" height="11" rx="1.4" transform="rotate(-12 7.5 10.5)"/><rect x="12" y="7" width="8" height="11" rx="1.4" transform="rotate(10 16 12.5)"/></svg>`,
    },
};

const POWER_IDS = Object.keys(POWERS);

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function haptic(pattern) {
    try {
        if (!pattern || !navigator.vibrate) return;
        navigator.vibrate(pattern);
    } catch {
        /* no haptic hardware */
    }
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
        this.voice = 0.2;
    }

    ensure() {
        if (this.ctx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.voice;
        this.masterGain.connect(this.ctx.destination);
    }

    resume() {
        this.ensure();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    setMuted(muted) {
        this.muted = muted;
        this.ensure();
        if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this.voice;
        writeSave({ muted });
    }

    later(ms, fn) {
        window.setTimeout(fn, ms);
    }

    playTone(freq, type, duration, { slideTo = null, peak = 0.45, delay = 0 } = {}) {
        if (this.muted) return;
        this.ensure();
        if (!this.ctx) return;
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 20), t0 + duration);
        }
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    playFlip() {
        this.playTone(392, 'sine', 0.07, { peak: 0.22 });
        this.playTone(196, 'sine', 0.08, { peak: 0.1 });
    }

    playMatch() {
        this.playTone(330, 'triangle', 0.16, { peak: 0.38 });
        this.playTone(494, 'sine', 0.22, { peak: 0.28, delay: 0.07 });
    }

    playMiss() {
        this.playTone(196, 'sine', 0.22, { slideTo: 98, peak: 0.3 });
    }

    playPower() {
        this.playTone(392, 'sine', 0.28, { peak: 0.28 });
        this.playTone(588, 'triangle', 0.32, { peak: 0.18, delay: 0.04 });
    }

    playCombo(level) {
        const n = Math.min(level, 5);
        this.playTone(330 + n * 28, 'triangle', 0.12, { peak: 0.34 });
        this.playTone(494 + n * 36, 'sine', 0.18, { peak: 0.3, delay: 0.06 });
        this.playTone(660 + n * 40, 'triangle', 0.22, { peak: 0.22, delay: 0.12 });
    }

    playWin() {
        [330, 392, 494, 660].forEach((freq, i) => {
            this.playTone(freq, 'triangle', 0.28, { peak: 0.28, delay: i * 0.11 });
        });
    }

    playLose() {
        this.playTone(392, 'sine', 0.36, { slideTo: 164, peak: 0.28 });
        this.playTone(247, 'triangle', 0.4, { peak: 0.14, delay: 0.08 });
    }
}

const AudioCtrl = new SoundEngine();

const WorldBridge = {
    installed: false,
    verified: false,

    appId() {
        const meta = document.querySelector('meta[name="world-app-id"]')?.getAttribute('content')?.trim();
        return meta || '';
    },

    init() {
        const MiniKit = window.MiniKit;
        if (!MiniKit) return false;
        const appId = this.appId();
        try {
            if (appId && typeof MiniKit.install === 'function') {
                const result = MiniKit.install({ appId });
                this.installed = Boolean(result?.success || MiniKit.isInstalled?.());
            } else {
                this.installed = Boolean(MiniKit.isInstalled?.());
            }
        } catch {
            this.installed = Boolean(MiniKit.isInstalled?.());
        }
        return this.installed;
    },

    async verify() {
        const MiniKit = window.MiniKit;
        if (!MiniKit) return { ok: false, reason: 'not-in-world-app' };
        if (!this.installed) this.installed = Boolean(MiniKit.isInstalled?.());
        if (!this.installed) return { ok: false, reason: 'not-in-world-app' };
        try {
            if (!MiniKit.commandsAsync?.verify) {
                return { ok: false, reason: 'sdk-missing-verify' };
            }
            const { finalPayload } = await MiniKit.commandsAsync.verify({
                action: 'play-lom',
                verification_level: 'device',
            });
            this.verified = finalPayload?.status === 'success';
            return { ok: this.verified, payload: finalPayload };
        } catch (err) {
            return { ok: false, reason: err?.message || 'verify-failed' };
        }
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
        this.coachStep = 0;
        this.coachOpen = false;
        this.botRush = false;
        this.matchDifficulty = 'easy';
        this.timer = null;
        this.timerRaf = null;
        this.timerEndsAt = 0;
        this.timerDurationMs = 0;
        this.timerRemainMs = 0;
        this.timerToken = 0;
        this.timerPaused = false;
        this.scanning = false;
        this._powerSig = '';
        this.pending = [];
        const saved = loadSave();
        const unlocked = Boolean(saved.arenaNight || saved.practiceDone);
        this.settings = {
            name: saved.name && saved.name !== 'YOU' ? saved.name : (saved.name || 'You'),
            bots: [1, 2, 3, 5].includes(Number(saved.bots)) ? Number(saved.bots) : 1,
            difficulty: saved.difficulty || 'normal',
            mode: saved.mode === 'arena' && unlocked ? 'arena' : 'practice',
        };
        this.ui = {
            grid: document.getElementById('game-grid'),
            players: document.getElementById('players-panel'),
            status: document.getElementById('game-status'),
            turnName: document.getElementById('turn-name'),
            modeBadge: document.getElementById('mode-badge'),
            comboBadge: document.getElementById('combo-badge'),
            verifiedBadge: document.getElementById('verified-badge'),
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
            homeBtn: document.getElementById('home-btn'),
            bestScore: document.getElementById('best-score'),
            lobbyBest: document.getElementById('lobby-best') || document.getElementById('best-human'),
            startOverlay: document.getElementById('start-overlay'),
            lobbyForm: document.getElementById('lobby-form'),
            playerName: document.getElementById('player-name'),
            verifyBtn: document.getElementById('verify-btn'),
            worldStatus: document.getElementById('world-status'),
            muteBtn: document.getElementById('mute-btn'),
            app: document.querySelector('.app-container'),
            arenaOpts: document.getElementById('arena-opts'),
            diffOpts: document.getElementById('diff-opts'),
            playBtn: document.getElementById('play-btn'),
            modeArena: document.getElementById('mode-arena') || document.querySelector('input[name="mode"][value="arena"]'),
            modeHint: document.getElementById('mode-hint') || document.getElementById('arena-lock'),
            easyBotsHint: document.getElementById('easy-bots-hint'),
            coach: document.getElementById('coach-overlay'),
            coachStepEl: document.getElementById('coach-step'),
            coachTitle: document.getElementById('coach-title'),
            coachBody: document.getElementById('coach-body'),
            coachNext: document.getElementById('coach-next'),
            coachSkip: document.getElementById('coach-skip'),
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
        this.ui.lobbyBtn.addEventListener('click', () => this.returnToLobby());
        this.ui.homeBtn?.addEventListener('click', () => this.returnToLobby());
        this.ui.lobbyForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.collectSettings();
            this.startGameFlow();
        });
        this.ui.lobbyForm.querySelectorAll('input[name="mode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.disabled) return;
                this.settings.mode = input.value === 'practice' ? 'practice' : 'arena';
                this.syncModeFields();
            });
        });
        this.ui.lobbyForm.querySelectorAll('input[name="diff"]').forEach((input) => {
            input.addEventListener('change', () => {
                this.settings.difficulty = input.value;
                this.syncBotChips();
            });
        });
        this.ui.verifyBtn?.addEventListener('click', () => this.handleVerify());
        this.ui.muteBtn.addEventListener('click', () => {
            AudioCtrl.setMuted(!AudioCtrl.muted);
            this.syncMuteButton();
        });
        this.ui.coachNext?.addEventListener('click', () => this.advanceCoach());
        this.ui.coachSkip?.addEventListener('click', () => this.hideCoach(true));
        this.ui.grid.addEventListener('keydown', (event) => this.handleGridKey(event));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.cancelBlockTargeting();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.pauseTimerVisual();
            else this.resumeTimer();
        });
    }

    returnToLobby() {
        this.teardown();
        this.coachOpen = false;
        this.ui.coach?.classList.add('hidden');
        this.ui.modal.classList.add('hidden');
        this.ui.startOverlay.classList.remove('hidden');
        this.setPhase(PHASE.LOBBY);
        this.toast('Lobby');
        this.ui.turnName.textContent = '—';
        this.hideCombo();
        this.setTimerDisplay(this.board().TURN_DURATION_MS / 1000, 1);
        this.hydrateLobby();
    }

    hydrateLobby() {
        const blank = !this.settings.name || this.settings.name === 'You' || this.settings.name === 'YOU';
        this.ui.playerName.value = blank ? '' : this.settings.name;
        const bots = String([1, 2, 3, 5].includes(this.settings.bots) ? this.settings.bots : 1);
        const diff = this.settings.difficulty;
        const mode = this.settings.mode === 'arena' ? 'arena' : 'practice';
        const botsInput = this.ui.lobbyForm.querySelector(`input[name="bots"][value="${bots}"]`);
        const diffInput = this.ui.lobbyForm.querySelector(`input[name="diff"][value="${diff}"]`);
        const modeInput = this.ui.lobbyForm.querySelector(`input[name="mode"][value="${mode}"]`);
        if (botsInput) botsInput.checked = true;
        if (diffInput) diffInput.checked = true;
        if (modeInput && !modeInput.disabled) modeInput.checked = true;
        this.syncArenaLock();
        const best = loadSave().bestScore;
        if (this.ui.lobbyBest) {
            this.ui.lobbyBest.textContent = best ? `Best human score on this device: ${best}` : '';
        }
    }

    arenaUnlocked() {
        const save = loadSave();
        return Boolean(save.arenaNight || save.practiceDone);
    }

    syncArenaLock() {
        const unlocked = this.arenaUnlocked();
        const arenaChip = document.getElementById('chip-arena') || document.getElementById('arena-chip');
        if (this.ui.modeArena) {
            this.ui.modeArena.disabled = !unlocked;
            if (!unlocked) {
                this.settings.mode = 'practice';
                const practiceInput = this.ui.lobbyForm.querySelector('input[name="mode"][value="practice"]');
                if (practiceInput) practiceInput.checked = true;
            }
        }
        arenaChip?.classList.toggle('locked', !unlocked);
        if (this.ui.modeHint) {
            this.ui.modeHint.hidden = unlocked && this.ui.modeHint.id === 'arena-lock';
            this.ui.modeHint.textContent = unlocked
                ? (this.isPractice()
                    ? 'Practice is one Easy bot, a longer timer, and a first-run coach.'
                    : 'Arena Night is 6×6. Gauntlet is five rivals.')
                : 'Finish a Practice night to unlock Arena Night.';
        }
        this.syncBotChips();
        this.syncModeFields();
    }

    syncBotChips() {
        const easy = (this.ui.lobbyForm.querySelector('input[name="diff"]:checked')?.value || this.settings.difficulty) === 'easy';
        const practice = this.settings.mode === 'practice';
        const unlocked = this.arenaUnlocked();
        const showAdvanced = unlocked && !practice && !easy;
        this.ui.lobbyForm.querySelectorAll('.chip.advanced').forEach((el) => {
            el.hidden = !showAdvanced;
            const input = el.querySelector('input');
            if (input) input.disabled = !showAdvanced;
        });
        if (this.ui.easyBotsHint) this.ui.easyBotsHint.hidden = practice || !easy;
        if (!practice && easy) {
            const selected = this.ui.lobbyForm.querySelector('input[name="bots"]:checked');
            if (selected && Number(selected.value) > 2) {
                const two = this.ui.lobbyForm.querySelector('input[name="bots"][value="2"]');
                const one = this.ui.lobbyForm.querySelector('input[name="bots"][value="1"]');
                (two || one).checked = true;
            }
        }
    }

    initWorld() {
        WorldBridge.init();
        this.syncVerifiedBadge();
        if (this.ui.verifyBtn) this.ui.verifyBtn.hidden = true;
    }

    syncVerifiedBadge() {
        this.ui.verifiedBadge?.classList.toggle('hidden', !WorldBridge.verified);
    }

    async handleVerify() {
        if (this.ui.verifyBtn) this.ui.verifyBtn.disabled = true;
        const result = await WorldBridge.verify();
        if (this.ui.verifyBtn) this.ui.verifyBtn.disabled = false;
        this.syncVerifiedBadge();
        return result;
    }

    collectSettings() {
        const name = (this.ui.playerName.value || 'You').trim().slice(0, 16) || 'You';
        const unlocked = this.arenaUnlocked();
        let mode = this.ui.lobbyForm.querySelector('input[name="mode"]:checked')?.value === 'arena'
            ? 'arena'
            : 'practice';
        if (!unlocked) mode = 'practice';
        let bots = Number(this.ui.lobbyForm.querySelector('input[name="bots"]:checked')?.value || 1);
        const difficulty = this.ui.lobbyForm.querySelector('input[name="diff"]:checked')?.value || 'normal';
        if (mode === 'practice') bots = 1;
        else if (difficulty === 'easy' && bots > 2) bots = 2;
        else bots = Math.min(5, Math.max(1, bots));
        this.settings = { ...this.settings, name, bots, difficulty, mode };
        writeSave({ name, bots, difficulty, mode });
        this.syncModeFields();
    }

    setPhase(phase) {
        const prev = this.phase;
        this.phase = phase;
        this.ui.app?.setAttribute('data-phase', phase);
        this.ui.app?.classList.toggle('targeting', phase === PHASE.TARGETING);
        this.renderPowers();
        if (phase === PHASE.TARGETING) this.pauseTimerVisual();
        else if (prev === PHASE.TARGETING && (phase === PHASE.IDLE || phase === PHASE.FLIPPING)) {
            this.resumeTimer();
        }
    }

    canHumanAct() {
        const p = this.getCurrentPlayer();
        return Boolean(p) && !p.isBot && this.phase === PHASE.IDLE && !this.coachOpen;
    }

    canHumanFlip() {
        const p = this.getCurrentPlayer();
        if (!p || p.isBot || this.coachOpen) return false;
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
        const practice = this.isPractice();
        this.matchDifficulty = practice ? 'easy' : (this.settings.difficulty || 'normal');
        let bots = practice ? 1 : Math.min(5, Math.max(1, Number(this.settings.bots) || 1));
        if (!practice && this.matchDifficulty === 'easy') bots = Math.min(bots, 2);
        this.players = [
            new Player(0, this.settings.name, false, CONFIG.PLAYER_COLORS[0]),
        ];
        shuffleInPlace([...BOT_NAMES]).slice(0, bots).forEach((name, i) => {
            this.players.push(new Player(i + 1, name, true, CONFIG.PLAYER_COLORS[(i + 1) % CONFIG.PLAYER_COLORS.length]));
        });
    }

    grantStarterPower(player) {
        player.powers = { block: 0, scanner: 0, shuffle: 0 };
        if (player.isBot && (this.isPractice() || this.matchDifficulty === 'easy')) return;
        const pick = POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)];
        player.powers[pick] = 1;
    }

    grantRandomPower(player) {
        if (player.isBot && (this.isPractice() || this.matchDifficulty === 'easy')) return null;
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
        this.coachOpen = false;
        this.ui.coach?.classList.add('hidden');
        this.scanning = false;
        if (this.phase === PHASE.TARGETING) this.phase = PHASE.IDLE;
        this.turnToken += 1;
        this.unflipOrphans();
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
        this._powerSig = '';
        this.renderPowers();
        this.syncModeFields();
        this.ui.app?.setAttribute('data-mode', this.isPractice() ? 'practice' : 'arena');
        this.maybeShowCoach();
        if (this.coachOpen) {
            this.setPhase(PHASE.IDLE);
            this.setTimerDisplay(this.board().TURN_DURATION_MS / 1000, 1);
            return;
        }
        this.startTurn();
    }

    generateCards() {
        const deck = [];
        const pairs = this.board().PAIRS;
        for (let i = 0; i < pairs; i++) {
            const icon = ICONS[i % ICONS.length].id;
            deck.push(new Card(i * 2, icon));
            deck.push(new Card(i * 2 + 1, icon));
        }
        this.cards = shuffleInPlace(deck);
    }

    getCurrentPlayer() {
        return this.players[this.activePlayerIndex];
    }

    isPractice() {
        return this.settings.mode === 'practice';
    }

    board() {
        if (this.isPractice()) return CONFIG.PRACTICE;
        return {
            GRID_SIZE: CONFIG.GRID_SIZE,
            PAIRS: CONFIG.PAIRS,
            TURN_DURATION_MS: this.matchDifficulty === 'easy' ? 9000 : CONFIG.TURN_DURATION_MS,
        };
    }

    syncModeFields() {
        const practice = this.isPractice();
        if (this.ui.arenaOpts) this.ui.arenaOpts.hidden = practice;
        if (this.ui.diffOpts) this.ui.diffOpts.hidden = practice;
        if (this.ui.playBtn) this.ui.playBtn.textContent = practice ? 'Play' : 'Enter Arena Night';
        if (this.ui.modeBadge) {
            this.ui.modeBadge.classList.toggle('hidden', !practice);
            this.ui.modeBadge.textContent = practice ? 'Practice 4×4' : 'Arena Night';
        }
    }

    unflipOrphans() {
        this.cards.forEach((c, i) => {
            if (c.isFlipped && !c.isMatched) {
                c.isFlipped = false;
                this.paintCard(i);
            }
        });
        this.flippedCards = [];
    }

    startTurn() {
        if (this.coachOpen) return;
        this.stopTimer();
        this.clearPending();
        this.unflipOrphans();
        this.combo = 0;
        this.hideCombo();
        if (!this.getCurrentPlayer()?.isBot) this.botRush = false;
        const token = ++this.turnToken;

        if (this.cards.every((c) => c.isMatched)) {
            this.handleGameOver();
            return;
        }

        const skipFreeze = this.activePlayerIndex === this.blockedPlayerIndex
            || Boolean(this.getCurrentPlayer()?.frozen);
        if (skipFreeze) {
            const frozen = this.getCurrentPlayer();
            frozen.frozen = true;
            this.blockedPlayerIndex = -1;
            this.setPhase(PHASE.FROZEN);
            this.renderPlayers();
            this.ui.turnName.textContent = `${frozen.name} skipped`;
            this.toast(`${frozen.name} skips this turn`);
            this.setTimerDisplay(0, 0);
            this.schedule(() => {
                if (this.turnToken !== token) return;
                frozen.frozen = false;
                this.nextTurn();
            }, this.botRush ? 220 : 420);
            return;
        }

        this.renderPlayers();
        this._powerSig = '';
        this.renderPowers();
        const player = this.getCurrentPlayer();
        this.ui.turnName.textContent = player.isBot ? `${player.name}'s turn` : 'YOUR TURN';
        this.toast(player.isBot ? `${player.name} is thinking…` : 'Your move');

        if (player.isBot) {
            this.setPhase(PHASE.BOT);
            this.processBotTurn(token);
        } else {
            this.setPhase(PHASE.IDLE);
            this.startTimer(token);
        }
    }

    endTurn() {
        this.stopTimer();
        this.unflipOrphans();
        this.combo = 0;
        this.hideCombo();
        this.nextTurn();
    }

    nextTurn() {
        if (this.cards.every((c) => c.isMatched)) {
            this.handleGameOver();
            return;
        }
        if (!this.players.length) {
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
        const size = this.board().GRID_SIZE;
        const col = index % size;
        const row = Math.floor(index / size);
        let next = index;
        if (event.key === 'ArrowRight') next = row * size + ((col + 1) % size);
        else if (event.key === 'ArrowLeft') next = row * size + ((col + size - 1) % size);
        else if (event.key === 'ArrowDown') next = ((row + 1) % size) * size + col;
        else if (event.key === 'ArrowUp') next = ((row + size - 1) % size) * size + col;
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
        const actor = this.getCurrentPlayer();
        const easy = this.isPractice() || this.matchDifficulty === 'easy';
        if (easy) {
            if (actor?.isBot) this.rememberCard(actor, index, card.icon, 1);
        } else {
            this.notifyBotsOfCard(index, card.icon);
        }

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

            this.showCombo(this.combo);
            this.floatPoints(points, player.color);
            this.toast(this.combo > 1 ? `Combo x${this.combo} · +${points}` : `Match · +${points}`);
            this.schedule(() => {
                if (this.turnToken !== token) return;
                if (this.combo > 1) {
                    AudioCtrl.playCombo(this.combo);
                    haptic([14, 36, 18, 52]);
                } else {
                    AudioCtrl.playMatch();
                    haptic(24);
                }
            }, 180);

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
                    if (this.grantRandomPower(player)) {
                        this._powerSig = '';
                        this.renderPowers();
                        AudioCtrl.playPower();
                    }
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
            }, player.isBot ? 420 : 480);
        } else {
            if (!player.isBot) this.botRush = true;
            this.schedule(() => {
                if (this.turnToken !== token) return;
                AudioCtrl.playMiss();
                haptic(28);
            }, 180);
            this.combo = 0;
            this.hideCombo();
            this.toast('Miss');
            this.ui.grid.classList.add('board-miss');
            [idx1, idx2].forEach((idx) => document.getElementById(`card-${idx}`)?.classList.add('miss'));
            const profile = this.botProfile();
            this.players.forEach((p) => {
                if (!p.isBot) return;
                this.rememberCard(p, idx1, card1.icon, profile.missMemory);
                this.rememberCard(p, idx2, card2.icon, profile.missMemory);
            });

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

        if (this.isPractice()) writeSave({ practiceDone: true, arenaNight: true });

        const ranked = [...this.players].sort((a, b) =>
            b.score - a.score
            || b.matches - a.matches
            || (b.bestCombo || 0) - (a.bestCombo || 0)
            || Number(a.isBot) - Number(b.isBot)
        );
        const winner = ranked[0];
        if (winner && !winner.isBot) AudioCtrl.playWin();
        else AudioCtrl.playLose();
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
        this.ui.modalTitle.textContent = isDraw ? 'Draw' : (winner.isBot ? 'Night lost' : 'Night cleared');
        this.ui.modalBody.innerHTML = ranked.map((p, i) =>
            `<div class="standings ${!isDraw && p === winner ? 'winner' : ''}" style="--p:${p.color}">
                <span>${i + 1}. ${escapeHtml(p.name)}</span>
                <span>${p.score} pts · ${p.matches} pairs · best x${p.bestCombo || 1}</span>
            </div>`
        ).join('');
        this.ui.bestScore.textContent = human
            ? `Your score ${human.score} · best ${best} · run combo x${this.bestComboRun}`
            : '';
        this.ui.modal.classList.remove('hidden');
        this.ui.modalBtn.focus();
        this.toast('Night complete');
    }

    shouldPauseTimer() {
        if (this.coachOpen) return true;
        if (document.hidden) return true;
        if (this.phase === PHASE.TARGETING) return true;
        if (this.scanning) return true;
        if (this.ui.coach && !this.ui.coach.classList.contains('hidden')) return true;
        return false;
    }

    startTimer(token, refill = false) {
        this.stopTimer(false);
        const duration = this.board().TURN_DURATION_MS;
        this.timerDurationMs = duration;
        this.timerRemainMs = duration;
        this.timerToken = token;
        this.timerPaused = false;
        this.timerEndsAt = performance.now() + duration;
        if (this.shouldPauseTimer()) {
            this.pauseTimerVisual();
            this.setTimerDisplay(duration / 1000, 1);
            return;
        }
        this.armTimer(token, duration, refill);
    }

    armTimer(token, remainMs, refill = false) {
        this.timerPaused = false;
        this.timerRemainMs = remainMs;
        this.timerToken = token;
        this.timerEndsAt = performance.now() + remainMs;
        const duration = this.timerDurationMs || remainMs;
        const ratio = duration ? remainMs / duration : 0;
        if (this.ui.timerFill) {
            this.ui.timerFill.style.transition = 'none';
            this.ui.timerFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
            void this.ui.timerFill.offsetHeight;
            this.ui.timerFill.style.transition = `width ${remainMs}ms linear`;
            this.ui.timerFill.style.width = '0%';
        }
        this.ui.timerBar?.classList.toggle('urgent', remainMs <= 2000);
        if (refill) {
            this.ui.timerBar?.classList.remove('refilled');
            void this.ui.timerBar?.offsetWidth;
            this.ui.timerBar?.classList.add('refilled');
        }
        this.setTimerDisplay(remainMs / 1000, ratio);

        const tick = () => {
            if (this.turnToken !== token || this.timerPaused) return;
            const left = Math.max(0, this.timerEndsAt - performance.now());
            this.setTimerDisplay(left / 1000, left / duration);
            this.ui.timerBar?.classList.toggle('urgent', left <= 2000);
            if (left > 0) this.timerRaf = requestAnimationFrame(tick);
        };
        this.timerRaf = requestAnimationFrame(tick);

        this.timer = setTimeout(() => {
            if (this.turnToken !== token || this.timerPaused) return;
            this.onTurnTimeout(token);
        }, remainMs);
    }

    pauseTimerVisual() {
        if (this.timerPaused) return;
        if (!this.timerEndsAt && !this.timer && !this.timerRaf) return;
        const left = this.timerEndsAt
            ? Math.max(0, this.timerEndsAt - performance.now())
            : this.timerRemainMs;
        this.timerRemainMs = left;
        this.timerPaused = true;
        clearTimeout(this.timer);
        this.timer = null;
        if (this.timerRaf) cancelAnimationFrame(this.timerRaf);
        this.timerRaf = null;
        const duration = this.timerDurationMs || this.board().TURN_DURATION_MS;
        const ratio = duration ? left / duration : 0;
        if (this.ui.timerFill) {
            this.ui.timerFill.style.transition = 'none';
            this.ui.timerFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
        }
        this.setTimerDisplay(left / 1000, ratio);
    }

    resumeTimer() {
        if (!this.timerPaused) return;
        if (this.shouldPauseTimer()) return;
        if (this.turnToken !== this.timerToken) return;
        const p = this.getCurrentPlayer();
        if (!p || p.isBot) return;
        if (this.phase !== PHASE.IDLE && this.phase !== PHASE.FLIPPING) return;
        if (this.timerRemainMs <= 0) {
            this.timerPaused = false;
            this.onTurnTimeout(this.timerToken);
            return;
        }
        this.armTimer(this.timerToken, this.timerRemainMs, false);
    }

    onTurnTimeout(token) {
        if (this.phase === PHASE.RESOLVING) return;
        this.unflipOrphans();
        this.combo = 0;
        this.hideCombo();
        this.toast("Time's up");
        this.schedule(() => {
            if (this.turnToken !== token) return;
            this.endTurn();
        }, 280);
    }

    stopTimer(resetDisplay = true) {
        clearTimeout(this.timer);
        this.timer = null;
        if (this.timerRaf) cancelAnimationFrame(this.timerRaf);
        this.timerRaf = null;
        this.timerPaused = false;
        this.timerEndsAt = 0;
        if (this.ui.timerFill) this.ui.timerFill.style.transition = 'none';
        this.ui.timerBar?.classList.remove('urgent', 'refilled');
        if (resetDisplay) this.setTimerDisplay(0, 0);
    }

    setTimerDisplay(seconds, ratio) {
        const s = Math.max(0, seconds);
        if (this.ui.timerDigits) this.ui.timerDigits.textContent = s.toFixed(1);
        this.ui.timerBar?.setAttribute('aria-valuenow', String(Math.ceil(s)));
        this.ui.timerBar?.setAttribute('aria-valuemax', String(Math.round(this.board().TURN_DURATION_MS / 1000)));
        if (ratio != null && !this.timer && this.ui.timerFill) {
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
        if (powerType === 'block') {
            this.beginBlockTargeting();
            return;
        }
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
        if (powerType === 'block') {
            return this.useBlockPower(player);
        }
        AudioCtrl.playPower();
        haptic(18);
        player.powers[powerType] -= 1;
        this._powerSig = '';
        this.renderPowers();
        if (powerType === 'scanner') this.useScannerPower(player);
        if (powerType === 'shuffle') this.useShufflePower(player);
        return true;
    }

    useBlockPower(player) {
        const rivals = this.players
            .map((p, idx) => ({ p, idx }))
            .filter(({ p, idx }) => p.id !== player.id && !p.frozen && idx !== this.blockedPlayerIndex);
        if (!rivals.length) {
            this.toast('No rival to freeze');
            return false;
        }
        const human = rivals.find(({ p }) => !p.isBot);
        const pick = (human && human.p.score >= player.score)
            ? human
            : rivals.reduce((best, cur) => (cur.p.score > best.p.score ? cur : best));
        return this.applyBlock(pick.idx);
    }

    beginBlockTargeting() {
        const me = this.getCurrentPlayer();
        if (!me || me.powers.block <= 0) return false;
        const rivals = this.players.filter((p, idx) => p.id !== me.id && !p.frozen && idx !== this.blockedPlayerIndex);
        if (!rivals.length) {
            this.toast('No rival to freeze');
            return false;
        }
        this.setPhase(PHASE.TARGETING);
        this.ui.powerHint.textContent = 'tap a rival · Esc cancel';
        this.toast('Tap a rival to freeze');
        this.renderPlayers();
        return true;
    }

    cancelBlockTargeting() {
        if (this.phase !== PHASE.TARGETING) return;
        this.setPhase(PHASE.IDLE);
        this.ui.powerHint.textContent = '';
        this.renderPlayers();
        this.toast('Block cancelled');
    }

    applyBlock(targetIndex) {
        const target = this.players[targetIndex];
        const caster = this.getCurrentPlayer();
        if (!target || !caster || target.id === caster.id || target.frozen) return false;
        if (targetIndex === this.blockedPlayerIndex) return false;
        if (caster.powers.block <= 0) return false;
        if (!caster.isBot && this.phase !== PHASE.TARGETING) return false;
        caster.powers.block -= 1;
        this.blockedPlayerIndex = targetIndex;
        target.frozen = true;
        AudioCtrl.playPower();
        haptic(18);
        if (this.phase === PHASE.TARGETING) this.setPhase(PHASE.IDLE);
        this.renderPlayers();
        this._powerSig = '';
        this.renderPowers();
        this.toast(`${target.name} will be frozen`);
        this.ui.powerHint.textContent = 'block armed';
        return true;
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
            if (player.isBot) this.rememberCard(player, idx, this.cards[idx].icon, 1);
        });
        this.toast('Scanning sector…');
        this.ui.powerHint.textContent = 'scanner live';
        this.scanning = true;
        this.pauseTimerVisual();
        this.schedule(() => {
            reveal.forEach((idx) => document.getElementById(`card-${idx}`)?.classList.remove('preview'));
            this.scanning = false;
            if (!player.isBot) this.ui.powerHint.textContent = '';
            this.resumeTimer();
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
        if (!bot) {
            this.endTurn();
            return;
        }
        const profile = this.botProfile();

        this.ui.turnName.textContent = `${bot.name}'s turn`;
        const think = this.botThinkMs();
        const gap = this.botFlipGap();
        this.schedule(() => {
            if (this.turnToken !== token || this.getCurrentPlayer() !== bot) return;

            if (this.phase === PHASE.BOT) this.maybeBotPower(bot, profile);

            this.schedule(() => {
                if (this.turnToken !== token || this.getCurrentPlayer() !== bot) return;

                const known = this.findMatchInMemory(bot);
                const useKnown = known && Math.random() >= (profile.flub || 0);
                if (useKnown) {
                    this.flipCard(known[0]);
                    this.schedule(() => {
                        if (this.turnToken !== token) return;
                        this.flipCard(known[1]);
                    }, gap);
                    return;
                }

                const unknown = this.openIndices().filter((i) => !bot.memory.has(i));
                const pool = unknown.length ? unknown : this.openIndices();
                if (!pool.length) {
                    this.unflipOrphans();
                    this.endTurn();
                    return;
                }
                const first = pool[Math.floor(Math.random() * pool.length)];
                this.flipCard(first);
                const remembered = this.findCardWithIconInMemory(bot, this.cards[first].icon, first);

                this.schedule(() => {
                    if (this.turnToken !== token) return;
                    if (remembered !== null && Math.random() >= (profile.flub || 0)) {
                        this.flipCard(remembered);
                        return;
                    }
                    const rest = this.openIndices().filter((i) => i !== first);
                    if (rest.length) {
                        this.flipCard(rest[Math.floor(Math.random() * rest.length)]);
                        return;
                    }
                    this.unflipOrphans();
                    this.endTurn();
                }, gap);
            }, this.botTelegraphMs());
        }, think);
    }

    botRushing() {
        const nBots = this.players.filter((p) => p.isBot).length;
        return Boolean(this.botRush) || nBots >= 3;
    }

    botThinkMs() {
        const base = (this.botProfile().botMs) || 420;
        // Rush only the wait BEFORE the first card, never the card itself.
        return this.botRushing() ? Math.min(180, Math.round(base * 0.4)) : base;
    }

    botTelegraphMs() {
        return this.botRushing() ? 80 : CONFIG.BOT_TELEGRAPH_MS;
    }

    botFlipGap() {
        // Readable hold: flip animation + a beat with the seal face-up.
        return CONFIG.BOT_FLIP_MS;
    }

    botProfile() {
        const base = { ...(DIFFICULTY[this.matchDifficulty] || DIFFICULTY.normal) };
        if (this.isPractice()) {
            base.flub = Math.min(0.62, (base.flub || 0) + 0.12);
            base.usePower = 0;
            base.cap = Math.min(base.cap || 4, 3);
            return base;
        }
        const open = this.openIndices().length;
        if (this.matchDifficulty === 'easy' || open > CONFIG.ENDGAME_OPEN) return base;
        return {
            ...base,
            memory: Math.min(0.99, base.memory + 0.12),
            flub: Math.max(0, (base.flub || 0) - 0.08),
        };
    }

    maybeBotPower(bot, profile) {
        if (!profile.usePower) return false;
        const persona = BOT_PERSONAS[bot.name] || { prefer: 'scanner', useMult: 1 };
        if (Math.random() > profile.usePower * persona.useMult) return false;

        const open = this.openIndices().length;
        if (this.matchDifficulty !== 'easy' && open <= CONFIG.ENDGAME_OPEN && bot.powers.scanner && this.hiddenPairCount()) {
            return this.consumePower(bot, 'scanner');
        }
        if (bot.powers[persona.prefer]) {
            if (persona.prefer === 'scanner' && !this.hiddenPairCount()) {
                /* fall through */
            } else {
                return this.consumePower(bot, persona.prefer);
            }
        }
        if (bot.powers.scanner && this.hiddenPairCount()) return this.consumePower(bot, 'scanner');
        const human = this.players.find((p) => !p.isBot);
        if (bot.powers.shuffle && human && human.score >= bot.score && this.openIndices().length >= 2) {
            return this.consumePower(bot, 'shuffle');
        }
        if (bot.powers.block) return this.consumePower(bot, 'block');
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

    rememberCard(bot, index, icon, rate = 1) {
        if (!bot?.isBot) return;
        if (Math.random() >= rate) return;
        bot.memory.set(index, icon);
        const cap = this.botProfile().cap || 12;
        while (bot.memory.size > cap) {
            const keys = [...bot.memory.keys()];
            bot.memory.delete(keys[Math.floor(Math.random() * keys.length)]);
        }
    }

    notifyBotsOfCard(index, icon, forceRate = null) {
        const profile = this.botProfile();
        const rate = forceRate == null ? profile.memory : forceRate;
        this.players.forEach((p) => {
            if (!p.isBot) return;
            this.rememberCard(p, index, icon, rate);
            if (p.memory.size && Math.random() < profile.forget) {
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
        el.style.setProperty('--float-color', color || '#8fd9b4');
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    paintCard(index, justMatched = false) {
        const card = this.cards[index];
        const el = document.getElementById(`card-${index}`);
        if (!el || !card) return;
        const seal = sealById(card.icon);

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
            const color = owner?.color || '#8fd9b4';
            el.style.setProperty('--owner', color);
            if (owner) el.dataset.owner = String(owner.id);
            el.setAttribute('aria-label', `Matched ${seal.label}`);
            el.removeAttribute('aria-hidden');
        } else {
            el.classList.remove('claimed');
            el.style.removeProperty('--owner');
            delete el.dataset.owner;
            el.setAttribute('aria-label', open ? `Card ${seal.label}` : `Card ${index + 1} face down`);
            el.removeAttribute('aria-hidden');
        }

        const face = el.querySelector('.card-front');
        if (face) face.innerHTML = seal.svg;
        if (justMatched) {
            this.schedule(() => el.classList.remove('just-matched'), 700);
        }
    }

    renderGrid() {
        const size = this.board().GRID_SIZE;
        this.ui.grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        this.ui.grid.style.gridTemplateRows = `repeat(${size}, 1fr)`;
        this.ui.grid.setAttribute('aria-rowcount', String(size));
        this.ui.grid.setAttribute('aria-colcount', String(size));
        this.ui.grid.classList.toggle('cols-4', size === 4);

        const frag = document.createDocumentFragment();
        this.cards.forEach((card, index) => {
            const seal = sealById(card.icon);
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'card';
            el.id = `card-${index}`;
            el.setAttribute('role', 'gridcell');
            const row = Math.floor(index / size) + 1;
            const col = (index % size) + 1;
            el.setAttribute('aria-rowindex', String(row));
            el.setAttribute('aria-colindex', String(col));

            const open = card.isFlipped || card.isMatched;
            if (open) el.classList.add('flipped');
            if (card.isMatched) {
                el.classList.add('matched', 'claimed');
                el.disabled = true;
                const owner = this.players.find((p) => p.id === card.ownerId);
                if (owner) {
                    el.style.setProperty('--owner', owner.color);
                    el.dataset.owner = String(owner.id);
                }
            }

            el.setAttribute('aria-pressed', String(open));
            el.setAttribute('aria-label', card.isMatched ? `Matched ${seal.label}` : open ? `Card ${seal.label}` : `Card ${index + 1} face down`);
            el.innerHTML = `<span class="card-inner"><span class="card-front">${seal.svg}</span><span class="card-back" aria-hidden="true"></span></span>`;
            el.addEventListener('click', () => this.handleCardClick(index));
            frag.appendChild(el);
        });
        this.ui.grid.replaceChildren(frag);
    }

    renderPlayers() {
        const targeting = this.phase === PHASE.TARGETING;
        const me = this.getCurrentPlayer();
        const frag = document.createDocumentFragment();
        this.players.forEach((p, idx) => {
            const el = document.createElement('button');
            el.type = 'button';
            const active = idx === this.activePlayerIndex;
            const willFreeze = idx === this.blockedPlayerIndex || p.frozen;
            const canTarget = targeting && me && p.id !== me.id && !p.frozen && idx !== this.blockedPlayerIndex;
            el.className = `player-card ${active ? 'active' : ''} ${p.isBot ? 'is-bot' : ''} ${willFreeze ? 'frozen' : ''} ${canTarget ? 'targetable' : ''}`;
            el.style.setProperty('--p', p.color);
            el.setAttribute('aria-current', active ? 'true' : 'false');
            el.disabled = targeting && !canTarget;
            if (canTarget) {
                el.setAttribute('aria-label', `Freeze ${p.name}`);
                el.addEventListener('click', () => {
                    if (this.phase !== PHASE.TARGETING) return;
                    this.applyBlock(idx);
                });
            }
            el.innerHTML = `
                <span class="player-pip" aria-hidden="true"></span>
                <span class="player-name">${escapeHtml(p.name)}</span>
                <span class="player-score">${p.score}</span>
                ${willFreeze ? '<span class="freeze-tag">frozen</span>' : ''}`;
            frag.appendChild(el);
        });
        this.ui.players.replaceChildren(frag);
        if (!targeting) {
            this.ui.players.children[this.activePlayerIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    }

    renderPowers() {
        const player = this.getCurrentPlayer();
        const counts = player ? POWER_IDS.map((id) => player.powers[id]).join(',') : '';
        const sig = `${this.phase}|${player?.id ?? 'x'}|${counts}|${this.canHumanAct()}`;
        if (sig === this._powerSig) return;
        this._powerSig = sig;

        if (!player || this.phase === PHASE.LOBBY || this.phase === PHASE.GAMEOVER) {
            this.ui.powerCards.innerHTML = '<div class="opp-turn">Powers ready in the night</div>';
            return;
        }

        if (player.isBot || this.phase === PHASE.BOT || this.phase === PHASE.FROZEN) {
            this.ui.powerCards.innerHTML = `<div class="opp-turn">${escapeHtml(player.name)}'s turn</div>`;
            return;
        }

        if (this.phase === PHASE.RESOLVING) {
            this.ui.powerCards.innerHTML = '<div class="opp-turn">Resolving…</div>';
            return;
        }

        if (this.phase === PHASE.TARGETING) {
            this.ui.powerCards.innerHTML = '<div class="opp-turn">Tap a rival · Esc cancel</div>';
            if (this.ui.powerHint) this.ui.powerHint.textContent = 'tap a rival · Esc cancel';
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

    maybeShowCoach() {
        if (!this.isPractice()) return;
        if (loadSave().seenCoach) return;
        if (!this.ui.coach) return;
        this.coachStep = 0;
        this.coachOpen = true;
        this.paintCoach();
        this.ui.coach.classList.remove('hidden');
    }

    paintCoach() {
        const step = COACH_STEPS[this.coachStep] || COACH_STEPS[0];
        if (this.ui.coachStepEl) this.ui.coachStepEl.textContent = `${this.coachStep + 1} / ${COACH_STEPS.length}`;
        if (this.ui.coachTitle) this.ui.coachTitle.textContent = step.title;
        if (this.ui.coachBody) this.ui.coachBody.textContent = step.body;
        if (this.ui.coachNext) this.ui.coachNext.textContent = this.coachStep >= COACH_STEPS.length - 1 ? 'Play' : 'Next';
    }

    advanceCoach() {
        if (this.coachStep >= COACH_STEPS.length - 1) {
            this.hideCoach(true);
            return;
        }
        this.coachStep += 1;
        this.paintCoach();
    }

    hideCoach(markSeen) {
        const wasOpen = this.coachOpen;
        this.coachOpen = false;
        this.ui.coach?.classList.add('hidden');
        if (markSeen) writeSave({ seenCoach: true });
        if (wasOpen && this.cards.length && this.phase !== PHASE.LOBBY && this.phase !== PHASE.GAMEOVER) {
            this.startTurn();
        }
    }

    syncMuteButton() {
        this.ui.muteBtn.setAttribute('aria-pressed', String(AudioCtrl.muted));
        this.ui.muteBtn.setAttribute('aria-label', AudioCtrl.muted ? 'Unmute sound' : 'Mute sound');
        this.ui.muteBtn.classList.toggle('is-muted', AudioCtrl.muted);
    }
}

function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.location.protocol.startsWith('http')) return;
    navigator.serviceWorker.register('./sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            sw?.addEventListener('statechange', () => {
                if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                    document.getElementById('sw-toast')?.classList.remove('hidden');
                }
            });
        });
    }).catch(() => {});
    document.getElementById('sw-refresh')?.addEventListener('click', () => location.reload());
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    if (new URLSearchParams(location.search).has('debug')) {
        window.lomGame = game;
    }
    registerWorker();
});
