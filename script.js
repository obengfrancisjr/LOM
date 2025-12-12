/**
 * League of Memory (LOM) - Script v2.0
 * Features: Web Audio API SFX, World ID Integration, Accessibility
 * @author Antigravity Agent
 */

// --- Constants & Config ---
const CONFIG = {
    GRID_SIZE: 6,
    TOTAL_CARDS: 36,
    PAIRS: 18,
    TURN_DURATION_MS: 7000,
    MATCH_POINTS: 10,
    REVEAL_DELAY_MS: 1000,
    BOT_SPEED_MS: 1500,
};

const POWERS = {
    BLOCK: { id: 'block', name: 'Block', icon: '⛔', desc: 'Skip next opp turn', cost: 1 },
    SCANNER: { id: 'scanner', name: 'Scanner', icon: '👁️', desc: 'Reveal 2 pairs', cost: 1 },
    SHUFFLE: { id: 'shuffle', name: 'Shuffle', icon: '🔀', desc: 'Shuffle hidden cards', cost: 1 }
};

const ICONS = [
    '🚀', '🛸', '🪐', '🌌', '⭐', '☄️',
    '🤖', '👾', '🔋', '⚡', '📡', '🔭',
    '💎', '💠', '🧿', '🧬', '⚛️', '🦠'
];

// --- Sci-Fi Sound Engine (Web Audio API) ---
class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Volume
        this.masterGain.connect(this.ctx.destination);
    }

    playTone(freq, type, duration, slideTo = null) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playFlip() {
        // High-tech blip
        this.playTone(800, 'sine', 0.1, 1200);
    }

    playMatch() {
        // Success chord
        this.playTone(440, 'triangle', 0.3); // A4
        setTimeout(() => this.playTone(554, 'triangle', 0.3), 100); // C#5
        setTimeout(() => this.playTone(659, 'triangle', 0.4), 200); // E5
    }

    playError() {
        this.playTone(150, 'sawtooth', 0.2, 50);
    }

    playPower() {
        // Power up sweep
        this.playTone(200, 'square', 0.6, 800);
    }

    playWin() {
        // Victory fanfare sequence
        [523, 659, 783, 1046].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.4), i * 150);
        });
    }
}

const AudioCtrl = new SoundEngine();

// --- World ID Integration ---
const WorldID = {
    isVerified: false,

    init: function (callback) {
        // Check if IDKit is loaded
        if (window.IDKit) {
            window.IDKit.init({
                app_id: "app_staging_YOUR_APP_ID", // TODO: User to replace this
                action: "play-lom",
                onSuccess: (result) => {
                    console.log("Creating proof...", result);
                },
                handleVerify: (verifyResult) => {
                    console.log("Verification success!", verifyResult);
                    this.isVerified = true;
                    callback();
                },
                verification_level: "orb" // or "device"
            });
        } else {
            console.warn("World ID SDK not active. Running in simulation mode.");
            // For testing without SDK, just callback
            // callback(); 
        }
    },

    open: function () {
        if (window.IDKit) {
            window.IDKit.open();
        } else {
            console.log("Simulating World ID check...");
            this.isVerified = true;
            return true;
        }
    }
};

// --- Game Classes ---

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

        this.ui = {
            grid: document.getElementById('game-grid'),
            players: document.getElementById('players-panel'),
            status: document.getElementById('game-status'),
            timerFill: document.getElementById('timer-fill'),
            powerCards: document.getElementById('power-cards'),
            modal: document.getElementById('modal-overlay'),
            modalTitle: document.getElementById('modal-title'),
            modalBody: document.getElementById('modal-body'),
            modalBtn: document.getElementById('modal-btn'),
            startOverlay: document.getElementById('start-overlay'),
            verifyBtn: document.getElementById('verify-btn')
        };

        this.bindEvents();
    }

    bindEvents() {
        this.ui.modalBtn.addEventListener('click', () => {
            this.ui.modal.classList.add('hidden');
            this.startNewGame();
        });

        if (this.ui.verifyBtn) {
            this.ui.verifyBtn.addEventListener('click', () => {
                // If SDK present, open it. If not, auto-start.
                if (WorldID.open()) {
                    this.startGameFlow();
                } else {
                    // Actual SDK callback will trigger this via init handleVerify
                    // This path is for the simulation fallback
                }
            });
            // Hook actual WorldID callback
            WorldID.init(() => this.startGameFlow());
        } else {
            // Direct start if no verify button (e.g. dev mode)
            this.setupPlayers();
            this.startNewGame();
        }
    }

    startGameFlow() {
        if (this.ui.startOverlay) this.ui.startOverlay.classList.add('hidden');
        this.setupPlayers();
        this.startNewGame();
        AudioCtrl.playPower(); // Intro sound
    }

    setupPlayers() {
        this.players = [
            new Player(0, 'Human', false),
            new Player(1, 'Bot Alpha', true),
            new Player(2, 'Bot Beta', true),
            new Player(3, 'Bot Gamma', true),
            new Player(4, 'Bot Delta', true),
            new Player(5, 'Bot Omega', true),
        ];
    }

    startNewGame() {
        this.activePlayerIndex = 0;
        this.blockedPlayerIndex = -1;
        this.flippedCards = [];
        this.isProcessing = false;
        this.players.forEach(p => {
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
        let deck = [];
        for (let i = 0; i < CONFIG.PAIRS; i++) {
            const icon = ICONS[i % ICONS.length];
            deck.push(new Card(i * 2, icon));
            deck.push(new Card(i * 2 + 1, icon));
        }
        deck.sort(() => Math.random() - 0.5);
        this.cards = deck;
    }

    startTurn() {
        this.stopTimer();
        this.flippedCards = [];
        this.isProcessing = false;

        if (this.activePlayerIndex === this.blockedPlayerIndex) {
            this.updateStatus(`${this.getCurrentPlayer().name} is Frozen!`);
            this.blockedPlayerIndex = -1;
            setTimeout(() => this.nextTurn(), 2500);
            return;
        }

        this.renderPlayers();
        this.renderPowers();
        this.updateStatus();

        const player = this.getCurrentPlayer();
        this.startTimer();

        if (player.isBot) {
            this.processBotTurn();
        }
    }

    endTurn() {
        this.stopTimer();
        this.nextTurn();
    }

    nextTurn() {
        this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
        if (this.cards.every(c => c.isMatched)) {
            this.handleGameOver();
        } else {
            this.startTurn();
        }
    }

    handleCardClick(index) {
        if (this.isProcessing) return;
        const player = this.getCurrentPlayer();
        if (player.isBot) return;

        // Resume Audio Context on first interaction
        if (AudioCtrl.ctx.state === 'suspended') AudioCtrl.ctx.resume();

        this.flipCard(index);
    }

    flipCard(index) {
        const card = this.cards[index];
        if (card.isFlipped || card.isMatched) return;

        AudioCtrl.playFlip();

        card.isFlipped = true;
        const cardEl = document.getElementById(`card-${index}`);
        cardEl.classList.add('flipped');
        cardEl.setAttribute('aria-pressed', 'true');

        this.flippedCards.push(index);
        this.notifyBotsOfCard(index, card.icon);

        if (this.flippedCards.length === 2) {
            this.isProcessing = true;
            this.stopTimer();
            this.checkMatch();
        }
    }

    checkMatch() {
        const [idx1, idx2] = this.flippedCards;
        const card1 = this.cards[idx1];
        const card2 = this.cards[idx2];

        if (card1.icon === card2.icon) {
            AudioCtrl.playMatch();
            setTimeout(() => {
                card1.isMatched = true;
                card2.isMatched = true;
                document.getElementById(`card-${idx1}`).classList.add('matched');
                document.getElementById(`card-${idx2}`).classList.add('matched');

                const player = this.getCurrentPlayer();
                player.score += CONFIG.MATCH_POINTS;

                this.updateStatus(`${player.name} Scored!`);
                this.renderPlayers();

                if (this.cards.every(c => c.isMatched)) {
                    this.handleGameOver();
                    return;
                }

                this.flippedCards = [];
                this.isProcessing = false;

                if (player.isBot) {
                    setTimeout(() => this.processBotTurn(), 1000);
                } else {
                    this.startTimer();
                }
            }, 600);
        } else {
            // AudioCtrl.playError(); // Optional: Negative sound
            setTimeout(() => {
                card1.isFlipped = false;
                card2.isFlipped = false;
                const el1 = document.getElementById(`card-${idx1}`);
                const el2 = document.getElementById(`card-${idx2}`);
                el1.classList.remove('flipped');
                el1.setAttribute('aria-pressed', 'false');
                el2.classList.remove('flipped');
                el2.setAttribute('aria-pressed', 'false');

                this.endTurn();
            }, CONFIG.REVEAL_DELAY_MS);
        }
    }

    handleGameOver() {
        this.stopTimer();
        AudioCtrl.playWin();
        const winner = this.players.reduce((prev, current) => (prev.score > current.score) ? prev : current);
        this.ui.modalTitle.innerText = "GAME OVER";
        this.ui.modalBody.innerHTML = `<span style="color:var(--accent-success);font-size:1.5rem">${winner.name}</span> wins<br>with ${winner.score} points!`;
        this.ui.modal.classList.remove('hidden');
    }

    startTimer() {
        const duration = CONFIG.TURN_DURATION_MS;
        this.ui.timerFill.style.transition = 'none';
        this.ui.timerFill.style.width = '100%';
        this.ui.timerFill.offsetHeight;
        this.ui.timerFill.style.transition = `width ${duration}ms linear`;
        this.ui.timerFill.style.width = '0%';

        this.timer = setTimeout(() => {
            if (this.flippedCards.length > 0) {
                const idx = this.flippedCards[0];
                this.cards[idx].isFlipped = false;
                document.getElementById(`card-${idx}`).classList.remove('flipped');
            }
            this.updateStatus("Time's Up!");
            setTimeout(() => this.endTurn(), 500);
        }, duration);
    }

    stopTimer() {
        clearTimeout(this.timer);
        this.ui.timerFill.style.transition = 'none';
    }

    activatePower(powerType) {
        const player = this.getCurrentPlayer();
        if (player.isBot || this.flippedCards.length > 0 || this.isProcessing) return;
        if (player.powers[powerType] <= 0) return;

        AudioCtrl.playPower();
        player.powers[powerType]--;
        this.renderPowers();

        switch (powerType) {
            case 'block': this.useBlockPower(); break;
            case 'scanner': this.useScannerPower(); break;
            case 'shuffle': this.useShufflePower(); break;
        }
    }

    useBlockPower() {
        const nextIdx = (this.activePlayerIndex + 1) % this.players.length;
        this.blockedPlayerIndex = nextIdx;
        this.updateStatus(`${this.players[nextIdx].name} is Frozen!`);
    }

    useScannerPower() {
        const hiddenIndices = this.cards
            .map((c, i) => ({ c, i }))
            .filter(item => !item.c.isMatched && !item.c.isFlipped)
            .map(item => item.i);

        // Cheat slightly to find 2 pairs
        let groups = {};
        hiddenIndices.forEach(idx => {
            const icon = this.cards[idx].icon;
            if (!groups[icon]) groups[icon] = [];
            groups[icon].push(idx);
        });

        const pairs = Object.values(groups).filter(g => g.length === 2);
        const pairsToReveal = pairs.sort(() => Math.random() - 0.5).slice(0, 2).flat();

        if (pairsToReveal.length === 0) {
            this.updateStatus("No pairs to scan!");
            return;
        }

        pairsToReveal.forEach(idx => document.getElementById(`card-${idx}`).classList.add('flipped'));
        this.updateStatus("Scanning Sector...");

        setTimeout(() => {
            pairsToReveal.forEach(idx => {
                const el = document.getElementById(`card-${idx}`);
                if (!this.cards[idx].isFlipped && !this.cards[idx].isMatched) el.classList.remove('flipped');
            });
            pairsToReveal.forEach(idx => this.notifyBotsOfCard(idx, this.cards[idx].icon));
        }, 3000);
    }

    useShufflePower() {
        this.updateStatus("Hyper-Shuffling...");
        const availableIndices = [];
        const availableIcons = [];
        this.cards.forEach((c, i) => {
            if (!c.isMatched && !c.isFlipped) {
                availableIndices.push(i);
                availableIcons.push(c.icon);
            }
        });

        availableIcons.sort(() => Math.random() - 0.5);
        availableIndices.forEach((idx, k) => {
            this.cards[idx].icon = availableIcons[k];
            this.players.forEach(p => { if (p.isBot) p.memory.delete(idx); });
        });

        setTimeout(() => this.renderGrid(), 600);
    }

    processBotTurn() {
        const bot = this.getCurrentPlayer();
        setTimeout(() => {
            // Simple AI Logic
            const match = this.findMatchInMemory(bot);
            if (match) {
                this.flipCard(match[0]);
                setTimeout(() => this.flipCard(match[1]), 600);
            } else {
                const possiblePicks = this.cards.map((c, i) => i)
                    .filter(i => !this.cards[i].isMatched && !this.cards[i].isFlipped && !bot.memory.has(i));
                const anyPick = this.cards.map((c, i) => i)
                    .filter(i => !this.cards[i].isMatched && !this.cards[i].isFlipped);
                const firstPick = (possiblePicks.length > 0) ? possiblePicks[Math.floor(Math.random() * possiblePicks.length)] : anyPick[Math.floor(Math.random() * anyPick.length)];

                if (firstPick === undefined) return;
                this.flipCard(firstPick);

                const firstIcon = this.cards[firstPick].icon;
                const memoryMatch = this.findCardWithIconInMemory(bot, firstIcon, firstPick);

                setTimeout(() => {
                    if (memoryMatch !== null) this.flipCard(memoryMatch);
                    else {
                        const remaining = anyPick.filter(i => i !== firstPick);
                        if (remaining.length > 0) this.flipCard(remaining[Math.floor(Math.random() * remaining.length)]);
                    }
                }, 1000);
            }
        }, CONFIG.BOT_SPEED_MS);
    }

    notifyBotsOfCard(index, icon) {
        this.players.forEach(p => {
            if (p.isBot && Math.random() < 0.85) p.memory.set(index, icon);
        });
    }

    findMatchInMemory(bot) {
        const seen = {};
        for (const [idx, icon] of bot.memory.entries()) {
            if (this.cards[idx].isMatched) continue;
            if (!seen[icon]) seen[icon] = [];
            seen[icon].push(idx);
            if (seen[icon].length === 2) return seen[icon];
        }
        return null;
    }

    findCardWithIconInMemory(bot, icon, excludeIndex) {
        for (const [idx, memIcon] of bot.memory.entries()) {
            if (memIcon === icon && idx !== excludeIndex && !this.cards[idx].isMatched) return idx;
        }
        return null;
    }

    getCurrentPlayer() { return this.players[this.activePlayerIndex]; }

    updateStatus(msg) {
        if (msg) {
            this.ui.status.innerText = msg;
            this.ui.status.classList.add('glow-text');
            setTimeout(() => this.ui.status.classList.remove('glow-text'), 500);
        } else {
            this.ui.status.innerText = `${this.getCurrentPlayer().name}'s Turn`;
        }
    }

    renderGrid() {
        this.ui.grid.innerHTML = '';
        this.cards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.id = `card-${index}`;
            cardEl.setAttribute('role', 'button');
            if (card.isMatched) {
                cardEl.classList.add('matched');
                cardEl.setAttribute('aria-hidden', 'true');
            }
            if (card.isFlipped) cardEl.classList.add('flipped');
            cardEl.innerHTML = `<div class="card-inner"><div class="card-front">${card.icon}</div><div class="card-back"></div></div>`;
            cardEl.onclick = () => this.handleCardClick(index);
            this.ui.grid.appendChild(cardEl);
        });
    }

    renderPlayers() {
        this.ui.players.innerHTML = '';
        this.players.forEach((p, idx) => {
            const el = document.createElement('div');
            el.className = `player-card ${idx === this.activePlayerIndex ? 'active' : ''} ${p.isBot ? 'is-bot' : ''}`;
            el.innerHTML = `<div class="player-avatar">G${idx + 1}</div><div class="player-score">${p.score}</div>`;
            this.ui.players.appendChild(el);
        });
        const activeEl = this.ui.players.children[this.activePlayerIndex];
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }

    renderPowers() {
        const player = this.getCurrentPlayer();
        this.ui.powerCards.innerHTML = '';
        if (player.isBot) {
            this.ui.powerCards.innerHTML = '<div style="color:#777; font-size:0.8rem; margin-top:20px;">OPPONENT TURN</div>';
            return;
        }
        Object.values(POWERS).forEach(power => {
            const count = player.powers[power.id];
            const el = document.createElement('div');
            el.className = `power-card ${count === 0 ? 'disabled' : ''}`;
            el.innerHTML = `<div class="power-count">${count}</div><div class="icon">${power.icon}</div><div>${power.name}</div>`;
            el.onclick = () => this.activatePower(power.id);
            this.ui.powerCards.appendChild(el);
        });
    }
}

// --- Initialization ---
window.onload = () => {
    // Check if we start immediately or waiting for UI
    const startOverlay = document.getElementById('start-overlay');
    if (!startOverlay) {
        new Game();
    } else {
        new Game(); // Game constructor now handles binding verify button
    }
};
