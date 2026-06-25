const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const enemyImg = new Image();
enemyImg.src = 'assets/angry-face.png';

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── World ────────────────────────────────────────────────────────────────────
const WORLD_WIDTH = 12000;
const GROUND_Y = () => canvas.height - 50;

// Camera offset (world → screen: screenX = worldX - cameraX)
let cameraX = 0;

function buildWorld() {
    const gh = GROUND_Y();
    const platforms = [];
    const collectibles = [];
    const enemies = [];

    // Ground segments with gaps (gap probability grows with x)
    let wx = 0;
    while (wx < WORLD_WIDTH - 400) {
        const segLen = 200 + Math.random() * 200;
        platforms.push({ x: wx, y: gh, width: segLen, height: 50, ground: true });
        const gapChance = Math.min(0.8, wx / WORLD_WIDTH + 0.05);
        const gap = Math.random() < gapChance ? 80 + Math.random() * 100 : 0;
        wx += segLen + gap;
    }
    // Always close with solid ground before the portal
    platforms.push({ x: WORLD_WIDTH - 500, y: gh, width: 500, height: 50, ground: true });

    // Elevated platforms scattered across the world
    const elevatedCount = 30;
    for (let i = 0; i < elevatedCount; i++) {
        const px = 300 + (i / elevatedCount) * (WORLD_WIDTH - 600);
        const py = gh - 80 - Math.random() * 160;
        const pw = 100 + Math.random() * 120;
        platforms.push({ x: px, y: py, width: pw, height: 15, ground: false });

        // Coin on some platforms
        if (Math.random() > 0.4) {
            collectibles.push({ x: px + pw / 2 - 12, y: py - 35, width: 24, height: 24, collected: false });
        }
    }

    // Enemies placed on ground segments, density grows with x
    platforms.filter(p => p.ground).forEach(seg => {
        const progress = seg.x / WORLD_WIDTH;
        const count = Math.floor(progress * 4);
        for (let i = 0; i < count; i++) {
            const ex = seg.x + 60 + Math.random() * Math.max(0, seg.width - 120);
            enemies.push({
                x: ex, y: seg.y - 40,
                width: 36, height: 40,
                startX: ex,
                rangeX: 80 + Math.random() * 80,
                speed: 1 + progress * 2.5,
                dir: 1
            });
        }
    });

    // Portal at the end
    const portal = { x: WORLD_WIDTH - 120, y: gh - 100, width: 60, height: 100 };

    return { platforms, collectibles, enemies, portal };
}

let world = buildWorld();

// ── State ────────────────────────────────────────────────────────────────────
let score = 0;
let lives = 3;
let gameRunning = true;
let keys = {};
let cloudOffset = 0;

const player = {
    x: 100,
    y: 0,
    width: 40,
    height: 50,
    velocityY: 0,
    velocityX: 0,
    speed: 5,
    jumpPower: 15,
    gravity: 0.6,
    onGround: false,
    crouching: false,
    dashing: false,
    dashCooldown: 0,
    dashSpeed: 15,
    invulnerable: false,
    invulnerableTime: 0
};

// ── Input ────────────────────────────────────────────────────────────────────
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;
    if (e.key.toLowerCase() === 'r') restartGame();
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
});

// ── Collision ────────────────────────────────────────────────────────────────
function checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// ── Player update ────────────────────────────────────────────────────────────
function updatePlayer() {
    // Dash
    if (keys['Shift'] && !player.dashing && player.dashCooldown <= 0) {
        player.dashing = true;
        player.dashCooldown = 60;
        setTimeout(() => { player.dashing = false; }, 200);
    }
    if (player.dashCooldown > 0) player.dashCooldown--;

    // Horizontal movement
    player.velocityX = 0;
    if (keys['ArrowLeft'] || keys['a'])
        player.velocityX = player.dashing ? -player.dashSpeed : -player.speed;
    if (keys['ArrowRight'] || keys['d'])
        player.velocityX = player.dashing ? player.dashSpeed : player.speed;

    // Crouch
    if ((keys['ArrowDown'] || keys['s']) && player.onGround) {
        player.crouching = true;
        player.height = 25;
    } else {
        player.crouching = false;
        player.height = 50;
    }

    // Jump
    if ((keys[' '] || keys['Space'] || keys['ArrowUp'] || keys['w']) && player.onGround && !player.crouching) {
        player.velocityY = -player.jumpPower;
        player.onGround = false;
    }

    player.velocityY += player.gravity;
    player.y += player.velocityY;
    player.x += player.velocityX;

    // World bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > WORLD_WIDTH) player.x = WORLD_WIDTH - player.width;

    // Platform collision
    player.onGround = false;
    world.platforms.forEach(p => {
        if (checkCollision(player, p) && player.velocityY >= 0) {
            player.y = p.y - player.height;
            player.velocityY = 0;
            player.onGround = true;
        }
    });

    // Fell into a gap
    if (player.y > canvas.height + 100) {
        takeDamage();
    }

    // Invulnerability timer
    if (player.invulnerable) {
        player.invulnerableTime--;
        if (player.invulnerableTime <= 0) player.invulnerable = false;
    }

    // Camera follows player, clamped to world
    const targetCam = player.x - canvas.width * 0.35;
    cameraX = Math.max(0, Math.min(targetCam, WORLD_WIDTH - canvas.width));

    // Score from progress
    const progress = Math.floor(player.x / 10);
    if (progress > score) {
        score = progress;
        updateScore();
    }

    // Portal check
    if (checkCollision(player, world.portal)) {
        winGame();
    }
}

// ── Enemies ──────────────────────────────────────────────────────────────────
const ENEMY_DETECTION = 320;

function updateEnemies() {
    world.enemies.forEach(e => {
        const dist = Math.abs(player.x - e.x);
        if (dist < ENEMY_DETECTION) {
            e.dir = player.x > e.x ? 1 : -1;
            e.x += e.speed * e.dir * 1.5;
        } else {
            e.x += e.speed * e.dir;
            if (e.x > e.startX + e.rangeX || e.x < e.startX - e.rangeX) e.dir *= -1;
        }

        if (checkCollision(player, e) && !player.invulnerable) {
            // Jump on top → stomp (kill enemy)
            if (player.velocityY > 0 && player.y + player.height < e.y + e.height * 0.5) {
                e.dead = true;
                player.velocityY = -10;
                score += 100;
                updateScore();
            } else {
                takeDamage();
            }
        }
    });
    world.enemies = world.enemies.filter(e => !e.dead);
}

// ── Collectibles ─────────────────────────────────────────────────────────────
function updateCollectibles() {
    world.collectibles.forEach((c, i) => {
        if (!c.collected && checkCollision(player, c)) {
            c.collected = true;
            score += 50;
            updateScore();
        }
    });
}

// ── Damage / lives ───────────────────────────────────────────────────────────
function takeDamage() {
    if (player.invulnerable) return;
    lives--;
    updateLives();
    player.invulnerable = true;
    player.invulnerableTime = 120;
    player.x = Math.max(0, cameraX + 80);
    player.y = GROUND_Y() - 200;
    player.velocityY = 0;
    if (lives <= 0) endGame();
}

// ── Draw helpers ─────────────────────────────────────────────────────────────
function wx(x) { return x - cameraX; } // world → screen x

function drawBackground() {
    cloudOffset = (cloudOffset + 0.3) % canvas.width;
    const clouds = [
        { ox: 80,  y: 70,  r: [28, 38, 28] },
        { ox: 380, y: 110, r: [32, 44, 32] },
        { ox: 650, y: 55,  r: [24, 34, 24] },
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    clouds.forEach(c => {
        const bx = ((c.ox + cloudOffset) % (canvas.width + 120)) - 60;
        ctx.beginPath();
        ctx.arc(bx,           c.y, c.r[0], 0, Math.PI * 2);
        ctx.arc(bx + c.r[0],  c.y, c.r[1], 0, Math.PI * 2);
        ctx.arc(bx + c.r[0] * 2, c.y, c.r[2], 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPlatforms() {
    world.platforms.forEach(p => {
        const sx = wx(p.x);
        if (sx + p.width < 0 || sx > canvas.width) return; // cull offscreen
        ctx.fillStyle = p.ground ? '#2ecc71' : '#27ae60';
        ctx.fillRect(sx, p.y, p.width, p.height);
        ctx.fillStyle = p.ground ? '#27ae60' : '#1e8449';
        for (let i = 0; i < p.width; i += 20) {
            ctx.fillRect(sx + i, p.y, 10, 5);
        }
    });
}

function drawEnemies() {
    world.enemies.forEach(e => {
        const sx = wx(e.x);
        if (sx + e.width < 0 || sx > canvas.width) return;

        ctx.save();
        if (e.dir < 0) {
            ctx.scale(-1, 1);
            ctx.drawImage(enemyImg, -sx - e.width, e.y, e.width, e.height);
        } else {
            ctx.drawImage(enemyImg, sx, e.y, e.width, e.height);
        }
        ctx.restore();
    });
}

function drawCollectibles() {
    world.collectibles.forEach(c => {
        if (c.collected) return;
        const sx = wx(c.x);
        if (sx + c.width < 0 || sx > canvas.width) return;
        const cr = c.width / 2;
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(sx + cr, c.y + cr, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(sx + cr - 4, c.y + cr - 4, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPortal() {
    const p = world.portal;
    const sx = wx(p.x);
    const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 300);

    ctx.save();
    ctx.globalAlpha = pulse;

    // Glow
    const grad = ctx.createRadialGradient(sx + p.width / 2, p.y + p.height / 2, 5, sx + p.width / 2, p.y + p.height / 2, 60);
    grad.addColorStop(0, 'rgba(142,68,173,0.9)');
    grad.addColorStop(1, 'rgba(142,68,173,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 30, p.y - 10, p.width + 60, p.height + 20);

    // Portal arch
    ctx.strokeStyle = '#8e44ad';
    ctx.lineWidth = 5;
    ctx.fillStyle = 'rgba(155,89,182,0.5)';
    ctx.beginPath();
    ctx.rect(sx, p.y, p.width, p.height);
    ctx.fill();
    ctx.stroke();

    // "PORTAL" label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('META', sx + p.width / 2, p.y - 10);
    ctx.textAlign = 'left';

    ctx.restore();
}

function drawPlayer() {
    if (player.invulnerable && Math.floor(player.invulnerableTime / 10) % 2 === 0) return;

    const sx = wx(player.x);
    const cx = sx + player.width / 2;
    const top = player.y;
    const h = player.height;

    const headR = h * 0.18;
    const headCY = top + headR;
    const neckY = headCY + headR;
    const hipY = player.crouching ? neckY + h * 0.25 : neckY + h * 0.38;
    const color = player.dashing ? '#ff6b6b' : '#222';

    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, neckY);
    ctx.lineTo(cx, hipY);
    ctx.stroke();

    if (player.crouching) {
        ctx.beginPath();
        ctx.moveTo(cx - h * 0.22, neckY + h * 0.08);
        ctx.lineTo(cx, neckY + h * 0.18);
        ctx.lineTo(cx + h * 0.22, neckY + h * 0.08);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.moveTo(cx - h * 0.28, neckY + h * 0.1);
        ctx.lineTo(cx, neckY + h * 0.22);
        ctx.lineTo(cx + h * 0.22, neckY + h * 0.08);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx - h * 0.22, top + h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + h * 0.22, top + h);
    ctx.stroke();
}

function drawHUD() {
    // Dash bar
    ctx.fillStyle = player.dashCooldown > 0 ? 'rgba(255,107,107,0.4)' : 'rgba(78,205,196,0.4)';
    ctx.fillRect(10, 10, 100, 10);
    const filled = player.dashCooldown > 0 ? 100 * (1 - player.dashCooldown / 60) : 100;
    ctx.fillStyle = player.dashCooldown > 0 ? '#ff6b6b' : '#4ecdc4';
    ctx.fillRect(10, 10, filled, 10);
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.fillText('DASH', 45, 30);

    // Progress bar
    const progress = Math.min(1, player.x / (WORLD_WIDTH - 200));
    const barW = canvas.width - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(15, canvas.height - 20, barW, 8);
    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(15, canvas.height - 20, barW * progress, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.fillText('META', canvas.width - 40, canvas.height - 13);
}

// ── Game state ───────────────────────────────────────────────────────────────
function updateScore() { document.getElementById('score').textContent = score; }
function updateLives()  { document.getElementById('lives').textContent = lives; }

function endGame() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
}

function winGame() {
    gameRunning = false;
    document.getElementById('winScore').textContent = score;
    document.getElementById('gameWin').classList.remove('hidden');
}

function restartGame() {
    score = 0;
    lives = 3;
    gameRunning = true;
    cameraX = 0;
    cloudOffset = 0;

    player.x = 100;
    player.y = 0;
    player.velocityY = 0;
    player.velocityX = 0;
    player.invulnerable = false;
    player.invulnerableTime = 0;
    player.dashing = false;
    player.dashCooldown = 0;

    world = buildWorld();

    updateScore();
    updateLives();
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('gameWin').classList.add('hidden');
    gameLoop();
}

// ── Touch controls ───────────────────────────────────────────────────────────
(function setupTouch() {
    // Prevent pull-to-refresh and pinch-zoom while playing
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    const bindings = [
        { id: 'btn-left',  press: ['ArrowLeft',  'a'] },
        { id: 'btn-right', press: ['ArrowRight', 'd'] },
        { id: 'btn-down',  press: ['ArrowDown',  's'] },
        { id: 'btn-jump',  press: [' ', 'Space', 'ArrowUp', 'w'] },
        { id: 'btn-dash',  press: ['Shift'] },
    ];

    bindings.forEach(({ id, press: k }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const on  = e => { e.preventDefault(); k.forEach(key => { keys[key] = true;  }); };
        const off = e => { e.preventDefault(); k.forEach(key => { keys[key] = false; }); };
        el.addEventListener('touchstart',  on,  { passive: false });
        el.addEventListener('touchend',    off, { passive: false });
        el.addEventListener('touchcancel', off, { passive: false });
    });
})();

// ── Main loop ────────────────────────────────────────────────────────────────
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    updatePlayer();
    updateEnemies();
    updateCollectibles();

    drawPlatforms();
    drawPortal();
    drawEnemies();
    drawCollectibles();
    drawPlayer();
    drawHUD();

    requestAnimationFrame(gameLoop);
}

gameLoop();
