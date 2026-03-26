'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────
var FW=105,FH=68,HW=52.5,HH=34;
var BALL_R=0.22,PR=0.4;
var GW=7.32,GH=2.44;
// Load settings saved from menu
var _SET=(function(){try{return JSON.parse(localStorage.getItem('sfc_settings'))||{}}catch(e){return{}}})();
var MATCH_SEC  = _SET.matchLen   || 180;
var DIFFICULTY = _SET.difficulty || 'medium';
var FORMATION  = _SET.formation  || '4-3-3';
var CAM_STYLE  = _SET.camStyle   || 'broadcast';
var OPT_OFFSIDE  = _SET.offside  !== false;
var OPT_INJURIES = _SET.injury   !== false;
var OPT_CARDS    = _SET.cards    !== false;
var OPT_SFX      = _SET.sfx     !== false;
var OPT_CROWD    = _SET.crowd    !== false;

// ── FORMATION ────────────────────────────────────────────────
// Formation definitions matching menu
var FORM_DEFS={
  '4-3-3':[
    {role:'GK',x:-44,z:0},
    {role:'LB',x:-35,z:-12},{role:'LCB',x:-35,z:-5},{role:'RCB',x:-35,z:5},{role:'RB',x:-35,z:12},
    {role:'LCM',x:-18,z:-8},{role:'CM',x:-18,z:0},{role:'RCM',x:-18,z:8},
    {role:'LW',x:5,z:-14},{role:'ST',x:8,z:0},{role:'RW',x:5,z:14}
  ],
  '4-4-2':[
    {role:'GK',x:-44,z:0},
    {role:'LB',x:-35,z:-12},{role:'LCB',x:-35,z:-5},{role:'RCB',x:-35,z:5},{role:'RB',x:-35,z:12},
    {role:'LM',x:-14,z:-16},{role:'LCM',x:-16,z:-5},{role:'RCM',x:-16,z:5},{role:'RM',x:-14,z:16},
    {role:'ST',x:6,z:-5},{role:'ST',x:6,z:5}
  ],
  '4-2-3-1':[
    {role:'GK',x:-44,z:0},
    {role:'LB',x:-35,z:-12},{role:'LCB',x:-35,z:-5},{role:'RCB',x:-35,z:5},{role:'RB',x:-35,z:12},
    {role:'LDM',x:-24,z:-6},{role:'RDM',x:-24,z:6},
    {role:'LW',x:-5,z:-14},{role:'CAM',x:-4,z:0},{role:'RW',x:-5,z:14},
    {role:'ST',x:8,z:0}
  ],
  '3-5-2':[
    {role:'GK',x:-44,z:0},
    {role:'LCB',x:-36,z:-10},{role:'CB',x:-36,z:0},{role:'RCB',x:-36,z:10},
    {role:'LWB',x:-20,z:-18},{role:'LCM',x:-18,z:-7},{role:'CM',x:-18,z:0},{role:'RCM',x:-18,z:7},{role:'RWB',x:-20,z:18},
    {role:'ST',x:6,z:-5},{role:'ST',x:6,z:5}
  ],
  '5-3-2':[
    {role:'GK',x:-44,z:0},
    {role:'LWB',x:-32,z:-18},{role:'LCB',x:-36,z:-9},{role:'CB',x:-36,z:0},{role:'RCB',x:-36,z:9},{role:'RWB',x:-32,z:18},
    {role:'LCM',x:-18,z:-8},{role:'CM',x:-18,z:0},{role:'RCM',x:-18,z:8},
    {role:'ST',x:6,z:-5},{role:'ST',x:6,z:5}
  ],
  '4-1-4-1':[
    {role:'GK',x:-44,z:0},
    {role:'LB',x:-35,z:-12},{role:'LCB',x:-35,z:-5},{role:'RCB',x:-35,z:5},{role:'RB',x:-35,z:12},
    {role:'DM',x:-26,z:0},
    {role:'LM',x:-12,z:-16},{role:'LCM',x:-14,z:-5},{role:'RCM',x:-14,z:5},{role:'RM',x:-12,z:16},
    {role:'ST',x:8,z:0}
  ]
};
var FORM=FORM_DEFS[FORMATION]||FORM_DEFS['4-3-3'];

// ── SQUAD STATS LOADER ───────────────────────────────────────
// Maps squad cards to formation slots, giving each player individual stats
var SQUAD_CARDS={}; // slotKey -> card object

function loadSquadStats(){
  try{
    var col=JSON.parse(localStorage.getItem('sfc_collection')||'[]');
    var sq =JSON.parse(localStorage.getItem('sfc_squad')||'{}');
    // sq is {slot_0: cardId, slot_1: cardId, ...}
    Object.keys(sq).forEach(function(slotKey){
      var card=col.find(function(c){return c.id===sq[slotKey]||String(c.id)===String(sq[slotKey])});
      if(card) SQUAD_CARDS[slotKey]=card;
    });
  }catch(e){}
}
loadSquadStats();

// Default stats for a position when no card is equipped
var ROLE_DEFAULTS={
  GK: {pace:55,shooting:40,passing:60,dribbling:55,defending:70,physical:70,overall:72},
  LB: {pace:72,shooting:55,passing:65,dribbling:62,defending:72,physical:68,overall:73},
  LCB:{pace:62,shooting:52,passing:65,dribbling:55,defending:80,physical:78,overall:76},
  RCB:{pace:62,shooting:52,passing:65,dribbling:55,defending:80,physical:78,overall:76},
  RB: {pace:72,shooting:55,passing:65,dribbling:62,defending:72,physical:68,overall:73},
  LCM:{pace:68,shooting:65,passing:78,dribbling:70,defending:65,physical:68,overall:75},
  CM: {pace:68,shooting:68,passing:80,dribbling:72,defending:62,physical:70,overall:76},
  RCM:{pace:68,shooting:65,passing:78,dribbling:70,defending:65,physical:68,overall:75},
  LW: {pace:82,shooting:72,passing:72,dribbling:82,defending:45,physical:62,overall:78},
  ST: {pace:78,shooting:85,passing:68,dribbling:76,defending:42,physical:74,overall:82},
  RW: {pace:82,shooting:72,passing:72,dribbling:82,defending:45,physical:62,overall:78},
};

function getPlayerStats(slotIndex){
  var slotKey='slot_'+slotIndex;
  var card=SQUAD_CARDS[slotKey];
  if(card&&card.stats){
    return {
      pace:    card.stats.pace      ||75,
      shooting:card.stats.shooting  ||75,
      passing: card.stats.passing   ||75,
      dribbling:card.stats.dribbling||75,
      defending:card.stats.defending||70,
      physical: card.stats.physical ||70,
      overall:  card.overall        ||75,
      name:     card.name           ||'Player',
    };
  }
  // Fall back to role defaults
  var role=FORM[slotIndex]?FORM[slotIndex].role:'CM';
  return Object.assign({name:'Player '+(slotIndex+1)},ROLE_DEFAULTS[role]||ROLE_DEFAULTS.CM);
}

// Controlled player base stats (slot 9 = ST by default)
var _ctrlStats=getPlayerStats(9);
var PACE =_ctrlStats.pace;
var SHOOT=_ctrlStats.shooting;
var WALK=6+(PACE-60)*0.06;
var SPR =10+(PACE-60)*0.12;
var KPOW=18+(SHOOT-60)*0.18;
var DIFF_MULT       = DIFFICULTY==='easy'?0.72:DIFFICULTY==='hard'?1.22:1.0;
var CPU_SPD_MULT    = DIFF_MULT;
var CPU_TACKLE_MULT = DIFFICULTY==='easy'?0.5:DIFFICULTY==='hard'?1.5:1.0;

// ── RENDERER ─────────────────────────────────────────────────
var canvas=document.getElementById('c');
var renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0a0b10);

// ── GEMINI SHADOW TEXTURE ────────────────────────────────────
function makeShadowTexture(){
  var c=document.createElement('canvas');c.width=64;c.height=64;
  var ctx=c.getContext('2d');
  ctx.clearRect(0,0,64,64);
  var grad=ctx.createRadialGradient(32,32,2,32,32,28);
  grad.addColorStop(0,'rgba(0,0,0,0.55)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.ellipse(32,32,24,12,0,0,Math.PI*2);ctx.fill();
  return new THREE.CanvasTexture(c);
}
var SHADOW_TEX=makeShadowTexture();

// Animation timer
var animTimer=0;

// ── SOUND SYSTEM (Web Audio API — no files needed) ───────────
var AudioCtx = window.AudioContext || window.webkitAudioContext;
var audioCtx = null;
var crowdGain = null;
var crowdNodes = [];

function initAudio(){
  if(audioCtx) return;
  try{
    audioCtx = new AudioCtx();

    // Master gain
    var master = audioCtx.createGain();
    master.gain.value = 0.7;
    master.connect(audioCtx.destination);

    // ── CROWD AMBIENCE ────────────────────────────────────────
    // Layer 1: low stadium rumble (brown noise filtered low)
    crowdGain = audioCtx.createGain();
    crowdGain.gain.value = 0.18;
    crowdGain.connect(master);

    function makeNoiseLayer(freq, q, gainVal, rate){
      var bufSize = audioCtx.sampleRate * 2;
      var buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
      var data = buf.getChannelData(0);
      var last = 0;
      for(var i=0;i<bufSize;i++){
        var white = Math.random()*2-1;
        last = (last + 0.02*white) / 1.02; // brownian
        data[i] = last * 3.5;
      }
      var src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var filt = audioCtx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = freq;
      filt.Q.value = q;
      var g = audioCtx.createGain();
      g.gain.value = gainVal;
      src.connect(filt);
      filt.connect(g);
      g.connect(crowdGain);
      src.start();
      crowdNodes.push({src:src, gain:g});

      // Gentle LFO modulation to make crowd feel alive
      var lfo = audioCtx.createOscillator();
      lfo.frequency.value = rate;
      var lfoGain = audioCtx.createGain();
      lfoGain.gain.value = gainVal * 0.3;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      lfo.start();
      return g;
    }

    makeNoiseLayer(180, 0.8, 1.0, 0.08);   // low crowd rumble
    makeNoiseLayer(600, 1.2, 0.4, 0.13);   // mid chatter
    makeNoiseLayer(2200, 2.0, 0.15, 0.21); // high sibilance

  } catch(e){ console.warn('Audio failed:', e); }
}

function setCrowdExcitement(level){
  // level 0-1: 0=quiet, 0.5=normal, 1=roaring
  if(!crowdGain) return;
  var target = 0.08 + level * 0.55;
  crowdGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.4);
}

// ── SOUND EFFECTS ────────────────────────────────────────────
function playKickSound(power){
  if(!audioCtx) return;
  try{
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    var dist = audioCtx.createWaveShaper();

    // Distortion curve for that thud sound
    var curve = new Float32Array(256);
    for(var i=0;i<256;i++){
      var x = (i*2/256)-1;
      curve[i] = (Math.PI+200)*x/(Math.PI+200*Math.abs(x));
    }
    dist.curve = curve;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120 + power*8, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime+0.12);

    g.gain.setValueAtTime(0.6 * Math.min(1, power/15), audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.18);

    osc.connect(dist);
    dist.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime+0.2);
  }catch(e){}
}

function playGoalSound(){
  if(!audioCtx) return;
  try{
    // Crowd EXPLODES
    setCrowdExcitement(1.0);
    setTimeout(function(){ setCrowdExcitement(0.6) }, 3000);
    setTimeout(function(){ setCrowdExcitement(0.3) }, 6000);

    // Air horn
    var t = audioCtx.currentTime;
    for(var h=0;h<3;h++){
      (function(delay){
        setTimeout(function(){
          var osc = audioCtx.createOscillator();
          var g = audioCtx.createGain();
          var filt = audioCtx.createBiquadFilter();
          filt.type = 'lowpass';
          filt.frequency.value = 1800;
          osc.type = 'sawtooth';
          osc.frequency.value = 220 + Math.random()*30;
          g.gain.setValueAtTime(0, audioCtx.currentTime);
          g.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime+0.05);
          g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.55);
          osc.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
          osc.start(); osc.stop(audioCtx.currentTime+0.6);
        }, delay);
      })(h * 220);
    }
  }catch(e){}
}

function playWhistleSound(){
  if(!audioCtx) return;
  try{
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2800, audioCtx.currentTime);
    osc.frequency.setValueAtTime(3100, audioCtx.currentTime+0.08);
    osc.frequency.setValueAtTime(2800, audioCtx.currentTime+0.16);
    g.gain.setValueAtTime(0.4, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.35);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime+0.4);
  }catch(e){}
}

function playSaveSound(){
  if(!audioCtx) return;
  try{
    // Sharp thud + crowd gasp
    playKickSound(12);
    setCrowdExcitement(0.65);
    setTimeout(function(){ setCrowdExcitement(0.3) }, 1500);
  }catch(e){}
}

function playCardSound(){
  if(!audioCtx) return;
  try{
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 400;
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.15);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime+0.2);
  }catch(e){}
}

// Crowd reacts to near-miss
function playNearMissSound(){
  if(!audioCtx) return;
  setCrowdExcitement(0.55);
  setTimeout(function(){ setCrowdExcitement(0.3) }, 1200);
}

// ── CROWD EXCITEMENT BASED ON GAME STATE ─────────────────────
var _lastBallX = 0;
function updateCrowdAmbience(){
  if(!audioCtx||!crowdGain) return;
  var ballNearGoal = Math.abs(B.x) > HW*0.7;
  var ballFast = Math.hypot(B.vx,B.vz) > 12;
  var excitement = 0.25;
  if(ballNearGoal) excitement += 0.25;
  if(ballFast)     excitement += 0.15;
  if(B.owner && teamA.indexOf(B.owner)>=0) excitement += 0.05; // crowd up when you attack
  // Only nudge gently — don't override goal/save spikes
  var cur = crowdGain.gain.value;
  if(Math.abs(cur - (0.08 + excitement*0.55)) > 0.1){
    setCrowdExcitement(excitement);
  }
}



// Ball trail particles
var trailParticles=[];
var trailGeo=new THREE.BufferGeometry();
var trailMat=new THREE.PointsMaterial({color:0x00F2FF,size:0.18,transparent:true,opacity:0.7,sizeAttenuation:true});
var trailSystem=null; // built after scene exists

// Power shot flare
function triggerPowerFlare(){
  var el=document.getElementById('power-flare');
  el.classList.remove('flash');
  void el.offsetWidth; // reflow
  el.classList.add('flash');
}

// Impact squish state per player — stored on player obj as .squish
function applySquish(p){
  p.squish=1.0; // 1=full squish, decays to 0
}

// ── GEMINI PITCH GRID TEXTURE ────────────────────────────────
function makeGridTexture(){
  var c=document.createElement('canvas');c.width=512;c.height=512;
  var ctx=c.getContext('2d');
  ctx.fillStyle='#0d1a0f';ctx.fillRect(0,0,512,512);
  // Neon grid lines
  ctx.strokeStyle='rgba(0,242,255,0.18)';ctx.lineWidth=1.5;
  ctx.shadowBlur=6;ctx.shadowColor='#00F2FF';
  for(var i=0;i<=512;i+=64){
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();
  }
  // Scanlines
  ctx.shadowBlur=0;ctx.fillStyle='rgba(0,242,255,0.03)';
  for(var i=0;i<512;i+=4)ctx.fillRect(0,i,512,1);
  var tex=new THREE.CanvasTexture(c);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(14,9);
  return tex;
}
var GRID_TEX=makeGridTexture();

// ── GEMINI PLAYER GLOW MAP ────────────────────────────────────
function makeGlowMap(){
  var c=document.createElement('canvas');c.width=256;c.height=256;
  var ctx=c.getContext('2d');
  ctx.fillStyle='black';ctx.fillRect(0,0,256,256);
  ctx.fillStyle='white';
  // Chest core glow
  ctx.beginPath();ctx.arc(128,80,20,0,Math.PI*2);ctx.fill();
  // Visor
  ctx.fillRect(80,40,96,10);
  // Leg stripes
  ctx.fillRect(60,120,10,80);ctx.fillRect(186,120,10,80);
  return new THREE.CanvasTexture(c);
}
var GLOW_MAP=makeGlowMap();

var scene=new THREE.Scene();

// Ball trail — built after scene
var _trailPositions=new Float32Array(60*3);
var _trailGeo=new THREE.BufferGeometry();
_trailGeo.setAttribute('position',new THREE.BufferAttribute(_trailPositions,3));
var _trailPoints=new THREE.Points(_trailGeo,new THREE.PointsMaterial({color:0x00F2FF,size:0.22,transparent:true,opacity:0.6,sizeAttenuation:true,depthWrite:false}));
// added to scene after scene is created

scene.fog=new THREE.Fog(0x0a0b10,120,250);
// Weather fog
if(FOG_DENSITY>0){
  scene.fog=new THREE.FogExp2(
    WEATHER==='fog'?0x888899:0x0a0b10,
    FOG_DENSITY
  );
}
scene.add(_trailPoints);
scene.add(rainSystem);
scene.add(_trailBillboard);
var _trailHistory=[];

var camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.1,300);
camera.position.set(0,22,52);
camera.lookAt(0,0,0);

// ── FIFA-STYLE BROADCAST CAMERA ──────────────────────────────
// Fixed side angle that tracks the ball's X position along the pitch.
// Manual mouse drag rotates the view. Scroll zooms.
var cam={
  // Current camera world position (lerped each frame)
  px:0, py:24, pz:58,
  // Look-at target (lerped)
  lx:0, lz:0,
  // Manual orbit offset added on top of auto position
  orbitY:0,       // horizontal orbit offset (radians)
  orbitYTarget:0,
  pitchOffset:0,  // vertical tilt offset
  pitchTarget:0,
  zoom:1.0,       // 1 = default, <1 closer, >1 further
  zoomTarget:1.0,
  dragging:false,
  lastMX:0, lastMY:0,
  returnTimer:0
};

canvas.addEventListener('mousedown',function(e){ initAudio();
  cam.dragging=true;cam.lastMX=e.clientX;cam.lastMY=e.clientY;
  cam.returnTimer=4;
});
window.addEventListener('mouseup',function(){cam.dragging=false});
window.addEventListener('mousemove',function(e){
  if(!cam.dragging)return;
  cam.orbitYTarget+=(e.clientX-cam.lastMX)*0.004;
  cam.pitchTarget  +=(e.clientY-cam.lastMY)*0.002;
  cam.pitchTarget=Math.max(-0.3,Math.min(0.5,cam.pitchTarget));
  cam.lastMX=e.clientX;cam.lastMY=e.clientY;
});
canvas.addEventListener('wheel',function(e){
  cam.zoomTarget=Math.max(0.55,Math.min(1.6,cam.zoomTarget+e.deltaY*0.001));
  e.preventDefault();
},{passive:false});
// Touch
canvas.addEventListener('touchstart',function(e){cam.dragging=true;cam.lastMX=e.touches[0].clientX;cam.lastMY=e.touches[0].clientY;cam.returnTimer=4});
window.addEventListener('touchend',function(){cam.dragging=false});
window.addEventListener('touchmove',function(e){
  if(!cam.dragging)return;
  cam.orbitYTarget+=(e.touches[0].clientX-cam.lastMX)*0.004;
  cam.lastMX=e.touches[0].clientX;cam.lastMY=e.touches[0].clientY;
});

window.addEventListener('resize',function(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

// ── LIGHTS ───────────────────────────────────────────────────
var sun=new THREE.DirectionalLight(0xfff4e0,1.5);
sun.position.set(30,70,20);sun.castShadow=true;
sun.shadow.mapSize.width=sun.shadow.mapSize.height=2048;
sun.shadow.camera.left=-80;sun.shadow.camera.right=80;
sun.shadow.camera.top=60;sun.shadow.camera.bottom=-60;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xc8e8c8,0.6));
var fill=new THREE.DirectionalLight(0x88aaff,0.25);
fill.position.set(-20,30,-20);scene.add(fill);

// ── PITCH ────────────────────────────────────────────────────
// Grass base
var base=new THREE.Mesh(new THREE.PlaneGeometry(FW,FH),new THREE.MeshStandardMaterial({color:0x1a4a1a,roughness:0.85,metalness:0.0,map:GRID_TEX}));
pitchMeshRef=base;
base.rotation.x=-Math.PI/2;base.receiveShadow=true;scene.add(base);
// Mown stripes — alternating light/dark green
for(var i=0;i<14;i++){
  var col=i%2===0?0x1e5c1e:0x165016;
  var sw=FW/14;
  var s=new THREE.Mesh(new THREE.PlaneGeometry(sw-.03,FH),new THREE.MeshStandardMaterial({color:col,roughness:0.85,metalness:0.0}));
  s.rotation.x=-Math.PI/2;s.position.set(-HW+sw*i+sw/2,0.001,0);s.receiveShadow=true;scene.add(s);
}
var lm=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.5,emissive:0xffffff,emissiveIntensity:0.04});
var T=0.12;
function ln(x,z,w,h){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),lm);m.rotation.x=-Math.PI/2;m.position.set(x,0.005,z);scene.add(m)}
ln(0,HH-T/2,FW,T);ln(0,-HH+T/2,FW,T);ln(HW-T/2,0,T,FH);ln(-HW+T/2,0,T,FH);ln(0,0,T,FH);
for(var i=0;i<48;i++){
  var a1=(i/48)*Math.PI*2,a2=((i+1)/48)*Math.PI*2,cr=9.15;
  var seg=new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot((Math.cos(a2)-Math.cos(a1))*cr,(Math.sin(a2)-Math.sin(a1))*cr)+.02,T),lm);
  seg.rotation.x=-Math.PI/2;seg.rotation.z=-Math.atan2(Math.sin(a2)-Math.sin(a1),Math.cos(a2)-Math.cos(a1));
  seg.position.set((Math.cos(a1)+Math.cos(a2))/2*cr,0.005,(Math.sin(a1)+Math.sin(a2))/2*cr);scene.add(seg);
}
ln(HW-8.25,0,16.5,40.32);ln(-HW+8.25,0,16.5,40.32);
var sur=new THREE.Mesh(new THREE.PlaneGeometry(FW+40,FH+40),new THREE.MeshStandardMaterial({color:0x0a0c08}));
sur.rotation.x=-Math.PI/2;sur.position.y=-0.01;scene.add(sur);

// ── GOALS ────────────────────────────────────────────────────
// Pitch runs along X axis. Goals sit at x=±HW.
// Goal mouth faces along X axis (ball enters from X direction).
// Posts are VERTICAL cylinders at z=±GW/2.
// Crossbar is HORIZONTAL cylinder along Z axis at y=GH.
// Net depth goes along X axis (inward = -side direction).
function addGoal(side){
  var g=new THREE.Group();
  var x=side*HW;
  var D=2.0;
  var R=0.07;
  var postMat=new THREE.MeshStandardMaterial({color:0xffffff,metalness:0.9,roughness:0.1});
  var netMat=new THREE.MeshBasicMaterial({color:0x7000FF,wireframe:true,transparent:true,opacity:0.3});

  function vPost(px,pz){
    // Vertical post
    var m=new THREE.Mesh(new THREE.CylinderGeometry(R,R,GH,10),postMat);
    m.position.set(px,GH/2,pz);m.castShadow=true;g.add(m);
  }
  function hBar(px,py,pz,len,axis){
    // Horizontal bar — axis 'z' or 'x'
    var m=new THREE.Mesh(new THREE.CylinderGeometry(R*0.85,R*0.85,len,10),postMat);
    if(axis==='z') m.rotation.x=Math.PI/2;
    else           m.rotation.z=Math.PI/2;
    m.position.set(px,py,pz);m.castShadow=true;g.add(m);
  }

  // Two front vertical posts at z = ±GW/2, sitting on goal line x
  vPost(x,  GW/2);
  vPost(x, -GW/2);

  // Front crossbar spanning z axis at top of posts
  hBar(x, GH, 0, GW, 'z');

  // Two back vertical posts, inward by D
  vPost(x - side*D,  GW/2);
  vPost(x - side*D, -GW/2);

  // Back crossbar
  hBar(x - side*D, GH, 0, GW, 'z');

  // Top side bars connecting front to back (along x axis)
  hBar(x - side*D/2, GH,  GW/2, D, 'x');
  hBar(x - side*D/2, GH, -GW/2, D, 'x');

  // Bottom side bars
  hBar(x - side*D/2, 0,  GW/2, D, 'x');
  hBar(x - side*D/2, 0, -GW/2, D, 'x');

  // Energy net (Gemini spec — purple wireframe)
  var net=new THREE.Mesh(new THREE.BoxGeometry(D, GH, GW), netMat);
  net.position.set(x - side*D/2, GH/2, 0);
  g.add(net);

  scene.add(g);
  return g;
}
var goalA=addGoal(-1);
var goalB=addGoal(1);

// ── PLAYER MESH ──────────────────────────────────────────────
function makePlayerMesh(color,isGK){
  var g=new THREE.Group();
  var kitColor=isGK?(color===0x00A3FF?0x00CC44:0xFFAA00):color; // GK wears green/gold
  var bm=new THREE.MeshStandardMaterial({color:kitColor,roughness:0.7,emissive:kitColor,emissiveIntensity:0.12,emissiveMap:GLOW_MAP});
  var sk=new THREE.MeshStandardMaterial({color:0xf5c5a3,roughness:0.8});
  var sh=new THREE.MeshStandardMaterial({color:0x111122,roughness:0.7});
  var t=new THREE.Mesh(new THREE.CapsuleGeometry(0.28,0.55,4,8),bm);t.position.y=1.0;t.castShadow=true;g.add(t);
  var h=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),sk);h.position.y=1.65;h.castShadow=true;g.add(h);
  var sh2=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.22,0.28,8),sh);sh2.position.y=0.58;g.add(sh2);
  [-0.13,0.13].forEach(function(ox){var l=new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.4,4,8),sk);l.position.set(ox,0.25,0);g.add(l)});
  // Selection ring
  var pts=[];
  for(var i=0;i<=6;i++){var a=(i/6)*Math.PI*2-Math.PI/6;pts.push(new THREE.Vector3(Math.cos(a)*0.7,0,Math.sin(a)*0.7))}
  var ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xFFFFFF,transparent:true,opacity:0}));
  ring.position.y=0.01;ring.name='ring';g.add(ring);

  // Gemini shadow decal — opacity scales with player height
  var shadowMesh=new THREE.Mesh(
    new THREE.PlaneGeometry(1.4,0.7),
    new THREE.MeshBasicMaterial({map:SHADOW_TEX,transparent:true,opacity:0.7,depthWrite:false})
  );
  shadowMesh.rotation.x=-Math.PI/2;
  shadowMesh.position.y=0.01;
  shadowMesh.name='shadow';
  g.add(shadowMesh);

  return g;
}

// ── BALL ─────────────────────────────────────────────────────
function makeBall(){
  var g=new THREE.Group();
  var b=new THREE.Mesh(new THREE.SphereGeometry(BALL_R,20,16),new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.6}));
  b.castShadow=true;g.add(b);
  var sm=new THREE.MeshStandardMaterial({color:0x001133});
  for(var i=0;i<5;i++){var r=new THREE.Mesh(new THREE.TorusGeometry(BALL_R+.001,0.012,4,32),sm);r.rotation.y=(i/5)*Math.PI;g.add(r)}
  g.add(new THREE.PointLight(0x00F2FF,0.6,7));
  return g;
}

// ── BUILD ────────────────────────────────────────────────────
var BM=makeBall();scene.add(BM);

// Aim cursor — ring on pitch for set pieces
var _aimGeo=new THREE.RingGeometry(0.6,0.9,24);
var _aimMat=new THREE.MeshBasicMaterial({color:0x00F2FF,side:THREE.DoubleSide,transparent:true,opacity:0.8});
window._aimCursor=new THREE.Mesh(_aimGeo,_aimMat);
window._aimCursor.rotation.x=-Math.PI/2;
window._aimCursor.visible=false;
scene.add(window._aimCursor);

// Aim line — dashes from ball to cursor
var _aimLinePts=[new THREE.Vector3(0,0.05,0),new THREE.Vector3(0,0.05,0)];
var _aimLineGeo=new THREE.BufferGeometry().setFromPoints(_aimLinePts);
var _aimLine=new THREE.Line(_aimLineGeo,new THREE.LineDashedMaterial({color:0x00F2FF,dashSize:0.8,gapSize:0.5,transparent:true,opacity:0.5}));
_aimLine.visible=false;
scene.add(_aimLine);
var teamA=[],teamB=[];
var posA=FORM;
var posB=FORM.map(function(p){return{role:p.role,x:-p.x,z:p.z}});

function makeTeamPlayer(pos,color){
  return{
    mesh:makePlayerMesh(color),
    x:pos.x,z:pos.z,vx:0,vz:0,fx:1,fz:0,
    role:pos.role,homeX:pos.x,homeZ:pos.z,
    kcd:0,sliding:0,
    // Animation state
    anim:{
      runCycle:Math.random()*Math.PI*2, // offset so players don't sync
      lean:0,        // forward lean when sprinting
      leanTarget:0,
      sideTilt:0,    // tilt on direction change
      sideTiltTarget:0,
      kickPhase:0,   // kick swing
      kicking:false,
      bounceY:0,     // vertical bob
      lastX:pos.x,lastZ:pos.z // for speed calc
    }
  };
}
for(var i=0;i<11;i++){
  var pa=makeTeamPlayer(posA[i],0x00A3FF,i);scene.add(pa.mesh);teamA.push(pa);
  var pb=makeTeamPlayer(posB[i],0xFF6B1A,i);scene.add(pb.mesh);teamB.push(pb);
}

// ── BALL STATE ───────────────────────────────────────────────
var B={x:0,y:BALL_R,z:0,vx:0,vy:0,vz:0,onGround:true,owner:null};

// ── CONTROLLED PLAYER ────────────────────────────────────────
var controlled=teamA[9]; // start with ST (index 9)
setControlled(teamA[9]);

function setControlled(p){
  if(controlled){
    var oldRing=controlled.mesh.getObjectByName('ring');
    if(oldRing)oldRing.material.opacity=0;
  }
  controlled=p;
  var ring=controlled.mesh.getObjectByName('ring');
  if(ring)ring.material.opacity=0.9;
  // Update global speeds to match this player's stats
  WALK=controlled.walkSpd||WALK;
  SPR =controlled.sprintSpd||SPR;
  KPOW=controlled.kickPow||KPOW;
}

// ── INPUT ────────────────────────────────────────────────────
var K={};
var justPressed={};
window.addEventListener('keydown',function(e){
  if(!K[e.code])justPressed[e.code]=true;
  K[e.code]=true;
  initAudio();
  if(e.code==='Escape'&&STATE==='playing')togglePause();
  if(e.code==='KeyT'&&STATE==='playing')openSubMenu();
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
});
window.addEventListener('keyup',function(e){K[e.code]=false});

function consumeKey(code){if(justPressed[code]){justPressed[code]=false;return true}return false}

// ── GAME STATE ───────────────────────────────────────────────
var STATE='start';
var sa=0,sb=0,matchTime=0,celebrating=false,stamina=100;

// ── WEATHER SYSTEM ────────────────────────────────────────────
var WEATHERS=['clear','rain','heavy_rain','fog','storm'];
var WEATHER=(function(){
  try{var s=JSON.parse(localStorage.getItem('sfc_settings')||'{}');return s.weather||'random'}catch(e){return 'random'}
})();
// Pick weather for this match
if(WEATHER==='random'){
  var _wr=Math.random();
  WEATHER=_wr<0.45?'clear':_wr<0.7?'rain':_wr<0.85?'heavy_rain':_wr<0.95?'fog':'storm';
}

var weatherParticles=[];
var weatherGeo=null,weatherMat=null,weatherSystem=null;
var RAIN_FRICTION   = WEATHER==='heavy_rain'||WEATHER==='storm'?0.965:WEATHER==='rain'?0.975:0.985;
var RAIN_BOUNCE     = WEATHER==='heavy_rain'||WEATHER==='storm'?0.3:0.52;
var WIND_X          = (WEATHER==='storm'?((Math.random()-0.5)*8):WEATHER==='rain'?((Math.random()-0.5)*3):0);
var WIND_Z          = (WEATHER==='storm'?((Math.random()-0.5)*5):0);
var FOG_DENSITY     = WEATHER==='fog'?0.025:WEATHER==='storm'?0.018:0.0;

// ── WEATHER SYSTEM ───────────────────────────────────────────
var WEATHERS=['clear','rain','heavy_rain','fog','storm'];
var currentWeather='clear';
var weatherIntensity=0;  // 0-1, lerps in
var weatherTarget=0;

// Weather particle system (rain drops)
var RAIN_COUNT=1800;
var rainPositions=new Float32Array(RAIN_COUNT*3);
var rainGeo=new THREE.BufferGeometry();
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
var rainMat=new THREE.PointsMaterial({color:0xaaddff,size:0.18,transparent:true,opacity:0,sizeAttenuation:true,depthWrite:false});
var rainSystem=new THREE.Points(rainGeo,rainMat);

// Init rain positions scattered above pitch
for(var _wi=0;_wi<RAIN_COUNT;_wi++){
  rainPositions[_wi*3  ]=( Math.random()-0.5)*FW*1.4;
  rainPositions[_wi*3+1]= Math.random()*28+2;
  rainPositions[_wi*3+2]=( Math.random()-0.5)*FH*1.4;
}

// Puddle shimmer on pitch — we bump metalness/roughness at runtime
var pitchMeshRef=null; // set after pitch is built
var pitchStripeRefs=[]; // stripe meshes

// Fog values per weather
var WEATHER_FOG={
  clear:     {near:120,far:250,color:0x0a0b10},
  rain:      {near:60, far:140,color:0x0d1218},
  heavy_rain:{near:30, far:90, color:0x080c12},
  fog:       {near:18, far:55, color:0x1a2030},
  storm:     {near:20, far:70, color:0x08090f}
};

// Ball friction per weather (slippery when wet)
var WEATHER_FRICTION={clear:0.982,rain:0.972,heavy_rain:0.960,fog:0.982,storm:0.955};

function pickWeather(){
  // Randomly pick weather at match start — weighted toward clear
  var roll=Math.random();
  if(roll<0.45) return 'clear';
  if(roll<0.65) return 'rain';
  if(roll<0.78) return 'heavy_rain';
  if(roll<0.90) return 'fog';
  return 'storm';
}

function setWeather(w){
  currentWeather=w;
  weatherTarget=w==='clear'?0:w==='rain'?0.45:w==='heavy_rain'?0.85:w==='fog'?0.6:0.95;
  // Update fog
  var fv=WEATHER_FOG[w]||WEATHER_FOG.clear;
  scene.fog=new THREE.Fog(fv.color,fv.near,fv.far);
  renderer.setClearColor(fv.color);
  // HUD weather badge
  showWeatherBadge(w);
}

function showWeatherBadge(w){
  var el=document.getElementById('weather-badge');
  if(!el)return;
  var icons={clear:'',rain:'RAIN',heavy_rain:'HEAVY RAIN',fog:'FOG',storm:'STORM'};
  if(w==='clear'){el.style.display='none';return}
  el.textContent=icons[w]||w.toUpperCase();
  el.className='weather-badge weather-'+w;
  el.style.display='flex';
}

function updateWeather(dt){
  if(currentWeather==='clear'){rainSystem.material.opacity=0;return}
  // Fade in
  weatherIntensity+=(weatherTarget-weatherIntensity)*dt*0.8;
  // Rain particles
  var isRaining=currentWeather==='rain'||currentWeather==='heavy_rain'||currentWeather==='storm';
  if(isRaining){
    rainSystem.material.opacity=weatherIntensity*0.55;
    var pos=rainGeo.attributes.position.array;
    var speed=(currentWeather==='storm'?55:currentWeather==='heavy_rain'?40:28)*dt;
    var wind=(currentWeather==='storm'?12:currentWeather==='rain'?4:0)*dt;
    for(var i=0;i<RAIN_COUNT;i++){
      pos[i*3+1]-=speed;
      pos[i*3  ]+=wind;
      if(pos[i*3+1]<0){
        pos[i*3+1]=28+Math.random()*8;
        pos[i*3  ]=( Math.random()-0.5)*FW*1.4;
        pos[i*3+2]=( Math.random()-0.5)*FH*1.4;
      }
    }
    rainGeo.attributes.position.needsUpdate=true;
    // Wet pitch — increase metalness/reflectivity
    if(pitchMeshRef){
      pitchMeshRef.material.roughness=Math.max(0.05,0.85-weatherIntensity*0.75);
      pitchMeshRef.material.metalness=Math.min(0.65,weatherIntensity*0.6);
    }
  } else {
    rainSystem.material.opacity=0;
  }
  // Screen darkening for storm — done via CSS overlay
  // Lightning
  if(currentWeather==='storm'){
    _lightningTimer-=dt;
    if(_lightningTimer<=0){triggerLightning();_lightningTimer=4+Math.random()*8}
  }
  var overlay=document.getElementById('weather-overlay');
  if(overlay){
    overlay.style.opacity=currentWeather==='storm'?weatherIntensity*0.22:
                          currentWeather==='fog'?weatherIntensity*0.30:0;
  }
}

// Ball friction from weather
function getGroundFriction(){
  return WEATHER_FRICTION[currentWeather]||0.982;
}

var _lightningTimer=0;
function triggerLightning(){
  var el=document.getElementById('weather-overlay');
  if(!el)return;
  el.style.opacity='0.7';
  el.style.background='rgba(200,220,255,0.7)';
  setTimeout(function(){
    el.style.opacity='0';
    el.style.background='rgba(0,0,0,0.22)';
  },80);
  // Boom sound
  if(AudioCtx&&OPT_SFX){
    var t=AudioCtx.currentTime;
    var n=AudioCtx.createBuffer(1,AudioCtx.sampleRate*0.4,AudioCtx.sampleRate);
    var d=n.getChannelData(0);
    for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,0.5)*0.6;
    var s=AudioCtx.createBufferSource();s.buffer=n;
    var g=AudioCtx.createGain();g.gain.value=0.8;
    s.connect(g);g.connect(AudioCtx.destination);s.start(t+0.3);
  }
}

// ── REPLAY BUFFER ─────────────────────────────────────────────
var REPLAY_BUFFER_SECS = 7;   // store last 7 seconds at 30fps
var REPLAY_FPS         = 30;
var REPLAY_MAX_FRAMES  = REPLAY_BUFFER_SECS * REPLAY_FPS;
var replayBuffer       = [];  // circular buffer of snapshots
var replayActive       = false;
var replayFrame        = 0;
var replayFrames       = [];  // frames captured for current replay
var replaySpeed        = 0.4; // 0.4 = slow-mo (40% speed)
var replayCamX=0,replayCamY=0,replayCamZ=0;
var replayCamLX=0,replayCamLZ=0;
var replayFrameAccum   = 0;

// Cards system
var yellowCards={A:[],B:[]};  // arrays of player indices
var redCards={A:[],B:[]};     // sent off
var cardCooldown=0;

// Substitutions
var subsUsed=0;
var SUB_MAX=3;
var subMode=false;  // player selected for sub-out
var subOutPlayer=null;
var benchA=[  // bench players (same structure as teamA)
  {name:'SUB GK',  role:'GK', x:0,z:0,vx:0,vz:0,fx:1,fz:0,kcd:0,sliding:0,kicking:0,squish:0,mesh:null,active:false},
  {name:'SUB DEF', role:'CB', x:0,z:0,vx:0,vz:0,fx:1,fz:0,kcd:0,sliding:0,kicking:0,squish:0,mesh:null,active:false},
  {name:'SUB MID', role:'CM', x:0,z:0,vx:0,vz:0,fx:1,fz:0,kcd:0,sliding:0,kicking:0,squish:0,mesh:null,active:false},
  {name:'SUB ATT', role:'ST', x:0,z:0,vx:0,vz:0,fx:1,fz:0,kcd:0,sliding:0,kicking:0,squish:0,mesh:null,active:false},
  {name:'SUB WG',  role:'LW', x:0,z:0,vx:0,vz:0,fx:1,fz:0,kcd:0,sliding:0,kicking:0,squish:0,mesh:null,active:false},
];

// ── SOUND SYSTEM (Web Audio API — no files needed) ───────────
var AudioCtx=null;
var crowdGain=null,crowdOsc=null,crowdOsc2=null;
var soundEnabled=true;

function initAudio(){
  if(AudioCtx)return;
  try{
    AudioCtx=new(window.AudioContext||window.webkitAudioContext)();
    // Master gain
    var master=AudioCtx.createGain();master.gain.value=0.5;master.connect(AudioCtx.destination);

    // ── CROWD AMBIENCE — layered noise ──────────────────────
    crowdGain=AudioCtx.createGain();crowdGain.gain.value=0;
    crowdGain.connect(master);

    // White noise buffer for crowd
    var bufLen=AudioCtx.sampleRate*2;
    var buf=AudioCtx.createBuffer(1,bufLen,AudioCtx.sampleRate);
    var data=buf.getChannelData(0);
    for(var i=0;i<bufLen;i++) data[i]=(Math.random()*2-1)*0.25;
    var noise=AudioCtx.createBufferSource();noise.buffer=buf;noise.loop=true;

    // Filter crowd noise to sound like distant chanting
    var crowdFilter=AudioCtx.createBiquadFilter();
    crowdFilter.type='bandpass';crowdFilter.frequency.value=600;crowdFilter.Q.value=0.8;
    noise.connect(crowdFilter);crowdFilter.connect(crowdGain);

    // Low hum underneath
    var hum=AudioCtx.createOscillator();hum.frequency.value=80;hum.type='sine';
    var humGain=AudioCtx.createGain();humGain.gain.value=0.04;
    hum.connect(humGain);humGain.connect(master);
    hum.start();

    noise.start();

    // Fade crowd in
    crowdGain.gain.setTargetAtTime(0.18,AudioCtx.currentTime,2);

  }catch(e){soundEnabled=false;console.warn('Audio init failed:',e)}
}

function snd_kick(){
  if(!AudioCtx||!soundEnabled||!OPT_SFX)return;
  var t=AudioCtx.currentTime;
  var o=AudioCtx.createOscillator();var g=AudioCtx.createGain();
  o.connect(g);g.connect(AudioCtx.destination);
  o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(60,t+0.08);
  g.gain.setValueAtTime(0.6,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
  o.start(t);o.stop(t+0.1);
  // Thud noise layer
  var bn=AudioCtx.createBuffer(1,AudioCtx.sampleRate*0.06,AudioCtx.sampleRate);
  var bd=bn.getChannelData(0);
  for(var i=0;i<bd.length;i++) bd[i]=(Math.random()*2-1)*Math.pow(1-i/bd.length,2)*0.5;
  var bs=AudioCtx.createBufferSource();bs.buffer=bn;
  var bg=AudioCtx.createGain();bg.gain.value=0.7;
  bs.connect(bg);bg.connect(AudioCtx.destination);bs.start(t);
}

function snd_goal(){
  if(!AudioCtx||!soundEnabled)return;
  if(!OPT_CROWD&&!OPT_SFX)return;
  // Crowd erupts
  if(crowdGain) crowdGain.gain.cancelScheduledValues(AudioCtx.currentTime);
  if(crowdGain) crowdGain.gain.setTargetAtTime(0.9,AudioCtx.currentTime,0.1);
  if(crowdGain) crowdGain.gain.setTargetAtTime(0.25,AudioCtx.currentTime+3,1.5);
  // Goal horn
  var t=AudioCtx.currentTime;
  [220,330,440].forEach(function(freq,i){
    var o=AudioCtx.createOscillator();var g=AudioCtx.createGain();
    o.type='sawtooth';o.frequency.value=freq;
    g.gain.setValueAtTime(0,t+i*0.12);
    g.gain.linearRampToValueAtTime(0.3,t+i*0.12+0.05);
    g.gain.setTargetAtTime(0,t+i*0.12+0.4,0.15);
    o.connect(g);g.connect(AudioCtx.destination);
    o.start(t+i*0.12);o.stop(t+i*0.12+0.8);
  });
}

function snd_whistle(){
  if(!AudioCtx||!soundEnabled)return;
  var t=AudioCtx.currentTime;
  var o=AudioCtx.createOscillator();var g=AudioCtx.createGain();
  o.type='sine';o.frequency.setValueAtTime(2200,t);
  o.frequency.setValueAtTime(2400,t+0.1);o.frequency.setValueAtTime(2200,t+0.2);
  g.gain.setValueAtTime(0.4,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
  o.connect(g);g.connect(AudioCtx.destination);o.start(t);o.stop(t+0.35);
}

function snd_card(){
  if(!AudioCtx||!soundEnabled)return;
  // Crowd 'ooh'
  if(crowdGain){crowdGain.gain.setTargetAtTime(0.45,AudioCtx.currentTime,0.05);
  crowdGain.gain.setTargetAtTime(0.2,AudioCtx.currentTime+1,0.5)}
}

function snd_tackle(){
  if(!AudioCtx||!soundEnabled)return;
  var t=AudioCtx.currentTime;
  var bn=AudioCtx.createBuffer(1,AudioCtx.sampleRate*0.05,AudioCtx.sampleRate);
  var bd=bn.getChannelData(0);
  for(var i=0;i<bd.length;i++) bd[i]=(Math.random()*2-1)*Math.pow(1-i/bd.length,3)*0.9;
  var bs=AudioCtx.createBufferSource();bs.buffer=bn;
  var g=AudioCtx.createGain();g.gain.value=0.5;
  bs.connect(g);g.connect(AudioCtx.destination);bs.start(t);
}

function snd_ref(){
  snd_whistle();
}

// Crowd reacts to near-misses
function snd_nearMiss(){
  if(!AudioCtx||!soundEnabled)return;
  if(crowdGain){
    crowdGain.gain.setTargetAtTime(0.5,AudioCtx.currentTime,0.08);
    crowdGain.gain.setTargetAtTime(0.18,AudioCtx.currentTime+1.2,0.8);
  }
}

// ── NEAR MISS DETECTION ──────────────────────────────────────
var _lastBallX=0;
function checkNearMiss(){
  // Ball whizzes past goal area without scoring
  var nearRight=Math.abs(B.x-HW)<3&&Math.abs(B.z)<GW+2&&B.y<GH+1&&!B.onGround;
  var nearLeft =Math.abs(B.x+HW)<3&&Math.abs(B.z)<GW+2&&B.y<GH+1&&!B.onGround;
  if((nearRight||nearLeft)&&Math.hypot(B.vx,B.vz)>8){
    snd_nearMiss();
  }
  _lastBallX=B.x;
}

// Pass arrow — shows where pass is going
var passArrow=null,passTarget=null,passTimer=0;

// ── PHYSICS ──────────────────────────────────────────────────
function stepBall(dt){
  if(B.owner){
    // Smoothly move ball to owner's feet
    var tx=B.owner.x+B.owner.fx*(PR+BALL_R+0.25);
    var tz=B.owner.z+B.owner.fz*(PR+BALL_R+0.25);
    B.x+=(tx-B.x)*0.4;
    B.z+=(tz-B.z)*0.4;
    B.y=BALL_R;B.vx=0;B.vy=0;B.vz=0;B.onGround=true;
    return;
  }
  if(!B.onGround)B.vy+=-18*dt;
  var spd=Math.hypot(B.vx,B.vy,B.vz);
  if(spd>0.01){var drag=spd*spd*0.013;B.vx-=(B.vx/spd)*drag*dt;B.vy-=(B.vy/spd)*drag*dt;B.vz-=(B.vz/spd)*drag*dt}
  if(B.onGround){var _fr=getGroundFriction();B.vx*=Math.pow(_fr,dt*60);B.vz*=Math.pow(_fr,dt*60);if(Math.abs(B.vy)<0.05)B.vy=0}
  B.vx+=WIND_X*dt*0.3;B.vz+=WIND_Z*dt*0.3;
  B.x+=B.vx*dt;B.y+=B.vy*dt;B.z+=B.vz*dt;
  if(B.y<=BALL_R){B.y=BALL_R;if(Math.abs(B.vy)>0.5){B.vy*=-0.48;B.onGround=false}else{B.vy=0;B.onGround=true}}
  else B.onGround=B.y<=BALL_R+0.05;
  if(Math.abs(B.x)>HW-BALL_R){var inNet=Math.abs(B.z)<GW/2&&B.y<GH+0.1;if(!inNet){B.x=Math.sign(B.x)*(HW-BALL_R);B.vx*=-0.5}}
  if(Math.abs(B.z)>HH-BALL_R){B.z=Math.sign(B.z)*(HH-BALL_R);B.vz*=-0.5}

  // Pickup — nearest player picks up loose ball
  for(var i=0;i<11;i++){
    if(teamA[i]===controlled)continue;
    if(Math.hypot(teamA[i].x-B.x,teamA[i].z-B.z)<PR+BALL_R+0.5){
      B.owner=teamA[i];
      // AUTO-SWITCH: blue team picks up ball → player takes control
      setControlled(teamA[i]);
      break;
    }
  }
  if(!B.owner){
    for(var i=0;i<11;i++){
      if(Math.hypot(teamB[i].x-B.x,teamB[i].z-B.z)<PR+BALL_R+0.5){
        B.owner=teamB[i];break;
      }
    }
  }
}

function kick(player,dirX,dirZ,power,lift){
  snd_kick();
  B.owner=null;
  var l=Math.hypot(dirX,dirZ);if(l<0.001)return;
  dirX/=l;dirZ/=l;
  var la=lift||0.18;
  B.vx=dirX*power*Math.cos(la);B.vy=power*Math.sin(la);B.vz=dirZ*power*Math.cos(la);
  B.x=player.x+dirX*(PR+BALL_R+1.6);B.z=player.z+dirZ*(PR+BALL_R+1.6);
  B.y=BALL_R;B.onGround=false;player.kcd=0.5;
  triggerKickAnim(player);
}

// ── FIND BEST PASS TARGET ────────────────────────────────────
function bestPassTarget(fromPlayer,team,toGoalX){
  var best=null,bestScore=-9999;
  for(var i=0;i<team.length;i++){
    var t=team[i];
    if(t===fromPlayer)continue;
    var dx=t.x-fromPlayer.x,dz=t.z-fromPlayer.z;
    var forward=(toGoalX>0)?dx:-dx; // is player ahead?
    var dist=Math.hypot(dx,dz);
    if(dist<2||dist>35)continue;
    // Score: prefer players ahead, not too wide, not too far
    var score=forward*0.5 - Math.abs(dz)*0.2 - dist*0.1;
    if(score>bestScore){bestScore=score;best=t}
  }
  return best;
}

// ── USER INPUT ───────────────────────────────────────────────
// ── SET PIECE STEP ───────────────────────────────────────────
function stepSetPiece(dt){
  if(!SP.active||SP.team!=='A')return;

  // Power bar oscillates
  SP.aimPower+=SP.powerDir*dt*0.55;
  if(SP.aimPower>=1){SP.aimPower=1;SP.powerDir=-1}
  if(SP.aimPower<=0){SP.aimPower=0;SP.powerDir=1}
  document.getElementById('sp-power-fill').style.width=(SP.aimPower*100)+'%';

  // Aim with A/D or arrow keys
  if(K['KeyA']||K['ArrowLeft']) SP.aimAngle+=dt*1.4;
  if(K['KeyD']||K['ArrowRight'])SP.aimAngle-=dt*1.4;

  // Show aim cursor in 3D space
  var aimDist=22+SP.aimPower*30;
  SP.cursorX=SP.x+Math.sin(SP.aimAngle)*aimDist;
  SP.cursorZ=SP.z-Math.cos(SP.aimAngle)*aimDist;

  // Clamp to pitch
  SP.cursorX=Math.max(-HW+2,Math.min(HW-2,SP.cursorX));
  SP.cursorZ=Math.max(-HH+2,Math.min(HH-2,SP.cursorZ));

  // Aim cursor mesh follows
  if(window._aimCursor){
    window._aimCursor.position.set(SP.cursorX,0.05,SP.cursorZ);
    window._aimCursor.visible=true;
    // Pulse aim cursor
    var pulse=0.7+Math.sin(animTimer*3)*0.3;
    window._aimCursor.material.opacity=pulse;
  }
  // Update dashed aim line
  if(window._aimLine){
    var pts=[new THREE.Vector3(SP.x,0.1,SP.z),new THREE.Vector3(SP.cursorX,0.1,SP.cursorZ)];
    window._aimLine.geometry.setFromPoints(pts);
    window._aimLine.computeLineDistances();
    window._aimLine.visible=true;
  }

  // Space to take the kick
  if(consumeKey('Space')){
    takeSetPiece();
  }
}

function takeSetPiece(){
  var dx=SP.cursorX-SP.x,dz=SP.cursorZ-SP.z;
  var power=12+SP.aimPower*20;
  var lift=SP.type==='corner'?0.35:0.22;
  kick(SP.taker,dx,dz,power,lift);
  SP.active=false;STATE='playing';
  document.getElementById('sp-ui').classList.remove('show');
  if(window._aimCursor)window._aimCursor.visible=false;
  if(window._aimLine)window._aimLine.visible=false;
  snd_kick();
}

function stepUser(dt){
  var p=controlled;
  var sprint=(K['ShiftLeft']||K['ShiftRight'])&&stamina>5;
  stamina=sprint?Math.max(0,stamina-22*dt):Math.min(100,stamina+9*dt);

  var ix=0,iz=0;
  if(K['KeyA']||K['ArrowLeft'])ix-=1;
  if(K['KeyD']||K['ArrowRight'])ix+=1;
  if(K['KeyW']||K['ArrowUp'])iz-=1;
  if(K['KeyS']||K['ArrowDown'])iz+=1;

  // Use this player's individual stats
  var pWalk=controlled.walkSpd||WALK;
  var pSpr =controlled.sprintSpd||SPR;
  var maxSpd=sprint?pSpr:pWalk;
  if(ix||iz){
    var l=Math.hypot(ix,iz);p.vx=(ix/l)*maxSpd;p.vz=(iz/l)*maxSpd;p.fx=ix/l;p.fz=iz/l;
  } else {p.vx=0;p.vz=0}

  p.x=Math.max(-HW+PR,Math.min(HW-PR,p.x+p.vx*dt));
  p.z=Math.max(-HH+PR,Math.min(HH-PR,p.z+p.vz*dt));
  p.kcd=Math.max(0,p.kcd-dt);
  if(p.sliding>0){p.sliding-=dt;if(p.sliding<0)p.sliding=0}

  // Pick up loose ball
  if(!B.owner&&Math.hypot(p.x-B.x,p.z-B.z)<PR+BALL_R+0.6){B.owner=p}

  var hasBall=B.owner===p;

  // ── SWAP PLAYER (E) ──────────────────────────────────────
  if(consumeKey('KeyE')){
    if(hasBall){
      // If we have ball, swap to closest forward teammate
      var best=null,bestD=9999;
      for(var i=0;i<11;i++){
        if(teamA[i]===p)continue;
        var d=Math.hypot(teamA[i].x-p.x,teamA[i].z-p.z);
        if(d<bestD){bestD=d;best=teamA[i]}
      }
      if(best)setControlled(best);
    } else {
      // Swap to teammate nearest to ball
      var best=null,bestD=9999;
      for(var i=0;i<11;i++){
        if(teamA[i]===p)continue;
        var d=Math.hypot(teamA[i].x-B.x,teamA[i].z-B.z);
        if(d<bestD){bestD=d;best=teamA[i]}
      }
      if(best)setControlled(best);
    }
  }

  // ── SHOOT (Space) ────────────────────────────────────────
  if(hasBall&&consumeKey('Space')&&p.kcd<=0){
    var _kpow=KPOW*(sprint?1.3:1.0);
    kick(p,p.fx,p.fz,_kpow,0.20);
    playKickSound(_kpow);
    if(sprint)triggerPowerFlare();
    p.kcd=0.5;
    p.kicking=1.0;
  }

  // ── PASS (C) ─────────────────────────────────────────────
  if(hasBall&&consumeKey('KeyC')&&p.kcd<=0){
    var target=bestPassTarget(p,teamA,1);
    if(target){
      var dx=target.x-p.x,dz=target.z-p.z;
      var dist=Math.hypot(dx,dz);
      var power=Math.min(16,8+dist*0.18);
      kick(p,dx,dz,power,0.05);
      // After a short delay, switch control to the pass recipient
      passTarget=target;
      passTimer=Math.max(0.3,dist/power*0.8);
      p.kcd=0.4;
    }
  }

  // ── THROUGH BALL (V) ─────────────────────────────────────
  if(hasBall&&consumeKey('KeyV')&&p.kcd<=0){
    // Find player making a run — furthest forward teammate
    var best=null,bestX=-9999;
    for(var i=0;i<11;i++){
      if(teamA[i]===p)continue;
      if(teamA[i].x>bestX){bestX=teamA[i].x;best=teamA[i]}
    }
    if(best){
      // Kick into space ahead of that player
      var tx=best.x+best.vx*1.2+8,tz=best.z+best.vz*1.2;
      var dx=tx-p.x,dz=tz-p.z;
      kick(p,dx,dz,20,0.12);
      passTarget=best;passTimer=0.8;
      p.kcd=0.4;
    }
  }

  // ── SLIDE TACKLE (X) ─────────────────────────────────────
  if(!hasBall&&consumeKey('KeyX')&&p.kcd<=0&&p.sliding<=0){
    p.sliding=0.6;p.kcd=1.0;
    // Check if close to ball carrier
    if(B.owner&&Math.hypot(p.x-B.owner.x,p.z-B.owner.z)<PR*3.5){
      if(Math.random()<0.55){snd_tackle();B.owner=null;B.vx=(p.fx)*7+((Math.random()-0.5)*3);B.vz=(p.fz)*4+((Math.random()-0.5)*3);B.vy=1.5;B.onGround=false}
    }
  }

  // ── STANDING TACKLE (Z) ──────────────────────────────────
  if(!hasBall&&consumeKey('KeyZ')&&p.kcd<=0){
    p.kcd=0.4;
    if(B.owner&&Math.hypot(p.x-B.owner.x,p.z-B.owner.z)<PR*2.8){
      if(Math.random()<0.4){B.owner=null;B.vx=(Math.random()-0.5)*5;B.vz=(Math.random()-0.5)*5;B.vy=0.5;B.onGround=false}
    }
  }

  // Pass switch timer
  if(passTarget){
    passTimer-=dt;
    if(passTimer<=0){setControlled(passTarget);passTarget=null}
  }
}

// ── TEAMMATE AI ──────────────────────────────────────────────
function moveToward(p,tx,tz,spd,dt){
  var dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);
  if(d<0.4){p.vx=0;p.vz=0;return}
  p.vx=(dx/d)*spd;p.vz=(dz/d)*spd;p.fx=dx/d;p.fz=dz/d;
  p.x=Math.max(-HW+PR,Math.min(HW-PR,p.x+p.vx*dt));
  p.z=Math.max(-HH+PR,Math.min(HH-PR,p.z+p.vz*dt));
}

var BALL_INFLUENCE={GK:0.05,LB:0.18,LCB:0.1,RCB:0.1,RB:0.18,LCM:0.38,CM:0.42,RCM:0.38,LW:0.58,ST:0.72,RW:0.58};

function getSpaceTarget(p,team){
  var inf=BALL_INFLUENCE[p.role]||0.3;
  var tx=p.homeX+(B.x-p.homeX)*inf;
  var tz=p.homeZ+(B.z-p.homeZ)*inf*0.5;
  // Push away from teammates
  for(var i=0;i<team.length;i++){
    if(team[i]===p)continue;
    var dx=p.x-team[i].x,dz=p.z-team[i].z,d=Math.hypot(dx,dz);
    if(d<5&&d>0.01){tx+=(dx/d)*(5-d)*0.5;tz+=(dz/d)*(5-d)*0.5}
  }
  tx=Math.max(-HW+3,Math.min(HW-3,tx));
  tz=Math.max(-HH+3,Math.min(HH-3,tz));
  return{x:tx,z:tz};
}

function stepTeamA(dt){
  // Find nearest to ball (excluding controlled)
  var nearest=null,nearestD=9999;
  for(var i=0;i<11;i++){
    if(teamA[i]===controlled)continue;
    var d=Math.hypot(teamA[i].x-B.x,teamA[i].z-B.z);
    if(d<nearestD){nearestD=d;nearest=teamA[i]}
  }

  for(var i=0;i<11;i++){
    var p=teamA[i];
    if(p===controlled)continue;
    p.kcd=Math.max(0,p.kcd-dt);

    if(B.owner===p){
      // AI teammate has ball - move toward goal and shoot/pass
      moveToward(p,HW-3,0,p.walkSpd*0.85,dt);
      var distGoal=Math.hypot(HW-p.x,p.z);
      if(distGoal<22&&p.kcd<=0){
        var gx=HW-p.x,gz=-p.z,gl=Math.hypot(gx,gz);
        kick(p,gx/gl,gz/gl,p.kickPow||KPOW,0.18);p.kicking=1.0;
      } else if(p.kcd<=0&&Math.random()<0.015){
        var tgt=bestPassTarget(p,teamA,1);
        if(tgt){var pdx=tgt.x-p.x,pdz=tgt.z-p.z;kick(p,pdx,pdz,p.passing*0.18||13,0.08)}
      }
    } else if(p===nearest&&!B.owner){
      moveToward(p,B.x,B.z,p.walkSpd*1.05,dt);
      if(Math.hypot(p.x-B.x,p.z-B.z)<PR+BALL_R+0.5)B.owner=p;
    } else {
      var sp=getSpaceTarget(p,teamA);
      moveToward(p,sp.x,sp.z,p.walkSpd*0.65,dt);
    }
  }
}

function stepTeamB(dt){
  var nearest=null,nearestD=9999;
  for(var i=1;i<11;i++){ // skip GK for nearest calc
    var d=Math.hypot(teamB[i].x-B.x,teamB[i].z-B.z);
    if(d<nearestD){nearestD=d;nearest=teamB[i]}
  }

  for(var i=0;i<11;i++){
    var p=teamB[i];
    p.kcd=Math.max(0,p.kcd-dt);

    // ── GOALKEEPER (index 0) ────────────────────────────────
    if(i===0){
      var gkHomeX=-HW+4.5;  // front of goal line not inside net
      if(B.owner===p){
        // GK has ball — punt it upfield
        if(p.kcd<=0){
          var tgt=bestPassTarget(p,teamB,-1);
          if(tgt){var pdx=tgt.x-p.x,pdz=tgt.z-p.z;kick(p,pdx,pdz,18,0.22);p.kcd=1.5}
        }
      } else {
        // Track ball Z (side to side) while holding X line near goal
        // GK tracks ball sideways, stays near goal line
        var gkTargetX=Math.max(gkHomeX-1,Math.min(gkHomeX+3, gkHomeX+((-B.x-HW)*0.04)));
        var gkTargetZ=Math.max(-GW/2+0.4,Math.min(GW/2-0.4, B.z*0.55));
        moveToward(p,gkTargetX,gkTargetZ,WALK*1.4,dt);

        // Dive — if ball heading fast toward goal
        var ballComingFast=B.vx<-8&&B.x<-30&&!B.onGround;
        if(ballComingFast&&p.kcd<=0){
          // Predict where ball crosses goal line
          var tToCross=(-HW-B.x)/B.vx;
          if(tToCross>0&&tToCross<1.5){
            var predictZ=B.z+B.vz*tToCross;
            if(Math.abs(predictZ)<GW/2+0.5){
              // Dive!
              p.sliding=0.8;p.kcd=1.2;
              moveToward(p,gkHomeX,predictZ,SPR*1.8,dt);
            }
          }
        }

        // Save — if ball very close
        if(Math.hypot(p.x-B.x,p.z-B.z)<PR+BALL_R+0.8&&B.owner===null){
          B.owner=p;
        }
      }
      continue;
    }

    // ── OUTFIELD ────────────────────────────────────────────
    if(B.owner===p){
      moveToward(p,-HW+3,0,p.walkSpd*0.85,dt);
      var distGoal=Math.hypot(-HW-p.x,p.z);
      if(distGoal<24&&p.kcd<=0){
        var gx=-HW-p.x,gz=-p.z,gl=Math.hypot(gx,gz);
        kick(p,gx/gl,gz/gl,p.kickPow||KPOW,0.18);p.kicking=1.0;
      } else if(p.kcd<=0&&Math.random()<0.014){
        var tgt=bestPassTarget(p,teamB,-1);
        if(tgt){var pdx=tgt.x-p.x,pdz=tgt.z-p.z;kick(p,pdx,pdz,p.passing*0.18||13,0.08)}
      }
    } else if(p===nearest&&!B.owner){
      moveToward(p,B.x,B.z,p.walkSpd*1.05,dt);
      if(Math.hypot(p.x-B.x,p.z-B.z)<PR+BALL_R+0.5)B.owner=p;
    } else {
      if(B.x<0&&!B.owner&&Math.hypot(p.x-B.x,p.z-B.z)<20){
        moveToward(p,B.x,B.z,p.walkSpd*0.8,dt);
      } else {
        var sp=getSpaceTarget(p,teamB);
        moveToward(p,sp.x,sp.z,p.walkSpd*0.62,dt);
      }
    }
  }
}

// ── PLAYER ANIMATIONS (Gemini Phase 3 — Sprint Lean + Squish) ─
function updatePlayerAnimations(dt){
  animTimer+=dt*15;

  function lerp(a,b,t){return a+(b-a)*t}

  function animatePlayer(p){
    var spd=Math.hypot(p.vx,p.vz);
    var isMoving=spd>0.3;
    var mesh=p.mesh;
    var shadow=mesh.getObjectByName('shadow');

    // ── SQUISH (Gemini impact spec) ───────────────────────
    if(p.squish>0){
      p.squish=Math.max(0,p.squish-dt*4);
      var sq=p.squish;
      mesh.scale.set(1+sq*0.22, 1-sq*0.22, 1+sq*0.22); // squish down
    } else {
      // Return to normal scale
      mesh.scale.x=lerp(mesh.scale.x,1,0.15);
      mesh.scale.y=lerp(mesh.scale.y,1,0.15);
      mesh.scale.z=lerp(mesh.scale.z,1,0.15);
    }

    if(p.sliding>0){
      mesh.rotation.x=lerp(mesh.rotation.x, 0.75, 0.25);
      mesh.rotation.z=lerp(mesh.rotation.z, 0,    0.2);
      mesh.position.y=lerp(mesh.position.y, 0,    0.2);
    } else if(p.kicking){
      // Kick lean back
      mesh.rotation.x=lerp(mesh.rotation.x,-0.45,0.35);
      mesh.rotation.z=lerp(mesh.rotation.z, 0,   0.2);
      p.kicking=Math.max(0,p.kicking-dt*4);
    } else if(isMoving){
      var sprintF=Math.min(1,spd/10);

      // Gemini Sprint Lean — forward tilt based on speed
      mesh.rotation.x=lerp(mesh.rotation.x, spd*0.14*sprintF, 0.1);

      // Side-to-side wobble
      mesh.rotation.z=lerp(mesh.rotation.z, Math.sin(animTimer)*0.09*sprintF, 0.25);

      // Step bounce
      var bounce=Math.abs(Math.sin(animTimer))*0.16*sprintF;
      mesh.position.y=lerp(mesh.position.y, bounce, 0.25);
    } else {
      // Idle breathing
      mesh.rotation.x=lerp(mesh.rotation.x, 0,                           0.08);
      mesh.rotation.z=lerp(mesh.rotation.z, Math.sin(animTimer*0.4)*0.015, 0.08);
      mesh.position.y=lerp(mesh.position.y, 0,                           0.1);
    }

    // Shadow opacity + scale with height (Gemini spec)
    if(shadow){
      var h=Math.max(0,mesh.position.y);
      shadow.material.opacity=Math.max(0.08,0.65-h*0.35);
      var ss=1+h*0.18;shadow.scale.set(ss,ss,1);
    }

    // Injury limp visual — player tilts to one side
    if(p.injured&&p.limp>0){
      mesh.rotation.z=lerp(mesh.rotation.z, Math.sin(animTimer*0.5)*0.25*p.limp, 0.1);
    }
    // Stamina drain visual — player turns red
    if(p===controlled){
      var redT=stamina<25?(25-stamina)/25*0.5:0;
      mesh.children.forEach(function(c){
        if(c.material&&c.material.emissive)c.material.emissive.setRGB(redT,0,0);
      });
    }
  }

  for(var i=0;i<11;i++){animatePlayer(teamA[i]);animatePlayer(teamB[i])}
}

// ── TACKLES ──────────────────────────────────────────────────
function checkTackles(){
  if(!B.owner)return;
  var owner=B.owner;
  var isA=teamA.indexOf(owner)>=0;
  var enemies=isA?teamB:teamA;
  for(var i=0;i<enemies.length;i++){
    var e=enemies[i];
    if(e.sliding>0&&Math.hypot(e.x-owner.x,e.z-owner.z)<PR*3){
      if(Math.random()<0.6){B.owner=null;B.vx=(Math.random()-0.5)*6;B.vz=(Math.random()-0.5)*6;B.vy=1;B.onGround=false;e.kcd=0.3;owner.kcd=0.4}
    } else if(e.kcd<=0&&Math.hypot(e.x-owner.x,e.z-owner.z)<PR*2){
      if(Math.random()<0.008){B.owner=null;B.vx=(Math.random()-0.5)*4;B.vz=(Math.random()-0.5)*4;B.vy=0.5;B.onGround=false}
    }
  }
}

// ── GOAL CHECK ───────────────────────────────────────────────
function checkGoal(){
  var inPost=Math.abs(B.z)<GW/2&&B.y<GH+0.1;
  // Near miss — ball goes close but wide
  var nearMiss=(Math.abs(B.x)>=HW-0.5)&&!inPost&&Math.hypot(B.vx,B.vz)>6;
  if(nearMiss) playNearMissSound();
  if(B.x>=HW-BALL_R&&inPost)scoreGoal('you');
  if(B.x<=-HW+BALL_R&&inPost)scoreGoal('cpu');
}

function startReplay(goalX,goalZ){
  if(replayBuffer.length<10)return; // not enough data
  replayFrames=replayBuffer.slice(); // snapshot current buffer
  replayFrame=0;
  replayActive=true;
  replayCamLX=goalX;replayCamLZ=goalZ;
  // Show replay UI
  var ru=document.getElementById('replay-ui');
  if(ru)ru.classList.add('show');
  // Auto-end after frames run out (handled in loop)
}

function endReplay(){
  replayActive=false;
  replayFrame=0;replayFrames=[];
  var ru=document.getElementById('replay-ui');
  if(ru)ru.classList.remove('show');
}

function scoreGoal(who){
  if(celebrating)return;
  celebrating=true;B.owner=null;
  if(who==='you'){
    sa++;document.getElementById('sb-home-score').textContent=sa;
    // Flash goal net cyan
    if(goalB){goalB.children.forEach(function(c){if(c.material&&c.material.wireframe){c.material.color.setHex(0x00F2FF);setTimeout(function(){c.material.color.setHex(0x7000FF)},1200)}})}
  } else {
    sb++;document.getElementById('sb-away-score').textContent=sb;
    if(goalA){goalA.children.forEach(function(c){if(c.material&&c.material.wireframe){c.material.color.setHex(0x00F2FF);setTimeout(function(){c.material.color.setHex(0x7000FF)},1200)}})}
  }
  playGoalSound();
  snd_goal();
  document.getElementById('goal').classList.add('show');
  var _goalBX=B.x,_goalBZ=B.z;
  setTimeout(function(){
    document.getElementById('goal').classList.remove('show');
    // Start replay THEN reset after replay ends
    startReplay(_goalBX,_goalBZ);
    // Reset 7 seconds later (replay duration) + short buffer
    setTimeout(function(){
      endReplay();
      resetAll();
      celebrating=false;
    },(REPLAY_MAX_FRAMES/REPLAY_FPS/replaySpeed)*1000+500);
  },2000);
}

function resetAll(){
  B.x=0;B.y=BALL_R;B.z=0;B.vx=0;B.vy=0;B.vz=0;B.onGround=true;B.owner=null;
  passTarget=null;passTimer=0;
  for(var i=0;i<11;i++){
    teamA[i].x=posA[i].x;teamA[i].z=posA[i].z;teamA[i].vx=0;teamA[i].vz=0;teamA[i].fx=1;teamA[i].fz=0;teamA[i].sliding=0;
    teamA[i].mesh.visible=true;
    teamB[i].x=posB[i].x;teamB[i].z=posB[i].z;teamB[i].vx=0;teamB[i].vz=0;teamB[i].fx=-1;teamB[i].fz=0;teamB[i].sliding=0;
    teamB[i].mesh.visible=true;
  }
  setControlled(teamA[9]);
}

// ── FIFA BROADCAST CAMERA ────────────────────────────────────
function updateCam(dt){
  var p=controlled;

  // Auto-return orbit to centre after inactivity
  if(!cam.dragging){
    cam.returnTimer=Math.max(0,cam.returnTimer-dt);
    if(cam.returnTimer<=0){
      cam.orbitYTarget*=0.94;   // ease back to 0
      cam.pitchTarget *=0.94;
    }
  }

  // Smooth all values
  var lerp=0.06;
  cam.orbitY +=(cam.orbitYTarget -cam.orbitY )*0.08;
  cam.pitchOffset+=(cam.pitchTarget-cam.pitchOffset)*0.08;
  cam.zoom   +=(cam.zoomTarget   -cam.zoom   )*0.06;

  // ── BASE BROADCAST POSITION ──────────────────────────────
  // Camera always sits on the SIDE of the pitch (Z axis).
  // It tracks the ball's X position (along the pitch length)
  // so the action stays centred — exactly like FIFA broadcast.

  var BASE_HEIGHT  = CAM_STYLE==='high'?32:CAM_STYLE==='close'?14:22;
  var BASE_Z       = CAM_STYLE==='high'?65:CAM_STYLE==='close'?36:52;
  var TRACK_SPEED  = 0.05; // how fast camera follows ball laterally

  // Target look-at: blend ball and controlled player
  var targetLX = B.x*0.65 + p.x*0.35;
  var targetLZ = B.z*0.15 + p.z*0.1;  // very little Z drift — keeps side view
  targetLX = Math.max(-42,Math.min(42,targetLX));
  targetLZ = Math.max(-8, Math.min(8, targetLZ));

  cam.lx += (targetLX-cam.lx)*TRACK_SPEED*2;
  cam.lz += (targetLZ-cam.lz)*TRACK_SPEED;

  // Base camera position tracks look-at X, stays on Z side
  var baseCX = cam.lx;
  var baseCY = BASE_HEIGHT + cam.pitchOffset*12;
  var baseCZ = BASE_Z * cam.zoom;

  // Apply manual orbit (rotates around look-at point)
  var orbitR  = baseCZ;
  var orbitCX = baseCX + Math.sin(cam.orbitY)*orbitR;
  var orbitCZ = baseCZ * Math.cos(cam.orbitY);
  // Keep camera on correct side (don't let it cross to other side of pitch)
  if(orbitCZ<8) orbitCZ=8;

  // Dynamic height — pull up when ball is in the air or spread is large
  var ballHeight  = Math.max(0,B.y-BALL_R);
  var spreadBonus = Math.min(6, ballHeight*1.2);
  var targetCY    = baseCY + spreadBonus;

  // Final lerp to target
  cam.px += (orbitCX-cam.px)*lerp;
  cam.py += (targetCY-cam.py)*lerp;
  cam.pz += (orbitCZ-cam.pz)*lerp;

  camera.position.set(cam.px, cam.py, cam.pz);
  camera.lookAt(cam.lx, 1.5, cam.lz);
}

// ── HUD ──────────────────────────────────────────────────────
var _lastControlled=null;
function updateHUD(dt){
  if(STATE==='playing'){
    matchTime+=dt;
    var e=Math.min(matchTime,MATCH_SEC);
    var mins=Math.floor(e/60),secs=Math.floor(e%60);
    document.getElementById('sb-clock').textContent=String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
    if(MATCH_SEC>=300){
      var half=e<MATCH_SEC/2?'1ST HALF':'2ND HALF';
      var hp=document.getElementById('sb-period');if(hp)hp.textContent=half;
    }
    if(matchTime>=MATCH_SEC)endMatch();
  }
  var sf=document.getElementById('stamfill');
  sf.style.width=stamina+'%';
  sf.style.background=stamina<25?'#FF5555':'#00F2FF';

  // Update player card when controlled player changes
  if(controlled!==_lastControlled){
    _lastControlled=controlled;
    var el=document.getElementById('player-card');
    if(el&&controlled){
      el.innerHTML=
        '<div id="pc-ovr">'+controlled.overall+'</div>'+
        '<div class="pc-info">'+
          '<div id="pc-name">'+controlled.name+'</div>'+
          '<div id="pc-role">'+controlled.role+'</div>'+
          '<div class="pc-stats">'+
            '<span>PAC <b>'+controlled.pace+'</b></span>'+
            '<span>SHO <b>'+controlled.shooting+'</b></span>'+
            '<span>PAS <b>'+controlled.passing+'</b></span>'+
            '<span>DRI <b>'+controlled.dribbling+'</b></span>'+
          '</div>'+
        '</div>';
    }
  }
}

// ── PROCEDURAL ANIMATION ─────────────────────────────────────
function animatePlayers(dt){
  var allPlayers=teamA.concat(teamB);
  for(var i=0;i<allPlayers.length;i++){
    var p=allPlayers[i];
    var a=p.anim;
    var mesh=p.mesh;

    // Actual speed this frame
    var spd=Math.hypot(p.x-a.lastX, p.z-a.lastZ)/dt;
    a.lastX=p.x; a.lastZ=p.z;
    var isMoving=spd>0.5;
    var isSprinting=spd>7;

    // ── RUN CYCLE ──────────────────────────────────────────
    if(isMoving){
      a.runCycle+=dt*(isSprinting?14:9);
    } else {
      // Idle sway — gentle breathing
      a.runCycle+=dt*1.2;
    }

    // Get body parts by index (torso=0, head=1, shorts=2, legs=3+4, ring=5)
    var torso= mesh.children[0];
    var head = mesh.children[1];
    var legL = mesh.children[3];
    var legR = mesh.children[4];

    if(!torso||!head)continue;

    // ── VERTICAL BOB ──────────────────────────────────────
    if(isMoving){
      a.bounceY=Math.sin(a.runCycle*2)*0.06*(isSprinting?1.4:1.0);
    } else {
      a.bounceY=Math.sin(a.runCycle)*0.015; // idle breathing
    }
    mesh.position.y=( p.sliding>0?-0.2:0 ) + a.bounceY;

    // ── LEG SWING ─────────────────────────────────────────
    if(legL&&legR){
      if(isMoving){
        var swing=Math.sin(a.runCycle)*(isSprinting?0.55:0.35);
        legL.rotation.x= swing;
        legR.rotation.x=-swing;
        // Knee lift — raise leg up on forward swing
        legL.position.z= Math.max(0,swing)*0.15;
        legR.position.z= Math.max(0,-swing)*0.15;
      } else {
        legL.rotation.x*=0.85;
        legR.rotation.x*=0.85;
      }
    }

    // ── FORWARD LEAN ─────────────────────────────────────
    a.leanTarget=isSprinting?0.22:isMoving?0.10:0;
    if(p.sliding>0) a.leanTarget=0.7;
    a.lean+=(a.leanTarget-a.lean)*0.15;
    torso.rotation.x=a.lean;
    if(head) head.rotation.x=-a.lean*0.4; // head stays more upright

    // ── SIDE TILT on sharp turns ──────────────────────────
    var crossX=a.lastX-p.x, crossZ=a.lastZ-p.z;
    var turnAmount=(crossX*p.fz - crossZ*p.fx); // cross product gives turn direction
    a.sideTiltTarget=isMoving?turnAmount*1.8:0;
    a.sideTiltTarget=Math.max(-0.25,Math.min(0.25,a.sideTiltTarget));
    a.sideTilt+=(a.sideTiltTarget-a.sideTilt)*0.12;
    torso.rotation.z=-a.sideTilt;

    // ── ARM SWING ─────────────────────────────────────────
    // Torso twists slightly opposite to legs
    if(isMoving){
      torso.rotation.y=Math.sin(a.runCycle)*( isSprinting?0.18:0.1 );
    } else {
      torso.rotation.y*=0.9;
    }

    // ── KICK ANIMATION ────────────────────────────────────
    if(p.kicking){
      a.kickPhase+=dt*18;
      if(legR) legR.rotation.x=-Math.sin(a.kickPhase)*0.9;
      if(a.kickPhase>Math.PI){p.kicking=false;a.kickPhase=0}
    }

    // ── HEAD LOOK TOWARD BALL ────────────────────────────
    if(head&&!p.sliding){
      var bdx=B.x-p.x,bdz=B.z-p.z;
      var ballAngle=Math.atan2(bdx,bdz);
      var faceAngle=Math.atan2(p.fx,p.fz);
      var diff=ballAngle-faceAngle;
      while(diff>Math.PI)diff-=Math.PI*2;
      while(diff<-Math.PI)diff+=Math.PI*2;
      diff=Math.max(-0.6,Math.min(0.6,diff));
      head.rotation.y+=(diff-head.rotation.y)*0.1;
    }

    // ── SLIDE TACKLE POSE ─────────────────────────────────
    if(p.sliding>0){
      var t=p.sliding/0.6;
      mesh.rotation.x=t*0.7;
      if(legL){legL.rotation.x=t*0.8;legR.rotation.x=-t*1.2}
    } else {
      mesh.rotation.x*=0.85; // recover
    }
  }
}

// Trigger kick animation on the player who just kicked
function triggerKickAnim(player){
  player.kicking=true;
  player.anim.kickPhase=0;
}

// ── GEMINI SUPER SHOT FX ─────────────────────────────────────
function triggerSuperShotFX(pos,dir){
  var count=12;
  var geo=new THREE.BufferGeometry();
  var positions=new Float32Array(count*3);
  var velocities=[];
  for(var i=0;i<count;i++){
    positions[i*3]=pos.x;positions[i*3+1]=pos.y;positions[i*3+2]=pos.z;
    velocities.push({
      x:(Math.random()-0.5)*2+dir.x*5,
      y:Math.random()*2,
      z:(Math.random()-0.5)*2+dir.z*5
    });
  }
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  var mat=new THREE.PointsMaterial({color:0x00F2FF,size:0.4,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
  var pts=new THREE.Points(geo,mat);
  scene.add(pts);
  var frame=0;
  (function animate(){
    frame++;
    var pa=pts.geometry.attributes.position;
    for(var i=0;i<count;i++){
      pa.array[i*3]  +=velocities[i].x*0.1;
      pa.array[i*3+1]+=velocities[i].y*0.1;
      pa.array[i*3+2]+=velocities[i].z*0.1;
      velocities[i].y-=0.05;
    }
    pa.needsUpdate=true;
    mat.opacity-=0.055;
    if(mat.opacity<=0){scene.remove(pts);geo.dispose();mat.dispose()}
    else requestAnimationFrame(animate);
  })();
}

// ── BALL BILLBOARD TRAIL ──────────────────────────────────────
// Canvas-generated speed streak texture
function makeTrailTex(){
  var c=document.createElement('canvas');c.width=128;c.height=32;
  var ctx=c.getContext('2d');
  var g=ctx.createLinearGradient(0,0,128,0);
  g.addColorStop(0,'rgba(0,242,255,0)');
  g.addColorStop(0.4,'rgba(0,242,255,0.6)');
  g.addColorStop(1,'rgba(255,255,255,0.9)');
  ctx.fillStyle=g;ctx.fillRect(0,8,128,16);
  // Speed streaks
  ctx.fillStyle='rgba(0,242,255,0.3)';
  ctx.fillRect(0,4,128,4);ctx.fillRect(0,24,128,4);
  return new THREE.CanvasTexture(c);
}
var _trailBillboard=new THREE.Mesh(
  new THREE.PlaneGeometry(3,0.35),
  new THREE.MeshBasicMaterial({map:null,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending})
);
_trailBillboard.material.map=makeTrailTex();

// ── BALL TRAIL ───────────────────────────────────────────────
function updateBallTrail(){
  var ballMoving=Math.hypot(B.vx,B.vz)>3||Math.abs(B.vy)>2;
  if(ballMoving&&!B.owner){
    _trailHistory.unshift({x:B.x,y:B.y,z:B.z});
    if(_trailHistory.length>20)_trailHistory.pop();
  } else {
    if(_trailHistory.length>0)_trailHistory.pop();
  }
  var pos=_trailGeo.attributes.position.array;
  for(var i=0;i<20;i++){
    if(i<_trailHistory.length){
      pos[i*3]=_trailHistory[i].x;
      pos[i*3+1]=_trailHistory[i].y;
      pos[i*3+2]=_trailHistory[i].z;
    } else {
      pos[i*3]=0;pos[i*3+1]=-100;pos[i*3+2]=0; // hide unused
    }
  }
  _trailGeo.attributes.position.needsUpdate=true;
  // Fade trail material based on ball speed
  var spd=Math.hypot(B.vx,B.vy,B.vz);
  _trailPoints.material.opacity=Math.min(0.75,spd*0.04);
  _trailPoints.material.size=Math.min(0.35,0.15+spd*0.01);

  // Billboard trail — faces camera, scales with velocity
  var billSpd=Math.hypot(B.vx,B.vz);
  if(billSpd>4&&!B.owner){
    _trailBillboard.position.set(B.x,B.y,B.z);
    // Orient to face camera
    _trailBillboard.quaternion.copy(camera.quaternion);
    // Stretch in direction of travel
    var trailLen=Math.min(5,billSpd*0.25);
    _trailBillboard.scale.set(trailLen,1,1);
    // Rotate to align with velocity direction
    var ang=Math.atan2(B.vx,B.vz);
    _trailBillboard.rotation.y=ang;
    _trailBillboard.material.opacity=Math.min(0.8,(billSpd-4)*0.08);
  } else {
    _trailBillboard.material.opacity*=0.7; // fade out
  }
}

// ── SOCCER RULES ENFORCEMENT ────────────────────────────────
var foulTimer=0;
var offsidesEnabled=OPT_OFFSIDE;
var lastTouchTeam=null; // 'A' or 'B'

function enforceRules(dt){
  // Track who last touched ball
  if(B.owner){
    lastTouchTeam=teamA.indexOf(B.owner)>=0?'A':'B';
  }

  // ── OFFSIDE ──────────────────────────────────────────────
  // A teamB player is offside if they are beyond the last defender
  // when the ball is played forward from teamB's own half
  // Simple version: flag if teamB attacker is ahead of 2nd-last teamA defender
  // when ball is in teamA's half
  if(offsidesEnabled&&B.owner&&teamB.indexOf(B.owner)>=0){
    // Find 2nd last teamA defender (GK counts as last)
    var defX=teamA.map(function(p){return p.x}).sort(function(a,b){return a-b});
    var secondLast=defX.length>=2?defX[1]:defX[0];
    // Check each teamB outfield player
    for(var i=1;i<11;i++){
      var p=teamB[i];
      if(p===B.owner)continue;
      // Offside: player is beyond last defender AND in attacking half (x<0)
      if(p.x<secondLast&&p.x<0){
        p._offside=true;
        // Don't auto-award yet — just flag for when ball is played to them
      } else {
        p._offside=false;
      }
    }
  }

  // ── THROW INS ────────────────────────────────────────────
  // Ball out of bounds on sideline — give to other team
  if(Math.abs(B.z)>=HH-0.1&&!B.owner){
    var throwTeam=lastTouchTeam==='A'?teamB:teamA;
    // Find nearest player on that team to where ball went out
    var best=null,bestD=9999;
    for(var i=0;i<11;i++){
      var d=Math.hypot(throwTeam[i].x-B.x,throwTeam[i].z-B.z);
      if(d<bestD){bestD=d;best=throwTeam[i]}
    }
    if(best){
      // Move ball to sideline and give possession
      B.z=Math.sign(B.z)*(HH-0.5);
      B.y=BALL_R;B.vx=0;B.vy=0;B.vz=0;B.onGround=true;
      B.owner=best;
      if(throwTeam===teamA) setControlled(best);
      showRef('THROW IN');
    }
  }

  // ── GOAL KICK / CORNER ───────────────────────────────────
  if(!celebrating&&STATE==='playing'){
    var outRight=B.x>=HW-0.1&&!(Math.abs(B.z)<GW/2&&B.y<GH+0.1)&&!B.owner;
    var outLeft =B.x<=-HW+0.1&&!(Math.abs(B.z)<GW/2&&B.y<GH+0.1)&&!B.owner;

    if(outRight){
      if(lastTouchTeam==='A'){
        // Attacking team last touched = corner for teamA
        triggerCorner('A', Math.sign(B.z)||1);
      } else {
        // Defending team last touched = goal kick for teamB GK
        B.x=HW-10;B.z=0;B.y=BALL_R;B.vx=0;B.vy=0;B.vz=0;B.onGround=true;
        teamB[0].x=HW-8;teamB[0].z=0;B.owner=teamB[0];
        showRef('GOAL KICK');
      }
    }
    if(outLeft){
      if(lastTouchTeam==='B'){
        // Attacking team last touched = corner for teamB
        triggerCorner('B', Math.sign(B.z)||1);
      } else {
        B.x=-HW+10;B.z=0;B.y=BALL_R;B.vx=0;B.vy=0;B.vz=0;B.onGround=true;
        teamA[0].x=-HW+8;teamA[0].z=0;B.owner=teamA[0];
        setControlled(teamA[0]);
        showRef('GOAL KICK');
      }
    }
  }

  // ── FOUL DETECTION ───────────────────────────────────────
  // Reckless sliding into player from wrong angle = foul
  foulTimer=Math.max(0,foulTimer-dt);
  cardCooldown=Math.max(0,cardCooldown-dt);
  if(foulTimer<=0){
    for(var i=0;i<11;i++){
      var p=teamB[i];
      if(p.sliding>0&&B.owner&&teamA.indexOf(B.owner)>=0){
        var d=Math.hypot(p.x-B.owner.x,p.z-B.owner.z);
        if(d<PR*1.5&&Math.random()<0.3){
          // Foul! Free kick to teamA
          awardFreeKick(B.owner,'A');
          foulTimer=5;
          break;
        }
      }
    }
  }
}

// ── REF INDICATOR ────────────────────────────────────────────
var refTimeout=null;
function showRef(msg){
  snd_ref();
  var el=document.getElementById('ref-call');
  if(!el)return;
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(refTimeout);
  refTimeout=setTimeout(function(){el.classList.remove('show')},2200);
}

function awardFreeKick(nearPlayer,team){
  B.owner=null;
  B.x=nearPlayer.x;B.z=nearPlayer.z;
  B.y=BALL_R;B.vx=0;B.vy=0;B.vz=0;B.onGround=true;
  if(teamB.indexOf(nearPlayer)>=0){
    var idx=teamB.indexOf(nearPlayer);
    checkCardForFoul(idx,'B');
  }
  if(team==='A'){
    triggerSetPiece('freekick','A',B.x,B.z);
  }
  showRef('FOUL — FREE KICK');
}

function triggerCorner(team,side){
  // side: 1=right corner, -1=left corner
  var cx=(team==='A')?HW:-HW;
  var cz=side*(HH-0.5);
  triggerSetPiece('corner',team,cx,cz);
}

function triggerSetPiece(type,team,bx,bz){
  B.x=bx;B.z=bz;B.y=BALL_R;B.vx=0;B.vy=0;B.vz=0;B.onGround=true;B.owner=null;
  STATE='setpiece';
  SP.active=true;SP.type=type;SP.team=team;
  SP.x=bx;SP.z=bz;SP.aimPower=0.5;SP.powerDir=1;SP.ready=false;

  if(team==='A'){
    // Default aim toward goal
    var goalX=(type==='corner')?HW*0.6:HW;
    SP.aimAngle=Math.atan2(goalX-bx,-bz);
    // Pick best taker — highest passing stat
    var best=teamA[0],bestStat=0;
    for(var i=0;i<11;i++){
      if(teamA[i].x===999)continue;
      var s=(teamA[i].passPow||10)+(teamA[i].kpow||16)*0.5;
      if(s>bestStat){bestStat=s;best=teamA[i]}
    }
    SP.taker=best;
    setControlled(best);
    // Walk taker to ball
    SP.taker.x=bx-1.5;SP.taker.z=bz;
    SP.taker.fx=1;SP.taker.fz=0;
    showRef(type==='corner'?'CORNER KICK':'FREE KICK');
    document.getElementById('sp-ui').classList.add('show');
    document.getElementById('sp-type').textContent=type==='corner'?'CORNER KICK':'FREE KICK';
  } else {
    // CPU takes it automatically after delay
    showRef(type==='corner'?'CORNER KICK':'FREE KICK');
    setTimeout(function(){
      if(STATE==='setpiece'&&SP.team==='B'){
        var goalX=-HW;var goalZ=0;
        var dx=goalX-bx,dz=goalZ-bz;
        kick(SP.taker||teamB[1],dx,dz,KPOW*1.1,0.25);
        STATE='playing';SP.active=false;
        document.getElementById('sp-ui').classList.remove('show');
      }
    },1800);
    SP.taker=teamB[1];
    SP.taker.x=bx+1.5;SP.taker.z=bz;
  }
}

// ── CARD SYSTEM ──────────────────────────────────────────────
function giveCard(team, playerIdx, color){
  var teamArr=team==='A'?teamA:teamB;
  var p=teamArr[playerIdx];
  if(!p||redCards[team].indexOf(playerIdx)>=0)return;

  if(color==='yellow'){
    if(yellowCards[team].indexOf(playerIdx)>=0){
      // Second yellow = red
      giveCard(team,playerIdx,'red');
      return;
    }
    yellowCards[team].push(playerIdx);
    showCard(p, 'yellow');
    playCardSound();
    showRef('YELLOW CARD');

  } else if(color==='red'){
    redCards[team].push(playerIdx);
    yellowCards[team]=yellowCards[team].filter(function(i){return i!==playerIdx});
    // Remove player from pitch — hide mesh, freeze position off pitch
    p.mesh.visible=false;
    p.x=999;p.z=999; // park off pitch
    if(p===controlled){
      // Auto-switch to another active player
      for(var i=0;i<11;i++){
        if(redCards.A.indexOf(i)<0&&teamA[i]!==controlled){
          setControlled(teamA[i]);break;
        }
      }
    }
    showCard(p, 'red');
    showRef('RED CARD — PLAYER OFF');
  }
}

function showCard(player, color){
  var el=document.getElementById('card-popup');
  if(!el)return;
  el.style.background=color==='yellow'?'#FFD700':'#FF3333';
  el.style.color=color==='yellow'?'#000':'#fff';
  el.classList.add('show');
  setTimeout(function(){el.classList.remove('show')},1800);
}

// Upgrade awardFreeKick to sometimes give yellow cards
function checkCardForFoul(tacklerId, team){
  if(cardCooldown>0)return;
  var roll=Math.random();
  if(roll<0.3){
    giveCard(team, tacklerId, 'yellow');
    cardCooldown=8;
  } else if(roll<0.06){
    giveCard(team, tacklerId, 'red');
    cardCooldown=8;
  }
}

// ── INJURY SYSTEM ────────────────────────────────────────────
var INJURY_CHANCE = 0.0008; // per frame chance on heavy tackle
var injuredQueue  = [];     // players awaiting forced sub

function checkInjuries(dt){
  // Random injury chance on sliding tackles
  for(var i=0;i<11;i++){
    var p=teamA[i];
    if(p.injured){
      p.injuryTimer=Math.max(0,p.injuryTimer-dt);
      p.limp=Math.min(1,p.limp+dt*0.3);
      // Forced sub if timer runs out and subs available
      if(p.injuryTimer<=0&&subsUsed<SUB_MAX){
        forceInjurySub(p,i);
      }
    }
    // Tackle collision = injury risk
    for(var j=0;j<11;j++){
      var e=teamB[j];
      if(e.sliding>0&&!p.injured){
        var d=Math.hypot(p.x-e.x,p.z-e.z);
        if(d<PR*2&&Math.random()<INJURY_CHANCE*60){
          triggerInjury(p,i,'A');
        }
      }
    }
  }
  // CPU injuries too (rare)
  for(var i=1;i<11;i++){
    var p=teamB[i];
    if(p.injured){
      p.injuryTimer=Math.max(0,p.injuryTimer-dt);
      p.limp=Math.min(1,p.limp+dt*0.3);
      if(p.injuryTimer<=0) forceInjurySubCPU(p,i);
    }
  }
}

function triggerInjury(player,idx,team){
  if(player.injured)return;
  player.injured=true;
  player.injuryTimer=25; // 25 seconds to get subbed or play through
  player.limp=0.3;
  showRef('INJURY — PLAYER DOWN');
  // Flash player mesh orange
  player.mesh.children.forEach(function(c){
    if(c.material&&c.material.emissive){
      c.material.emissive.setHex(0xFF6600);
      setTimeout(function(){
        if(c.material&&c.material.emissive)c.material.emissive.setHex(0x000000);
      },1500);
    }
  });
  // Show injury notification
  showInjuryAlert(player,team);
}

function showInjuryAlert(player,team){
  var el=document.getElementById('injury-alert');
  if(!el)return;
  el.textContent=(team==='A'?'YOUR ':'CPU ')+player.role+' INJURED';
  el.classList.add('show');
  setTimeout(function(){el.classList.remove('show')},3000);
}

function forceInjurySub(player,idx){
  // Auto-sub from bench
  for(var i=0;i<benchA.length;i++){
    if(!benchA[i].active){
      if(!benchA[i].mesh){benchA[i].mesh=makePlayerMesh(0x00A3FF,false);scene.add(benchA[i].mesh)}
      benchA[i].x=player.x;benchA[i].z=player.z;
      benchA[i].homeX=player.homeX||player.x;
      benchA[i].homeZ=player.homeZ||player.z;
      benchA[i].active=true;benchA[i].mesh.visible=true;
      if(B.owner===player)B.owner=benchA[i];
      if(player===controlled)setControlled(benchA[i]);
      player.mesh.visible=false;player.x=999;player.z=999;
      teamA[idx]=benchA[i];
      subsUsed++;
      showRef('FORCED SUB — INJURY');
      return;
    }
  }
  // No subs left — player limps on at half speed
  player.injuryTimer=999;
}

function forceInjurySubCPU(player,idx){
  // CPU just replaces with a clone
  var fresh=makeTeamPlayer(posB[idx],0xFF6B1A);
  fresh.x=player.x;fresh.z=player.z;
  scene.add(fresh.mesh);
  player.mesh.visible=false;player.x=999;player.z=999;
  teamB[idx]=fresh;
  showRef('CPU SUBSTITUTION');
}

// ── WEATHER UPDATE ───────────────────────────────────────────
function updateWeather(dt){
  if(!weatherSystem||WEATHER==='clear')return;
  var pos=weatherGeo.attributes.position.array;
  var fallSpeed=WEATHER==='storm'?28:WEATHER==='heavy_rain'?22:14;
  for(var i=0;i<pos.length/3;i++){
    pos[i*3  ]+=WIND_X*dt*0.6;
    pos[i*3+1]-=fallSpeed*dt;
    pos[i*3+2]+=WIND_Z*dt*0.6;
    // Wrap when fallen below pitch
    if(pos[i*3+1]<0){
      pos[i*3  ]=(Math.random()-0.5)*FW*1.2;
      pos[i*3+1]=28+Math.random()*4;
      pos[i*3+2]=(Math.random()-0.5)*FH*1.2;
    }
  }
  weatherGeo.attributes.position.needsUpdate=true;

  // Lightning flashes for storm
  if(WEATHER==='storm'&&Math.random()<0.002){
    renderer.setClearColor(0x223344);
    setTimeout(function(){renderer.setClearColor(0x0a0b10)},60);
    setTimeout(function(){renderer.setClearColor(0x223344)},120);
    setTimeout(function(){renderer.setClearColor(0x0a0b10)},180);
    snd_thunder();
  }
}

function snd_thunder(){
  if(!AudioCtx||!OPT_SFX)return;
  var t=AudioCtx.currentTime;
  var o=AudioCtx.createOscillator();var g=AudioCtx.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(60,t);
  o.frequency.exponentialRampToValueAtTime(20,t+0.8);
  g.gain.setValueAtTime(0.6,t);g.gain.exponentialRampToValueAtTime(0,t+1.2);
  o.connect(g);g.connect(AudioCtx.destination);
  o.start(t);o.stop(t+1.2);
}

// ── MAIN LOOP ─────────────────────────────────────────────────
var last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  var dt=Math.min((now-last)/1000,0.05);last=now;

  if(STATE==='setpiece'){stepSetPiece(dt)}
  if(STATE==='playing'&&!celebrating){
    stepUser(dt);
    stepTeamA(dt);
    stepTeamB(dt);
    stepBall(dt);
    checkTackles();
    checkGoal();
    enforceRules(dt);
    if(OPT_INJURIES)checkInjuries(dt);
    checkNearMiss();
    // Auto-switch: if any blue player has ball and isn't controlled
    if(B.owner&&teamA.indexOf(B.owner)>=0&&B.owner!==controlled){
      setControlled(B.owner);
    }
  }

  // Sync mesh XZ positions and facing — Y and rotation.x handled by animatePlayers
  for(var i=0;i<11;i++){
    teamA[i].mesh.position.x=teamA[i].x;
    teamA[i].mesh.position.z=teamA[i].z;
    teamA[i].mesh.rotation.y=Math.atan2(teamA[i].fx,teamA[i].fz);
    teamB[i].mesh.position.x=teamB[i].x;
    teamB[i].mesh.position.z=teamB[i].z;
    teamB[i].mesh.rotation.y=Math.atan2(teamB[i].fx,teamB[i].fz);
  }
  BM.position.set(B.x,B.y,B.z);
  var bspd=Math.hypot(B.vx,B.vz);
  if(bspd>0.1)BM.rotateOnWorldAxis(new THREE.Vector3(-B.vz,0,B.vx).normalize(),bspd*dt/BALL_R);

  animatePlayers(dt);
  updatePlayerAnimations(dt);
  updateBallTrail();
  updateWeather(dt);
  clearJustPressed();

  // ── SNAPSHOT for replay buffer ───────────────────────────
  if(STATE==='playing'&&!celebrating){
    replayFrameAccum+=dt;
    if(replayFrameAccum>=1/REPLAY_FPS){
      replayFrameAccum=0;
      var snap={
        bx:B.x,by:B.y,bz:B.z,
        players:[]
      };
      for(var _ri=0;_ri<11;_ri++){
        snap.players.push({
          ax:teamA[_ri].x,az:teamA[_ri].z,afx:teamA[_ri].fx,afz:teamA[_ri].fz,
          bx:teamB[_ri].x,bz:teamB[_ri].z,bfx:teamB[_ri].fx,bfz:teamB[_ri].fz
        });
      }
      replayBuffer.push(snap);
      if(replayBuffer.length>REPLAY_MAX_FRAMES) replayBuffer.shift();
    }
  }

  // ── REPLAY PLAYBACK ──────────────────────────────────────
  if(replayActive){
    replayFrame+=replaySpeed;
    var fi=Math.floor(replayFrame);
    if(fi>=replayFrames.length){
      // Replay done — resume game
      endReplay();
    } else {
      var f=replayFrames[fi];
      // Position ball
      BM.position.set(f.bx,f.by,f.bz);
      // Position players
      for(var _ri=0;_ri<11;_ri++){
        teamA[_ri].mesh.position.x=f.players[_ri].ax;
        teamA[_ri].mesh.position.z=f.players[_ri].az;
        teamA[_ri].mesh.rotation.y=Math.atan2(f.players[_ri].afx,f.players[_ri].afz);
        teamB[_ri].mesh.position.x=f.players[_ri].bx;
        teamB[_ri].mesh.position.z=f.players[_ri].bz;
        teamB[_ri].mesh.rotation.y=Math.atan2(f.players[_ri].bfx,f.players[_ri].bfz);
      }
      // Replay cam — cinematic angle close to goal
      var gc=replayCamLX>0?HW:-HW;
      var camTX=gc-Math.sign(gc)*18+Math.sin(replayFrame*0.04)*6;
      var camTZ=replayCamLZ+12;
      camera.position.x+=(camTX-camera.position.x)*0.04;
      camera.position.y+=(10-camera.position.y)*0.04;
      camera.position.z+=(camTZ-camera.position.z)*0.04;
      camera.lookAt(f.bx,f.by+0.5,f.bz);
      // Replay progress bar
      var pct=(fi/replayFrames.length)*100;
      var pb=document.getElementById('replay-progress-fill');
      if(pb)pb.style.width=pct+'%';
    }
  } else {
    updateCam(dt);
  }

  updateWeather(dt);
  updateHUD(dt);
  renderer.render(scene,camera);
}

function clearJustPressed(){justPressed={}}

// ── GAME FLOW ─────────────────────────────────────────────────
function action(){
  initAudio();
  // Weather indicator
  var _wi=document.getElementById('weather-indicator');
  if(_wi){
    var _wicons={'clear':'','rain':'RAIN','heavy_rain':'HEAVY RAIN','fog':'FOG','storm':'STORM'};
    _wi.textContent=_wicons[WEATHER]||'';
    _wi.style.display=WEATHER==='clear'?'none':'flex';
  }
  // Load club name
  try{
    var _cn=localStorage.getItem('sfc_clubname');
    if(_cn)document.getElementById('sb-home-name').textContent=_cn.toUpperCase();
  }catch(e){}
  document.getElementById('post-match').classList.remove('show');
  if(STATE==='start'||STATE==='end'){
    sa=0;sb=0;matchTime=0;stamina=100;celebrating=false;passTarget=null;
  yellowCards={A:[],B:[]};redCards={A:[],B:[]};cardCooldown=0;subsUsed=0;_subOutIdx=null;
  injuredQueue=[];
  replayBuffer=[];replayFrames=[];replayActive=false;
  SP.active=false;STATE='start';
  weatherIntensity=0;setWeather(pickWeather());if(window._aimCursor)window._aimCursor.visible=false;
    document.getElementById('sb-home-score').textContent='0';
    document.getElementById('sb-away-score').textContent='0';
    document.getElementById('sb-clock').textContent='00:00';
    resetAll();
    document.getElementById('overlay').style.display='none';
    STATE='playing';
  setTimeout(snd_whistle,300);
  // Update player card with real name from squad
  var pc=document.getElementById('pc-name');
  if(pc&&controlled&&controlled.name)pc.textContent=controlled.name.split(' ').pop().toUpperCase();
    setTimeout(playWhistleSound, 300);
    setCrowdExcitement(0.35);
  } else if(STATE==='paused'){resume()}
}

function togglePause(){
  STATE='paused';
  document.getElementById('ov-title').textContent='PAUSED';
  document.getElementById('ov-sub').textContent=sa+' – '+sb;
  document.getElementById('ov-btn').textContent='Resume';
  document.getElementById('overlay').style.display='flex';
}

function resume(){STATE='playing';document.getElementById('overlay').style.display='none'}

// ── POST-MATCH CONFETTI ──────────────────────────────────────
var _confParticles=[];
function triggerConfetti(){
  var canvas=document.getElementById('pm-confetti');
  if(!canvas)return;
  canvas.width=innerWidth;canvas.height=innerHeight;
  _confParticles=[];
  for(var i=0;i<80;i++){
    _confParticles.push({
      x:Math.random()*innerWidth,y:-10,
      vx:(Math.random()-0.5)*4,vy:Math.random()*4+2,
      color:Math.random()>0.5?'#00F2FF':'#7000FF',
      size:Math.random()*5+3,life:1,rot:Math.random()*Math.PI*2,vrot:(Math.random()-0.5)*0.2
    });
  }
  animateConfetti();
}
function animateConfetti(){
  var canvas=document.getElementById('pm-confetti');
  if(!canvas||_confParticles.length===0)return;
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  _confParticles=_confParticles.filter(function(p){return p.life>0});
  _confParticles.forEach(function(p){
    p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life-=0.012;p.rot+=p.vrot;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;
    ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
    ctx.restore();
  });
  if(_confParticles.length>0)requestAnimationFrame(animateConfetti);
  else{var cv=document.getElementById('pm-confetti');if(cv){var cx=cv.getContext('2d');cx.clearRect(0,0,cv.width,cv.height)}}
}

// ── BOLT COUNT-UP (Gemini spec) ───────────────────────────────
function animateBolts(target){
  var display=0;
  var el=document.getElementById('pm-bolt-count');
  var step=target/60;
  var timer=setInterval(function(){
    display+=step;
    if(display>=target){display=target;clearInterval(timer);triggerConfetti()}
    el.textContent=Math.floor(display);
  },16);
}

function endMatch(){
  STATE='end';
  playWhistleSound();
  setTimeout(playWhistleSound, 500);
  setTimeout(playWhistleSound, 1000);
  setCrowdExcitement(0.5);
  var won=sa>sb,drew=sa===sb;
  var earned=won?150:drew?60:30;

  // Update bolt balance
  var newBal=0;
  try{
    newBal=parseInt(localStorage.getItem('sfc_bolts')||'0')+earned;
    localStorage.setItem('sfc_bolts',newBal);
    var _ms=JSON.parse(localStorage.getItem('sfc_matchstats')||'{}');
    _ms.played=(_ms.played||0)+1;
    if(won)_ms.wins=(_ms.wins||0)+1;
    _ms.goals=(_ms.goals||0)+sa;
    localStorage.setItem('sfc_matchstats',JSON.stringify(_ms));
    // Save result for league mode if a league fixture is pending
    var _lf=localStorage.getItem('sfc_league_fixture');
    if(_lf!==null){
      var _isHome=true;
      try{
        var _league=JSON.parse(localStorage.getItem('sfc_league')||'null');
        if(_league){var _fix=_league.fixtures[parseInt(_lf)];_isHome=_fix&&_fix.home===0}
      }catch(e){}
      var _lr=_isHome?{home:sa,away:sb}:{home:sb,away:sa};
      localStorage.setItem('sfc_last_result',JSON.stringify(_lr));
    }
  }catch(ex){}

  // Fill screen
  var resEl=document.getElementById('pm-result');
  resEl.textContent=won?'VICTORY':drew?'DRAW':'DEFEATED';
  resEl.className=won?'victory':drew?'draw':'defeat';
  document.getElementById('pm-score').textContent=sa+' – '+sb;
  document.getElementById('pm-goals').textContent=sa;
  document.getElementById('pm-result-txt').textContent=won?'Win':drew?'Draw':'Loss';
  document.getElementById('pm-total-bolts').textContent=newBal.toLocaleString();

  // Show screen
  document.getElementById('post-match').classList.add('show');
  document.getElementById('overlay').style.display='none';

  // Animate bolts counting up
  setTimeout(function(){animateBolts(earned)},400);
}

function pmPlayAgain(){
  document.getElementById('post-match').classList.remove('show');
  _confParticles=[];
  action();
}

// ── SUBSTITUTION ─────────────────────────────────────────────
function openSubMenu(){
  if(subsUsed>=SUB_MAX){showRef('NO SUBS LEFT');return}
  var menu=document.getElementById('sub-menu');
  if(!menu)return;

  // Build player list
  var html='<div class="sub-title">Select player to substitute out</div>';
  html+='<div class="sub-list">';
  for(var i=0;i<11;i++){
    var p=teamA[i];
    var isOff=redCards.A.indexOf(i)>=0;
    var yc=yellowCards.A.indexOf(i)>=0;
    if(isOff)continue;
    html+='<div class="sub-row'+(p===controlled?' active':'')+'" onclick="selectSubOut('+i+')">';
    html+='<span class="sub-role">'+p.role+'</span>';
    html+='<span class="sub-name">Player '+(i+1)+'</span>';
    if(yc)html+='<span class="sub-card yellow-card">Y</span>';
    html+='</div>';
  }
  html+='</div>';
  html+='<div class="sub-title" style="margin-top:12px">Bring on</div>';
  html+='<div class="sub-list">';
  for(var i=0;i<benchA.length;i++){
    if(benchA[i].active)continue;
    html+='<div class="sub-row" onclick="confirmSub('+i+')" id="sub-bench-'+i+'">';
    html+='<span class="sub-role">'+benchA[i].role+'</span>';
    html+='<span class="sub-name">'+benchA[i].name+'</span>';
    html+='</div>';
  }
  html+='</div>';
  html+='<div style="margin-top:12px;display:flex;gap:8px">';
  html+='<button class="sub-btn" onclick="closeSubMenu()">Cancel</button>';
  html+='<div style="font-size:11px;color:#A0A8B8;display:flex;align-items:center">Subs: '+(SUB_MAX-subsUsed)+' left</div>';
  html+='</div>';

  menu.innerHTML=html;
  menu.classList.add('show');
  STATE='paused';
}

var _subOutIdx=null;
function selectSubOut(idx){
  _subOutIdx=idx;
  // Highlight selected row
  document.querySelectorAll('.sub-row').forEach(function(r,i){r.classList.remove('selected')});
  var rows=document.querySelectorAll('#sub-menu .sub-row');
  if(rows[idx])rows[idx].classList.add('selected');
}

function confirmSub(benchIdx){
  if(_subOutIdx===null){showRef('SELECT PLAYER FIRST');return}
  var outPlayer=teamA[_subOutIdx];
  var inBench=benchA[benchIdx];

  // Swap positions and stats
  inBench.x=outPlayer.x;inBench.z=outPlayer.z;
  inBench.homeX=outPlayer.homeX||outPlayer.x;
  inBench.homeZ=outPlayer.homeZ||outPlayer.z;
  inBench.active=true;

  // Create mesh for sub if needed
  if(!inBench.mesh){
    inBench.mesh=makePlayerMesh(0x00A3FF);
    scene.add(inBench.mesh);
  }
  inBench.mesh.visible=true;

  // Swap in array
  teamA[_subOutIdx]=inBench;
  outPlayer.mesh.visible=false;
  outPlayer.x=999;outPlayer.z=999;

  if(outPlayer===controlled)setControlled(inBench);

  subsUsed++;
  _subOutIdx=null;
  closeSubMenu();
  showRef('SUBSTITUTION');
  STATE='playing';
}

function closeSubMenu(){
  var menu=document.getElementById('sub-menu');
  if(menu)menu.classList.remove('show');
  if(STATE==='paused')STATE='playing';
}

function pmGoToClub(){
  window.location.href='menu.html';
}
function pmGoToLeague(){
  // If came from league, go back to league page
  if(localStorage.getItem('sfc_league_fixture')!==null){
    window.location.href='league.html';
  } else {
    window.location.href='menu.html';
  }
}

requestAnimationFrame(loop);