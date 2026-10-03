// ============================================================
// BISA - Main Application Logic
// ============================================================

// --- State Variables ---
let totalScore = 150;
let cogProgress = 0;
let motProgress = 0;

let cameraStream = null;
let poseModel = null;
let handsModel = null;
let activeTrackingModel = 'none';
let animFrameId = null;
let isProcessingFrame = false;
let handTrackingReady = false;
let gameActive = false;
let levelCompleted = false;
let currentLevelTarget = 50; // points needed to pass level
let cameraInitialized = false; // Track if camera was ever initialized
let inputMode = 'ai'; // 'ai' or 'touch'
let fruitCollectCount = 0;

let soundEnabled = true; // Default: AKTIF (Suara & TalkBack satu fitur)
let voiceEnabled = true; // Default: AKTIF

// Level Progression
let gameProgress = {
    menunjuk_buah: 1,
    tebak_gambar: 1,
    tebak_suara: 1
};

// Coordinate mapping cache
let lastHandPosition = { x: 0, y: 0 };

// ============================================================
// SOUND & INDONESIAN VOICE SYNTHESIS SYSTEM (Web Audio API + TTS)
// ============================================================
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// ============================================================
// UNIFIED SOUND & TALKBACK SYSTEM (Default: AKTIF)
// ============================================================
let talkbackEnabled = true;
let talkbackTimer = null;
let lastSpokenText = '';

// Unified toggle for Sound & TalkBack
function toggleTalkBack() {
    talkbackEnabled = !talkbackEnabled;
    voiceEnabled = talkbackEnabled;
    soundEnabled = talkbackEnabled;
    updateTalkBackUI();
    
    if (talkbackEnabled) {
        sfxClick();
        forceSpeak('TalkBack dan suara diaktifkan');
    } else {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (currentAudio) currentAudio.pause();
    }
}

function toggleSound() {
    toggleTalkBack();
}

function updateTalkBackUI() {
    const buttons = document.querySelectorAll('.btn-talkback-toggle, .btn-sound-toggle');
    const label = talkbackEnabled ? 'TalkBack & Suara: Aktif' : 'TalkBack & Suara: Nonaktif';
    buttons.forEach(btn => {
        btn.textContent = label;
        btn.setAttribute('aria-pressed', talkbackEnabled ? 'true' : 'false');
        btn.classList.toggle('active', talkbackEnabled);
        btn.classList.toggle('muted', !talkbackEnabled);
        btn.setAttribute('data-talkback', talkbackEnabled ? 'TalkBack dan suara saat ini aktif. Klik untuk mematikan.' : 'TalkBack dan suara saat ini nonaktif. Klik untuk mengaktifkan.');
    });
}

// Indonesian Text-to-Speech (TTS) - Only speaks when voiceEnabled & talkbackEnabled are true
function speak(text, priority = false) {
    if (!voiceEnabled || !talkbackEnabled || !('speechSynthesis' in window) || !text) return;
    executeTTS(text, priority);
}

// Explicit forced speech (used when user manually clicks "Dengarkan Suara" button)
function forceSpeak(text, priority = true) {
    if (!('speechSynthesis' in window) || !text) return;
    executeTTS(text, priority);
}

function executeTTS(text, priority = false) {
    try {
        if (priority) {
            window.speechSynthesis.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.0;
        utterance.pitch = 1.15; // Friendly and cheerful for kids
        
        const voices = window.speechSynthesis.getVoices();
        const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('ID'));
        if (idVoice) utterance.voice = idVoice;
        
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('TTS error:', e);
    }
}

// Pre-load voices for browser
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

function talkback(text) {
    if (!talkbackEnabled || !voiceEnabled || !text) return;
    
    // Clean emojis & extra whitespaces for natural reading
    const cleanText = text
        .replace(/[🍎🍌🍉🍇🍓🍊🐶🐱🦆🐰🐮🐔🌙⭐☀️💡🎮📺👩‍⚕️👦🎬🖐️✋🖱️📷🔊🔇🔄🚀⬅️🏆✨🔒←]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
        
    if (!cleanText || cleanText === lastSpokenText) return;

    clearTimeout(talkbackTimer);
    talkbackTimer = setTimeout(() => {
        lastSpokenText = cleanText;
        playTone(850, 0.03, 'sine', 0.05); // Subtle tactile feedback
        speak(cleanText, true);
    }, 120); // 120ms debounce prevents speech pile-up
}

// Global Hover / Focus Listener for Talkback
function initTalkBack() {
    updateTalkBackUI();

    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-talkback], .btn-option, .role-card, .menu-card, .level-btn, button, input, .fruit-target');
        if (!target) return;
        
        let label = target.getAttribute('data-talkback');
        if (!label) {
            if (target.classList.contains('btn-option')) {
                label = 'Pilihan: ' + target.textContent;
            } else if (target.classList.contains('role-card')) {
                const title = target.querySelector('h3');
                label = 'Pilih peran: ' + (title ? title.textContent : target.textContent);
            } else if (target.classList.contains('menu-card')) {
                const title = target.querySelector('h3');
                const desc = target.querySelector('p');
                label = (title ? title.textContent : '') + (desc ? ', ' + desc.textContent : '');
            } else if (target.classList.contains('level-btn')) {
                label = target.classList.contains('locked') ? 'Level terkunci' : 'Pilih Level ' + target.textContent;
            } else if (target.classList.contains('fruit-target')) {
                const emoji = target.textContent.trim();
                label = 'Target ' + (fruitNames[emoji] || 'Buah');
            } else if (target.tagName.toLowerCase() === 'input') {
                label = target.placeholder || 'Kolom input teks';
            } else if (target.tagName.toLowerCase() === 'button') {
                label = target.getAttribute('title') || target.textContent;
            }
        }
        
        if (label) {
            talkback(label);
        }
    });

    document.addEventListener('focusin', (e) => {
        const target = e.target.closest('[data-talkback], .btn-option, .role-card, .menu-card, .level-btn, button, input');
        if (target) {
            const label = target.getAttribute('data-talkback') || target.textContent;
            talkback(label);
        }
    });
}

// Speak Fruit with praise
const fruitNames = {
    '🍎': 'Apel',
    '🍌': 'Pisang',
    '🍉': 'Semangka',
    '🍇': 'Anggur',
    '🍓': 'Stroberi',
    '🍊': 'Jeruk'
};
const cheerPhrases = ['Hebat!', 'Pintar!', 'Bagus sekali!', 'Keren!', 'Mantap!'];

function speakFruit(emoji) {
    if (!voiceEnabled) return;
    fruitCollectCount++;
    const name = fruitNames[emoji] || 'Buah';
    if (fruitCollectCount % 3 === 0) {
        const cheer = cheerPhrases[Math.floor(Math.random() * cheerPhrases.length)];
        speak(`${name}! ${cheer}`, true);
    } else {
        speak(name, true);
    }
}

function speakInstruction() {
    sfxClick();
    if (selectedGame === 'menunjuk_buah') {
        forceSpeak('Kinestetik motorik. Angkat tanganmu di depan kamera atau gunakan mouse dan sentuhan layar untuk menangkap buah-buahan!', true);
    } else if (selectedGame === 'tebak_gambar') {
        forceSpeak('Kognisi visual. Perhatikan gambar dengan teliti, lalu pilih jawaban yang paling tepat ya!', true);
    } else if (selectedGame === 'tebak_suara') {
        forceSpeak('Kognisi auditori. Pasang telingamu baik-baik, dengarkan suara hewannya lalu tebak hewan apakah itu!', true);
    }
}

// Play a simple tone
function playTone(frequency, duration, type = 'sine', volume = 0.25) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        // Silently fail if audio not available
    }
}

// 🎵 Correct Answer — ascending major arpeggio with sparkle
function sfxCorrect() {
    if (!soundEnabled) return;
    playTone(523.25, 0.12, 'sine', 0.25); // C5
    setTimeout(() => playTone(659.25, 0.12, 'sine', 0.25), 90); // E5
    setTimeout(() => playTone(783.99, 0.15, 'sine', 0.25), 180); // G5
    setTimeout(() => playTone(1046.5, 0.3, 'sine', 0.25), 270); // C6
}

// ❌ Wrong Answer — gentle friendly boing (child-friendly)
function sfxWrong() {
    if (!soundEnabled) return;
    playTone(330, 0.15, 'triangle', 0.2); // E4
    setTimeout(() => playTone(247, 0.25, 'sine', 0.18), 120); // B3
}

// 🍎 Fruit Collected — crisp bubble pop with upward slide
function sfxCollect() {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1350, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.28, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
        playTone(980, 0.1, 'sine', 0.2);
    }
}

// 🏆 Level Complete — rich victory fanfare
function sfxLevelComplete() {
    if (!soundEnabled) return;
    playTone(523.25, 0.18, 'sine', 0.3); // C5
    setTimeout(() => playTone(659.25, 0.18, 'sine', 0.3), 130); // E5
    setTimeout(() => playTone(783.99, 0.18, 'sine', 0.3), 260); // G5
    setTimeout(() => playTone(1046.5, 0.5, 'sine', 0.35), 390); // C6
    setTimeout(() => {
        playTone(1318.5, 0.6, 'sine', 0.3); // E6
        playTone(1046.5, 0.6, 'triangle', 0.25);
    }, 550);
}

// 🔘 Button Click — subtle snappy tick
function sfxClick() {
    if (!soundEnabled) return;
    playTone(720, 0.04, 'sine', 0.12);
}

// Animal Sound Synthesizer (Cat, Dog, Cow)
function playAnimalSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (type === 'cat') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(780, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
            speak('Meong! Meong!');
        } else if (type === 'dog') {
            [0, 0.18].forEach(delay => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, ctx.currentTime + delay);
                osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + delay + 0.12);
                gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.12);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.12);
            });
            speak('Guk guk!');
        } else if (type === 'cow') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(130, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(105, ctx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.35, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.8);
            speak('Mooooo!');
        }
    } catch (e) {
        console.warn('Animal sound synthesis error:', e);
    }
}

// --- Cognitive Game Data ---
const cognitiveQuestions = [
    {
        image: 'assets/apple.jpg',
        question: 'Apa nama buah ini?',
        options: ['🍎 Apel', '🍊 Jeruk', '🍌 Pisang'],
        answer: 0
    },
    {
        image: 'assets/cat.jpg',
        question: 'Hewan apa ini?',
        options: ['🐶 Anjing', '🐱 Kucing', '🐰 Kelinci'],
        answer: 1
    },
    {
        image: 'assets/sun.jpg',
        question: 'Apa ini?',
        options: ['🌙 Bulan', '⭐ Bintang', '☀️ Matahari'],
        answer: 2
    }
];

const audioQuestions = [
    {
        audio: 'assets/sound/cat.mp3',
        soundType: 'cat',
        question: 'Suara hewan apakah ini?',
        options: ['🐶 Anjing', '🐱 Kucing', '🦆 Bebek'],
        answer: 1
    },
    {
        audio: 'assets/sound/dog.mp3',
        soundType: 'dog',
        question: 'Suara hewan apakah ini?',
        options: ['🐶 Anjing', '🐰 Kelinci', '🐮 Sapi'],
        answer: 0
    },
    {
        audio: 'assets/sound/cow.mp3',
        soundType: 'cow',
        question: 'Suara hewan apakah ini?',
        options: ['🐔 Ayam', '🐱 Kucing', '🐮 Sapi'],
        answer: 2
    }
];

let currentQuestionIndex = 0;

// ============================================================
// SCREEN FLOW & LOGIN LOGIC
// ============================================================
let currentRole = '';

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
}

function selectRole(role) {
    sfxClick();
    currentRole = role;
    
    // Update UI selection
    const cards = document.querySelectorAll('.role-card');
    cards.forEach(c => c.classList.remove('selected'));
    
    if (role === 'anak') {
        cards[0].classList.add('selected');
        speak('Pasien Anak');
    } else {
        cards[1].classList.add('selected');
        speak('Klinisi atau Terapis');
    }
    
    // Show name input
    document.getElementById('name-input-container').style.display = 'flex';
}

function login() {
    sfxClick();
    const nameInput = document.getElementById('user-name').value.trim();
    if (!nameInput) {
        alert('Silakan masukkan nama Anda!');
        return;
    }
    if (!currentRole) {
        alert('Silakan pilih peran Anda terlebih dahulu!');
        return;
    }
    
    document.getElementById('welcome-name').textContent = nameInput;
    
    if (currentRole === 'anak') {
        updateChildMenuScore();
        showScreen('child-menu-screen');
        speak(`Halo ${nameInput}! Mau latihan terapi apa hari ini?`);
    } else {
        renderPatientList();
        showScreen('therapist-dashboard');
        speak(`Selamat datang di portal klinisi, ${nameInput}`);
    }
}

// Keep child-menu score pill in sync with totalScore
function updateChildMenuScore() {
    const scorePill = document.getElementById('child-menu-score');
    if (scorePill) scorePill.textContent = totalScore;
}

// ============================================================
// THERAPIST DASHBOARD — DUMMY DATA
// ============================================================
const dummyPatients = [
    {
        id: 1, name: 'Aldi Rahman', age: 8, gender: '👦',
        diagnosis: 'Disabilitas Intelektual Ringan',
        slb: 'SLB Negeri 1 Surabaya',
        cognitiveProgress: 78, motoricProgress: 65, sessions: 24,
        status: 'good',
        history: [
            { label: 'Minggu 1', cog: 45, mot: 30 },
            { label: 'Minggu 2', cog: 52, mot: 40 },
            { label: 'Minggu 3', cog: 65, mot: 55 },
            { label: 'Minggu 4', cog: 78, mot: 65 },
        ],
        notes: [
            { date: '2 Okt 2026', text: 'Progres motorik halus meningkat signifikan. Koordinasi jari tangan sudah lebih presisi saat bermain modul Kinestetik.' },
            { date: '28 Sep 2026', text: 'Aldi mampu menyelesaikan modul Kognisi Visual level 3 tanpa bantuan. Penalaran sebab-akibat mulai berkembang.' },
            { date: '20 Sep 2026', text: 'Sesi pertama. Asesmen awal ROM bahu: 120°. Fokus atensi rata-rata 4 menit.' },
        ]
    },
    {
        id: 2, name: 'Siti Nurhaliza', age: 7, gender: '👧',
        diagnosis: 'Cerebral Palsy — Spastik Bilateral',
        slb: 'SLB YPAC Jakarta',
        cognitiveProgress: 85, motoricProgress: 42, sessions: 18,
        status: 'warn',
        history: [
            { label: 'Minggu 1', cog: 60, mot: 20 },
            { label: 'Minggu 2', cog: 70, mot: 28 },
            { label: 'Minggu 3', cog: 80, mot: 35 },
            { label: 'Minggu 4', cog: 85, mot: 42 },
        ],
        notes: [
            { date: '1 Okt 2026', text: 'Kemampuan kognitif sangat baik. Namun motorik halus masih terhambat akibat spastisitas jari. Perlu penyesuaian DDA ke mode lebih lambat.' },
            { date: '25 Sep 2026', text: 'Siti sangat antusias dengan modul Kognisi Auditori. Berhasil menebak 8/10 suara hewan dengan benar.' },
        ]
    },
    {
        id: 3, name: 'Budi Santoso', age: 10, gender: '👦',
        diagnosis: 'Down Syndrome',
        slb: 'SLB Bina Bangsa Makassar',
        cognitiveProgress: 55, motoricProgress: 70, sessions: 30,
        status: 'good',
        history: [
            { label: 'Minggu 1', cog: 25, mot: 35 },
            { label: 'Minggu 2', cog: 35, mot: 50 },
            { label: 'Minggu 3', cog: 45, mot: 60 },
            { label: 'Minggu 4', cog: 55, mot: 70 },
        ],
        notes: [
            { date: '3 Okt 2026', text: 'Budi menunjukkan peningkatan koordinasi motorik yang luar biasa. Sudah mampu menangkap target bergerak di level 4.' },
            { date: '26 Sep 2026', text: 'Perlu pendampingan ekstra di modul kognitif. Latensi respons masih di atas 8 detik. DDA sudah diturunkan otomatis.' },
        ]
    },
    {
        id: 4, name: 'Dewi Lestari', age: 6, gender: '👧',
        diagnosis: 'Autisme Spektrum — Level 2',
        slb: 'SLB Autis Mutiara Hati',
        cognitiveProgress: 30, motoricProgress: 25, sessions: 8,
        status: 'alert',
        history: [
            { label: 'Minggu 1', cog: 10, mot: 10 },
            { label: 'Minggu 2', cog: 18, mot: 15 },
            { label: 'Minggu 3', cog: 25, mot: 20 },
            { label: 'Minggu 4', cog: 30, mot: 25 },
        ],
        notes: [
            { date: '1 Okt 2026', text: 'Dewi masih dalam fase adaptasi. Sensory overload terjadi setelah menit ke-3. Disarankan sesi pendek (maks 5 menit) dengan jeda istirahat.' },
            { date: '28 Sep 2026', text: 'Sesi awal bersama pendamping. Dewi menunjukkan minat pada stimulasi auditori (suara hewan). Modul visual belum bisa dijalankan.' },
        ]
    },
    {
        id: 5, name: 'Raka Pratama', age: 9, gender: '👦',
        diagnosis: 'Disabilitas Intelektual Sedang',
        slb: 'SLB Negeri 2 Denpasar',
        cognitiveProgress: 60, motoricProgress: 80, sessions: 22,
        status: 'good',
        history: [
            { label: 'Minggu 1', cog: 30, mot: 45 },
            { label: 'Minggu 2', cog: 40, mot: 58 },
            { label: 'Minggu 3', cog: 52, mot: 70 },
            { label: 'Minggu 4', cog: 60, mot: 80 },
        ],
        notes: [
            { date: '2 Okt 2026', text: 'Raka sudah menyelesaikan seluruh 5 level modul Kinestetik Motorik. Koordinasi bilateral sangat baik. Siap naik ke latihan cross-body reaching.' },
            { date: '29 Sep 2026', text: 'Progres kognitif stabil namun lambat. Pemilahan warna sudah dikuasai. Matematika dasar masih di level 2.' },
        ]
    }
];

function renderPatientList() {
    const listEl = document.getElementById('patient-list');
    listEl.innerHTML = '';
    
    dummyPatients.forEach(p => {
        const item = document.createElement('div');
        item.className = 'patient-item';
        item.onclick = () => showPatientDetail(p.id);
        item.id = `patient-${p.id}`;
        item.innerHTML = `
            <div class="patient-avatar">${p.gender}</div>
            <div class="patient-meta">
                <h4>${p.name}</h4>
                <p>${p.diagnosis}</p>
            </div>
            <div class="patient-status ${p.status}"></div>
        `;
        listEl.appendChild(item);
    });
}

function showPatientDetail(id) {
    const p = dummyPatients.find(x => x.id === id);
    if (!p) return;
    
    // Highlight selected patient
    document.querySelectorAll('.patient-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`patient-${id}`).classList.add('active');
    
    const panel = document.getElementById('patient-detail-panel');
    
    const historyBars = p.history.map(h => `
        <div class="history-row">
            <span class="history-label">${h.label}</span>
            <div class="history-bar-track">
                <div class="history-bar-fill bg-baby-blue" style="width: ${h.cog}%"></div>
            </div>
            <span class="history-val" style="color: var(--color-baby-blue);">${h.cog}%</span>
            <div class="history-bar-track">
                <div class="history-bar-fill bg-warm-yellow" style="width: ${h.mot}%"></div>
            </div>
            <span class="history-val" style="color: var(--color-warm-yellow);">${h.mot}%</span>
        </div>
    `).join('');
    
    const noteCards = p.notes.map(n => `
        <div class="note-item">
            <div class="note-date">${n.date}</div>
            <div class="note-text">${n.text}</div>
        </div>
    `).join('');
    
    panel.innerHTML = `
        <div class="detail-header">
            <div class="detail-avatar">${p.gender}</div>
            <div class="detail-info">
                <h2>${p.name}</h2>
                <p>${p.diagnosis} · ${p.age} tahun · ${p.slb}</p>
            </div>
        </div>
        
        <div class="detail-stats-grid">
            <div class="detail-stat">
                <span class="stat-val blue">${p.cognitiveProgress}%</span>
                <span class="stat-lbl">Progres Kognitif</span>
            </div>
            <div class="detail-stat">
                <span class="stat-val yellow">${p.motoricProgress}%</span>
                <span class="stat-lbl">Progres Motorik</span>
            </div>
            <div class="detail-stat">
                <span class="stat-val green">${p.sessions}</span>
                <span class="stat-lbl">Total Sesi Terapi</span>
            </div>
        </div>
        
        <h4 class="detail-section-title">📈 Riwayat Perkembangan (Kognitif & Motorik)</h4>
        <div class="progress-history">
            ${historyBars}
        </div>
        
        <h4 class="detail-section-title">📝 Catatan Klinis</h4>
        <div class="notes-list">
            ${noteCards}
        </div>
    `;
}

// ============================================================
// BIOMECHANICS & LEVEL TARGET CONFIGURATION (KINESTETIK MOTORIK)
// ============================================================
const KINESTETIK_LEVEL_CONFIG = {
    1: {
        fruit: '🍎',
        fruitName: 'Apel',
        targetCount: 5,
        targetMinAngle: 75,
        targetMaxAngle: 110,
        idealAngle: 90,
        targetDesc: '🍎 Apel (~90°)',
        angleInstruction: 'tekuk siku sekitar 90°',
        title: 'Level 1: Apel & Fleksi Siku 90°'
    },
    2: {
        fruit: '🍌',
        fruitName: 'Pisang',
        targetCount: 7,
        targetMinAngle: 125,
        targetMaxAngle: 165,
        idealAngle: 145,
        targetDesc: '🍌 Pisang (~145°)',
        angleInstruction: 'luruskan lengan sekitar 145°',
        title: 'Level 2: Pisang & Ekstensi Lengan 145°'
    },
    3: {
        fruit: '🍉',
        fruitName: 'Semangka',
        targetCount: 8,
        targetMinAngle: 45,
        targetMaxAngle: 80,
        idealAngle: 65,
        targetDesc: '🍉 Semangka (~65°)',
        angleInstruction: 'tekuk siku rapat sekitar 65°',
        title: 'Level 3: Semangka & Fleksi Penuh 65°'
    },
    4: {
        fruit: '🍓',
        fruitName: 'Stroberi',
        targetCount: 10,
        targetMinAngle: 85,
        targetMaxAngle: 125,
        idealAngle: 105,
        targetDesc: '🍓 Stroberi (~105°)',
        angleInstruction: 'tekuk siku seimbang sekitar 105°',
        title: 'Level 4: Stroberi & Rentang 105°'
    },
    5: {
        fruit: '🍊',
        fruitName: 'Jeruk',
        targetCount: 12,
        targetMinAngle: 110,
        targetMaxAngle: 155,
        idealAngle: 130,
        targetDesc: '🍊 Jeruk (~130°)',
        angleInstruction: 'rentangkan lengan sekitar 130°',
        title: 'Level 5: Jeruk & Rentang Penuh 130°'
    }
};

let activeArmSide = 'right'; // 'right' or 'left' (Sticky to prevent fluttering)
let lastGuidanceVoiceTime = 0;

function calculateJointAngle(A, B, C) {
    if (!A || !B || !C) return 0;
    const BA = { x: A.x - B.x, y: A.y - B.y };
    const BC = { x: C.x - B.x, y: C.y - B.y };
    const dot = (BA.x * BC.x) + (BA.y * BC.y);
    const magBA = Math.sqrt(BA.x * BA.x + BA.y * BA.y);
    const magBC = Math.sqrt(BC.x * BC.x + BC.y * BC.y);
    if (magBA === 0 || magBC === 0) return 0;
    let cosTheta = dot / (magBA * magBC);
    cosTheta = Math.max(-1, Math.min(1, cosTheta));
    return Math.round((Math.acos(cosTheta) * 180) / Math.PI);
}

function updateBiomechanicsLevelTarget() {
    const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
    const lvlNum = document.getElementById('bio-level-num');
    const targetDesc = document.getElementById('bio-target-desc');
    if (lvlNum) lvlNum.textContent = selectedLevel;
    if (targetDesc) targetDesc.textContent = config.targetDesc;
    updateFruitTargetCounter();
}

function updateFruitTargetCounter() {
    const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
    const targetCount = config.targetCount || 5;
    const counterEl = document.getElementById('bio-fruit-progress');
    if (counterEl) {
        counterEl.textContent = `${fruitCollectCount} / ${targetCount} ${config.fruit}`;
        if (fruitCollectCount >= targetCount) {
            counterEl.classList.add('target-reached');
        } else {
            counterEl.classList.remove('target-reached');
        }
    }
}

let selectedGame = '';
let selectedLevel = 1;

function showLevelSelect(gameType) {
    sfxClick();
    selectedGame = gameType;
    let title = '';
    if (gameType === 'menunjuk_buah') title = 'Menunjuk Buah';
    if (gameType === 'tebak_gambar') title = 'Tebak Gambar';
    if (gameType === 'tebak_suara') title = 'Tebak Suara';
    
    document.getElementById('level-select-title').textContent = title + ' - Pilih Level';
    
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= 5; i++) {
        const isUnlocked = i <= gameProgress[gameType];
        const btn = document.createElement('button');
        
        btn.className = `level-btn ${isUnlocked ? '' : 'locked'}`;
        btn.innerHTML = isUnlocked ? i : '🔒';
        btn.disabled = !isUnlocked;
        
        btn.onclick = () => {
            selectedLevel = i;
            // Set difficulty targets
            currentLevelTarget = 30 + (i * 20); // L1: 50, L2: 70...
            
            // Reset Progress UI for this session
            cogProgress = 0;
            motProgress = 0;
            
            showInstructions();
        };
        grid.appendChild(btn);
    }
    
    showScreen('level-select-screen');
}

const VIDEO_CATALOG = {
    'https://www.youtube.com/embed/hq3yfQnllfQ?si=zbgrrpyullgBfDJ7': {
        title: 'Matematika Dasar',
        desc: 'Belajar berhitung dan mengenal angka dengan lagu edukatif dan animasi interaktif!',
        watchUrl: 'https://www.youtube.com/watch?v=hq3yfQnllfQ'
    },
    'https://www.youtube.com/embed/zxIpA5nF_LY?si=ImZDP2Pbk-3lkgp2': {
        title: 'Pemilahan Warna',
        desc: 'Mengenal warna-warni ceria dan melatih fokus visual anak!',
        watchUrl: 'https://www.youtube.com/watch?v=zxIpA5nF_LY'
    },
    'https://www.youtube.com/embed/85M1yxIcHpw?si=3vlqAZVOJPQYHjJI': {
        title: 'Penalaran Sebab-Akibat',
        desc: 'Latihan logika sederhana dan penalaran kognitif bersama animasi menarik!',
        watchUrl: 'https://www.youtube.com/watch?v=85M1yxIcHpw'
    }
};

function playVideo(url, title = 'Video Edukasi') {
    let meta = VIDEO_CATALOG[url];
    if (!meta) {
        for (const k in VIDEO_CATALOG) {
            if (url.includes(k) || k.includes(url)) {
                meta = VIDEO_CATALOG[k];
                break;
            }
        }
    }
    if (!meta) {
        meta = { 
            title, 
            desc: 'Video stimulasi pembelajaran adaptif untuk anak.', 
            watchUrl: url.replace('/embed/', '/watch?v=').split('?')[0] 
        };
    }

    const titleEl = document.getElementById('video-player-title') || document.querySelector('#video-screen .brand-name');
    if (titleEl) titleEl.textContent = meta.title;
    const descEl = document.getElementById('video-player-desc');
    if (descEl) descEl.textContent = meta.desc;

    const ytLink = document.getElementById('youtube-direct-link');
    if (ytLink) {
        ytLink.href = meta.watchUrl || url;
    }

    const player = document.getElementById('youtube-player');
    if (player) {
        player.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        player.setAttribute('title', meta.title + ' - YouTube video player');
        player.src = url;
    }
    showScreen('video-screen');
    sfxClick();
    speak('Memutar video ' + meta.title);
}

function stopVideoAndBack() {
    // Stop video from playing in background by clearing src
    const player = document.getElementById('youtube-player');
    if (player) {
        player.src = '';
    }
    sfxClick();
    showScreen('video-list-screen');
}

function showInstructions() {
    const title = document.getElementById('inst-title');
    const desc = document.getElementById('inst-desc');
    const icon = document.getElementById('inst-icon');

    if (selectedGame === 'menunjuk_buah') {
        const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
        title.textContent = `Kinestetik Motorik (Level ${selectedLevel})`;
        icon.textContent = `${config.fruit}📐`;
        desc.innerHTML = `<b>Target Level ${selectedLevel}: Buah ${config.fruitName} ${config.fruit} & Biomekanika Siku</b><br><br>
        Latih gerakan motorik dan fleksibilitas siku Anda! Di Level ${selectedLevel}, fokuslah mencari buah <b>${config.fruitName} ${config.fruit}</b>.<br><br>
        🎯 <b>Target Ambil:</b> Kumpulkan <b>${config.targetCount} buah ${config.fruitName} ${config.fruit}</b>.<br>
        📐 <b>Target Siku:</b> Posisikan dan ${config.angleInstruction} (rentang <b>${config.targetMinAngle}° - ${config.targetMaxAngle}°</b>).<br>
        Sistem AI akan mengukur sudut siku Anda secara real-time dan memberikan instruksi apakah siku perlu ditekuk, diluruskan, dinaikkan, atau diturunkan.`;
        speak(`Kinestetik motorik level ${selectedLevel}. Target ambil ${config.targetCount} buah ${config.fruitName}, dan ${config.angleInstruction}!`);
    } else if (selectedGame === 'tebak_gambar') {
        title.textContent = 'Kognisi Visual';
        icon.textContent = '🖼️❓';
        desc.innerHTML = `<b>Modul Kognisi Adaptif — Visual</b><br><br>Perhatikan gambar yang muncul dengan teliti! Pilih jawaban yang paling tepat dari pilihan di bawahnya. Modul ini melatih kemampuan pengenalan objek dan penalaran sebab-akibat. Jawab dengan benar untuk mengumpulkan poin!`;
        speak('Kognisi visual. Perhatikan gambar dengan teliti dan pilih jawaban yang benar ya!');
    } else if (selectedGame === 'tebak_suara') {
        title.textContent = 'Kognisi Auditori';
        icon.textContent = '🎵👂';
        desc.innerHTML = `<b>Modul Kognisi Adaptif — Auditori</b><br><br>Pasang telingamu baik-baik! Tekan tombol <b>🔊 Dengarkan Suara</b> untuk mendengarkan suara, lalu tebak suara hewan apakah itu. Modul ini melatih stimulasi multi-indera dan daya ingat auditori anak.`;
        speak('Kognisi auditori. Dengarkan suara hewan dengan seksama lalu tebak hewannya ya!');
    }
    
    // Render dynamic animated tutorial preview
    renderTutorialAnimation(selectedGame);
    
    showScreen('instruction-screen');
}

// ============================================================
// ANIMATED TUTORIAL PREVIEW SYSTEM
// ============================================================
function renderTutorialAnimation(gameType) {
    const stage = document.getElementById('tutorial-stage');
    const steps = document.getElementById('tutorial-steps');
    if (!stage || !steps) return;

    if (gameType === 'menunjuk_buah') {
        const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
        stage.innerHTML = `
            <div class="tut-cam-mockup">
                <div class="tut-grid-lines"></div>
                
                <!-- Body Silhouette & Shoulder/Arm Wireframe -->
                <svg class="tut-body-skeleton" viewBox="0 0 300 200" preserveAspectRatio="none">
                    <line x1="70" y1="150" x2="230" y2="150" stroke="rgba(16, 185, 129, 0.6)" stroke-width="4" stroke-dasharray="4 4" />
                    <circle cx="150" cy="100" r="24" stroke="rgba(59, 130, 246, 0.4)" stroke-width="2" fill="none" />
                    <circle cx="70" cy="150" r="7" fill="#10B981" />
                    <circle cx="230" cy="150" r="7" fill="#10B981" />
                    <text x="50" y="172" fill="rgba(16, 185, 129, 0.9)" font-size="11" font-weight="700">Bahu Kiri</text>
                    <text x="210" y="172" fill="rgba(16, 185, 129, 0.9)" font-size="11" font-weight="700">Bahu Kanan</text>
                </svg>

                <div class="tut-target-fruit tut-fruit-apple">${config.fruit}</div>
                <div class="tut-target-fruit tut-fruit-banana">${config.fruit}</div>
                
                <!-- Moving Hand & Basket Avatar -->
                <div class="tut-hand-tracker">
                    <div class="tut-hand-avatar">
                        <div class="tut-hand-reticle"></div>
                        <span class="tut-hand-symbol">✋</span>
                    </div>
                    <span class="tut-basket-symbol">🧺</span>
                    <div class="tut-pose-indicator-badge">Target: ${config.fruit} (${config.angleInstruction})</div>
                </div>

                <div class="tut-score-badge">+15 POIN! ⭐</div>
            </div>
        `;
        steps.innerHTML = `
            <div class="tut-step-item">
                <span class="tut-step-num">1</span>
                <span>Posisikan 1 lengan & tangan aktif di depan kamera</span>
            </div>
            <div class="tut-step-item">
                <span class="tut-step-num">2</span>
                <span>${config.angleInstruction} sesuai target derajat siku</span>
            </div>
            <div class="tut-step-item">
                <span class="tut-step-num">3</span>
                <span>Ikuti arahan naikkan/turunkan tangan & tangkap buah ${config.fruitName}!</span>
            </div>
        `;
    } else if (gameType === 'tebak_gambar') {
        stage.innerHTML = `
            <div class="tut-cog-mockup">
                <div class="tut-cog-card">
                    <div class="tut-cog-img">🍎</div>
                    <div style="font-weight:700; font-size:0.85rem; margin-top:4px;">Apa nama buah ini?</div>
                </div>
                <div class="tut-cog-options">
                    <div class="tut-cog-btn correct">🍎 Apel ✅ (+20)</div>
                    <div class="tut-cog-btn">🍊 Jeruk</div>
                    <div class="tut-cog-btn">🍌 Pisang</div>
                </div>
            </div>
        `;
        steps.innerHTML = `
            <div class="tut-step-item">
                <span class="tut-step-num">1</span>
                <span>Amati gambar buah</span>
            </div>
            <div class="tut-step-item">
                <span class="tut-step-num">2</span>
                <span>Pilih nama yang sesuai</span>
            </div>
            <div class="tut-step-item">
                <span class="tut-step-num">3</span>
                <span>Raih skor kognitif!</span>
            </div>
        `;
    } else if (gameType === 'tebak_suara') {
        stage.innerHTML = `
            <div class="tut-cog-mockup">
                <div class="tut-cog-card" style="min-width: 140px;">
                    <div class="tut-audio-speaker">🔊</div>
                    <div style="font-weight:700; font-size:0.85rem; margin-top:4px;">Dengarkan Suara</div>
                </div>
                <div class="tut-cog-options">
                    <div class="tut-cog-btn">🐶 Anjing</div>
                    <div class="tut-cog-btn correct">🐱 Kucing ✅ (+20)</div>
                    <div class="tut-cog-btn">🐮 Sapi</div>
                </div>
            </div>
        `;
        steps.innerHTML = `
            <div class="tut-step-item">
                <span class="tut-step-num">1</span>
                <span>Dengarkan suara hewan</span>
            </div>
            <div class="tut-step-item">
                <span class="tut-step-num">2</span>
                <span>Tebak hewan apakah itu</span>
            </div>
            <div class="tut-step-item">
                <span class="tut-step-num">3</span>
                <span>Kumpulkan skor auditori!</span>
            </div>
        `;
    }
}

function replayTutorialAnimation() {
    sfxClick();
    const stage = document.getElementById('tutorial-stage');
    if (!stage) return;
    stage.style.opacity = '0';
    setTimeout(() => {
        renderTutorialAnimation(selectedGame);
        stage.style.opacity = '1';
        speakInstruction();
    }, 150);
}

function startGame() {
    sfxClick();
    showScreen('main-app');
    
    // Reset session game state
    gameActive = true;
    levelCompleted = false;
    currentQuestionIndex = 0;
    fruitCollectCount = 0;
    
    // Reset active module progress so each level starts at 0%
    if (selectedGame === 'menunjuk_buah') {
        motProgress = 0;
    } else {
        cogProgress = 0;
    }
    
    // Initialize Dashboard UI
    updateDashboardUI();
    
    // Setup game content based on selected game
    setupGameContent();
    
    // Camera / Psychomotor initialization
    if (selectedGame === 'menunjuk_buah') {
        if (!cameraInitialized || !cameraStream) {
            initCameraAndAI();
        } else {
            restartGameLoops();
        }
    }
}

// Restart fruit targets and frame processing for re-entering camera game
function restartGameLoops() {
    const video = document.getElementById('camera-feed');
    
    // Hide camera loading container
    const statusContainer = document.getElementById('camera-status-container');
    if (statusContainer) {
        statusContainer.style.display = 'none';
    }
    
    // Update Biomechanics Level HUD
    updateBiomechanicsLevelTarget();
    
    // Spawn fresh fruits for this level
    spawnFruitTargets();
    
    // Ensure hand cursor and interaction listeners are active
    setupHandCursor();
    setupInteractionListeners();
    updateCameraBadge(inputMode);
    
    // Restart frame processing if in AI mode (supports BOTH poseModel and handsModel)
    if (cameraStream && video && inputMode === 'ai' && (poseModel || handsModel)) {
        startFrameProcessing(video);
    }
    
    const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
    speak(`Level ${selectedLevel}. Target: cari buah ${config.fruitName}, dan ${config.angleInstruction}!`, true);
}

// Cleanup function for stopping game and freeing resources
function stopGame() {
    gameActive = false;
    
    // Stop audio & speech
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    
    // Cancel animation frame loop
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    
    // Clear fruit targets
    const gameTargets = document.getElementById('game-targets');
    if (gameTargets) gameTargets.innerHTML = '';
    
    // Hide cursor
    const cursor = document.getElementById('hand-cursor');
    if (cursor) cursor.style.display = 'none';

    // Clear hand canvas
    const canvas = document.getElementById('hand-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Reset inline grid styles to avoid layout corruption on next game
    const dashboardGrid = document.querySelector('.dashboard-grid');
    if (dashboardGrid) dashboardGrid.style.gridTemplateColumns = '';
}

function setupGameContent() {
    const cogPanel = document.querySelector('.cognitive-panel');
    const psychomotorPanel = document.querySelector('.psychomotor-panel');
    const dashboardGrid = document.querySelector('.dashboard-grid');
    const rightColumn = document.querySelector('.right-column');
    
    const cogTitle = document.querySelector('.cognitive-panel .panel-title');
    const badge = document.querySelector('.cognitive-panel .badge');
    
    // Fully reset layout visibility, sizing, and grid columns
    cogPanel.style.display = 'flex';
    psychomotorPanel.style.display = 'block';
    rightColumn.style.maxWidth = '';
    rightColumn.style.margin = '';
    dashboardGrid.style.gridTemplateColumns = '';
    
    if (selectedGame === 'tebak_suara') {
        psychomotorPanel.style.display = 'none';
        dashboardGrid.style.gridTemplateColumns = '60% 40%';
        
        cogTitle.textContent = `Kognisi Auditori (Level ${selectedLevel})`;
        badge.textContent = 'Auditori';
        
        loadAudioQuestion(0);
        
    } else if (selectedGame === 'menunjuk_buah') {
        cogPanel.style.display = 'none';
        dashboardGrid.style.gridTemplateColumns = '100%'; 
        rightColumn.style.maxWidth = '920px';
        rightColumn.style.margin = '0 auto';
        rightColumn.style.width = '100%';
        
    } else {
        psychomotorPanel.style.display = 'none';
        dashboardGrid.style.gridTemplateColumns = '60% 40%';
        
        cogTitle.textContent = `Kognisi Visual (Level ${selectedLevel})`;
        badge.textContent = 'Visual';
        currentQuestionIndex = 0;
        loadCognitiveQuestion(currentQuestionIndex);
    }
}

// Load Audio Question Logic
let currentAudio = null;
function loadAudioQuestion(index) {
    const q = audioQuestions[index % audioQuestions.length];
    
    const imgWrapper = document.querySelector('.image-wrapper');
    imgWrapper.innerHTML = `
        <div class="audio-play-btn" onclick="playQuestionAudio(${index})">
            <div class="audio-icon">🔊</div>
            <div class="audio-text">Dengarkan Suara</div>
        </div>
    `;
    
    document.getElementById('cognitive-question').textContent = q.question;
    speak(q.question);
    
    const optionsContainer = document.getElementById('cognitive-options');
    optionsContainer.innerHTML = '';
    
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn-option';
        btn.textContent = opt;
        btn.setAttribute('data-talkback', 'Pilihan jawaban: ' + opt);
        btn.onclick = () => checkAudioAnswer(i, index);
        optionsContainer.appendChild(btn);
    });
}

function playQuestionAudio(questionIndex) {
    const q = audioQuestions[questionIndex % audioQuestions.length];
    sfxClick();
    
    try {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        currentAudio = new Audio(q.audio);
        const playPromise = currentAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                console.warn('Audio play error:', err);
                playAnimalSound(q.soundType || (questionIndex === 0 ? 'cat' : questionIndex === 1 ? 'dog' : 'cow'));
            });
        }
    } catch (e) {
        playAnimalSound(q.soundType || (questionIndex === 0 ? 'cat' : questionIndex === 1 ? 'dog' : 'cow'));
    }
}

function checkAudioAnswer(selectedIndex, questionIndex) {
    const q = audioQuestions[questionIndex % audioQuestions.length];
    const optionsContainer = document.getElementById('cognitive-options');
    const buttons = optionsContainer.querySelectorAll('.btn-option');
    
    buttons.forEach(btn => btn.disabled = true);
    
    if (selectedIndex === q.answer) {
        buttons[selectedIndex].style.borderColor = 'var(--color-mint)';
        buttons[selectedIndex].style.color = 'var(--color-mint)';
        addScore(20, 'cognitive');
        spawnParticles(buttons[selectedIndex]);
        sfxCorrect();
        speak('Pintar! Jawabanmu benar!');
    } else {
        buttons[selectedIndex].style.borderColor = 'var(--color-red-alert)';
        buttons[selectedIndex].style.color = 'var(--color-red-alert)';
        buttons[q.answer].style.borderColor = 'var(--color-mint)';
        buttons[q.answer].style.color = 'var(--color-mint)';
        sfxWrong();
        speak('Belum tepat, ayo coba lagi!');
    }
    
    setTimeout(() => {
        if (!levelCompleted) loadAudioQuestion(questionIndex + 1);
    }, 1500);
}

// ============================================================
// DASHBOARD UI
// ============================================================
function updateDashboardUI() {
    document.getElementById('total-score').textContent = totalScore;
    
    document.getElementById('progress-cog-val').textContent = `${Math.round(cogProgress)}%`;
    document.getElementById('progress-cog-fill').style.width = `${Math.round(cogProgress)}%`;
    
    document.getElementById('progress-mot-val').textContent = `${Math.round(motProgress)}%`;
    document.getElementById('progress-mot-fill').style.width = `${Math.round(motProgress)}%`;
}

function addScore(points, type) {
    if (!gameActive || levelCompleted) return;
    
    totalScore += points;
    if (type === 'cognitive') {
        cogProgress = Math.min(100, cogProgress + (points / currentLevelTarget) * 100);
    } else if (type === 'motoric') {
        motProgress = Math.min(100, motProgress + (points / currentLevelTarget) * 100);
    }
    updateDashboardUI();
    updateChildMenuScore();
    
    // Check level up condition
    if (!levelCompleted && (cogProgress >= 100 || motProgress >= 100)) {
        levelCompleted = true;
        gameActive = false;
        setTimeout(levelComplete, 500);
    }
}

function levelComplete() {
    // Unlock next level if possible
    if (selectedLevel < 5 && selectedLevel === gameProgress[selectedGame]) {
        gameProgress[selectedGame]++;
    }
    
    sfxLevelComplete();
    speak(`Hore! Luar biasa! Kamu berhasil menyelesaikan Level ${selectedLevel}!`, true);
    
    if (selectedGame === 'menunjuk_buah') {
        const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
        document.getElementById('success-modal-message').innerHTML = `Hebat! Kamu berhasil mengumpulkan semua <b>${config.targetCount} buah ${config.fruitName} ${config.fruit}</b> di Level ${selectedLevel}!`;
    } else {
        document.getElementById('success-modal-message').innerHTML = `Hebat! Kamu berhasil menyelesaikan <b>Level ${selectedLevel}</b> dengan cemerlang!`;
    }
    const modal = document.getElementById('success-modal');
    modal.classList.add('active');
}

function goToNextLevel() {
    document.getElementById('success-modal').classList.remove('active');
    stopGame();
    if (selectedLevel < 5) {
        selectedLevel++;
    } else {
        selectedLevel = 1;
    }
    currentLevelTarget = 30 + (selectedLevel * 20);
    cogProgress = 0;
    motProgress = 0;
    updateDashboardUI();
    startGame();
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');
    stopGame();
    showLevelSelect(selectedGame);
}

// ============================================================
// COGNITIVE MODULE (TEBAK GAMBAR)
// ============================================================
function loadCognitiveQuestion(index) {
    const safeIndex = index % cognitiveQuestions.length;
    currentQuestionIndex = safeIndex;
    const q = cognitiveQuestions[safeIndex];
    
    const imgWrapper = document.querySelector('.image-wrapper');
    imgWrapper.innerHTML = `<img id="cognitive-image" src="${q.image}" alt="Pertanyaan" class="cognitive-img">`;

    document.getElementById('cognitive-question').textContent = q.question;
    speak(q.question);
    
    const optionsContainer = document.getElementById('cognitive-options');
    optionsContainer.innerHTML = '';
    
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn-option';
        btn.textContent = opt;
        btn.onclick = () => checkAnswer(i);
        optionsContainer.appendChild(btn);
    });
}

function checkAnswer(selectedIndex) {
    const q = cognitiveQuestions[currentQuestionIndex];
    const optionsContainer = document.getElementById('cognitive-options');
    const buttons = optionsContainer.querySelectorAll('.btn-option');
    
    buttons.forEach(btn => btn.disabled = true);
    
    if (selectedIndex === q.answer) {
        buttons[selectedIndex].style.borderColor = 'var(--color-mint)';
        buttons[selectedIndex].style.color = 'var(--color-mint)';
        addScore(20, 'cognitive');
        spawnParticles(buttons[selectedIndex]);
        sfxCorrect();
        speak('Hebat! Jawabanmu benar!');
    } else {
        buttons[selectedIndex].style.borderColor = 'var(--color-red-alert)';
        buttons[selectedIndex].style.color = 'var(--color-red-alert)';
        buttons[q.answer].style.borderColor = 'var(--color-mint)';
        buttons[q.answer].style.color = 'var(--color-mint)';
        sfxWrong();
        speak('Ayo coba lagi ya!');
    }
    
    setTimeout(() => {
        if (!levelCompleted) {
            currentQuestionIndex = (currentQuestionIndex + 1) % cognitiveQuestions.length;
            loadCognitiveQuestion(currentQuestionIndex);
        }
    }, 1500);
}

function spawnParticles(element) {
    element.style.transform = 'scale(1.05)';
    setTimeout(() => {
        element.style.transform = 'translateY(-6px)';
    }, 200);
}

// ============================================================
// PSYCHOMOTOR MODULE (AI CAMERA & TOUCH/MOUSE)
// ============================================================
function setupHandCursor() {
    let cursor = document.getElementById('hand-cursor');
    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'hand-cursor';
        cursor.className = 'hand-cursor';
        cursor.textContent = '🧺';
        const cameraView = document.getElementById('camera-view');
        if (cameraView) cameraView.appendChild(cursor);
    }
    cursor.style.display = 'block';
}

function updateCameraBadge(mode) {
    const badgeText = document.getElementById('camera-badge-text');
    const dot = document.getElementById('camera-dot');
    const toggleBtn = document.getElementById('toggle-input-mode-btn');
    const guideIcon = document.getElementById('camera-guide-icon');
    const guideText = document.getElementById('camera-guide-text');

    if (mode === 'ai') {
        if (badgeText) badgeText.textContent = 'AI KAMERA AKTIF';
        if (dot) {
            dot.style.background = 'var(--color-mint)';
            dot.style.animation = 'blink 1.5s infinite';
        }
        if (toggleBtn) toggleBtn.innerHTML = 'Mode Sentuh & Mouse';
        if (guideIcon) guideIcon.textContent = '🖐️';
        if (guideText) guideText.textContent = 'Arahkan tanganmu di depan kamera untuk menangkap buah!';
    } else {
        if (badgeText) badgeText.textContent = 'SENTUH / MOUSE';
        if (dot) {
            dot.style.background = 'var(--color-warm-yellow)';
            dot.style.animation = 'none';
        }
        if (toggleBtn) toggleBtn.innerHTML = 'Mode Kamera AI';
        if (guideIcon) guideIcon.textContent = '🖱️';
        if (guideText) guideText.textContent = 'Gerakkan keranjang atau sentuh buah untuk menangkapnya!';
    }
}

function toggleInputMode() {
    sfxClick();
    if (inputMode === 'ai') {
        inputMode = 'touch';
        updateCameraBadge('touch');
        speak('Mode Sentuh dan Mouse aktif!', true);
    } else {
        inputMode = 'ai';
        if (!cameraStream || !cameraInitialized) {
            initCameraAndAI();
        } else {
            updateCameraBadge('ai');
            const video = document.getElementById('camera-feed');
            if (video) startFrameProcessing(video);
            speak('Mode Kamera AI aktif! Arahkan tanganmu.', true);
        }
    }
}

async function initCameraAndAI() {
    const video = document.getElementById('camera-feed');
    const statusContainer = document.getElementById('camera-status-container');
    const statusText = document.getElementById('camera-status-text');
    const spinner = document.getElementById('camera-spinner');

    if (statusContainer) {
        statusContainer.style.display = 'flex';
        statusContainer.style.opacity = '1';
    }
    if (spinner) spinner.style.display = 'block';
    if (statusText) statusText.textContent = 'Meminta akses kamera...';

    // Verify browser mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not supported in this environment');
        fallbackToMouseTouch('Browser tidak mendukung akses kamera. Menggunakan mode sentuh/mouse.');
        return;
    }

    try {
        if (!cameraStream) {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
        }
        
        video.srcObject = cameraStream;
        
        // Wait safely for video metadata
        await new Promise((resolve) => {
            if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
            video.onloadeddata = () => resolve();
            video.onloadedmetadata = () => resolve();
            setTimeout(resolve, 2000);
        });

        try {
            await video.play();
        } catch (e) {
            console.warn('Video play note:', e);
        }

        // Initialize MediaPipe Pose (Shoulders, Arms, Hands) or fallback to Hands
        if (window.Pose) {
            if (statusText) statusText.textContent = 'Memuat AI Deteksi Bahu & Lengan...';
            try {
                poseModel = new window.Pose({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
                });

                poseModel.setOptions({
                    modelComplexity: 0, // Lite model for smooth 60fps tracking
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                poseModel.onResults(onPoseResults);

                // Warmup frame
                if (video.readyState >= 2 && video.videoWidth > 0) {
                    try {
                        await poseModel.send({ image: video });
                    } catch (e) {}
                }

                activeTrackingModel = 'pose';
                handTrackingReady = true;
                inputMode = 'ai';
                updateCameraBadge('ai');
            } catch (poseErr) {
                console.warn('Pose init failed, fallback to Hands:', poseErr);
            }
        }

        if (!poseModel && window.Hands) {
            if (statusText) statusText.textContent = 'Memuat AI Deteksi Tangan...';
            handsModel = new window.Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            handsModel.setOptions({
                maxNumHands: 1,
                modelComplexity: 0, // Lite model for smooth 60fps tracking
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            handsModel.onResults(onHandResults);

            // Warmup frame
            if (video.readyState >= 2 && video.videoWidth > 0) {
                try {
                    await handsModel.send({ image: video });
                } catch (e) {}
            }

            activeTrackingModel = 'hands';
            handTrackingReady = true;
            inputMode = 'ai';
            updateCameraBadge('ai');
        }

        if (!poseModel && !handsModel) {
            console.warn('MediaPipe Pose/Hands not available');
            handTrackingReady = false;
            inputMode = 'touch';
            updateCameraBadge('touch');
        }

        cameraInitialized = true;

        if (statusContainer) {
            statusContainer.style.opacity = '0';
            setTimeout(() => {
                statusContainer.style.display = 'none';
            }, 300);
        }

        // Start loops
        updateBiomechanicsLevelTarget();
        startFrameProcessing(video);
        spawnFruitTargets();
        setupHandCursor();
        setupInteractionListeners();

        const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
        speak(`Level ${selectedLevel}. Target: cari buah ${config.fruitName}, dan ${config.angleInstruction}!`, true);

    } catch (err) {
        console.warn('Camera/AI init failed:', err);
        fallbackToMouseTouch('Kamera tidak aktif atau izin ditolak. Mode Sentuh & Mouse diaktifkan!');
    }
}

function fallbackToMouseTouch(message) {
    const statusContainer = document.getElementById('camera-status-container');
    const statusText = document.getElementById('camera-status-text');
    const spinner = document.getElementById('camera-spinner');

    if (spinner) spinner.style.display = 'none';
    if (statusText) statusText.textContent = message;

    handTrackingReady = false;
    cameraInitialized = true;
    inputMode = 'touch';
    updateCameraBadge('touch');

    spawnFruitTargets();
    setupHandCursor();
    setupInteractionListeners();

    setTimeout(() => {
        if (statusContainer) {
            statusContainer.style.opacity = '0';
            setTimeout(() => {
                statusContainer.style.display = 'none';
            }, 300);
        }
    }, 1200);

    speak('Ayo tangkap buah dengan menggerakkan keranjang atau sentuh layar!', true);
}

function setupInteractionListeners() {
    const cameraView = document.getElementById('camera-view');
    if (!cameraView) return;

    cameraView.removeEventListener('mousemove', onPointerMove);
    cameraView.removeEventListener('touchmove', onTouchMove);
    cameraView.removeEventListener('touchstart', onTouchMove);

    cameraView.addEventListener('mousemove', onPointerMove);
    cameraView.addEventListener('touchmove', onTouchMove, { passive: false });
    cameraView.addEventListener('touchstart', onTouchMove, { passive: false });
}

function onPointerMove(e) {
    if (!gameActive || levelCompleted) return;
    const cameraView = document.getElementById('camera-view');
    if (!cameraView) return;
    const rect = cameraView.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    updateCursorAndCheckCollision(x, y);
}

function onTouchMove(e) {
    if (!gameActive || levelCompleted) return;
    const cameraView = document.getElementById('camera-view');
    if (!cameraView) return;
    if (e.touches && e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = cameraView.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        updateCursorAndCheckCollision(x, y);
    }
}

function updateCursorAndCheckCollision(x, y) {
    const cursor = document.getElementById('hand-cursor');
    if (cursor) {
        cursor.style.display = 'block';
        cursor.style.transform = `translate3d(${x - 24}px, ${y - 24}px, 0)`;
    }
    lastHandPosition.x = x;
    lastHandPosition.y = y;
    checkTargetCollision(x, y);
}

function startFrameProcessing(video) {
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }

    async function processLoop() {
        if (!gameActive) return;

        if (inputMode === 'ai' && (poseModel || handsModel) && cameraStream && !isProcessingFrame &&
            video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
            isProcessingFrame = true;
            try {
                if (poseModel) {
                    await poseModel.send({ image: video });
                } else if (handsModel) {
                    await handsModel.send({ image: video });
                }
            } catch (e) {
                // Ignore dropped frame
            }
            isProcessingFrame = false;
        }

        if (gameActive) {
            animFrameId = requestAnimationFrame(processLoop);
        }
    }

    animFrameId = requestAnimationFrame(processLoop);
}

// MediaPipe Pose Results: Single Arm Biofeedback & Real-time Biomechanics
function onPoseResults(results) {
    if (!gameActive || levelCompleted || inputMode !== 'ai') return;

    const canvas = document.getElementById('hand-canvas');
    const cameraView = document.getElementById('camera-view');
    if (!canvas || !cameraView) return;

    const ctx = canvas.getContext('2d');
    const viewWidth = cameraView.clientWidth;
    const viewHeight = cameraView.clientHeight;

    const video = document.getElementById('camera-feed');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    const scale = Math.max(viewWidth / vw, viewHeight / vh);
    const scaledWidth = Math.round(vw * scale);
    const scaledHeight = Math.round(vh * scale);
    const offsetX = Math.round((scaledWidth - viewWidth) / 2);
    const offsetY = Math.round((scaledHeight - viewHeight) / 2);

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        canvas.style.width = scaledWidth + 'px';
        canvas.style.height = scaledHeight + 'px';
        canvas.style.left = -offsetX + 'px';
        canvas.style.top = -offsetY + 'px';
    }

    ctx.clearRect(0, 0, scaledWidth, scaledHeight);

    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        const lm = results.poseLandmarks;

        // Landmarks indices in MediaPipe Pose:
        // 11: left_shoulder, 12: right_shoulder
        // 13: left_elbow,    14: right_elbow
        // 15: left_wrist,    16: right_wrist
        // 19: left_index,    20: right_index

        const toScreen = (pt) => {
            if (!pt) return { x: 0, y: 0, visibility: 0 };
            const rawX = pt.x * scaledWidth;
            const rawY = pt.y * scaledHeight;
            // Mirror X because camera feed has scaleX(-1)
            return {
                x: (scaledWidth - rawX) - offsetX,
                y: rawY - offsetY,
                visibility: pt.visibility !== undefined ? pt.visibility : 1
            };
        };

        const ls = toScreen(lm[11]); // Bahu Kiri
        const rs = toScreen(lm[12]); // Bahu Kanan
        const le = toScreen(lm[13]); // Siku Kiri
        const re = toScreen(lm[14]); // Siku Kanan
        const lw = toScreen(lm[15]); // Pergelangan Kiri
        const rw = toScreen(lm[16]); // Pergelangan Kanan
        const li = lm[19] ? toScreen(lm[19]) : lw; // Jari Kiri
        const ri = lm[20] ? toScreen(lm[20]) : rw; // Jari Kanan

        // Calculate arm presence / confidence scores
        const leftScore = ((lm[11]?.visibility ?? 1) + (lm[13]?.visibility ?? 1) + (lm[15]?.visibility ?? 1)) / 3;
        const rightScore = ((lm[12]?.visibility ?? 1) + (lm[14]?.visibility ?? 1) + (lm[16]?.visibility ?? 1)) / 3;

        // Requirement 2: Strictly select ONLY 1 arm even if user presents both arms
        if (leftScore > 0.35 && rightScore > 0.35) {
            // Both arms visible: pick elevated hand (smaller screen Y) with 40px hysteresis to prevent flutter
            if (activeArmSide === 'right') {
                if (lw.y < rw.y - 40) {
                    activeArmSide = 'left';
                }
            } else {
                if (rw.y < lw.y - 40) {
                    activeArmSide = 'right';
                }
            }
        } else if (leftScore > 0.35) {
            activeArmSide = 'left';
        } else if (rightScore > 0.35) {
            activeArmSide = 'right';
        }

        // Active arm landmarks
        const isRight = (activeArmSide === 'right');
        const shoulder = isRight ? rs : ls;
        const elbow = isRight ? re : le;
        const wrist = isRight ? rw : lw;
        const hand = isRight ? ri : li;
        const armLabel = isRight ? 'Lengan Kanan' : 'Lengan Kiri';

        // Requirement 4: Real-time Elbow Angle Calculation
        const elbowAngle = calculateJointAngle(shoulder, elbow, wrist);
        const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
        const isInRange = (elbowAngle >= config.targetMinAngle && elbowAngle <= config.targetMaxAngle);

        const drawSegment = (p1, p2, color, width) => {
            if ((p1.visibility || 1) < 0.25 || (p2.visibility || 1) < 0.25) return;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.stroke();
        };

        const drawJoint = (pt, label, color, radius) => {
            if ((pt.visibility || 1) < 0.25) return;
            ctx.save();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();

            if (label && pt.y > 25) {
                ctx.font = '700 11px Inter, sans-serif';
                ctx.fillStyle = '#FFFFFF';
                ctx.shadowColor = 'rgba(0,0,0,0.85)';
                ctx.shadowBlur = 4;
                ctx.fillText(label, pt.x - 14, pt.y - radius - 6);
            }
            ctx.restore();
        };

        // Draw ONLY the selected arm (Shoulder -> Elbow -> Wrist -> Hand)
        drawSegment(shoulder, elbow, isInRange ? 'rgba(16, 185, 129, 0.95)' : 'rgba(59, 130, 246, 0.9)', 6.5);
        drawSegment(elbow, wrist, isInRange ? 'rgba(52, 211, 153, 0.95)' : 'rgba(14, 165, 233, 0.9)', 5);
        drawSegment(wrist, hand, 'rgba(245, 158, 11, 0.85)', 3.5);

        // Draw elbow angle arc and degree badge
        if ((elbow.visibility || 1) > 0.25 && (shoulder.visibility || 1) > 0.25 && (wrist.visibility || 1) > 0.25) {
            const angleSE = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x);
            const angleWE = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);

            ctx.save();
            ctx.beginPath();
            ctx.arc(elbow.x, elbow.y, 34, angleSE, angleWE, false);
            ctx.strokeStyle = isInRange ? '#10B981' : '#F59E0B';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Degree badge beside elbow
            const badgeText = `${elbowAngle}°`;
            ctx.font = '800 13px Inter, sans-serif';
            const textWidth = ctx.measureText(badgeText).width;
            const badgeX = elbow.x + 16;
            const badgeY = elbow.y - 12;

            ctx.fillStyle = isInRange ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.88)';
            ctx.strokeStyle = isInRange ? '#34D399' : '#F59E0B';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(badgeX - 6, badgeY - 14, textWidth + 12, 22, 6);
            } else {
                ctx.rect(badgeX - 6, badgeY - 14, textWidth + 12, 22);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 3;
            ctx.fillText(badgeText, badgeX, badgeY + 2);
            ctx.restore();
        }

        // Draw only the joints of this active arm
        drawJoint(shoulder, 'Bahu', '#10B981', 8);
        drawJoint(elbow, `Siku (${armLabel})`, isInRange ? '#10B981' : '#3B82F6', 8);
        drawJoint(wrist, 'Tangan', '#F59E0B', 9);

        // Visual target reticle on active hand
        ctx.save();
        ctx.beginPath();
        ctx.arc(hand.x, hand.y, 22, 0, 2 * Math.PI);
        ctx.strokeStyle = isInRange ? '#10B981' : '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();

        // Real-time biomechanics feedback (tekuk/luruskan, naikkan/turunkan)
        let guideText = '';
        let guideIcon = '📐';
        let guideStatus = 'adjust';

        if (elbowAngle > config.targetMaxAngle) {
            guideText = `Tekuk siku lebih dalam ke ~${config.idealAngle}°! (Saat ini: ${elbowAngle}°)`;
            guideIcon = '📐';
            guideStatus = 'adjust';
        } else if (elbowAngle < config.targetMinAngle) {
            guideText = `Luruskan siku sedikit ke ~${config.idealAngle}°! (Saat ini: ${elbowAngle}°)`;
            guideIcon = '📐';
            guideStatus = 'adjust';
        } else {
            // Angle is within ideal target range! Check vertical elevation
            if (hand.y > viewHeight * 0.65) {
                guideText = `Sudut pas (${elbowAngle}°)! Naikkan tanganmu lebih tinggi! ⬆️`;
                guideIcon = '⬆️';
                guideStatus = 'adjust';
            } else if (hand.y < viewHeight * 0.22) {
                guideText = `Sudut pas (${elbowAngle}°)! Turunkan tanganmu sedikit! ⬇️`;
                guideIcon = '⬇️';
                guideStatus = 'adjust';
            } else {
                guideText = `Posisi Bagus (${elbowAngle}°)! Tangkap buah ${config.fruitName} ${config.fruit}! 🎯`;
                guideIcon = '🎯';
                guideStatus = 'good';
            }
        }

        // Update DOM HUD elements
        const angleValEl = document.getElementById('bio-current-angle');
        if (angleValEl) {
            angleValEl.textContent = `${elbowAngle}°`;
            angleValEl.className = `bio-hud-value ${isInRange ? 'angle-good' : 'angle-adjust'}`;
        }

        const guideToast = document.getElementById('camera-guide-toast');
        const guideIconEl = document.getElementById('camera-guide-icon');
        const guideTextEl = document.getElementById('camera-guide-text');
        if (guideToast && guideIconEl && guideTextEl) {
            guideIconEl.textContent = guideIcon;
            guideTextEl.textContent = guideText;
            guideToast.className = `camera-guide-toast ${guideStatus === 'good' ? 'guide-good' : 'guide-adjust'}`;
        }

        // Speech biofeedback (throttled)
        const now = Date.now();
        if (now - lastGuidanceVoiceTime > 4500 && talkbackEnabled) {
            if (elbowAngle > config.targetMaxAngle) {
                speak('Tekuk siku sedikit lagi');
                lastGuidanceVoiceTime = now;
            } else if (elbowAngle < config.targetMinAngle) {
                speak('Luruskan siku sedikit');
                lastGuidanceVoiceTime = now;
            } else if (hand.y > viewHeight * 0.65) {
                speak('Naikkan tangan lebih tinggi');
                lastGuidanceVoiceTime = now;
            } else if (guideStatus === 'good') {
                speak(`Bagus! Tangkap buah ${config.fruitName}!`);
                lastGuidanceVoiceTime = now;
            }
        }

        // Drive hand cursor and collision
        updateCursorAndCheckCollision(hand.x, hand.y);
    }
}

function onHandResults(results) {
    if (!gameActive || levelCompleted || inputMode !== 'ai') return;

    const canvas = document.getElementById('hand-canvas');
    const cameraView = document.getElementById('camera-view');
    if (!canvas || !cameraView) return;

    const ctx = canvas.getContext('2d');
    const viewWidth = cameraView.clientWidth;
    const viewHeight = cameraView.clientHeight;

    const video = document.getElementById('camera-feed');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    const scale = Math.max(viewWidth / vw, viewHeight / vh);
    const scaledWidth = Math.round(vw * scale);
    const scaledHeight = Math.round(vh * scale);
    const offsetX = Math.round((scaledWidth - viewWidth) / 2);
    const offsetY = Math.round((scaledHeight - viewHeight) / 2);

    // Only update canvas dimensions when changed to prevent expensive 60fps DOM reflows!
    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        canvas.style.width = scaledWidth + 'px';
        canvas.style.height = scaledHeight + 'px';
        canvas.style.left = -offsetX + 'px';
        canvas.style.top = -offsetY + 'px';
    }

    ctx.clearRect(0, 0, scaledWidth, scaledHeight);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Draw Skeleton overlay (Clinical / Cyber look)
        if (window.drawConnectors && window.drawLandmarks) {
            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
                color: 'rgba(16, 185, 129, 0.85)',
                lineWidth: 4
            });
            window.drawLandmarks(ctx, landmarks, {
                color: 'rgba(59, 130, 246, 0.95)',
                fillColor: '#FFFFFF',
                lineWidth: 2,
                radius: 5
            });
        }

        // Use Index Finger Tip (8) as main pointer
        const indexTip = landmarks[8];
        const rawX = indexTip.x * scaledWidth;
        const rawY = indexTip.y * scaledHeight;

        // Visual position mapped to container space
        const screenX = (scaledWidth - rawX) - offsetX;
        const screenY = rawY - offsetY;

        updateCursorAndCheckCollision(screenX, screenY);
    }
}

// ============================================================
// GAME LOGIC: SPAWN FRUITS & COLLISION
// ============================================================
function spawnFruitTargets() {
    const container = document.getElementById('game-targets');
    if (!container) return;
    container.innerHTML = '';

    const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
    const targetFruit = config.fruit; // Level 1: ONLY Apel 🍎, buah lain tidak ada
    const count = 5;

    for (let i = 0; i < count; i++) {
        const fruit = document.createElement('div');
        fruit.className = 'fruit-target';
        fruit.textContent = targetFruit;
        
        fruit.style.left = (12 + Math.random() * 74) + '%';
        fruit.style.top = (15 + Math.random() * 65) + '%';
        fruit.style.animationDelay = (Math.random() * 2) + 's';
        
        // Allow direct click / touch
        fruit.onclick = () => collectTarget(fruit);
        fruit.ontouchstart = (e) => {
            e.stopPropagation();
            collectTarget(fruit);
        };
        
        container.appendChild(fruit);
    }
}

function checkTargetCollision(handX, handY) {
    if (!gameActive || levelCompleted) return;

    const targets = document.querySelectorAll('.fruit-target');
    const cameraView = document.getElementById('camera-view');
    if (!cameraView) return;
    const viewRect = cameraView.getBoundingClientRect();

    targets.forEach(target => {
        const targetRect = target.getBoundingClientRect();
        const targetCenterX = targetRect.left - viewRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top - viewRect.top + targetRect.height / 2;

        const dx = handX - targetCenterX;
        const dy = handY - targetCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Generous collision radius (65px)
        if (distance < 65) {
            collectTarget(target);
        }
    });
}

function collectTarget(target) {
    if (!target.classList.contains('fruit-target') || !gameActive || levelCompleted) return;
    
    const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
    const targetCount = config.targetCount || 5;
    target.classList.remove('fruit-target');
    
    fruitCollectCount++;
    updateFruitTargetCounter();
    
    // SFX + Voice feedback
    sfxCollect();
    const remaining = targetCount - fruitCollectCount;
    if (remaining > 0) {
        speak(`${config.fruitName}! Sisa ${remaining} lagi!`);
    } else {
        speak(`${config.fruitName}! Target ${targetCount} buah tercapai!`);
    }
    
    // Animation
    target.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    target.style.transform = 'scale(1.6)';
    target.style.opacity = '0';
    
    const pointsPerFruit = Math.round(100 / targetCount);
    addScore(pointsPerFruit, 'motoric');
    
    setTimeout(() => {
        target.remove();
        if (gameActive && !levelCompleted) {
            respawnSingleFruit();
        }
    }, 300);
}

function respawnSingleFruit() {
    const container = document.getElementById('game-targets');
    if (!container || !gameActive || levelCompleted) return;
    
    const config = KINESTETIK_LEVEL_CONFIG[selectedLevel] || KINESTETIK_LEVEL_CONFIG[1];
    const fruit = document.createElement('div');
    fruit.className = 'fruit-target';
    fruit.textContent = config.fruit;
    fruit.style.left = (12 + Math.random() * 74) + '%';
    fruit.style.top = (15 + Math.random() * 65) + '%';
    
    fruit.onclick = () => collectTarget(fruit);
    fruit.ontouchstart = (e) => {
        e.stopPropagation();
        collectTarget(fruit);
    };
    
    container.appendChild(fruit);
}

// Initialize TalkBack Accessibility
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTalkBack);
} else {
    initTalkBack();
}
