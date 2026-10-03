// ============================================================
// SMILE - Main Application Logic
// ============================================================

// --- State Variables ---
let totalScore = 150;
let cogProgress = 70;
let motProgress = 45;

let cameraStream = null;
let handsModel = null;
let animFrameId = null;
let isProcessingFrame = false;
let handTrackingReady = false;
let gameActive = false;
let levelCompleted = false;
let currentLevelTarget = 50; // points needed to pass level

// Level Progression
let gameProgress = {
    menunjuk_buah: 1,
    tebak_gambar: 1,
    tebak_suara: 1
};

// Coordinate mapping cache
let lastHandPosition = { x: 0, y: 0 };

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
        audio: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Cat_meow.ogg',
        question: 'Suara hewan apakah ini?',
        options: ['🐶 Anjing', '🐱 Kucing', '🦆 Bebek'],
        answer: 1
    },
    {
        audio: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Dog_barking.ogg',
        question: 'Suara hewan apakah ini?',
        options: ['🐶 Anjing', '🐰 Kelinci', '🐮 Sapi'],
        answer: 0
    },
    {
        audio: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Cow_moo.ogg',
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
    currentRole = role;
    
    // Update UI selection
    const cards = document.querySelectorAll('.role-card');
    cards.forEach(c => c.classList.remove('selected'));
    
    if (role === 'anak') {
        cards[0].classList.add('selected');
    } else {
        cards[1].classList.add('selected');
    }
    
    // Show name input
    document.getElementById('name-input-container').style.display = 'flex';
}

function login() {
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
    } else {
        renderPatientList();
        showScreen('therapist-dashboard');
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

let selectedGame = '';
let selectedLevel = 1;

function showLevelSelect(gameType) {
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

function playVideo(url) {
    document.getElementById('youtube-player').src = url;
    showScreen('video-screen');
}

function stopVideoAndBack() {
    // Stop video from playing in background by clearing src
    document.getElementById('youtube-player').src = '';
    showScreen('video-list-screen');
}

function showInstructions() {
    const title = document.getElementById('inst-title');
    const desc = document.getElementById('inst-desc');
    const icon = document.getElementById('inst-icon');

    if (selectedGame === 'menunjuk_buah') {
        title.textContent = 'Kinestetik Motorik';
        icon.textContent = '👆🍎';
        desc.innerHTML = `<b>Modul Kinestetik Gamifikasi</b><br><br>Latih keterampilan motorik halus dan koordinasi tangan-matamu! Angkat tanganmu di depan kamera dan arahkan ke buah-buahan yang muncul di layar. Sistem Edge-AI akan mendeteksi gerakan tanganmu secara real-time. Kumpulkan poin sampai 100% untuk naik level!`;
    } else if (selectedGame === 'tebak_gambar') {
        title.textContent = 'Kognisi Visual';
        icon.textContent = '🖼️❓';
        desc.innerHTML = `<b>Modul Kognisi Adaptif — Visual</b><br><br>Perhatikan gambar yang muncul dengan teliti! Pilih jawaban yang paling tepat dari pilihan di bawahnya. Modul ini melatih kemampuan pengenalan objek dan penalaran sebab-akibat. Jawab dengan benar untuk mengumpulkan poin!`;
    } else if (selectedGame === 'tebak_suara') {
        title.textContent = 'Kognisi Auditori';
        icon.textContent = '🎵👂';
        desc.innerHTML = `<b>Modul Kognisi Adaptif — Auditori</b><br><br>Pasang telingamu baik-baik! Tekan tombol <b>🔊 PLAY</b> untuk mendengarkan suara, lalu tebak suara hewan apakah itu. Modul ini melatih stimulasi multi-indera dan daya ingat auditori anak.`;
    }
    
    showScreen('instruction-screen');
}

function startGame() {
    showScreen('main-app');
    
    // Reset game state for new session
    gameActive = true;
    levelCompleted = false;
    currentQuestionIndex = 0;
    
    // Initialize Dashboard
    updateDashboardUI();
    
    // Setup game content based on selected game
    setupGameContent();
    
    // Only init camera once
    if (!cameraStream) {
        initCameraAndAI();
    }
}

// Cleanup function for stopping game and freeing resources
function stopGame() {
    gameActive = false;
    
    // Stop audio if playing
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    // Cancel animation frame loop
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
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
        // Only Cognitive Panel + Dashboard
        psychomotorPanel.style.display = 'none';
        dashboardGrid.style.gridTemplateColumns = '60% 40%';
        
        cogTitle.textContent = `Kognisi Auditori (Level ${selectedLevel})`;
        badge.textContent = 'Auditori';
        
        loadAudioQuestion(0);
        
    } else if (selectedGame === 'menunjuk_buah') {
        // Only Psychomotor Panel + Dashboard, Centered and Smaller
        cogPanel.style.display = 'none';
        dashboardGrid.style.gridTemplateColumns = '100%'; 
        rightColumn.style.maxWidth = '900px';
        rightColumn.style.margin = '0 auto';
        
    } else {
        // Tebak Gambar
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
    
    // Create interactive play button style for image
    const imgWrapper = document.querySelector('.image-wrapper');
    imgWrapper.innerHTML = `
        <div class="audio-play-btn" onclick="playAudio('${q.audio}')">
            <div class="audio-icon">🔊</div>
            <div class="audio-text">Play</div>
        </div>
    `;
    
    document.getElementById('cognitive-question').textContent = q.question;
    
    const optionsContainer = document.getElementById('cognitive-options');
    optionsContainer.innerHTML = '';
    
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn-option';
        btn.textContent = opt;
        btn.onclick = () => checkAudioAnswer(i, index);
        optionsContainer.appendChild(btn);
    });
}

function playAudio(url) {
    if (currentAudio) {
        currentAudio.pause();
    }
    currentAudio = new Audio(url);
    currentAudio.play().catch(e => console.log('Audio play failed', e));
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
    } else {
        buttons[selectedIndex].style.borderColor = 'var(--color-red-alert)';
        buttons[selectedIndex].style.color = 'var(--color-red-alert)';
        buttons[q.answer].style.borderColor = 'var(--color-mint)';
        buttons[q.answer].style.color = 'var(--color-mint)';
    }
    
    setTimeout(() => {
        loadAudioQuestion(questionIndex + 1);
    }, 1500);
}

// ============================================================
// DASHBOARD UI
// ============================================================
function updateDashboardUI() {
    document.getElementById('total-score').textContent = totalScore;
    
    document.getElementById('progress-cog-val').textContent = `${cogProgress}%`;
    document.getElementById('progress-cog-fill').style.width = `${cogProgress}%`;
    
    document.getElementById('progress-mot-val').textContent = `${motProgress}%`;
    document.getElementById('progress-mot-fill').style.width = `${motProgress}%`;
}

function addScore(points, type) {
    if (!gameActive || levelCompleted) return; // Prevent scoring after level complete
    
    totalScore += points;
    if (type === 'cognitive') {
        cogProgress = Math.min(100, cogProgress + (points / currentLevelTarget) * 100);
    } else if (type === 'motoric') {
        motProgress = Math.min(100, motProgress + (points / currentLevelTarget) * 100);
    }
    updateDashboardUI();
    updateChildMenuScore();
    
    // Check level up condition (guard against multiple triggers)
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
    
    // Show Premium Modal instead of alert
    document.getElementById('success-modal-message').innerHTML = `Hebat! Kamu berhasil menyelesaikan <b>Level ${selectedLevel}</b> dengan cemerlang!`;
    const modal = document.getElementById('success-modal');
    modal.classList.add('active');
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');
    stopGame();
    showScreen('game-list-screen'); // Go back to game selection
}

// ============================================================
// COGNITIVE MODULE
// ============================================================
function loadCognitiveQuestion(index) {
    // Use modulo to cycle through questions and prevent out-of-bounds
    const safeIndex = index % cognitiveQuestions.length;
    currentQuestionIndex = safeIndex;
    const q = cognitiveQuestions[safeIndex];
    
    // Restore image layout if we came from audio
    const imgWrapper = document.querySelector('.image-wrapper');
    imgWrapper.innerHTML = `<img id="cognitive-image" src="${q.image}" alt="Pertanyaan" class="cognitive-img">`;

    document.getElementById('cognitive-question').textContent = q.question;
    
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
    
    // Disable all buttons
    buttons.forEach(btn => btn.disabled = true);
    
    if (selectedIndex === q.answer) {
        // Correct
        buttons[selectedIndex].style.borderColor = 'var(--color-mint)';
        buttons[selectedIndex].style.color = 'var(--color-mint)';
        addScore(20, 'cognitive');
        spawnParticles(buttons[selectedIndex]);
    } else {
        // Wrong
        buttons[selectedIndex].style.borderColor = 'var(--color-red-alert)';
        buttons[selectedIndex].style.color = 'var(--color-red-alert)';
        buttons[q.answer].style.borderColor = 'var(--color-mint)';
        buttons[q.answer].style.color = 'var(--color-mint)';
    }
    
    // Next question after delay
    setTimeout(() => {
        currentQuestionIndex = (currentQuestionIndex + 1) % cognitiveQuestions.length;
        loadCognitiveQuestion(currentQuestionIndex);
    }, 1500);
}

function spawnParticles(element) {
    // Simple visual feedback
    element.style.transform = 'scale(1.05)';
    setTimeout(() => {
        element.style.transform = 'translateY(-6px)';
    }, 200);
}

// ============================================================
// PSYCHOMOTOR MODULE (AI & CAMERA)
// ============================================================
async function initCameraAndAI() {
    const video = document.getElementById('camera-feed');
    const statusContainer = document.getElementById('camera-status-container');
    const statusText = document.getElementById('camera-status-text');

    try {
        // 1. Request Camera
        statusText.textContent = 'Meminta akses kamera...';
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });
        video.srcObject = cameraStream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => resolve();
        });
        
        video.play();

        // 2. Load MediaPipe Hands
        statusText.textContent = 'Memuat model AI... (Sekitar 5-10 detik)';
        handsModel = new window.Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        handsModel.setOptions({
            maxNumHands: 1,
            modelComplexity: 1, // Higher accuracy
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });

        handsModel.onResults(onHandResults);

        // 3. Warm up model
        if (video.readyState >= 2) {
            await handsModel.send({ image: video });
        }

        handTrackingReady = true;
        statusContainer.style.opacity = '0'; // Hide loading
        setTimeout(() => statusContainer.style.display = 'none', 300);

        // 4. Start Game Loops
        startFrameProcessing(video);
        spawnFruitTargets();
        
        // Setup Hand Cursor Element (Basket)
        const cursor = document.createElement('div');
        cursor.id = 'hand-cursor';
        cursor.className = 'hand-cursor';
        cursor.textContent = '🧺';
        document.getElementById('camera-view').appendChild(cursor);

        // Fallback for mouse
        document.getElementById('camera-view').addEventListener('mousemove', moveHandCursorFallback);

    } catch (err) {
        console.warn('Camera/AI init failed:', err);
        statusText.textContent = 'Gagal mengakses kamera. Menggunakan mode mouse.';
        document.getElementById('camera-spinner').style.display = 'none';
        
        // Enable mouse fallback instantly
        handTrackingReady = false;
        const cursor = document.createElement('div');
        cursor.id = 'hand-cursor';
        cursor.className = 'hand-cursor';
        cursor.textContent = '🧺';
        document.getElementById('camera-view').appendChild(cursor);
        document.getElementById('camera-view').addEventListener('mousemove', moveHandCursorFallback);
        spawnFruitTargets();
        
        setTimeout(() => statusContainer.style.display = 'none', 2000);
    }
}

function startFrameProcessing(video) {
    async function processLoop() {
        if (!handsModel || !cameraStream) return;

        if (!isProcessingFrame && video.readyState >= 2) {
            isProcessingFrame = true;
            try {
                await handsModel.send({ image: video });
            } catch (e) {
                // Ignore dropped frames
            }
            isProcessingFrame = false;
        }
        animFrameId = requestAnimationFrame(processLoop);
    }
    animFrameId = requestAnimationFrame(processLoop);
}

function onHandResults(results) {
    const canvas = document.getElementById('hand-canvas');
    const cameraView = document.getElementById('camera-view');
    if (!canvas || !cameraView) return;

    const ctx = canvas.getContext('2d');
    const viewWidth = cameraView.clientWidth;
    const viewHeight = cameraView.clientHeight;

    const handCursor = document.getElementById('hand-cursor');

    // --- Object-Fit: Cover Mapping ---
    const video = document.getElementById('camera-feed');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    
    const scale = Math.max(viewWidth / vw, viewHeight / vh);
    const scaledWidth = vw * scale;
    const scaledHeight = vh * scale;
    const offsetX = (scaledWidth - viewWidth) / 2;
    const offsetY = (scaledHeight - viewHeight) / 2;

    // Align canvas to scaled video dimensions
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    canvas.style.width = scaledWidth + 'px';
    canvas.style.height = scaledHeight + 'px';
    canvas.style.left = -offsetX + 'px';
    canvas.style.top = -offsetY + 'px';

    ctx.clearRect(0, 0, scaledWidth, scaledHeight);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Draw Skeleton overlay (Clinical/Cyber look)
        if (window.drawConnectors && window.drawLandmarks) {
            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
                color: 'rgba(16, 185, 129, 0.8)', // Mint green
                lineWidth: 4
            });
            window.drawLandmarks(ctx, landmarks, {
                color: 'rgba(59, 130, 246, 0.9)', // Baby blue
                fillColor: '#FFFFFF',
                lineWidth: 2,
                radius: 5
            });
        }
        
        // Use Index Finger Tip (8) as the main pointer
        const indexTip = landmarks[8];
        const rawX = indexTip.x * scaledWidth;
        const rawY = indexTip.y * scaledHeight;

        // Visual position on mirrored canvas mapped to container DOM space
        const screenX = (scaledWidth - rawX) - offsetX;
        const screenY = rawY - offsetY;

        if (handCursor) {
            handCursor.style.display = 'block';
            // Center the basket (3rem ~ 48px, so offset by 24px)
            handCursor.style.transform = `translate3d(${screenX - 24}px, ${screenY - 24}px, 0)`;
        }

        lastHandPosition.x = screenX;
        lastHandPosition.y = screenY;

        checkTargetCollision(screenX, screenY);

    } else {
        if (handCursor) handCursor.style.display = 'none';
    }
}

// Fallback for mouse movement
function moveHandCursorFallback(e) {
    if (handTrackingReady) return; // Ignore if AI is active
    
    const cursor = document.getElementById('hand-cursor');
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (cursor) {
        cursor.style.display = 'block';
        cursor.style.transform = `translate3d(${x - 24}px, ${y - 24}px, 0)`;
    }
    
    checkTargetCollision(x, y);
}

// ============================================================
// GAME LOGIC: SPAWN FRUITS & COLLISION
// ============================================================
function spawnFruitTargets() {
    const container = document.getElementById('game-targets');
    container.innerHTML = '';

    const fruits = ['🍎', '🍌', '🍉', '🍇', '🍓', '🍊'];
    const count = 5;

    for (let i = 0; i < count; i++) {
        const fruit = document.createElement('div');
        fruit.className = 'fruit-target';
        fruit.textContent = fruits[Math.floor(Math.random() * fruits.length)];
        
        // Random position
        fruit.style.left = (10 + Math.random() * 80) + '%';
        fruit.style.top = (10 + Math.random() * 80) + '%';
        
        // Random animation delay
        fruit.style.animationDelay = (Math.random() * 2) + 's';
        
        container.appendChild(fruit);
    }
}

function checkTargetCollision(handX, handY) {
    if (!gameActive || levelCompleted) return; // Don't check collisions if game is over
    
    const targets = document.querySelectorAll('.fruit-target');
    const viewRect = document.getElementById('camera-view').getBoundingClientRect();

    targets.forEach(target => {
        const targetRect = target.getBoundingClientRect();
        
        const targetCenterX = targetRect.left - viewRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top - viewRect.top + targetRect.height / 2;

        const dx = handX - targetCenterX;
        const dy = handY - targetCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Generous collision radius (60px)
        if (distance < 60) {
            collectTarget(target);
        }
    });
}

function collectTarget(target) {
    // Prevent double collection
    target.classList.remove('fruit-target');
    
    // Collection Animation
    target.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    target.style.transform = 'scale(1.5)';
    target.style.opacity = '0';
    
    addScore(10, 'motoric');
    
    setTimeout(() => {
        target.remove();
        // Respawn a new fruit to keep game going
        respawnSingleFruit();
    }, 300);
}

function respawnSingleFruit() {
    const container = document.getElementById('game-targets');
    const fruits = ['🍎', '🍌', '🍉', '🍇', '🍓', '🍊'];
    
    const fruit = document.createElement('div');
    fruit.className = 'fruit-target';
    fruit.textContent = fruits[Math.floor(Math.random() * fruits.length)];
    fruit.style.left = (10 + Math.random() * 80) + '%';
    fruit.style.top = (10 + Math.random() * 80) + '%';
    
    container.appendChild(fruit);
}
