// ⚙️ 核心配置 (署名更新)
const SITE_CONFIG = { title: "波点拼贴", subtitle: "上传一张照片，开始创作", author: "@ohh" };

const canvas = document.getElementById('mainCanvas'); const ctx = canvas.getContext('2d');
let currentImage = null, currentBgImage = null, particles = [], isDrawing = false, lastPos = {x:0, y:0};
let isRecording = false, mediaRecorder, recordedChunks = [];
let animationFrameId = null, pickingColorFor = null; 

// --- 💡 高级功能：撤销与重做系统 ---
let historyStack = [[]]; // 初始状态为空
let historyIndex = 0;

function saveState() {
    historyStack = historyStack.slice(0, historyIndex + 1); // 截断未来的记录
    historyStack.push(JSON.parse(JSON.stringify(particles))); // 深拷贝当前粒子
    historyIndex++;
    updateUndoRedoUI();
}
function updateUndoRedoUI() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    undoBtn.disabled = historyIndex <= 0;
    undoBtn.style.opacity = historyIndex <= 0 ? 0.5 : 1;
    redoBtn.disabled = historyIndex >= historyStack.length - 1;
    redoBtn.style.opacity = historyIndex >= historyStack.length - 1 ? 0.5 : 1;
}
document.getElementById('undoBtn').onclick = () => {
    if (historyIndex > 0) { historyIndex--; particles = JSON.parse(JSON.stringify(historyStack[historyIndex])); render(); updateUndoRedoUI(); }
};
document.getElementById('redoBtn').onclick = () => {
    if (historyIndex < historyStack.length - 1) { historyIndex++; particles = JSON.parse(JSON.stringify(historyStack[historyIndex])); render(); updateUndoRedoUI(); }
};
document.getElementById('clearBtn').onclick = () => { particles=[]; saveState(); render(); };
document.getElementById('randomBtn').onclick = () => { generateRandomParticles(); saveState(); render(); };

// --- 💡 高级功能：自定义上传图形 ---
let customShapeImg = null;
document.getElementById('customShapeUpload').onchange = (e) => {
    if(!e.target.files[0]) return; const r = new FileReader(); 
    r.onload = (ev) => { customShapeImg = new Image(); customShapeImg.src = ev.target.result; customShapeImg.onload = render; };
    r.readAsDataURL(e.target.files[0]);
};

// 颜色记忆系统
let colorHistory = [];
let lastActiveColorInput = 'color1'; 

const ui = {
    canvasRatio: document.getElementById('canvasRatio'), layoutDir: document.getElementById('layoutDir'), bgSplitRatio: document.getElementById('bgSplitRatio'),
    bgType: document.getElementById('bgType'), color1: document.getElementById('color1'), color1Hex: document.getElementById('color1Hex'), color2: document.getElementById('color2'), color2Hex: document.getElementById('color2Hex'), stripeDensity: document.getElementById('stripeDensity'),
    featherRange: document.getElementById('featherRange'), shapeType: document.getElementById('shapeType'), customText: document.getElementById('customText'),
    sizeRange: document.getElementById('sizeRange'), sizeVar: document.getElementById('sizeVar'), unifiedRotation: document.getElementById('unifiedRotation'), angleRange: document.getElementById('angleRange'), angleControl: document.getElementById('angleControl'),
    imgScale: document.getElementById('imgScale'), imgOffsetX: document.getElementById('imgOffsetX'), imgOffsetY: document.getElementById('imgOffsetY'), particleCount: document.getElementById('particleCount'), scatter: document.getElementById('scatter') 
};

function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.style.display = 'block'; }
function hideToast() { document.getElementById('toast').style.display = 'none'; }
function setActiveColorInput(target) { lastActiveColorInput = target; document.getElementById('wrapColor1').classList.remove('active'); document.getElementById('wrapColor2').classList.remove('active'); document.getElementById('wrap' + target.charAt(0).toUpperCase() + target.slice(1)).classList.add('active'); }

function addColorToHistory(hex) {
    hex = hex.toUpperCase(); if(colorHistory[0] === hex) return;
    colorHistory = colorHistory.filter(c => c !== hex); colorHistory.unshift(hex);
    if(colorHistory.length > 8) colorHistory.pop(); 
    document.getElementById('colorHistoryArea').style.display = 'block';
    const palette = document.getElementById('historyPalette'); palette.innerHTML = '';
    colorHistory.forEach(c => {
        const div = document.createElement('div'); div.className = 'swatch'; div.style.background = c;
        div.onclick = () => { applyColor(lastActiveColorInput, c); }; palette.appendChild(div);
    });
}

function applyColor(target, hex) { ui[target].value = hex; ui[target + 'Hex'].value = hex; setActiveColorInput(target); render(); }
document.getElementById('wrapColor1').onclick = () => setActiveColorInput('color1');
document.getElementById('wrapColor2').onclick = () => setActiveColorInput('color2');
document.getElementById('pickColor1').onclick = (e) => { e.stopPropagation(); setActiveColorInput('color1'); pickingColorFor = 'color1'; showToast('🎯 请点击右侧画面提取颜色'); };
document.getElementById('pickColor2').onclick = (e) => { e.stopPropagation(); setActiveColorInput('color2'); pickingColorFor = 'color2'; showToast('🎯 请点击右侧画面提取颜色'); };

document.querySelectorAll('#quickPaletteArea .swatch').forEach(sw => { sw.addEventListener('click', (e) => { const c = e.target.getAttribute('data-c'); applyColor(lastActiveColorInput, c); addColorToHistory(c); }); });
['color1', 'color2'].forEach(target => {
    ui[target].addEventListener('input', e => { ui[target+'Hex'].value = e.target.value.toUpperCase(); render(); });
    ui[target].addEventListener('change', e => { addColorToHistory(e.target.value); }); 
    ui[target+'Hex'].addEventListener('change', e => { if(/^#[0-9A-F]{6}$/i.test(e.target.value)){ applyColor(target, e.target.value); addColorToHistory(e.target.value); } });
});

function updateCanvasSize() {
    const r = ui.canvasRatio.value.split(':'); canvas.width = 1080; canvas.height = Math.round((1080 / parseInt(r[0])) * parseInt(r[1]));
    generateRandomParticles(); render();
}

function generateRandomParticles() {
    particles = []; const count = parseInt(ui.particleCount.value); 
    for(let i=0; i<count; i++) particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, randSize: Math.random(), rotation: Math.random()*Math.PI*2, colorIndex: Math.random()>0.5?0:1 });
}

ui.canvasRatio.onchange = () => { updateCanvasSize(); saveState(); };
ui.bgType.onchange = (e) => { 
    document.getElementById('imageControls').style.display = e.target.value === 'image' ? 'block' : 'none'; 
    document.getElementById('colorControls').style.display = (e.target.value === 'solid' || e.target.value === 'gradient' || e.target.value === 'stripes') ? 'flex' : 'none'; 
    document.getElementById('stripeControls').style.display = e.target.value === 'stripes' ? 'block' : 'none'; render(); 
};
ui.shapeType.onchange = (e) => { 
    ui.customText.style.display = e.target.value === 'text' ? 'block' : 'none'; 
    document.getElementById('customShapeUploadWrapper').style.display = e.target.value === 'custom' ? 'block' : 'none'; render(); 
};
ui.unifiedRotation.onchange = (e) => { ui.angleControl.style.display = e.target.checked ? 'block' : 'none'; render(); };

['layoutDir', 'bgSplitRatio', 'customText', 'angleRange', 'imgScale', 'imgOffsetX', 'imgOffsetY', 'featherRange', 'sizeRange', 'sizeVar', 'particleCount', 'stripeDensity', 'scatter'].forEach(k => {
    if(ui[k]) { ui[k].oninput = ui[k].onchange = () => { if(document.getElementById(k+'Val')) document.getElementById(k+'Val').innerText = ui[k].value; render(); }; }
});

document.getElementById('imageUpload').onchange = (e) => {
    if(!e.target.files[0]) return; const reader = new FileReader(); document.getElementById('imgStatus').innerText = "读取中..."; document.getElementById('imgStatus').style.color = "var(--primary)";
    reader.onload = (ev) => { currentImage = new Image(); currentImage.onload = () => { document.getElementById('imgStatus').innerText = "已加载 ✅"; document.getElementById('imgStatus').style.color = "#10b981"; generateRandomParticles(); saveState(); render(); }; currentImage.src = ev.target.result; };
    reader.readAsDataURL(e.target.files[0]);
};
document.getElementById('bgImageUpload').onchange = (e) => {
    if(!e.target.files[0]) return; const reader = new FileReader(); reader.onload = (ev) => { currentBgImage = new Image(); currentBgImage.onload = render; currentBgImage.src = ev.target.result; }; reader.readAsDataURL(e.target.files[0]);
};

function getPos(e) { const r = canvas.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; return { x: (cx - r.left) * (canvas.width / r.width), y: (cy - r.top) * (canvas.height / r.height) }; }

function startDrawing(e) { 
    if(!currentImage) return; const pos = getPos(e);
    if (pickingColorFor) {
        try {
            const pixel = ctx.getImageData(pos.x, pos.y, 1, 1).data;
            const hex = '#' + ((1<<24) + (pixel[0]<<16) + (pixel[1]<<8) + pixel[2]).toString(16).slice(1).toUpperCase();
            applyColor(pickingColorFor, hex); addColorToHistory(hex);
        } catch(err) { alert('受安全限制，跨域图片可能无法取色。本地图片不受影响。'); }
        pickingColorFor = null; hideToast(); return; 
    }
    isDrawing = true; lastPos = pos; 
}

function moveDrawing(e) {
    if(!isDrawing || pickingColorFor) return; const pos = getPos(e);
    if (Math.hypot(pos.x - lastPos.x, pos.y - lastPos.y) > 15) {
        const scatterVal = parseInt(ui.scatter.value);
        particles.push({ x: pos.x + (Math.random()-0.5) * scatterVal * 2, y: pos.y + (Math.random()-0.5) * scatterVal * 2, randSize: Math.random(), rotation: Math.random()*Math.PI*2, colorIndex: Math.random()>0.5?0:1 });
        lastPos = pos; render();
    }
    if(e.touches && e.cancelable) e.preventDefault();
}
// 结束划线时保存状态以供撤销
function endDrawing() { if(isDrawing) { isDrawing = false; saveState(); } }

canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', moveDrawing); window.addEventListener('mouseup', endDrawing);
canvas.addEventListener('touchstart', startDrawing, {passive: false}); canvas.addEventListener('touchmove', moveDrawing, {passive: false}); canvas.addEventListener('touchend', endDrawing);

function drawShape(ctx, type, size) {
    if(type === 'custom' && customShapeImg) {
        // 自定义图片/SVG 渲染
        ctx.drawImage(customShapeImg, -size/2, -size/2, size, size);
        return false; // 返回 false 表示已经自己填充好了，不需要引擎调用 fill()
    }
    if(type === 'text'){ ctx.font = `bold ${size}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ui.customText.value||'OHH', 0, 0); return false; }
    ctx.beginPath();
    if(type==='circle') { ctx.arc(0,0,size/2,0,Math.PI*2); }
    else if(type==='star') { for(let i=0;i<10;i++){ let r=i%2==0?size/2:size/4; let a=i*Math.PI/5-Math.PI/2; ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } }
    else if(type==='drop') { ctx.moveTo(0,-size/2); ctx.quadraticCurveTo(size/3,0,size/3,size/4); ctx.arc(0,size/4,size/3,0,Math.PI); ctx.quadraticCurveTo(-size/3,0,0,-size/2); }
    else if(type==='heart') { ctx.moveTo(0,size/4); ctx.bezierCurveTo(size/2,-size/4,size/2,-size/1.5,0,-size/3); ctx.bezierCurveTo(-size/2,-size/1.5,-size/2,-size/4,0,size/4); }
    else if(type==='leaf') { ctx.moveTo(0,-size/2); ctx.quadraticCurveTo(size/2,0,0,size/2); ctx.quadraticCurveTo(-size/2,0,0,-size/2); }
    else if(type==='moon') { ctx.arc(0, 0, size/2, Math.PI*0.5, Math.PI*1.5, false); ctx.arc(size/6, 0, size/2.5, Math.PI*1.5, Math.PI*0.5, true); }
    else if(type==='square') { ctx.rect(-size/2, -size/2, size, size); }
    else if(type==='diamond') { ctx.moveTo(0, -size/2); ctx.lineTo(size/2, 0); ctx.lineTo(0, size/2); ctx.lineTo(-size/2, 0); }
    else if(type==='triangle') { ctx.moveTo(0, -size/2); ctx.lineTo(size/2, size/2); ctx.lineTo(-size/2, size/2); }
    ctx.closePath(); return true;
}

function render(drawLimit = particles.length) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!currentImage) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.textAlign = 'center'; ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 80px -apple-system, sans-serif'; ctx.fillText(SITE_CONFIG.title, canvas.width/2, canvas.height/2 - 60);
        ctx.fillStyle = '#64748b'; ctx.font = '36px sans-serif'; ctx.fillText(SITE_CONFIG.subtitle, canvas.width/2, canvas.height/2 + 20);
        ctx.fillStyle = '#94a3b8'; ctx.font = '24px monospace'; ctx.fillText(SITE_CONFIG.author, canvas.width/2, canvas.height/2 + 80);
        return;
    }

    const layout = ui.layoutDir.value; const splitRatio = parseInt(ui.bgSplitRatio.value) / 100;
    let imgR = {x:0, y:0, w:canvas.width, h:canvas.height}; let bgR = {x:0, y:0, w:canvas.width, h:canvas.height};
    if(layout==='top') { imgR.h = canvas.height * (1 - splitRatio); bgR.y = imgR.h; bgR.h = canvas.height * splitRatio; } 
    else if(layout==='bottom') { bgR.h = canvas.height * splitRatio; imgR.y = bgR.h; imgR.h = canvas.height * (1 - splitRatio); } 
    else if(layout==='left') { imgR.w = canvas.width * (1 - splitRatio); bgR.x = imgR.w; bgR.w = canvas.width * splitRatio; } 
    else if(layout==='right') { bgR.w = canvas.width * splitRatio; imgR.x = bgR.w; imgR.w = canvas.width * (1 - splitRatio); }

    let defW = canvas.width, defH = canvas.height;
    if(layout === 'top' || layout === 'bottom') defH = canvas.height / 2;
    if(layout === 'left' || layout === 'right') defW = canvas.width / 2;
    const scale = parseInt(ui.imgScale.value)/100, ox = parseInt(ui.imgOffsetX.value), oy = parseInt(ui.imgOffsetY.value);
    const s = Math.max(defW/currentImage.width, defH/currentImage.height) * scale;
    let defX = layout === 'right' ? canvas.width/2 : 0; let defY = layout === 'bottom' ? canvas.height/2 : 0;
    const dx = defX + (defW - currentImage.width * s) / 2 + ox; const dy = defY + (defH - currentImage.height * s) / 2 + oy;

    if(ui.bgType.value==='image' && currentBgImage){
        let bgs = Math.max(canvas.width/currentBgImage.width, canvas.height/currentBgImage.height);
        ctx.drawImage(currentBgImage, (canvas.width-currentBgImage.width*bgs)/2, (canvas.height-currentBgImage.height*bgs)/2, currentBgImage.width*bgs, currentBgImage.height*bgs);
    } else {
        let g = ctx.createLinearGradient(0,0,canvas.width,canvas.height); g.addColorStop(0,ui.color1.value); g.addColorStop(1,ui.color2.value);
        ctx.fillStyle = ui.bgType.value==='gradient'?g:ui.color1.value; ctx.fillRect(0,0,canvas.width,canvas.height);
        if(ui.bgType.value==='stripes'){ 
            ctx.fillStyle=ui.color2.value; const density = parseInt(ui.stripeDensity.value);
            for(let i=0; i<canvas.width+canvas.height; i+=density*2) ctx.fillRect(i, 0, density, canvas.height); 
        }
    }

    const imgCanvas = document.createElement('canvas'); imgCanvas.width=canvas.width; imgCanvas.height=canvas.height; const iCtx = imgCanvas.getContext('2d');
    iCtx.save(); iCtx.beginPath(); iCtx.rect(imgR.x, imgR.y, imgR.w, imgR.h); iCtx.clip();
    iCtx.drawImage(currentImage, dx, dy, currentImage.width*s, currentImage.height*s); iCtx.restore();

    const rot = ui.unifiedRotation.checked ? ui.angleRange.value*Math.PI/180 : null;
    const feather = parseInt(ui.featherRange.value); const isStripe = ui.bgType.value === 'stripes';
    iCtx.globalCompositeOperation = isStripe ? 'source-over' : 'destination-out';
    const activeParticles = particles.slice(0, drawLimit);
    const baseSize = parseInt(ui.sizeRange.value); const varRatio = parseInt(ui.sizeVar.value) / 100;

    activeParticles.forEach(p => {
        if(p.x>imgR.x && p.x<imgR.x+imgR.w && p.y>imgR.y && p.y<imgR.y+imgR.h){
            iCtx.save(); iCtx.translate(p.x, p.y); iCtx.rotate(rot??p.rotation);
            if(isStripe) iCtx.fillStyle = p.colorIndex === 0 ? ui.color1.value : ui.color2.value;
            else { iCtx.fillStyle='black'; if(feather>0){ iCtx.shadowColor='black'; iCtx.shadowBlur=feather; } }
            const pSize = baseSize * (1 - varRatio) + p.randSize * baseSize * varRatio * 2;
            if(drawShape(iCtx, ui.shapeType.value, pSize)) iCtx.fill(); 
            iCtx.restore();
        }
    });
    ctx.drawImage(imgCanvas, 0, 0);

    activeParticles.forEach(p => {
        if(p.x>bgR.x && p.x<bgR.x+bgR.w && p.y>bgR.y && p.y<bgR.y+bgR.h){
            const pSize = baseSize * (1 - varRatio) + p.randSize * baseSize * varRatio * 2;
            const fCanvas = document.createElement('canvas'); fCanvas.width=pSize*2+feather; fCanvas.height=pSize*2+feather; const fCtx = fCanvas.getContext('2d'); 
            fCtx.translate(pSize+feather/2, pSize+feather/2); fCtx.rotate(rot??p.rotation);
            fCtx.fillStyle='black'; if(feather>0){ fCtx.shadowColor='black'; fCtx.shadowBlur=feather; }
            if(drawShape(fCtx, ui.shapeType.value, pSize)) fCtx.fill();
            fCtx.globalCompositeOperation='source-in'; fCtx.shadowColor='transparent';
            let sx = p.x, sy = p.y; 
            if(layout==='top') sy-=canvas.height * (1-splitRatio); else if(layout==='bottom') sy+=canvas.height * splitRatio; 
            else if(layout==='left') sx-=canvas.width * (1-splitRatio); else if(layout==='right') sx+=canvas.width * splitRatio;
            fCtx.drawImage(currentImage, dx-sx+pSize+feather/2, dy-sy+pSize+feather/2, currentImage.width*s, currentImage.height*s);
            ctx.drawImage(fCanvas, p.x-pSize-feather/2, p.y-pSize-feather/2);
        }
    });
}

function playAnimation(onComplete = null) {
    if(!currentImage) return; if(animationFrameId) cancelAnimationFrame(animationFrameId);
    let startTime = null; const TOTAL_DURATION = 2500; 
    function step(timestamp) {
        if(!startTime) startTime = timestamp;
        let progress = Math.min((timestamp - startTime) / TOTAL_DURATION, 1);
        let easeOutProgress = 1 - Math.pow(1 - progress, 3);
        render(Math.floor(easeOutProgress * particles.length));
        if(progress < 1) animationFrameId = requestAnimationFrame(step);
        else if(onComplete) onComplete();
    }
    requestAnimationFrame(step);
}

document.getElementById('previewAnimBtn').onclick = () => { playAnimation(); };
document.getElementById('downloadPngBtn').onclick = () => { if(!currentImage)return; render(); const a=document.createElement('a'); a.download=`波点拼贴_${Date.now()}.png`; a.href=canvas.toDataURL('image/png'); a.click(); };
document.getElementById('recordAnimBtn').onclick = (e) => {
    if(!currentImage) return; const btn = e.target;
    if (!isRecording) {
        const stream = canvas.captureStream(30); const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : (MediaRecorder.isTypeSupported('video/webm; codecs=vp9') ? 'video/webm; codecs=vp9' : 'video/webm');
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
        mediaRecorder.ondataavailable = ev => { if (ev.data.size > 0) recordedChunks.push(ev.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mimeType }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; 
            a.download = `波点拼贴_Live_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`; a.click(); URL.revokeObjectURL(url);
            btn.innerHTML = "🎥 导出动态实况视频 (MP4)"; btn.classList.replace('btn-success', 'btn-danger'); isRecording = false;
        };
        mediaRecorder.start(); isRecording = true; btn.innerHTML = "⏳ 正在录制动效中..."; btn.classList.replace('btn-danger', 'btn-success'); recordedChunks = [];
        playAnimation(() => { setTimeout(() => mediaRecorder.stop(), 500); });
    }
};

updateCanvasSize();
updateUndoRedoUI();