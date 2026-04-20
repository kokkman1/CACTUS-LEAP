const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 400;

// [추가] 픽셀 아트의 선명도를 유지하고 경계선 노이즈를 방지
ctx.imageSmoothingEnabled = false;

// --- 1. 에셋 로드 ---
const assets = {
    sky: new Image(),
    mid: new Image(),
    ground: new Image(),
    character1: new Image(),
    character2: new Image(),
    obs: new Image(),
    obs2: new Image(),
    itemMeat: new Image(),
    bgm: new Audio('assets/sounds/bgm_main.mp3'),
    jump: new Audio('assets/sounds/sfx_jump.mp3'),
    die: new Audio('assets/sounds/sfx_die.mp3'),
    gameover: new Audio('assets/sounds/game_over.mp3'),
    land: new Audio('assets/sounds/landing_on_ground_sfx.mp3'),
    point: new Audio('assets/sounds/sfx_point.mp3')
};

assets.sky.src = 'assets/images/sky.png';
assets.mid.src = 'assets/images/mid_bg.png';
assets.ground.src = 'assets/images/ground.png';
assets.character1.src = 'assets/images/character.png';
assets.character2.src = 'assets/images/character_run2.png';
assets.obs.src = 'assets/images/obstacle.png';
assets.obs2.src = 'assets/images/obstacle2.png';
assets.itemMeat.src = 'assets/images/item_meat.png';

assets.bgm.loop = true;
assets.bgm.volume = 0.4;

// --- 2. 게임 변수 설정 ---
let gameState = 'START';
let score = 0;
let timer = 0;
let obstacles = [];
let items = [];
let speedLines = [];
let animationFrame;
let playerName = "";

let skyX = 0;
let midX = 0;
let groundX = 0;

const GAME_SPEED = 6; 

let isBoosterActive = false;
let boosterTimer = 0;
let boostMultiplier = 1.0; 
const BOOSTER_DURATION = 240; 
const MAX_BOOSTER_MULTIPLIER = 3.0; 
const ACCEL_RATE = 0.05; 
const DECEL_RATE = 0.02; 
const BOOSTER_POINT_MULTIPLIER = 5; 

let obstacleTimerMax = 120; 
let obstacleTimer = 0; 
let itemMeatTimerMax = 700; 
let itemMeatTimer = 0;

// --- 3. 플레이어 (하이에나) ---
const player = {
    x: 100,
    y: 265,
    width: 100,
    height: 70,
    dy: 0,
    jumpForce: 15,
    gravity: 0.7,
    isJumping: false,
    frame: 0,
    
    draw() {
        if (!this.isJumping) {
            if (timer % 8 === 0) this.frame = this.frame === 0 ? 1 : 0;
        } else {
            this.frame = 0; 
        }

        const currentImg = this.frame === 0 ? assets.character1 : assets.character2;
        if (currentImg.complete) {
            if (isBoosterActive && boostMultiplier > 1.2) {
                for (let i = 0; i < 5; i++) {
                    ctx.fillStyle = '#f1c40f';
                    ctx.fillRect(this.x + Math.random() * this.width, this.y + this.height + (Math.random() * 10), 4, 4);
                }
            }
            ctx.drawImage(currentImg, this.x, this.y, this.width, this.height);
        }
    },
    update() {
        if (this.isJumping) {
            this.y -= this.dy;
            this.dy -= this.gravity;
        }
        if (this.y >= 265) {
            if (this.isJumping) playSfx(assets.land);
            this.y = 265;
            this.isJumping = false;
            this.dy = 0;
        }
    }
};

// --- 4. 장애물 & 아이템 ---
class Obstacle {
    constructor() {
        this.width = 60;
        this.height = 70;
        this.x = canvas.width;
        this.y = 260;
        this.img = Math.random() > 0.5 ? assets.obs : assets.obs2;
    }
    draw() {
        if (this.img.complete) ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }
    update() {
        this.x -= (GAME_SPEED + score / 500) * boostMultiplier;
    }
}

class ItemMeat {
    constructor(xPos) {
        this.width = 50;
        this.height = 50;
        this.x = xPos || canvas.width;
        this.y = 280; 
    }
    draw() {
        if (assets.itemMeat.complete) ctx.drawImage(assets.itemMeat, this.x, this.y, this.width, this.height);
    }
    update() {
        this.x -= (GAME_SPEED + score / 500) * boostMultiplier;
    }
}

// --- 5. 효과 함수 ---
function initSpeedLines() {
    speedLines = [];
    for (let i = 0; i < 15; i++) {
        speedLines.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height - 100),
            length: 400 + Math.random() * 600,
            speed: 20 + Math.random() * 30
        });
    }
}

function drawSpeedLines() {
    if (!isBoosterActive) return;
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
            line.length = 400 + Math.random() * 600;
        }
    });
}

// --- 6. 배경 그리기 (흰 선 방지 보정) ---
function drawBackground() {
    const currentSpeed = (GAME_SPEED + score / 500) * boostMultiplier;
    
    skyX -= 0.5;
    midX -= 1.8;
    groundX -= currentSpeed; 

    if (skyX <= -canvas.width) skyX = 0;
    if (midX <= -canvas.width) midX = 0;
    if (groundX <= -canvas.width) groundX = 0;

    // [수정] 이미지 사이에 1px 겹침을 주어 미세한 흰 선 방지
    ctx.drawImage(assets.sky, Math.floor(skyX), 0, canvas.width + 1, canvas.height);
    ctx.drawImage(assets.sky, Math.floor(skyX + canvas.width), 0, canvas.width + 1, canvas.height);
    
    ctx.drawImage(assets.mid, Math.floor(midX), 100, canvas.width + 1, 230); 
    ctx.drawImage(assets.mid, Math.floor(midX + canvas.width), 100, canvas.width + 1, 230);

    drawSpeedLines();

    ctx.drawImage(assets.ground, Math.floor(groundX), 310, canvas.width + 1, 90); 
    ctx.drawImage(assets.ground, Math.floor(groundX + canvas.width), 310, canvas.width + 1, 90);
}

// --- 7. 메인 루프 ---
function frame() {
    if (gameState !== 'PLAYING') return;
    
    animationFrame = requestAnimationFrame(frame);
    timer++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();

    // UI 점수
    if (timer % 10 === 0) {
        const pointWeight = 1.0 + (boostMultiplier - 1.0) * (BOOSTER_POINT_MULTIPLIER - 1) / (MAX_BOOSTER_MULTIPLIER - 1);
        score += Math.round(pointWeight);
    }
    document.getElementById('ui-score').innerText = score;

    // 부스터 가감속
    if (isBoosterActive) {
        boosterTimer--;
        if (boosterTimer > BOOSTER_DURATION * 0.8) boostMultiplier += ACCEL_RATE;
        else if (boosterTimer < BOOSTER_DURATION * 0.2) boostMultiplier -= DECEL_RATE;
        if (boostMultiplier > MAX_BOOSTER_MULTIPLIER) boostMultiplier = MAX_BOOSTER_MULTIPLIER;
        if (boostMultiplier < 1.0) boostMultiplier = 1.0;
        if (boosterTimer <= 0) isBoosterActive = false;
    } else {
        boostMultiplier = 1.0;
    }

    // 장애물 생성
    obstacleTimer++;
    if (obstacleTimer >= obstacleTimerMax) {
        obstacles.push(new Obstacle());
        obstacleTimerMax = 100 + Math.random() * 100;
        obstacleTimer = 0;
    }

    // [수정] 아이템 생성 시 장애물과 겹침 체크
    itemMeatTimer++;
    if (itemMeatTimer >= itemMeatTimerMax) {
        let safeToSpawn = true;
        const minDistance = 150; // 장애물과의 최소 안전 거리

        obstacles.forEach(obs => {
            if (Math.abs(canvas.width - obs.x) < minDistance) {
                safeToSpawn = false;
            }
        });

        if (safeToSpawn) {
            items.push(new ItemMeat());
            itemMeatTimerMax = 500 + Math.random() * 500;
            itemMeatTimer = 0;
        }
    }

    obstacles.forEach((obs, i) => {
        obs.update();
        obs.draw();
        if (checkCollision(player, obs)) endGame();
        if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    });

    items.forEach((item, i) => {
        item.update();
        item.draw();
        if (checkCollision(player, item)) {
            items.splice(i, 1);
            isBoosterActive = true;
            boosterTimer = BOOSTER_DURATION;
            initSpeedLines();
            playSfx(assets.point);
        }
        if (item.x + item.width < 0) items.splice(i, 1);
    });

    player.update();
    player.draw();
}

// 충돌 및 게임 제어 함수들은 이전과 동일
function checkCollision(p, o) {
    return !(p.x + 25 > o.x + o.width - 25 || p.x + p.width - 25 < o.x + 25 || p.y + 20 > o.y + o.height - 10 || p.y + p.height - 10 < o.y + 20);
}
function playSfx(audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
function startGame() {
    playerName = document.getElementById('player-name').value || "GUEST";
    document.getElementById('ui-name').innerText = playerName;
    document.getElementById('start-screen').classList.add('hidden');
    assets.bgm.play();
    gameState = 'PLAYING';
    frame();
}
function endGame() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationFrame);
    assets.bgm.pause(); assets.bgm.currentTime = 0;
    isBoosterActive = false; boostMultiplier = 1.0;
    playSfx(assets.die);
    setTimeout(() => playSfx(assets.gameover), 600);
    document.getElementById('gameover-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = `Score: ${score}`;
    let rankings = JSON.parse(localStorage.getItem('hyenaRank') || '[]');
    rankings.push({ name: playerName, score: score });
    rankings.sort((a, b) => b.score - a.score);
    localStorage.setItem('hyenaRank', JSON.stringify(rankings.slice(0, 5)));
}
function resetGame() {
    score = 0; timer = 0; obstacles = []; items = [];
    player.y = 265; isBoosterActive = false; boostMultiplier = 1.0;
    gameState = 'START';
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}
function showRanking() {
    let rankings = JSON.parse(localStorage.getItem('hyenaRank') || '[]');
    let msg = rankings.length ? rankings.map((r, i) => `${i+1}위: ${r.name} (${r.score})`).join('\n') : "No Record";
    alert("🏆 TOP 5 RANKING 🏆\n\n" + msg);
}
window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'ArrowUp') && !player.isJumping && gameState === 'PLAYING') {
        player.isJumping = true; player.dy = player.jumpForce; playSfx(assets.jump);
    }
});