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

assets.bgm.loop = true;
assets.bgm.volume = 0.4;

// --- 2. 게임 변수 설정 ---
let gameState = 'START';
let score = 0;
let timer = 0;
let obstacles = [];
let animationFrame;
let playerName = "";

let skyX = 0;
let midX = 0;
let groundX = 0;

// 바닥과 장애물의 속도를 통일하기 위한 기준 변수
const GAME_SPEED = 6; 

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
        // [수정] 점프 중일 때는 발 동작 프레임을 고정
        if (!this.isJumping) {
            if (timer % 8 === 0) this.frame = this.frame === 0 ? 1 : 0;
        } else {
            this.frame = 0; // 점프 시에는 첫 번째 자세로 고정
        }

        const currentImg = this.frame === 0 ? assets.character1 : assets.character2;
        if (currentImg.complete) {
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
        // [수정] 바닥 이동 속도와 동일하게 설정
        this.x -= (GAME_SPEED + score / 500);
    }
}

// --- 5. 게임 기능 함수 ---
function playSfx(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

// 점수 강조 효과 (500점 단위)
function bumpScoreUI() {
    const scoreElement = document.getElementById('ui-score');
    scoreElement.classList.add('score-bump');
    setTimeout(() => {
        scoreElement.classList.remove('score-bump');
    }, 400);
}

function drawBackground() {
    const currentSpeed = (GAME_SPEED + score / 500);
    
    skyX -= 0.5;
    midX -= 1.8;
    groundX -= currentSpeed; // 장애물 속도와 동기화

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

    if (timer % 10 === 0) {
        score++;
        // 500점 단위 강조 효과
        if (score > 0 && score % 500 === 0) {
            playSfx(assets.point);
            bumpScoreUI();
        }
    }
    document.getElementById('ui-score').innerText = score;

    if (timer % 120 === 0) {
        obstacles.push(new Obstacle());
    }

    obstacles.forEach((obs, i) => {
        obs.update();
        obs.draw();
        if (checkCollision(player, obs)) endGame();
        if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    });

    player.update();
    player.draw();
}

function checkCollision(p, o) {
    return !(p.x + 20 > o.x + o.width - 20 || 
             p.x + p.width - 20 < o.x + 20 || 
             p.y + 20 > o.y + o.height - 10 || 
             p.y + p.height - 10 < o.y + 20);
}

// --- 6. 시스템 제어 ---
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
    score = 0; timer = 0; obstacles = [];
    player.y = 265;
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