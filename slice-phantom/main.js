const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

let currentImage = null, timer = null, isRecording = false, pickingColor = false;
let colorPool = ['#FF0055', '#00FFCC', '#FFFF00', '#FF00FF']; 

// 动画缓存状态 (解决录制加速问题)
let frameCount = 0;
let cachedSlices = [];
let cachedColors = [];

const ui = {
    sizeVar: document.getElementById('sizeVar'),
    rgbSplit: document.getElementById('rgbSplit'),
    scanlines: document.getElementById('scanlines'),
    stutter: document.getElementById('stutter'),
    pixelDrift: document.getElementById('pixelDrift'),
    colorCount: document.getElementById('colorCount'),
    overlayText: document.getElementById('overlayText'),
    textSize: document.getElementById('textSize'),
    textColor: document.getElementById('textColor'),
    textX: document.getElementById('textX'),
    textY: document.getElementById('textY')
};

const PRESETS = {
    matrix: { split: 2, scan: 85, colors: ['#00FF41', '#003B00', '#000000', '#0D0208'], txt: 'SYSTEM FAILURE', size: 80, x: 50, y: 50, drift: true },
    cyber: { split: 15, scan: 30, colors: ['#FF00FF', '#00FFFF', '#FFFF00', '#0000FF'], txt: 'NEON NIGHT', size: 90, x: 50, y: 80, drift: true },
    magazine: { split: 0, scan: 0, colors: ['#FFFFFF', '#000000', '#F1F5F9'], txt: 'VOGUE', size: 180, x: 50, y: 90, drift: false },
    vhs: { split: 12, scan: 50, colors: ['#FFFFFF', '#999999', '#000000', '#FF0000'], txt: 'PLAY ▶ 00:00:24', size: 55, x: 25, y: 15, drift: true },
    candy: { split: 6, scan: 10, colors: ['#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA'], txt: 'SWEET PEACH', size: 100, x: 50, y: 50, drift: false },
    nordic: { split: 3, scan: 20, colors: ['#2C3E50', '#34495E', '#BDC3C7', '#7F8C8D'], txt: 'WINTER SOLITUDE', size: 70, x: 10, y: 90, drift: true }
};

// --- 色彩管理 ---
function renderPalette() {
    const container = document.getElementById('customPalette');
    container.querySelectorAll('.color-item').forEach(el => el.remove());
    colorPool.forEach((color, index) => {
        const div = document.createElement('div');
        div.className = 'color-item';
        div.style.background = color;
        div.innerHTML = `<div class="color-del" onclick="removeColor(${index}, event)">×</div>`;
        container.insertBefore(div, document.getElementById('pickColor'));
    });
}
window.removeColor = (index, e) => { e.stopPropagation(); colorPool.splice(index, 1); renderPalette(); generateEffectData(); render(); };
function addColor(hex) { colorPool.push(hex.toUpperCase()); renderPalette(); generateEffectData(); render(); }

window.applyPreset = (name) => {
    const p = PRESETS[name];
    if (!p) return;
    ui.rgbSplit.value = p.split; ui.scanlines.value = p.scan; ui.overlayText.value = p.txt;
    ui.textSize.value = p.size; ui.textX.value = p.x; ui.textY.value = p.y; ui.pixelDrift.checked = p.drift;
    colorPool = [...p.colors]; renderPalette();
    ['rgbSplit', 'scanlines', 'textSize', 'textX', 'textY'].forEach(k => {
        const valEl = document.getElementById(k + 'Val');
        if (valEl) valEl.innerText = ui[k].value;
    });
    generateEffectData();
    render(); 
};

// --- 动画核心：数据生成与渲染分离 ---

// 生成每一帧的跳变数据 (独立出来，不受渲染帧率影响)
function generateEffectData() {
    if(!currentImage) return;
    const w = canvas.width, h = canvas.height;
    const drift = ui.pixelDrift.checked;
    const sVar = parseInt(ui.sizeVar.value) / 100;
    
    cachedSlices = [];
    const slicesCount = isMobile ? 18 : 25; 
    for (let i = 0; i < slicesCount; i++) {
        const sw = (w / 10) * (1 + (Math.random() - 0.5) * sVar * 4);
        const sh = (h / 20) * (1 + (Math.random() - 0.5) * sVar * 4);
        const sx = Math.random() * (currentImage.width - sw);
        const sy = Math.random() * (currentImage.height - sh);
        let dx = Math.random() * (w - sw);
        let dy = Math.random() * (h - sh);
        if (drift) dx += (Math.random() - 0.5) * (w * 0.15); 
        cachedSlices.push({sx, sy, sw, sh, dx, dy});
    }

    cachedColors = [];
    const colorsCount = parseInt(ui.colorCount.value);
    for (let i = 0; i < colorsCount; i++) {
        const bw = (w / 8) * Math.random(), bh = (h / 8) * Math.random();
        const color = colorPool[Math.floor(Math.random() * colorPool.length)] || '#FFFFFF';
        const cx = Math.random() * (w - bw), cy = Math.random() * (h - bh);
        cachedColors.push({color, cx, cy, bw, bh});
    }
}

// 渲染引擎 (只负责画出当前的数据)
function render() {
    if (!currentImage) return;
    const w = canvas.width, h = canvas.height;
    ctx.drawImage(currentImage, 0, 0, w, h);

    // RGB 色散
    const split = parseInt(ui.rgbSplit.value);
    if (split > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
        const splitRatio = split * (w / 1200); 
        ctx.drawImage(currentImage, splitRatio, 0, w, h);
        ctx.drawImage(currentImage, -splitRatio, 0, w, h);
        ctx.restore();
    }

    // 画缓存的切片
    cachedSlices.forEach(s => {
        ctx.drawImage(currentImage, s.sx, s.sy, s.sw, s.sh, s.dx, s.dy, s.sw, s.sh);
    });

    // 画缓存的色块
    cachedColors.forEach(c => {
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(c.cx, c.cy, c.bw, c.bh);
        ctx.globalAlpha = 1.0;
    });

    // 扫描线
    const scan = parseInt(ui.scanlines.value);
    if (scan > 0) {
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${scan / 100})`;
        for (let i = 0; i < h; i += 4) ctx.fillRect(0, i, w, 2);
        ctx.restore();
    }

    // 文字
    if (ui.overlayText.value) {
        ctx.save();
        const scaleRatio = w / 1200;
        const fSize = parseInt(ui.textSize.value) * scaleRatio;
        ctx.font = `bold ${fSize}px -apple-system, sans-serif`;
        ctx.fillStyle = ui.textColor.value;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10 * scaleRatio;
        ctx.fillText(ui.overlayText.value, (ui.textX.value / 100) * w, (ui.textY.value / 100) * h);
        ctx.restore();
    }
}

// 动画循环控制
function startEffectLoop() {
    if (timer) clearTimeout(timer);
    
    // 强制每秒固定更新数据，不受录制帧率影响
    const updateLoop = () => {
        generateEffectData();
        if (!isRecording) render(); // 如果没录制，更新完直接画

        let delay = 120; // 基础变换间隔
        const stutterIntensity = parseInt(ui.stutter.value) / 100;
        if (stutterIntensity > 0 && Math.random() < stutterIntensity) { 
            delay += 200 + Math.random() * 400; // 模拟卡顿
        }
        timer = setTimeout(updateLoop, delay);
    };
    updateLoop();
}

// --- 🖱️ 统一的交互事件管理器 ---
const previewArea = document.querySelector('.preview-area');

previewArea.onclick = (e) => {
    // 1. 如果在全屏模式，点击任何地方退出
    if (document.body.classList.contains('immersive-mode')) {
        document.body.classList.remove('immersive-mode');
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        return;
    }

    // 2. 如果开启了取色，执行取色逻辑
    if (pickingColor) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        const p = ctx.getImageData(x, y, 1, 1).data;
        addColor('#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase());
        pickingColor = false; 
        document.getElementById('toast').style.display = 'none';
    }
};

document.getElementById('pickColor').onclick = () => { pickingColor = true; document.getElementById('toast').style.display = 'block'; };
document.getElementById('addColorBtn').onclick = () => addColor('#' + Math.floor(Math.random() * 16777215).toString(16));

// --- 📁 上传与导出 ---
document.getElementById('imageUpload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
        currentImage = new Image();
        currentImage.onload = () => {
            const max = isMobile ? 800 : 1200; 
            const ratio = currentImage.width / currentImage.height;
            if (ratio > 1) { canvas.width = max; canvas.height = max / ratio; } 
            else { canvas.height = max; canvas.width = max * ratio; }
            startEffectLoop(); // 启动循环
        };
        currentImage.src = ev.target.result;
    };
    r.readAsDataURL(file);
};

document.getElementById('downloadPngBtn').onclick = () => {
    if (!currentImage) return;
    const d = canvas.toDataURL('image/png');
    if (isMobile) {
        document.getElementById('wechat-img').src = d;
        document.getElementById('wechat-mask').style.display = 'flex';
    } else {
        const a = document.createElement('a'); a.download = `OHH_SLICE_${Date.now()}.png`; a.href = d; a.click();
    }
};

document.getElementById('recordBtn').onclick = async (e) => {
    if (!currentImage || isRecording) return;
    if (isMobile) { alert("⚠️ 手机端录制可能黑屏或模糊。\n👉 强烈建议：点击【手机端全屏录制】手动录屏，或使用电脑浏览器访问一键导出！"); return; }
    
    isRecording = true; const btn = e.target; const chunks = [];
    
    // 兼容格式探测
    const mimeTypes = ['video/mp4;codecs=h264', 'video/webm;codecs=vp9', 'video/webm'];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';

    const mr = new MediaRecorder(canvas.captureStream(30), { mimeType: mimeType, videoBitsPerSecond: 8000000 }); 

    mr.ondataavailable = ev => { if(ev.data.size > 0) chunks.push(ev.data); };
    mr.onstop = () => {
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(new Blob(chunks, { type: mimeType })); 
        a.download = `OHH_LIVE_${Date.now()}.${extension}`; a.click();
        isRecording = false; btn.innerText = "🎥 电脑端导出视频"; btn.classList.replace('btn-success', 'btn-danger');
    };

    mr.start();
    btn.innerText = "⏳ 录制中..."; btn.classList.replace('btn-danger', 'btn-success');

    // 录制期间强行高频渲染，保证视频流流畅，但不改变闪动节奏
    const recordTimer = setInterval(render, 33);
    setTimeout(() => { clearInterval(recordTimer); mr.stop(); }, 2500);
};

// 沉浸模式入口
document.getElementById('enterImmersiveBtn').onclick = () => {
    if (!currentImage) { alert("请先上传一张照片！"); return; }
    document.body.classList.add('immersive-mode');
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    if (isMobile) { setTimeout(() => { alert("✨ 已进入纯净模式！\n1. 请开启手机自带的【屏幕录制】。\n2. 录完后，【点击屏幕任意位置】即可退出。"); }, 300); }
};

function init() {
    renderPalette();
    ['sizeVar', 'rgbSplit', 'scanlines', 'stutter', 'colorCount', 'textSize', 'textX', 'textY'].forEach(id => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(id + 'Val');
        if (!el) return;
        el.addEventListener('input', (e) => {
            if (valEl) valEl.innerText = e.target.value;
            if (!isRecording) { generateEffectData(); render(); }
        });
    });
    ['overlayText', 'textColor'].forEach(id => { 
        const el = document.getElementById(id); 
        if (el) el.addEventListener('input', () => { if (!isRecording) render(); }); 
    });
    if (ui.pixelDrift) { ui.pixelDrift.addEventListener('change', () => { if (!isRecording) { generateEffectData(); render(); } }); }
    
    canvas.width = isMobile ? 800 : 1200; 
    canvas.height = canvas.width;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const scale = canvas.width / 1000;
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `bold ${80 * scale}px sans-serif`; ctx.fillText('OHH BOX', canvas.width/2, canvas.height/2 - 20);
    ctx.font = `${24 * scale}px sans-serif`; ctx.fillStyle = '#64748b'; ctx.fillText('切片幻影 v3.5', canvas.width/2, canvas.height/2 + 40);
}

init();
