(() => {
  const $ = (id) => document.getElementById(id);
  const setup = $('setup'), gameSection = $('gameSection'), canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const nicknameInput = $('nickname'), titleInput = $('gameTitle'), jokesInput = $('jokes');
  const photoInput = $('photoInput'), avatarPreview = $('avatarPreview');
  const overlay = $('overlay'), overlayEmoji = $('overlayEmoji'), overlayEyebrow = $('overlayEyebrow');
  const overlayTitle = $('overlayTitle'), overlayText = $('overlayText'), overlayBtn = $('overlayBtn');
  const scoreEl = $('score'), bestEl = $('best'), streakEl = $('streak'), playerNameEl = $('playerName'), livesEl = $('lives');
  let photo = null, photoUrl = null, usingOriginalPhoto = true, running = false, gameOver = false, animationId = null;
  let width = 800, height = 500, lastTime = 0, spawnTimer = 0, elapsedTime = 0, score = 0, lives = 3, pizzaStreak = 0, items = [], particles = [], spawnCount = 0;
  let player = { x: 400, y: 420, w: 118, h: 170, speed: 450 };
  let playerScale = 1;
  function updatePlayerSize() {
    // Reduz proporcionalmente o personagem em telas estreitas, mantendo proporções e colisão.
    playerScale = Math.max(0.58, Math.min(1, width / 800));
    player.w = 118 * playerScale;
    player.h = 170 * playerScale;
    player.y = height - (178 * playerScale) / 2 - 6;
    player.x = Math.min(Math.max(player.x, player.w / 2), width - player.w / 2);
  }
  let keys = { left:false, right:false }, soundOn = true, audioCtx = null, toastTimer = null;
  let nickname = 'Paulo Henrique', gameTitle = 'Missão Pizza do Naguminho', jokes = [];
  // Armazenamento defensivo: alguns navegadores/modos privados podem bloquear localStorage.
  const memoryStore = Object.create(null);
  let memoryLeaderboard = [];
  function storageGet(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
    }
  }
  function storageSet(key, value) {
    const stringValue = String(value);
    memoryStore[key] = stringValue;
    try {
      localStorage.setItem(key, stringValue);
      return true;
    } catch (error) {
      return false;
    }
  }
  let best = Number(storageGet('chuvaMemesBest', '0')) || 0;
  bestEl.textContent = String(best).padStart(4,'0');
  // Personagem completo enviado pelo usuário, recortado para fundo transparente.
  const characterSprite = new Image();
  characterSprite.src = 'paulo-personagem.png';
  characterSprite.onload = () => { if (!running) draw(); };


  const goodies = [
    { emoji:'🍕', sprite:'pizza-naguminho.png', points:10, kind:'good', label:'Hummm adoro uma pizzinha do Naguminho!' },
    { emoji:'🍕', sprite:'pizza-naguminho.png', points:15, kind:'good', label:'MAIS UMA DO NAGUMINHO! +15' },
    { emoji:'🍕', sprite:'pizza-naguminho.png', points:20, kind:'good', label:'PAULO ATACOU A PIZZA! +20' },
    { emoji:'🍕', sprite:'pizza-naguminho.png', points:12, kind:'good', label:'BORDA RECHEADA! +12' },
    { emoji:'🍕', sprite:'pizza-naguminho.png', points:30, kind:'good', label:'PIZZA GIGANTE! +30' }
  ];
  const hazards = [
    { emoji:'📄', sprite:'contrato-cet.png', kind:'bad', label:'Lá vem mais uma OS emergencial' },
    { emoji:'🧽', sprite:'bob-esponja.png', kind:'bad', label:'Tô ficando quadrado igual' },
    { emoji:'⚽', sprite:'corinthians.png', kind:'bad', label:'Tenho nojo desse time' },
    { emoji:'🧍', sprite:'matheus-vermelho.png', kind:'instant', label:'Paulo Henrique encontrou o Matheus Petista' },
    { emoji:'🇧🇷', sprite:'joao-bolsonarista.png', kind:'life', label:'22 na cabeça, exatamente!' }
  ];

  const objectSprites = {};
  ['pizza-naguminho.png','contrato-cet.png','bob-esponja.png','corinthians.png','matheus-vermelho.png','joao-bolsonarista.png'].forEach(file => {
    const img = new Image();
    img.src = file;
    objectSprites[file] = img;
  });

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, rect.width);
    height = Math.max(330, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.y = height - 95;
    player.x = Math.min(Math.max(player.x, player.w/2), width-player.w/2);
    if (!running) draw();
  }
  window.addEventListener('resize', resizeCanvas);

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('Escolha um arquivo de imagem.');
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file);
    usingOriginalPhoto = false;
    photo = new Image();
    photo.onload = () => {
      avatarPreview.innerHTML = '';
      const img = document.createElement('img'); img.src = photoUrl; img.alt = 'Prévia do rosto escolhido';
      avatarPreview.appendChild(img);
      if (!running) draw();
    };
    photo.src = photoUrl;
  });
  $('removePhoto').addEventListener('click', () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = null; photoInput.value = '';
    usingOriginalPhoto = true;
    photo = new Image();
    photo.onload = () => {
      avatarPreview.innerHTML = '';
      const img = document.createElement('img'); img.src = 'paulo-henrique.jpg'; img.alt = 'Foto do Paulo Henrique';
      avatarPreview.appendChild(img);
      if (!running) draw();
    };
    photo.onerror = () => { photo = null; avatarPreview.innerHTML = '<span>📸</span>'; };
    photo.src = 'paulo-henrique.jpg';
    if (!running) draw();
  });

  renderLeaderboard();
  $('startBtn').addEventListener('click', () => {
    nickname = nicknameInput.value.trim();
    if (!nickname) { nicknameInput.focus(); nicknameInput.placeholder = 'Digite seu nome para jogar'; return; }
    gameTitle = 'Naguminho: O Desafio';
    jokes = [];
    playerNameEl.textContent = nickname;
    setup.classList.add('hidden'); gameSection.classList.remove('hidden');
    requestAnimationFrame(() => { resizeCanvas(); startGame(); });
  });
  nicknameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('startBtn').click(); });

  $('backBtn').addEventListener('click', () => {
    stopGame(); gameSection.classList.add('hidden'); setup.classList.remove('hidden');
  });
  overlayBtn.addEventListener('click', () => { if (typeof overlayBtn.action === 'function') overlayBtn.action(); });
  $('soundBtn').addEventListener('click', () => {
    soundOn = !soundOn; $('soundBtn').textContent = soundOn ? '🔊' : '🔇';
    $('soundBtn').setAttribute('aria-label', soundOn ? 'Desativar sons' : 'Ativar sons');
  });

  function showOverlay(emoji, eyebrow, title, text, buttonText, action) {
    overlayEmoji.textContent = emoji; overlayEyebrow.textContent = eyebrow;
    overlayTitle.textContent = title; overlayText.textContent = text; overlayBtn.textContent = buttonText;
    overlayBtn.action = action; overlay.classList.remove('hidden');
  }
  function getLeaderboard() {
    try {
      const parsed = JSON.parse(storageGet('naguminhoLeaderboard', '[]'));
      if (Array.isArray(parsed)) {
        memoryLeaderboard = parsed.filter(entry => entry && typeof entry.name === 'string')
          .map(entry => ({ name: entry.name, best: Number(entry.best) || 0 }));
        return memoryLeaderboard.slice();
      }
    } catch (e) { /* usa a cópia em memória se o armazenamento estiver indisponível */ }
    return memoryLeaderboard.slice();
  }
  function savePlayerScore() {
    try {
      const board = getLeaderboard();
      const cleanName = (nickname || nicknameInput.value || 'Jogador').trim() || 'Jogador';
      const key = cleanName.toLocaleLowerCase('pt-BR');
      const existing = board.find(entry => entry.name.trim().toLocaleLowerCase('pt-BR') === key);
      if (existing) existing.best = Math.max(Number(existing.best) || 0, Number(score) || 0);
      else board.push({ name: cleanName, best: Number(score) || 0 });
      board.sort((a, b) => b.best - a.best);
      memoryLeaderboard = board.slice(0, 10);
      const persisted = storageSet('naguminhoLeaderboard', JSON.stringify(memoryLeaderboard));
      renderLeaderboard();
      if (!persisted) showToast('Pontuação registrada nesta sessão, mas o navegador bloqueou o salvamento permanente.');
      return true;
    } catch (error) {
      showToast('Não foi possível salvar a pontuação. Verifique as permissões de armazenamento do navegador.');
      renderLeaderboard();
      return false;
    }
  }
  function renderLeaderboard() {
    const list = $('leaderboardList');
    if (!list) return;
    const board = getLeaderboard();
    list.innerHTML = '';
    if (!board.length) { list.innerHTML = '<li>Ainda não há recordes. Seja o primeiro!</li>'; return; }
    board.slice(0,5).forEach(entry => {
      const li = document.createElement('li');
      li.textContent = entry.name + ' ';
      const score = document.createElement('span');
      score.textContent = String(entry.best).padStart(4,'0');
      li.appendChild(score); list.appendChild(li);
    });
  }

  function startGame() {
    overlay.classList.add('hidden');
    stopGame(); score = 0; lives = 3; pizzaStreak = 0; items = []; particles = []; spawnTimer = 0; spawnCount = 0; elapsedTime = 0; lastTime = 0; gameOver = false;
    updatePlayerSize(); player.x = width/2; running = true;
    updateHUD(); animationId = requestAnimationFrame(loop);
  }
  function stopGame() { running = false; if (animationId) cancelAnimationFrame(animationId); animationId = null; }

  function endGameInstant() {
    stopGame(); gameOver = true; savePlayerScore();
    const finalBest = Math.max(best, score);
    if (finalBest > best) { best = finalBest; storageSet('chuvaMemesBest', String(best)); }
    bestEl.textContent = String(best).padStart(4,'0');
    showOverlay('🚨','FIM DE JOGO INSTANTÂNEO','MATHEUS PETISTA APARECEU!',`Paulo Henrique encontrou o Matheus Petista. Fim de jogo imediato com ${score} pontos.`, 'TENTAR DE NOVO ↻', startGame);
  }

  function endGame() {
    stopGame(); gameOver = true; savePlayerScore();
    const finalBest = Math.max(best, score);
    if (finalBest > best) { best = finalBest; storageSet('chuvaMemesBest', String(best)); }
    bestEl.textContent = String(best).padStart(4,'0');
  // Personagem completo enviado pelo usuário, recortado para fundo transparente.
  const characterSprite = new Image();
  characterSprite.src = 'paulo-personagem.png';
  characterSprite.onload = () => { if (!running) draw(); };

    const ending = score >= 250 ? 'LENDA DAS PIZZAS DO NAGUMINHO' : score >= 100 ? 'SOBREVIVEU AO PERRENGUE...' : 'A CET E O CORINTHIANS VENCERAM';
    showOverlay(score >= 250 ? '🏆' : score >= 100 ? '😎' : '🫠', 'FIM DE JOGO', ending,
      `${nickname} fez ${score} pontos em “${gameTitle}”. ${score < 100 ? 'Treina mais e volta, campeão.' : 'A turma vai ouvir falar dessa partida.'}`,
      'JOGAR DE NOVO ↻', startGame);
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - (lastTime || now))/1000, 0.035); lastTime = now;
    update(dt); draw();
    animationId = requestAnimationFrame(loop);
  }
  function update(dt) {
    const move = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    player.x += move * player.speed * dt;
    player.x = Math.max(player.w/2+4, Math.min(width-player.w/2-4, player.x));
    elapsedTime += dt;
    spawnTimer += dt;
    // A dificuldade cresce tanto com o tempo sobrevivido quanto com a pontuação.
    // Intervalo mínimo e velocidade máxima mantêm o jogo jogável em celular.
    const interval = Math.max(.30, .9 - Math.min(score/1800, .25) - Math.min(elapsedTime*.006, .30));
    if (spawnTimer >= interval) { spawnTimer = 0; spawnItem(); }
    const fallSpeed = 150 + Math.min(score*.12, 100) + Math.min(elapsedTime*2.5, 100);
    for (let i = items.length-1; i >= 0; i--) {
      const it = items[i]; it.y += (fallSpeed + it.extraSpeed) * dt; it.rot += dt*1.8;
      if (collides(it, player)) {
        items.splice(i,1);
        if (it.kind === 'instant') {
          pizzaStreak = 0;
          burst(it.x,it.y,'💥'); playTone(90,.35);
          updateHUD();
          endGameInstant();
          return;
        } else if (it.kind === 'life') {
          lives = Math.min(3, lives + 1);
          pizzaStreak = 0;
          burst(it.x,it.y,'❤️'); playTone(880,.12);
          showToast(it.label);
        } else if (it.kind === 'good') {
          score += it.points; pizzaStreak++; burst(it.x,it.y,it.emoji); playTone(520 + it.points*7, .07);
          if (pizzaStreak === 3) {
            showToast('🍕 EU ADORO UMA PIZZINHA DO NAGUMINHO!');
            playTone(740, .12);
          } else if (pizzaStreak === 5) {
            showToast('🤤 EU ADORO UMA PIZZINHA DO NAGUMINHO!!!');
            playTone(880, .16);
          } else if (pizzaStreak >= 8 && pizzaStreak % 3 === 2) {
            showToast('🍕🍕 A PIZZINHA DO NAGUMINHO É BOA DEMAIS!');
            playTone(980, .18);
          } else {
            showToast(it.label);
          }
        } else {
          pizzaStreak = 0;
          lives--; burst(it.x,it.y,'💥'); playTone(140,.18); showToast(it.label);
          if (lives <= 0) { updateHUD(); endGame(); return; }
        }
        updateHUD();
      } else if (it.y > height + 50) items.splice(i,1);
    }
    for (let i=particles.length-1;i>=0;i--) { const p=particles[i]; p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1); }
  }
  function spawnItem() {
    spawnCount++;
    const roll = Math.random();
    // João é um bônus raro: chance baixa e aparição garantida apenas a cada 30 itens.
    // Pizzas e obstáculos comuns têm prioridade e aparecem com mais frequência.
    const isMatheus = roll < .04;
    const isJoao = !isMatheus && ((spawnCount % 30 === 0) || (roll >= .04 && roll < .065));
    const isBad = !isMatheus && !isJoao && roll < Math.min(.60, .35 + score/3000);
    const list = isMatheus ? hazards.filter(item => item.kind === 'instant') :
      isJoao ? hazards.filter(item => item.kind === 'life') :
      (isBad ? hazards.filter(item => item.kind === 'bad') : goodies);
    const data = list[Math.floor(Math.random()*list.length)];
    items.push({ x: 86 + Math.random()*Math.max(1,width-172), y:-70, emoji:data.emoji, sprite:data.sprite, points:data.points||0, kind:data.kind, label:data.label, rot:0, extraSpeed:Math.random()*45, size:(data.kind==='good' || data.kind==='life') ? 72+Math.random()*12 : (data.kind==='instant' ? 112+Math.random()*12 : 72+Math.random()*10) });
  }
  function collides(it,p) {
    const dx = Math.abs(it.x-p.x), dy = Math.abs(it.y-(p.y+2));
    return dx < p.w*.40 + it.size*.25 && dy < p.h*.31 + it.size*.25;
  }
  function updateHUD() {
    scoreEl.textContent = String(score).padStart(4,'0');
    if (streakEl) streakEl.textContent = String(pizzaStreak);
    livesEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3-lives);
  }
  function showToast(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(()=>toast.classList.remove('show'), 1100);
  }
  function burst(x,y,emoji) {
    for(let i=0;i<7;i++) particles.push({x,y,emoji,vx:(Math.random()-.5)*190,vy:-40-Math.random()*160,life:.45+Math.random()*.4});
  }
  function playTone(freq,duration) {
    if(!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
      osc.frequency.value=freq; osc.type='sine'; gain.gain.setValueAtTime(.06,audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
      osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);
    } catch(e) {}
  }

  function roundedRect(x,y,w,h,r) {
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,w,h,r) : ctx.rect(x,y,w,h); ctx.fill();
  }
  function drawUnderwaterBackground() {
    const grad=ctx.createLinearGradient(0,0,0,height);
    grad.addColorStop(0,'#087da7'); grad.addColorStop(.58,'#19b4c7'); grad.addColorStop(1,'#075b7a');
    ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
    // distant seabed silhouettes and whimsical underwater town
    ctx.fillStyle='#f5c46a';ctx.beginPath();ctx.moveTo(0,height-38);
    for(let x=0;x<=width+30;x+=30) ctx.lineTo(x,height-38-Math.sin(x*.018)*7-Math.cos(x*.031)*4);
    ctx.lineTo(width,height);ctx.lineTo(0,height);ctx.closePath();ctx.fill();
    for(let i=0;i<7;i++){
      const x=(i*137+35)%(width+40)-20, y=height-120-(i%3)*35, w=42+(i%3)*10, h=70+(i%2)*22;
      ctx.fillStyle=['#f5a15b','#f5df7b','#ee7e8c','#8fe1ce'][i%4];
      ctx.beginPath();ctx.roundRect(x,y,w,h,7);ctx.fill();
      ctx.fillStyle='#b7f5f5';for(let r=0;r<2;r++)for(let c=0;c<2;c++){ctx.fillRect(x+8+c*15,y+13+r*18,7,9);}
      ctx.fillStyle='#f6a45e';ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+w/2,y-16);ctx.lineTo(x+w+5,y);ctx.closePath();ctx.fill();
    }
    // coral and seaweed silhouettes
    for(let side=0;side<2;side++){
      const x=side===0?12:width-18;
      ctx.strokeStyle=side===0?'#ef6d9c':'#a4ed77';ctx.lineWidth=7;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(x,height-28);ctx.quadraticCurveTo(x-18,height-90,x+(side?20:-14),height-120);ctx.moveTo(x,height-50);ctx.quadraticCurveTo(x+18,height-85,x+(side?-24:22),height-100);ctx.stroke();
    }
    // bubbles
    ctx.strokeStyle='#d7fbff88';ctx.lineWidth=2;
    for(let i=0;i<12;i++){const x=(i*83+22)%(width-20)+10,y=(i*61+30)%(height-90)+10,r=3+(i%4)*2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#ffe36e';ctx.fillRect(0,height-6,width,6);
  }

  function draw() {
    ctx.clearRect(0,0,width,height);
    drawUnderwaterBackground();
    items.forEach(it=>{
      ctx.save();ctx.translate(it.x,it.y);ctx.rotate(it.rot);
      const sprite = objectSprites[it.sprite];
      if (sprite && sprite.complete && sprite.naturalWidth) {
        const ratio = sprite.naturalWidth / sprite.naturalHeight;
        const maxH = it.size * .86, maxW = it.size * .94;
        const scale = Math.min(maxH / sprite.naturalHeight, maxW / sprite.naturalWidth);
        const drawH = sprite.naturalHeight * scale;
        const drawW = sprite.naturalWidth * scale;
        ctx.shadowColor = (it.kind === 'good') ? '#ffb347' : (it.kind === 'life' ? '#53ff9c' : '#ff4f70');
        ctx.shadowBlur = 8;
        ctx.drawImage(sprite, -drawW/2, -drawH/2, drawW, drawH);
        ctx.shadowBlur = 0;
      } else {
        ctx.font=`${it.size*.7}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(it.emoji,0,1);
      }
      ctx.restore();
    });
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life);ctx.font='22px "Apple Color Emoji","Segoe UI Emoji",sans-serif';ctx.textAlign='center';ctx.fillText(p.emoji,p.x,p.y);});ctx.globalAlpha=1;
    drawPlayer();
    if(!running && !gameOver && !overlay.classList.contains('hidden')) {
      // Decorative idle frame.
    }
  }
  function drawPlayer() {
    const x=player.x, y=player.y;
    ctx.save();
    ctx.fillStyle='#002c3d55';ctx.beginPath();ctx.ellipse(x,y+76*playerScale,50*playerScale,10*playerScale,0,0,Math.PI*2);ctx.fill();
    if (characterSprite.complete && characterSprite.naturalWidth) {
      const ratio=characterSprite.naturalWidth/characterSprite.naturalHeight;
      const drawH=178*playerScale, drawW=drawH*ratio;
      ctx.drawImage(characterSprite,x-drawW/2,y-drawH/2,drawW,drawH);
    } else {
      ctx.fillStyle='#f7f3ed';ctx.beginPath();ctx.ellipse(x,y,40,65,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f0bd9e';ctx.beginPath();ctx.arc(x,y-54,34,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  window.addEventListener('keydown', e=>{
    if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)) e.preventDefault();
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') keys.left=true;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') keys.right=true;
    if(e.key==='Enter' && !overlay.classList.contains('hidden')) overlayBtn.click();
  });
  window.addEventListener('keyup', e=>{
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') keys.left=false;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') keys.right=false;
  });
  function bindHold(btn, side) {
    const on= e=>{e.preventDefault();keys[side]=true;};
    const off= e=>{e.preventDefault();keys[side]=false;};
    btn.addEventListener('pointerdown',on);btn.addEventListener('pointerup',off);btn.addEventListener('pointercancel',off);btn.addEventListener('pointerleave',off);
  }
  bindHold($('leftBtn'),'left');bindHold($('rightBtn'),'right');
  canvas.addEventListener('pointermove', e=>{
    if(e.pointerType==='touch' && running) {
      const rect=canvas.getBoundingClientRect();
      player.x=Math.max(player.w/2,Math.min(width-player.w/2,e.clientX-rect.left));
    }
  });
  canvas.addEventListener('pointerdown', e=>{
    if(e.pointerType==='touch' && running) {
      const rect=canvas.getBoundingClientRect();
      player.x=Math.max(player.w/2,Math.min(width-player.w/2,e.clientX-rect.left));
    }
  });
  resizeCanvas();
})();
