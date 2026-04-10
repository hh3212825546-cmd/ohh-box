const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');


// 📱 核心升级：精准移动端设备嗅探
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

let currentImage = null, timer = null, isRecording = false, pickingColor = false;
let colorPool = ['#FF0055', '#00FFCC', '#FFFF00', '#FF00FF']; 
let frameCount = 0; // 记录运行了多少帧

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

window.removeColor = (index, e) => { e.stopPropagation(); colorPool.splice(index, 1); renderPalette(); render(); };
function addColor(hex) { colorPool.push(hex.toUpperCase()); renderPalette(); render(); }

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
    render(); 
};

function render() {
    if (!currentImage) return;
    const w = canvas.width, h = canvas.height;
    
    // 🚀 核心控制逻辑：
    // 我们定义一个变化阈值。滑块数值越小（速度越慢），阈值越大。
    // 假设 speedValue 是滑块传来的值 (1-100)
    const speedValue = parseInt(document.getElementById('stutter').value); // 复用卡顿或新开滑块
    const changeThreshold = Math.max(1, Math.floor(60 / (speedValue / 10 + 1))); 

    // 只有当帧数达到阈值时，才更新随机位移和颜色
    // 这样无论 render 运行多快，视觉上的闪动频率都是恒定的
    if (frameCount % changeThreshold === 0) {
        // ... 这里放原本那些生成随机 sx, sy, dx, dy 以及随机颜色的逻辑 ...
        updateRandomParams(); 
    }

    // 绘制逻辑（每一帧都执行，保证视频流丝滑）
    drawBaseImage(w, h);
    drawSlices(); // 使用 updateRandomParams 生成的旧参数
    drawColorBlocks();
    drawScanlines(w, h);
    drawText(w, h);

    frameCount++; // 帧数累加
}
    const drift = ui.pixelDrift.checked;
    const sVar = parseInt(ui.sizeVar.value) / 100;
    // 手机端优化：移动端适当减少切片数量，保持视觉效果同时提升帧率
    const slices = isMobile ? 18 : 25; 
    for (let i = 0; i < slices; i++) {
        const sw = (w / 10) * (1 + (Math.random() - 0.5) * sVar * 4);
        const sh = (h / 20) * (1 + (Math.random() - 0.5) * sVar * 4);
        const sx = Math.random() * (currentImage.width - sw), sy = Math.random() * (currentImage.height - sh);
        let dx = Math.random() * (w - sw), dy = Math.random() * (h - sh);
        if (drift) dx += (Math.random() - 0.5) * (w * 0.15); // 动态撕裂幅度
        ctx.drawImage(currentImage, sx, sy, sw, sh, dx, dy, sw, sh);
    }

    const colors = parseInt(ui.colorCount.value);
    for (let i = 0; i < colors; i++) {
        const bw = (w / 8) * Math.random(), bh = (h / 8) * Math.random();
        ctx.fillStyle = colorPool[Math.floor(Math.random() * colorPool.length)] || '#FFFFFF';
        ctx.globalAlpha = 0.6; ctx.fillRect(Math.random() * (w - bw), Math.random() * (h - bh), bw, bh); ctx.globalAlpha = 1.0;
    }

    const scan = parseInt(ui.scanlines.value);
    if (scan > 0) {
        ctx.save(); ctx.fillStyle = `rgba(0,0,0,${scan / 100})`;
        for (let i = 0; i < h; i += 4) ctx.fillRect(0, i, w, 2);
        ctx.restore();
    }

    if (ui.overlayText.value) {
        ctx.save();
        // 手机端文字大小自适应
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

canvas.onclick = (e) => {
    if (!pickingColor) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const p = ctx.getImageData(x, y, 1, 1).data;
    addColor('#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase());
    pickingColor = false; document.getElementById('toast').style.display = 'none';
};

document.getElementById('pickColor').onclick = () => { pickingColor = true; document.getElementById('toast').style.display = 'block'; };
document.getElementById('addColorBtn').onclick = () => addColor('#' + Math.floor(Math.random() * 16777215).toString(16));

function startEffectLoop() {
    if (timer) clearTimeout(timer);
    const loop = () => {
        if (!isRecording) render();
        let delay = 120;
        const stutterIntensity = parseInt(ui.stutter.value) / 100;
        if (stutterIntensity > 0 && Math.random() < stutterIntensity) { delay += 200 + Math.random() * 400; }
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
            // 🚀 核心优化：智能分辨率降维打击
            const max = isMobile ? 800 : 1200; // 手机端使用 800px，保证绝对流畅
            const ratio = currentImage.width / currentImage.height;
            if (ratio > 1) { canvas.width = max; canvas.height = max / ratio; } 
            else { canvas.height = max; canvas.width = max * ratio; }
            startEffectLoop();
        };
        currentImage.src = ev.target.result;
    };
    r.readAsDataURL(file);
};

// 📸 全平台出图逻辑
document.getElementById('downloadPngBtn').onclick = () => {
    if (!currentImage) return;
    render();
    const d = canvas.toDataURL('image/png');
    // 手机端一律弹出长按保存遮罩
    if (isMobile) {
        const mask = document.getElementById('wechat-mask');
        const img = document.getElementById('wechat-img');
        img.src = d;
        mask.style.display = 'flex';
    } else {
        // 电脑端直接下载
        const a = document.createElement('a'); a.download = `OHH_SLICE_${Date.now()}.png`; a.href = d; a.click();
    }
};

// --- 🎬 导出与跨端提示功能 ---
document.getElementById('recordBtn').onclick = async (e) => {
    if (!currentImage || isRecording) return;

    if (isMobile) {
        alert("⚠️ 提示：手机端录制可能黑屏或模糊。\n推荐使用电脑浏览器，或点击【开启纯净全屏录制】手动录屏。");
        return;
    }

    // 1. 自动探测支持的格式 (优先 MP4，不行就 WebM)
    const mimeTypes = [
        'video/mp4;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';

    console.log(`正在使用编码器: ${mimeType}`);

    isRecording = true;
    const btn = e.target;
    const chunks = [];
    
    // 2. 获取画面流
    const stream = canvas.captureStream(30); 
    const mr = new MediaRecorder(stream, { 
        mimeType: mimeType, 
        videoBitsPerSecond: 8000000 
    });

    mr.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    mr.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OHH_LIVE_${Date.now()}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        isRecording = false;
        btn.innerText = "🎥 导出 2.5s 实况视频";
        btn.classList.replace('btn-success', 'btn-danger');
    };

    // 3. 开始录制并强制重绘
    mr.start();
    btn.innerText = "⏳ 录制中...";
    btn.classList.replace('btn-danger', 'btn-success');

    // 特别修正：录制期间确保 render 持续运行
   // 修改录制按钮点击事件里的 setInterval 部分
const recordTimer = setInterval(() => {
    // 录制时，我们每秒固定执行 30 次 render
    render(); 
}, 33); // 33ms 对应约 30fps

    setTimeout(() => {
        clearInterval(recordTimer);
        mr.stop();
    }, 2500);
};

// --- 📱 沉浸式全屏录制逻辑 (优化版) ---
const enterBtn = document.getElementById('enterImmersiveBtn');
const previewArea = document.querySelector('.preview-area'); // 获取预览区域容器

if(enterBtn && previewArea) {
    // 1. 点击按钮进入全屏
    enterBtn.onclick = () => {
        if (!currentImage) { alert("请先上传一张照片！"); return; }
        document.body.classList.add('immersive-mode');
        
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        
        if (isMobile) {
            // 提示用户点击屏幕任意位置即可退出
            setTimeout(() => { 
                alert("✨ 已进入纯净模式！\n录制完毕后，【点击屏幕任意位置】即可退出。"); 
            }, 300);
        }
    };

    // 2. 点击预览区域直接退出 (替代原有的退出按钮)
    previewArea.onclick = () => {
        // 只有在全屏模式下点击才触发退出
        if (document.body.classList.contains('immersive-mode')) {
            document.body.classList.remove('immersive-mode');
            
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    };
}

function init() {
    renderPalette();
    ['sizeVar', 'rgbSplit', 'scanlines', 'stutter', 'colorCount', 'textSize', 'textX', 'textY'].forEach(id => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(id + 'Val');
        if (!el) return;
        el.addEventListener('input', (e) => {
            if (valEl) valEl.innerText = e.target.value;
            if (id === 'stutter') startEffectLoop(); 
            if (!isRecording) render();
        });
    });
    ['overlayText', 'textColor'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => { if (!isRecording) render(); }); });
    if (ui.pixelDrift) { ui.pixelDrift.addEventListener('change', () => { if (!isRecording) render(); }); }
    
    canvas.width = isMobile ? 800 : 1200; 
    canvas.height = canvas.width;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 初始引导语比例自适应
    const scale = canvas.width / 1000;
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `bold ${80 * scale}px sans-serif`; ctx.fillText('OHH BOX', canvas.width/2, canvas.height/2 - 20);
    ctx.font = `${24 * scale}px sans-serif`; ctx.fillStyle = '#64748b'; ctx.fillText('切片幻影 移动端优化版', canvas.width/2, canvas.height/2 + 40);
}

init();
