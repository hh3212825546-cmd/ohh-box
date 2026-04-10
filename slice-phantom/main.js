const SITE_CONFIG = { title: "OHH BOX", author: "@ohh" };

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const isWechat = /MicroMessenger/i.test(navigator.userAgent);

let currentImage = null, timer = null, isRecording = false, pickingColor = false;
let colorPool = ['#ff0055', '#00ffcc', '#ffff00']; // 默认色池

const ui = {
    sizeVar: document.getElementById('sizeVar'),
    rgbSplit: document.getElementById('rgbSplit'),
    pixelDrift: document.getElementById('pixelDrift'),
    colorCount: document.getElementById('colorCount'),
    overlayText: document.getElementById('overlayText'),
    textSize: document.getElementById('textSize'),
    textColor: document.getElementById('textColor'),
    textX: document.getElementById('textX'),
    textY: document.getElementById('textY')
};

// --- 🌈 颜色管理逻辑 ---
function renderPalette() {
    const container = document.getElementById('customPalette');
    // 保留功能按钮，删除旧色块
    const items = container.querySelectorAll('.color-item');
    items.forEach(el => el.remove());

    colorPool.forEach((color, index) => {
        const div = document.createElement('div');
        div.className = 'color-item';
        div.style.background = color;
        div.innerHTML = `<div class="color-del" onclick="removeColor(${index}, event)">×</div>`;
        container.insertBefore(div, document.getElementById('pickColor'));
    });
}

function removeColor(index, e) {
    e.stopPropagation();
    colorPool.splice(index, 1);
    renderPalette();
    render();
}

function addColor(hex) {
    colorPool.push(hex.toUpperCase());
    renderPalette();
    render();
}

document.getElementById('addColorBtn').onclick = () => addColor('#' + Math.floor(Math.random()*16777215).toString(16));
document.getElementById('pickColor').onclick = () => {
    pickingColor = true;
    document.getElementById('toast').style.display = 'block';
};

// --- 🎭 预设系统 ---
const PRESETS = {
    matrix: { 
        split: 2, 
        colors: ['#00ff41', '#003b00', '#000000', '#0d0208'], 
        txt: 'SYSTEM FAILURE', 
        size: 80, x: 50, y: 50, 
        scan: 80, // 强化扫描线
        drift: true 
    },
    vhs: { 
        split: 12, 
        colors: ['#fff', '#999', '#000'], 
        txt: 'PLAY ▶', 
        size: 60, x: 15, y: 15, 
        scan: 40, 
        drift: true 
    },
    vaporwave: { 
        split: 8, 
        colors: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'], 
        txt: 'A E S T H E T I C', 
        size: 70, x: 50, y: 50, 
        scan: 20, 
        drift: true 
    },
    cyber: { split: 15, colors: ['#ff00ff','#00ffff','#ffff00'], txt: 'NEON NIGHT', size: 100, x: 50, y: 80, scan: 30, drift: true },
    magazine: { split: 0, colors: ['#ffffff','#000000'], txt: 'VOGUE', size: 180, x: 50, y: 90, scan: 0, drift: false }
};

// 修改后的 applyPreset 函数，支持扫描线和撕裂开关
window.applyPreset = (name) => {
    const p = PRESETS[name];
    ui.rgbSplit.value = p.split;
    ui.overlayText.value = p.txt;
    ui.textSize.value = p.size;
    ui.textX.value = p.x;
    ui.textY.value = p.y;
    // 如果有 scan 属性就赋值，没有就设为 0
    document.getElementById('scanlines').value = p.scan || 0; 
    ui.pixelDrift.checked = p.drift !== undefined ? p.drift : true;
    
    colorPool = [...p.colors];
    renderPalette();
    render();
};

// --- 🎨 核心渲染引擎 ---
function render() {
    if(!currentImage) return;
    const w = canvas.width, h = canvas.height;
    ctx.drawImage(currentImage, 0, 0, w, h);

    // RGB 色散
    const split = parseInt(ui.rgbSplit.value);
    if(split > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.5;
        ctx.drawImage(currentImage, split, 0, w, h);
        ctx.drawImage(currentImage, -split, 0, w, h);
        ctx.restore();
    }

    // 切片
    const sVar = parseInt(ui.sizeVar.value) / 100;
    const drift = ui.pixelDrift.checked;
    for(let i=0; i<25; i++) {
        const sw = w/10 * (Math.random()+0.5), sh = h/20 * (Math.random()+0.5);
        const sx = Math.random()*(currentImage.width-sw), sy = Math.random()*(currentImage.height-sh);
        let dx = Math.random()*(w-sw), dy = Math.random()*(h-sh);
        if(drift) dx += (Math.random()-0.5)*60;
        ctx.drawImage(currentImage, sx, sy, sw, sh, dx, dy, sw, sh);
    }

    // 色块
    const colors = parseInt(ui.colorCount.value);
    for(let i=0; i<colors; i++) {
        const bw = w/8 * Math.random(), bh = h/8 * Math.random();
        ctx.fillStyle = colorPool[Math.floor(Math.random()*colorPool.length)] || '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(Math.random()*(w-bw), Math.random()*(h-bh), bw, bh);
        ctx.globalAlpha = 1.0;
    }

    // 文字
    if(ui.overlayText.value) {
        ctx.save();
        ctx.font = `bold ${ui.textSize.value}px sans-serif`;
        ctx.fillStyle = ui.textColor.value;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 15;
        ctx.fillText(ui.overlayText.value, (ui.textX.value/100)*w, (ui.textY.value/100)*h);
        ctx.restore();
    }
}

// --- 🖱️ 交互逻辑 ---
canvas.onclick = (e) => {
    if(!pickingColor) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + ((1<<24) + (pixel[0]<<16) + (pixel[1]<<8) + pixel[2]).toString(16).slice(1).toUpperCase();
    addColor(hex);
    pickingColor = false;
    document.getElementById('toast').style.display = 'none';
};

document.getElementById('imageUpload').onchange = (e) => {
    const r = new FileReader();
    r.onload = (ev) => {
        currentImage = new Image();
        currentImage.onload = () => {
            const max = 1200;
            canvas.width = max; canvas.height = max * (currentImage.height/currentImage.width);
            if(timer) clearInterval(timer);
            timer = setInterval(render, 150);
        };
        currentImage.src = ev.target.result;
    };
    r.readAsDataURL(e.target.files[0]);
};

// 导出 PNG
document.getElementById('downloadPngBtn').onclick = () => {
    const d = canvas.toDataURL('image/png');
    if(isWechat) {
        document.getElementById('wechat-img').src = d;
        document.getElementById('wechat-mask').style.display = 'flex';
    } else {
        const a = document.createElement('a'); a.download = `SLICE_${Date.now()}.png`; a.href = d; a.click();
    }
};

// 导出视频
document.getElementById('recordBtn').onclick = (e) => {
    if(!currentImage || isRecording) return;
    if(isWechat) { alert("微信内暂不支持导出视频，请长按保存图片或浏览器打开"); return; }
    isRecording = true;
    const stream = canvas.captureStream(30);
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
    const chunks = [];
    mr.ondataavailable = ev => chunks.push(ev.data);
    mr.onstop = () => {
        const b = new Blob(chunks, { type: 'video/webm' });
        const u = URL.createObjectURL(b);
        const a = document.createElement('a'); a.href = u; a.download = `OHH_SLICE.webm`; a.click();
        isRecording = false; e.target.innerText = "🎥 导出 2.5s 实况视频";
    };
    mr.start(); e.target.innerText = "⏳ 录制中...";
    setTimeout(() => mr.stop(), 2500);
};

// 初始化
renderPalette();
['sizeVar','rgbSplit','colorCount','overlayText','textSize','textX','textY','textColor'].forEach(id => {
    document.getElementById(id).oninput = () => {
        if(document.getElementById(id+'Val')) document.getElementById(id+'Val').innerText = document.getElementById(id).value;
        render();
    };
});
