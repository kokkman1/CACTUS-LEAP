const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 400;

// --- 1. 에셋 로드 ---
const assets = {
    sky: new Image(),
    mid: new Image(),
    ground: new Image(),
    character1: new Image(),
    character2: new Image(),
    obs: new Image(),
    obs2: new Image(),
    itemMeat: new Image(), // 얼룩말 고기 아이템 이미지
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
assets.itemMeat.src = 'assets/images/item_meat.png'; // 아이템 경로

assets.bgm.loop = true;
assets.bgm.volume = 0.4;

// --- 2. 게임 변수 설정 ---
let gameState = 'START';
let score = 0;
let timer = 0;
let obstacles = [];
let items = []; // 아이템 저장 배열
let animationFrame;
let playerName = "";

let skyX = 0;
let midX = 0;
let groundX = 0;

// 바닥과 장애물의 기준 속도
const GAME_SPEED = 6; 

// 부스터 모드 관련 변수
let isBoosterActive = false;
let boosterTimer = 0;
const BOOSTER_DURATION = 180; // 부스터 지속 시간 (약 3초)
const BOOSTER_SPEED = 18;     // 부스터 시 속도 (3배)
const BOOSTER_POINT_MULTIPLIER = 5; // 부스터 시 점수 획득 배율

// 장애물 및 아이템 생성 타이머 변수
let obstacleTimerMax = 120; 
let obstacleTimer = 0; 
let itemMeatTimerMax = 600; 
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
            // 부스터 모드 시 노란색 파티클 효과
            if (isBoosterActive) {
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

// --- 4. 장애물 (선인장) ---
class Obstacle {
    constructor() {
        this.width = 60;
        this.height = 70;
        this.x = canvas.width;
        this.y = 260;
        this.img = Math.random() > 0.5 ? assets.obs : assets.obs2;
    }
    draw() {
        if (this.img.complete) {
            ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
        }
    }
    update() {
        const currentSpeed = isBoosterActive ? BOOSTER_SPEED : (GAME_SPEED + score / 500);
        this.x -= currentSpeed;
    }
}

// --- 5. 아이템 (얼룩말 고기) ---
class ItemMeat {
    constructor() {
        this.width = 50;
        this.height = 50;
        this.x = canvas.width;
        this.y = 150 + Math.random() * 100; // 공중에 떠 있는 높이 랜덤
    }
    draw() {
        if (assets.itemMeat.complete) {
            ctx.drawImage(assets.itemMeat, this.x, this.y, this.width, this.height);
        }
    }
    update() {
        const currentSpeed = isBoosterActive ? BOOSTER_SPEED : (GAME_SPEED + score / 500);
        this.x -= currentSpeed;
    }
}

// --- 6. 게임 기능 함수 ---
function playSfx(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

function bumpScoreUI() {
    const scoreElement = document.getElementById('ui-score');
    scoreElement.classList.add('score-bump');
    setTimeout(() => {
        scoreElement.classList.remove('score-bump');
    }, 400);
}

function drawBackground() {
    const currentSpeed = isBoosterActive ? BOOSTER_SPEED : (GAME_SPEED + score / 500);
    
    skyX -= 0.5;
    midX -= 1.8;
    groundX -= currentSpeed; 

    if (skyX <= -canvas.width) skyX = 0;
    if (midX <= -canvas.width) midX = 0;
    if (groundX <= -canvas.width) groundX = 0;

    ctx.drawImage(assets.sky, skyX, 0, canvas.width, canvas.height);
    ctx.drawImage(assets.sky, skyX + canvas.width, 0, canvas.width, canvas.height);
    
    ctx.drawImage(assets.mid, midX, 100, canvas.width, 230); 
    ctx.drawImage(assets.mid, midX + canvas.width, 100, canvas.width, 230);

    ctx.drawImage(assets.ground, groundX, 310, canvas.width, 90); 
    ctx.drawImage(assets.ground, groundX + canvas.width, 310, canvas.width, 90);
}

function frame() {
    if (gameState !== 'PLAYING') return;
    
    animationFrame = requestAnimationFrame(frame);
    timer++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();

    // 점수 획득 로직
    if (timer % 10 === 0) {
        score += isBoosterActive ? BOOSTER_POINT_MULTIPLIER : 1;
        if (score > 0 && score % 500 === 0) {
            playSfx(assets.point);
            bumpScoreUI();
        }
    }
    document.getElementById('ui-score').innerText = score;

    // 부스터 타이머 처리
    if (isBoosterActive) {
        boosterTimer--;
        if (boosterTimer <= 0) isBoosterActive = false;
    }

    // 장애물 불규칙 생성
    obstacleTimer++;
    if (obstacleTimer >= obstacleTimerMax) {
        obstacles.push(new Obstacle());
        obstacleTimerMax = 100 + Math.random() * 100; // 생성 간격 랜덤화
        obstacleTimer = 0;
    }

    // 아이템 불규칙 생성
    itemMeatTimer++;
    if (itemMeatTimer >= itemMeatTimerMax) {
        items.push(new ItemMeat());
        itemMeatTimerMax = 500 + Math.random() * 500;
        itemMeatTimer = 0;
    }

    // 장애물 업데이트 및 충돌 체크
    obstacles.forEach((obs, i) => {
        obs.update();
        obs.draw();
        if (checkCollision(player, obs)) endGame();
        if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    });

    // 아이템 업데이트 및 충돌 체크
    items.forEach((item, i) => {
        item.update();
        item.draw();
        if (checkCollision(player, item)) {
            items.splice(i, 1);
            isBoosterActive = true;
            boosterTimer = BOOSTER_DURATION;
            playSfx(assets.point);
            bumpScoreUI();
        }
        if (item.x + item.width < 0) items.splice(i, 1);
    });

    player.update();
    player.draw();
}

function checkCollision(p, o) {
    return !(p.x + 25 > o.x + o.width - 25 || 
             p.x + p.width - 25 < o.x + 25 || 
             p.y + 20 > o.y + o.height - 10 || 
             p.y + p.height - 10 < o.y + 20);
}

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
    assets.bgm.pause();
    assets.bgm.currentTime = 0;
    isBoosterActive = false;
    
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
    player.y = 265;
    isBoosterActive = false;
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
        player.isJumping = true;
        player.dy = player.jumpForce;
        playSfx(assets.jump);
    }
});
