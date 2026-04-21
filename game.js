const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 400;
ctx.imageSmoothingEnabled = false;

// --- 1. 에셋 로드 ---
const assets = {
    sky: new Image(), mid: new Image(), ground: new Image(),
    character1: new Image(), character2: new Image(),
    obs: new Image(), obs2: new Image(), itemMeat: new Image(),
    bgmMain: new Audio('assets/sounds/bgm_main.mp3'),
    jump: new Audio('assets/sounds/sfx_jump.mp3'),
    die: new Audio('assets/sounds/sfx_die.mp3'),
    gameover: new Audio('assets/sounds/game_over.mp3'),
    point: new Audio('assets/sounds/sfx_point.mp3'),
    start: new Audio('assets/sounds/sfx_start.mp3')
};

assets.sky.src = 'assets/images/sky.png';
assets.mid.src = 'assets/images/mid_bg.png';
assets.ground.src = 'assets/images/ground.png';
assets.character1.src = 'assets/images/character.png';
assets.character2.src = 'assets/images/character_run2.png';
assets.obs.src = 'assets/images/obstacle.png';
assets.obs2.src = 'assets/images/obstacle2.png';
assets.itemMeat.src = 'assets/images/item_meat.png';

Object.values(assets).forEach(asset => {
    if (asset instanceof Audio) {
        asset.preload = 'auto';
        asset.load();
    }
});

assets.bgmMain.loop = true;
assets.bgmMain.volume = 0.4;

// --- 2. 기기별 밸런스 제어 ---
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const speedAdjustment = isMobile ? 0.6 : 1.0; 
const mobileJumpForce = isMobile ? 15.5 : 15;
const mobileGravity = isMobile ? 0.55 : 0.7; // 중력을 낮춰 비거리(공중 체류시간) 확보

let gameState = 'START';
let score = 0;
let timer = 0;
let obstacles = [];
let items = [];
let speedLines = [];
let animationFrame;
let playerName = "";

let skyX = 0, midX = 0, groundX = 0;
const GAME_SPEED = 6 * speedAdjustment; 

let isBoosterActive = false;
let boosterTimer = 0;
let boostMultiplier = 1.0;
const BOOSTER_DURATION = 240;
const MAX_BOOSTER_MULTIPLIER = 2.2;

let obstacleTimerMax = 60;
let obstacleTimer = 0;
let itemMeatTimerMax = 600;
let itemMeatTimer = 0;

// --- 3. 플레이어 (발밑 파티클 로직 포함) ---
const player = {
    x: 100, y: 265, width: 100, height: 70,
    dy: 0, 
    jumpForce: mobileJumpForce,
    gravity: mobileGravity,
    isJumping: false, 
    frame: 0,
    draw() {
        if (!this.isJumping) {
            if (timer % 8 === 0) this.frame = this.frame === 0 ? 1 : 0;
        } else { this.frame = 0; }
        
        const currentImg = this.frame === 0 ? assets.character1 : assets.character2;
        
        if (currentImg.complete) {
            // [복구] 부스터 시 발밑 노란색 파티클 이펙트
            if (isBoosterActive && boostMultiplier > 1.2 && !this.isJumping) {
                for (let i = 0; i < 5; i++) {
                    ctx.fillStyle = '#f1c40f';
                    ctx.fillRect(this.x + Math.random() * (this.width * 0.8), this.y + this.height - 5 + (Math.random() * 10), 4, 4);
                }
            }
            ctx.drawImage(currentImg, this.x, this.y, this.width, this.height);
        }
    },
    update() {
        if (this.isJumping) { this.y -= this.dy; this.dy -= this.gravity; }
        if (this.y >= 265) { this.y = 265; this.isJumping = false; this.dy = 0; }
    }
};

// --- 4. 클래스 ---
class Obstacle {
    constructor(offsetX = 0) {
        this.width = 60; this.height = 70;
        this.x = canvas.width + offsetX; this.y = 260;
        this.img = Math.random() > 0.5 ? assets.obs : assets.obs2;
    }
    draw() { if (this.img.complete) ctx.drawImage(this.img, this.x, this.y, this.width, this.height); }
    update() { this.x -= (GAME_SPEED + score / 500) * boostMultiplier; }
}

class ItemMeat {
    constructor() { this.width = 50; this.height = 50; this.x = canvas.width; this.y = 280; }
    draw() { if (assets.itemMeat.complete) ctx.drawImage(assets.itemMeat, this.x, this.y, this.width, this.height); }
    update() { this.x -= (GAME_SPEED + score / 500) * boostMultiplier; }
}

// --- 5. 배경 및 속도선 이펙트 ---
function initSpeedLines() {
    speedLines = [];
    for (let i = 0; i < 15; i++) {
        speedLines.push({ 
            x: Math.random() * canvas.width, 
            y: Math.random() * (canvas.height - 100), 
            length: 400 + Math.random() * 600, 
            speed: (20 + Math.random() * 30) * speedAdjustment 
        });
    }
}

function drawBackground() {
    const curSpeed = (GAME_SPEED + score / 500) * boostMultiplier;
    skyX -= 0.5 * speedAdjustment; 
    midX -= 1.8 * speedAdjustment; 
    groundX -= curSpeed;

    if (skyX <= -canvas.width) skyX = 0; 
    if (midX <= -canvas.width) midX = 0; 
    if (groundX <= -canvas.width) groundX = 0;

    ctx.drawImage(assets.sky, Math.floor(skyX), 0, canvas.width + 1, canvas.height);
    ctx.drawImage(assets.sky, Math.floor(skyX + canvas.width), 0, canvas.width + 1, canvas.height);
    ctx.drawImage(assets.mid, Math.floor(midX), 100, canvas.width + 1, 230);
    ctx.drawImage(assets.mid, Math.floor(midX + canvas.width), 100, canvas.width + 1, 230);
    
    // [복구] 부스터 시 배경 흰색 속도선(Speed Lines)
    if (isBoosterActive) {
        const alpha = (boostMultiplier - 1.0) / (MAX_BOOSTER_MULTIPLIER - 1.0) * 0.4;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; 
        ctx.lineWidth = 2;
        speedLines.forEach(line => {
            ctx.beginPath(); 
            ctx.moveTo(line.x, line.y); 
            ctx.lineTo(line.x + line.length, line.y); 
            ctx.stroke();
            line.x -= line.speed * boostMultiplier;
            if (line.x + line.length < 0) { 
                line.x = canvas.width + Math.random() * 200; 
                line.y = Math.random() * (canvas.height - 100); 
            }
        });
    }

    ctx.drawImage(assets.ground, Math.floor(groundX), 310, canvas.width + 1, 90);
    ctx.drawImage(assets.ground, Math.floor(groundX + canvas.width), 310, canvas.width + 1, 90);
}

// --- 6. 게임 루프 및 시스템 ---
function frame() {
    if (gameState !== 'PLAYING') return;
    animationFrame = requestAnimationFrame(frame);
    timer++; ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    if (timer % 10 === 0) {
        const pointWeight = 1.0 + (boostMultiplier - 1.0) * (5 - 1) / (MAX_BOOSTER_MULTIPLIER - 1.0);
        score += Math.round(pointWeight);
    }
    document.getElementById('ui-score').innerText = score;

    if (isBoosterActive) {
        boosterTimer--;
        if (boosterTimer > BOOSTER_DURATION * 0.8) boostMultiplier += 0.04;
        else if (boosterTimer < BOOSTER_DURATION * 0.2) boostMultiplier -= 0.02;
        if (boostMultiplier > MAX_BOOSTER_MULTIPLIER) boostMultiplier = MAX_BOOSTER_MULTIPLIER;
        if (boostMultiplier < 1.0) boostMultiplier = 1.0;
        if (boosterTimer <= 0) isBoosterActive = false;
    } else { boostMultiplier = 1.0; }

    obstacleTimer += 1 * speedAdjustment; 
    if (obstacleTimer >= obstacleTimerMax) {
        obstacles.push(new Obstacle());
        if (Math.random() < 0.2) obstacles.push(new Obstacle(70));
        obstacleTimerMax = 50 + Math.random() * 80; 
        obstacleTimer = 0;
    }

    itemMeatTimer++;
    if (itemMeatTimer >= itemMeatTimerMax) {
        let safe = true; 
        obstacles.forEach(o => { if (Math.abs(canvas.width - o.x) < 150) safe = false; });
        if (safe) { items.push(new ItemMeat()); itemMeatTimerMax = 600 + Math.random() * 600; itemMeatTimer = 0; }
    }

    obstacles.forEach((o, i) => { 
        o.update(); o.draw(); 
        if (checkCollision(player, o)) endGame(); 
        if (o.x + o.width < 0) obstacles.splice(i, 1); 
    });

    items.forEach((m, i) => { 
        m.update(); m.draw(); 
        if (checkCollision(player, m)) { 
            items.splice(i, 1); isBoosterActive = true; boosterTimer = BOOSTER_DURATION; 
            initSpeedLines(); playSfx(assets.point); 
        } 
        if (m.x + m.width < 0) items.splice(i, 1); 
    });

    player.update(); player.draw();
}

function checkCollision(p, o) { 
    return !(p.x + 25 > o.x + o.width - 25 || p.x + p.width - 25 < o.x + 25 || 
             p.y + 20 > o.y + o.height - 10 || p.y + p.height - 10 < o.y + 20); 
}

function playSfx(audio) {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {});
    }
}

function startGame() {
    playSfx(assets.start);
    playerName = document.getElementById('player-name').value || "GUEST";
    document.getElementById('ui-name').innerText = playerName;
    document.getElementById('start-screen').classList.add('hidden');
    assets.bgmMain.play().catch(() => {});
    gameState = 'PLAYING'; frame();
}

function endGame() {
    gameState = 'GAMEOVER'; cancelAnimationFrame(animationFrame);
    assets.bgmMain.pause(); assets.bgmMain.currentTime = 0;
    isBoosterActive = false; boostMultiplier = 1.0;
    playSfx(assets.die); 
    setTimeout(() => playSfx(assets.gameover), 300);
    document.getElementById('gameover-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = `Score: ${score}`;
    let ranks = JSON.parse(localStorage.getItem('hyenaRank') || '[]');
    ranks.push({ name: playerName, score: score }); 
    ranks.sort((a, b) => b.score - a.score);
    localStorage.setItem('hyenaRank', JSON.stringify(ranks.slice(0, 5)));
}

function resetGame() {
    score = 0; timer = 0; obstacles = []; items = []; player.y = 265;
    isBoosterActive = false; boostMultiplier = 1.0;
    gameState = 'START';
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}

function showRanking() {
    let ranks = JSON.parse(localStorage.getItem('hyenaRank') || '[]');
    let msg = ranks.length ? ranks.map((r, i) => `${i+1}위: ${r.name} (${r.score})`).join('\n') : "기록이 없습니다.";
    alert("🏆 TOP 5 랭킹 🏆\n\n" + msg);
}

window.addEventListener('keydown', (e) => { 
    if ((e.code === 'Space' || e.code === 'ArrowUp') && !player.isJumping && gameState === 'PLAYING') { 
        player.isJumping = true; player.dy = player.jumpForce; playSfx(assets.jump); 
    } 
});

window.addEventListener('touchstart', (e) => { 
    if (gameState === 'PLAYING' && !player.isJumping) { 
        player.isJumping = true; player.dy = player.jumpForce; playSfx(assets.jump); 
        if (e.cancelable) e.preventDefault(); 
    } 
}, { passive: false });