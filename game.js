// === Puff Dodge Prototype ===
// Brand: $QUEEF | Practice mode only (no real tokens)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = 960;
canvas.height = 540;

// ---- Assets ----
const ASSETS = {
  player: 'mascot-main-final.png',
  coin:   'coin-main.png',
  logo:   'logo-epic-final.png',
};

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}
const imgPlayer = loadImage(ASSETS.player);
const imgCoin   = loadImage(ASSETS.coin);

// ---- State ----
let state = {
  running: false,
  paused: true,
  score: 0,
  coins: 0,
  lives: 3,
  multiplier: 1,
  burnMock: 0,
  timeScale: 1,
  nextId: 1,
  shielded: false,
  inventory: [],      // max 3; values: 'shield'|'slow'|'life'|'x2'|'x5'|'x10'|'x100'
  entities: [],       // coins, obstacles, powerups
  inputs: { left: false, right: false, jump: false },
};

// ---- Player ----
const player = {
  x: 120, y: canvas.height - 140, w: 96, h: 96,
  vx: 0, vy: 0,
  speed: 5,
  onGround: true,
  gravity: 0.7,
  jumpPower: -12,
};

// ---- Helpers ----
function rand(min, max){ return Math.random() * (max - min) + min; }
function irand(min, max){ return Math.floor(rand(min, max)); }
function aabb(a, b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.h + a.y > b.y; }

function strokeRoundedRect(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  ctx.stroke();
}

// ---- Layers ----
const LAYERS = { GROUND: canvas.height - 44 };

// ---- Spawning ----
function spawnCoin(){
  state.entities.push({
    id: state.nextId++, kind: 'coin',
    x: canvas.width + irand(0, 200),
    y: LAYERS.GROUND - 60 - irand(0, 120),
    w: 40, h: 40, vx: -(3 + rand(0, 2))
  });
}

function spawnObstacle(){
  const size = irand(40, 100);
  state.entities.push({
    id: state.nextId++, kind: 'obstacle',
    x: canvas.width + irand(0, 200),
    y: LAYERS.GROUND - size,
    w: size, h: size, vx: -(4 + rand(0, 3))
  });
}

function rollPowerKind(){
  const r = Math.random();
  if (r < 0.25) return 'shield';
  if (r < 0.50) return 'slow';
  if (r < 0.65) return 'life';
  if (r < 0.80) return 'x2';
  if (r < 0.90) return 'x5';
  if (r < 0.975) return 'x10';
  return 'x100';
}

function spawnPowerup(){
  const k = rollPowerKind();
  state.entities.push({
    id: state.nextId++, kind: 'power', power: k,
    x: canvas.width + irand(0, 300),
    y: LAYERS.GROUND - 80 - irand(0, 160),
    w: 44, h: 44, vx: -(3.5 + rand(0, 2.5))
  });
}

// ---- Inputs ----
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') state.inputs.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') state.inputs.right = true;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') state.inputs.jump = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') state.inputs.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') state.inputs.right = false;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') state.inputs.jump = false;
});

// Touch
const btnLeft  = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump  = document.getElementById('btn-jump');
function bindTouch(btn, prop){
  btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); state.inputs[prop] = true; }, {passive:false});
  btn.addEventListener('touchend',   (e)=>{ e.preventDefault(); state.inputs[prop] = false; }, {passive:false});
}
bindTouch(btnLeft, 'left'); bindTouch(btnRight, 'right'); bindTouch(btnJump, 'jump');

// Inventory UI
const invSlots = [...document.querySelectorAll('#inventory .slot')];
function refreshInventoryUI(){
  invSlots.forEach((slot, i) => {
    const val = state.inventory[i];
    slot.textContent = val ? val.toUpperCase() : '—';
    slot.classList.toggle('ready', !!val);
  });
}
invSlots.forEach((slot, i) => {
  slot.addEventListener('click', () => {
    const item = state.inventory[i];
    if (!item) return;
    activatePower(item);
    state.inventory.splice(i, 1);
    refreshInventoryUI();
  });
});

// HUD
const elScore = document.getElementById('score');
const elCoins = document.getElementById('coins');
const elLives = document.getElementById('lives');
const elMult  = document.getElementById('mult');
const elBurn  = document.getElementById('burn');

function updateHUD(){
  elScore.textContent = Math.floor(state.score);
  elCoins.textContent = state.coins;
  elLives.textContent = state.lives;
  elMult.textContent  = `${state.multiplier.toFixed(0)}x`;
  elBurn.textContent  = state.burnMock.toFixed(0);
}

// Overlay
const overlay  = document.getElementById('overlay');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
btnStart.addEventListener('click', () => startGame());
btnReset.addEventListener('click', () => resetGame(true));
function openOverlay(){ overlay.hidden = false; }
function closeOverlay(){ overlay.hidden = true; }

// Power-ups
let multTimer = 0;
let slowTimer = 0;
function activatePower(kind){
  switch (kind) {
    case 'shield':
      state.shielded = true; break;
    case 'slow':
      slowTimer = 5 * 60; state.timeScale = 0.5; break;
    case 'life':
      state.lives += 1; break;
    case 'x2': case 'x5': case 'x10': case 'x100':
      state.multiplier = parseInt(kind.slice(1), 10);
      multTimer = 6 * 60; break;
  }
  updateHUD();
}

// Flow
function resetGame(keepOverlay=false){
  state.running = false;
  state.paused = !keepOverlay;
  state.score = 0; state.coins = 0; state.lives = 3; state.multiplier = 1;
  state.burnMock = 0; state.timeScale = 1; state.shielded = false;
  state.inventory = []; state.entities = [];
  player.x = 120; player.y = canvas.height - 140; player.vx = 0; player.vy = 0; player.onGround = true;
  if (!keepOverlay) openOverlay();
  refreshInventoryUI(); updateHUD(); draw();
}

function startGame(){ closeOverlay(); state.running = true; state.paused = false; }

// ---- Update ----
let spawnTick = 0;
function update(){
  if (!state.running || state.paused) return;
  const dt = state.timeScale;

  // Movement
  player.vx = 0;
  if (state.inputs.left)  player.vx -= player.speed;
  if (state.inputs.right) player.vx += player.speed;
  if (state.inputs.jump && player.onGround){ player.vy = player.jumpPower; player.onGround = false; }
  player.vy += player.gravity * dt;
  player.x  += player.vx * dt * 1.2;
  player.y  += player.vy * dt;

  // Ground
  const groundY = LAYERS.GROUND - player.h;
  if (player.y >= groundY){ player.y = groundY; player.vy = 0; player.onGround = true; }
  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));

  // Spawns
  spawnTick += 1 * dt;
  if (spawnTick > 30){ // ~0.5s
    spawnTick = 0;
    if (Math.random() < 0.55) spawnObstacle();
    if (Math.random() < 0.45) spawnCoin();
    if (Math.random() < 0.20) spawnPowerup();
  }

  // Move/cull
  for (let i = state.entities.length - 1; i >= 0; i--){
    const e = state.entities[i];
    e.x += e.vx * dt;
    if (e.x + e.w < -10) state.entities.splice(i, 1);
  }

  // Collisions
  for (let i = state.entities.length - 1; i >= 0; i--){
    const e = state.entities[i];
    const pbox = { x: player.x+12, y: player.y+12, w: player.w-24, h: player.h-24 };
    if (!aabb(pbox, e)) continue;

    if (e.kind === 'coin'){
      state.coins += 1;
      state.score += 10 * state.multiplier;
      state.burnMock += 0.5; // visual only
      state.entities.splice(i, 1);
      updateHUD(); continue;
    }

    if (e.kind === 'power'){
      if (state.inventory.length < 3) state.inventory.push(e.power);
      else activatePower(e.power); // auto-use if full
      state.entities.splice(i, 1);
      refreshInventoryUI(); continue;
    }

    if (e.kind === 'obstacle'){
      if (state.shielded){ state.shielded = false; state.entities.splice(i, 1); }
      else{
        state.lives -= 1; state.entities.splice(i, 1);
        if (state.lives <= 0){ state.running = false; openOverlay(); }
      }
      updateHUD(); continue;
    }
  }

  // Timers
  if (multTimer > 0){ multTimer -= 1; if (multTimer <= 0){ state.multiplier = 1; updateHUD(); } }
  if (slowTimer > 0){ slowTimer -= 1; if (slowTimer <= 0){ state.timeScale = 1; } }

  // Distance score
  state.score += 0.2 * state.multiplier * dt;
  updateHUD();
}

// ---- Draw ----
function drawBackground(){
  ctx.fillStyle = '#0D0D0D';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // simple drifting stars
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 40; i++){
    const x = (i * 137) % canvas.width;
    const y = (i * 59)  % canvas.height;
    ctx.fillRect((x + performance.now()/50) % canvas.width, y, 2, 2);
  }
}

function drawPlayer(){
  if (imgPlayer.complete) ctx.drawImage(imgPlayer, player.x, player.y, player.w, player.h);
  else { ctx.fillStyle = '#FF6B00'; ctx.fillRect(player.x, player.y, player.w, player.h); }

  if (state.shielded){
    ctx.save();
    ctx.strokeStyle = '#94DAFF'; ctx.lineWidth = 4;
    strokeRoundedRect(player.x-4, player.y-4, player.w+8, player.h+8, 12);
    ctx.restore();
  }
}

function symbolForPower(k){
  switch(k){
    case 'shield': return '💠';
    case 'slow':   return '⏱️';
    case 'life':   return '❤️';
    case 'x2':     return '2×';
    case 'x5':     return '5×';
    case 'x10':    return '10×';
    case 'x100':   return '100×';
    default:       return '?';
  }
}

function drawEntities(){
  for (const e of state.entities){
    if (e.kind === 'coin'){
      if (imgCoin.complete) ctx.drawImage(imgCoin, e.x, e.y, e.w, e.h);
      else { ctx.fillStyle = '#FDC100'; ctx.beginPath(); ctx.arc(e.x+e.w/2, e.y+e.h/2, e.w/2, 0, Math.PI*2); ctx.fill(); }
    } else if (e.kind === 'power'){
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(symbolForPower(e.power), e.x + e.w/2, e.y + e.h/2);
      ctx.strokeStyle = '#FF9500'; ctx.strokeRect(e.x, e.y, e.w, e.h);
    } else if (e.kind === 'obstacle'){
      ctx.fillStyle = '#1b1122'; ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.strokeStyle = '#FF6B00'; ctx.lineWidth = 3; ctx.strokeRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = '#FF6B00'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('RUG', e.x + e.w/2, e.y + e.h/2);
    }
  }
}

function drawGround(){
  ctx.fillStyle = '#12091a';
  ctx.fillRect(0, canvas.height-44, canvas.width, 44);
  ctx.strokeStyle = '#FF6B00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height-44);
  ctx.lineTo(canvas.width, canvas.height-44);
  ctx.stroke();
}

function draw(){
  drawBackground();
  drawEntities();
  drawPlayer();
  drawGround();
}

// ---- Loop ----
function loop(){
  update();
  draw();
  requestAnimationFrame(loop);
}

// Init
resetGame(); // opens overlay
loop();
