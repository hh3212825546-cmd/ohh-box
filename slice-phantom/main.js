const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const isWechat = /MicroMessenger/i.test(navigator.userAgent);

// 全局变量
let currentImage = null, timer = null, isRecording = false, pickingColor = false;
let colorPool = ['#FF0055', '#00FFCC', '#FFFF00', '#FF00FF']; // 初始默认多巴胺色池

// UI 元素引用映射表
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

// --- 🎭 大师级预设数据池 ---
const PRESETS = {
    matrix: { split: 2, scan: 85, colors: ['#00FF41', '#003B00', '#000000', '#0D0208'], txt: 'SYSTEM FAILURE', size: 80, x: 50, y: 50, drift: true },
    cyber: { split: 15, scan: 30, colors: ['#FF00FF', '#00FFFF', '#FFFF00', '#0000FF'], txt: 'NEON NIGHT', size: 90, x: 50, y: 80, drift: true },
    magazine: { split: 0, scan: 0, colors: ['#FFFFFF', '#000000', '#F1F5F9'], txt: 'VOGUE', size: 180, x: 50, y: 90, drift: false },
    vhs: { split: 12, scan: 50, colors: ['#FFFFFF', '#999999', '#000000', '#FF0000'], txt: 'PLAY ▶ 00:00:24', size: 55, x: 25, y: 15, drift: true },
    candy: { split: 6, scan: 10, colors: ['#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA'], txt: 'SWEET PEACH', size: 100, x: 50, y: 50, drift: false },
    nordic: { split: 3, scan: 20, colors: ['#2C3E50', '#34495E', '#BDC3C7', '#7F8C8D'], txt: 'WINTER SOLITUDE', size: 70, x: 10, y: 90, drift: true }
};

// --- 🌈 预设与多色池管理逻辑 ---
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

// 必须挂载到 window 上，否则 HTML 里的 onclick 会找不到
window.removeColor = (index, e) => {
    e.stopPropagation(); 
    colorPool.splice(index, 1); 
    renderPalette(); 
    render();
};

function addColor(hex) {
    colorPool.push(hex.toUpperCase());
    renderPalette();
    render();
}

window.applyPreset = (name) => {
    const p = PRESETS[name];
    if (!p) return;

    ui.rgbSplit.value = p.split;
    ui.scanlines.value = p.scan;
    ui.overlayText.value = p.txt;
    ui.textSize.value = p.size;
    ui.textX.value = p.x;
    ui.textY.value = p.y;
    ui.pixelDrift.checked = p.drift;
    
    colorPool = [...p.colors]; 
    renderPalette();
    
    ['rgbSplit', 'scanlines', 'textSize', 'textX', 'textY'].forEach(k => {
        const valEl = document.getElementById(k + 'Val');
        if (valEl) valEl.innerText = ui[k].value;
    });
    render(); 
};


// --- 🎨 核心渲染引擎 ---
function render() {
    if (!currentImage) return;
    const w = canvas.width, h = canvas.height;
    ctx.drawImage(currentImage, 0, 0, w, h);

    // 1. 实验室：色散重影 (RGB Split)
    const split = parseInt(ui.rgbSplit.value);
    if (split > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
        ctx.drawImage(currentImage, split, 0, w, h);
        ctx.drawImage(currentImage, -split, 0, w, h);
        ctx.restore();
    }

    // 2. 特效核心：位移切片 + 水平撕裂
    const drift = ui.pixelDrift.checked;
    const sVar = parseInt(ui.sizeVar.value) / 100;
    const slices = 25;
    for (let i = 0; i < slices; i++) {
        const sw = (w / 10) * (1 + (Math.random() - 0.5) * sVar * 4);
        const sh = (h / 20) * (1 + (Math.random() - 0.5) * sVar * 4);
        const sx = Math.random() * (currentImage.width - sw), sy = Math.random() * (currentImage.height - sh);
        let dx = Math.random() * (w - sw), dy = Math.random() * (h - sh);
        
        // 开启撕裂时，画面产生横向断层
        if (drift) dx += (Math.random() - 0.5) * 80; 
        
        ctx.drawImage(currentImage, sx, sy, sw, sh, dx, dy, sw, sh);
    }

    // 3. 特效核心：动态多色色块
    const colors = parseInt(ui.colorCount.value);
    for (let i = 0; i < colors; i++) {
        const bw = (w / 8) * Math.random(), bh = (h / 8) * Math.random();
        ctx.fillStyle = colorPool[Math.floor(Math.random() * colorPool.length)] || '#FFFFFF';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(Math.random() * (w - bw), Math.random() * (h - bh), bw, bh);
        ctx.globalAlpha = 1.0;
    }

    // 4. 实验室：扫描线调节
    const scan = parseInt(ui.scanlines.value);
    if (scan > 0) {
        ctx.save();
        // 调整了算法，让扫描线更加显眼
        ctx.fillStyle = `rgba(0,0,0,${scan / 150})`;
        for (let i = 0; i < h; i += 4) ctx.fillRect(0, i, w, 2);
        ctx.restore();
    }

    // 5. 大师文字排版
    if (ui.overlayText.value) {
        ctx.save();
        const fSize = parseInt(ui.textSize.value);
        ctx.font = `bold ${fSize}px -apple-system, sans-serif`;
        ctx.fillStyle = ui.textColor.value;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const x = (parseInt(ui.textX.value) / 100) * w;
        const y = (parseInt(ui.textY.value) / 100) * h;
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 15;
        ctx.fillText(ui.overlayText.value, x, y);
        ctx.restore();
    }
}


// --- 🖱️ 交互、取色与动画 ---
canvas.onclick = (e) => {
    if (!pickingColor) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1).toUpperCase();
    addColor(hex);
    pickingColor = false; 
    document.getElementById('toast').style.display = 'none';
};

document.getElementById('pickColor').onclick = () => { pickingColor = true; document.getElementById('toast').style.display = 'block'; };
document.getElementById('addColorBtn').onclick = () => addColor('#' + Math.floor(Math.random() * 16777215).toString(16));


// 🚀 智能动画循环引擎 (支持不规则卡顿强度)
function startEffectLoop() {
    if (timer) clearTimeout(timer);
    const loop = () => {
        if (!isRecording) render();
        
        let delay = 150; // 基础帧率
        const stutterIntensity = parseInt(ui.stutter.value) / 100;
        // 如果触发了卡顿，随机增加 0~400 毫秒的停顿
        if (Math.random() < stutterIntensity) {
            delay += Math.random() * 400; 
        }
        
        timer = setTimeout(loop, delay);
    };
    loop();
}

document.getElementById('imageUpload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
        currentImage = new Image();
        currentImage.onload = () => {
            const max = 1200; 
            const ratio = currentImage.width / currentImage.height;
            if (ratio > 1) { canvas.width = max; canvas.height = max / ratio; } 
            else { canvas.height = max; canvas.width = max * ratio; }
            startEffectLoop();
        };
        currentImage.src = ev.target.result;
    };
    r.readAsDataURL(file);
};


// --- 🎬 导出功能 ---
document.getElementById('downloadPngBtn').onclick = () => {
    if (!currentImage) return;
    render();
    const d = canvas.toDataURL('image/png');
    if (isWechat) {
        document.getElementById('wechat-img').src = d;
        document.getElementById('wechat-mask').style.display = 'flex';
    } else {
        const a = document.createElement('a'); a.download = `SLICE_PHANTOM_${Date.now()}.png`; a.href = d; a.click();
    }
};

document.getElementById('recordBtn').onclick = (e) => {
    if (!currentImage || isRecording) return;
    if (isWechat) { alert("微信内暂不支持导出视频，请在浏览器中打开此页面。"); return; }
    
    isRecording = true;
    const btn = e.target;
    const chunks = [];
    const stream = canvas.captureStream(30);
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 }); 

    mr.ondataavailable = ev => chunks.push(ev.data);
    mr.onstop = () => {
        const b = new Blob(chunks, { type: 'video/webm' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `SLICE_LIVE_${Date.now()}.webm`; a.click();
        isRecording = false; btn.innerText = "🎥 导出 2.5s 实况视频"; btn.classList.remove('btn-success'); btn.classList.add('btn-danger');
    };

    mr.start();
    btn.innerText = "⏳ 录制中..."; btn.classList.remove('btn-danger'); btn.classList.add('btn-success');
    setTimeout(() => mr.stop(), 2500);
};


// --- 🚀 初始化系统与事件绑定 ---
function init() {
    renderPalette();
    
    // 监听范围条
    ['sizeVar', 'rgbSplit', 'scanlines', 'stutter', 'colorCount', 'textSize', 'textX', 'textY'].forEach(id => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(id + 'Val');
        if (!el) return;
        el.oninput = () => {
            if (valEl) valEl.innerText = el.value;
            if (id === 'stutter') startEffectLoop(); // 实时反馈卡顿
            if (!isRecording) render();
        };
    });

    // 监听颜色和文字输入
    ['overlayText', 'textColor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = () => { if (!isRecording) render(); };
    });

    // 监听复选框 (必须用 onchange)
    if (ui.pixelDrift) {
        ui.pixelDrift.onchange = () => { if (!isRecording) render(); };
    }
    
    // 初始化画布状态
    canvas.width = 1000; canvas.height = 1000;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1000, 1000);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 80px sans-serif'; ctx.fillText('OHH BOX', 500, 480);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#64748b'; ctx.fillText('切片幻影 PRO v2.6', 500, 540);
}

init();
