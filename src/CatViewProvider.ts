import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface CatState {
    totalKeystrokes: number;
    keystrokeCount: number;
    fishEaten: number;
}

export class CatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'feedcat.catView';
    
    private _view?: vscode.WebviewView;
    private _keystrokeCount: number = 0;
    private _totalKeystrokes: number = 0;
    private _fishEaten: number = 0;
    private readonly _stateFile: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _globalStoragePath: string
    ) {
        // 使用 globalStoragePath 存储状态文件
        this._stateFile = path.join(_globalStoragePath, 'catstate.json');
        console.log('[FeedCat] State file path:', this._stateFile);
        
        // 确保目录存在
        this._ensureStorageDir();
        
        // Load saved state immediately
        this._loadState();
    }

    private _ensureStorageDir() {
        const dir = path.dirname(this._stateFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log('[FeedCat] Created storage directory:', dir);
        }
    }

    private _loadState() {
        try {
            if (fs.existsSync(this._stateFile)) {
                const data = fs.readFileSync(this._stateFile, 'utf8');
                const state: CatState = JSON.parse(data);
                console.log('[FeedCat] Loaded state from file:', state);
                this._totalKeystrokes = state.totalKeystrokes || 0;
                this._keystrokeCount = state.keystrokeCount || 0;
                this._fishEaten = state.fishEaten || 0;
            } else {
                console.log('[FeedCat] No state file found, starting fresh');
            }
        } catch (err) {
            console.error('[FeedCat] Error loading state:', err);
        }
    }

    public saveState() {
        try {
            this._ensureStorageDir();
            const state: CatState = {
                totalKeystrokes: this._totalKeystrokes,
                keystrokeCount: this._keystrokeCount,
                fishEaten: this._fishEaten
            };
            fs.writeFileSync(this._stateFile, JSON.stringify(state), 'utf8');
            console.log('[FeedCat] Saved state to file:', state);
        } catch (err) {
            console.error('[FeedCat] Error saving state:', err);
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'ready':
                    console.log('[FeedCat] Webview ready, sending state:', this._totalKeystrokes, this._fishEaten);
                    this._view?.webview.postMessage({
                        type: 'init',
                        count: this._totalKeystrokes,
                        fishEaten: this._fishEaten
                    });
                    break;
                case 'fishEaten':
                    this._fishEaten = message.count;
                    this.saveState();
                    break;
            }
        });

        webviewView.onDidDispose(() => {
            console.log('[FeedCat] View disposed, saving state');
            this.saveState();
        });
    }

    public onKeystroke() {
        this._keystrokeCount++;
        this._totalKeystrokes++;
        
        const config = vscode.workspace.getConfiguration('feedcat');
        const threshold = config.get<number>('fishThreshold', 1000);
        
        let spawnFish = false;
        if (this._keystrokeCount >= threshold) {
            this._keystrokeCount = 0;
            spawnFish = true;
        }

        this._view?.webview.postMessage({
            type: 'keystroke',
            count: this._totalKeystrokes,
            spawnFish: spawnFish
        });

        // Save state every 50 keystrokes
        if (this._totalKeystrokes % 50 === 0) {
            this.saveState();
        }
    }

    public resetCounter() {
        this._keystrokeCount = 0;
        this._totalKeystrokes = 0;
        this._fishEaten = 0;
        this._view?.webview.postMessage({
            type: 'reset'
        });
        this.saveState();
    }

    public spawnFish() {
        this._view?.webview.postMessage({
            type: 'spawnFish'
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const spriteUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'cat-sprite.png')
        );
        const bgUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'background.png')
        );
        const emotesUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'emotes.png')
        );

        const nonce = getNonce();

        return /*html*/`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
    <title>Feed Cat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; min-height: 120px; overflow: hidden; }
        body {
            background-image: url('${bgUri}');
            background-size: cover;
            background-position: center bottom;
            background-repeat: no-repeat;
            font-family: 'Segoe UI', sans-serif;
        }
        #game-container {
            position: absolute; bottom: 0; left: 0; right: 0; top: 45px;
        }
        #cat-wrapper {
            position: absolute;
            bottom: 5px;
            left: 0;
            width: 48px;
            height: 68px;
        }
        #cat {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 48px;
            height: 48px;
            background-image: url('${spriteUri}');
            background-repeat: no-repeat;
            image-rendering: pixelated;
        }
        #emote {
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 32px;
            height: 32px;
            background-image: url('${emotesUri}');
            background-repeat: no-repeat;
            background-size: 384px 416px;
            image-rendering: pixelated;
            display: none;
            z-index: 100;
        }
        #emote.show {
            display: block;
            animation: emoteFloat 0.5s ease-out;
        }
        @keyframes emoteFloat {
            0% { transform: translateX(-50%) translateY(10px) scale(0.5); opacity: 0; }
            50% { transform: translateX(-50%) translateY(-5px) scale(1.1); opacity: 1; }
            100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        .fish {
            position: absolute;
            font-size: 18px;
            z-index: 50;
        }
        .fish.eaten { opacity: 0; }
        #stats {
            position: absolute;
            top: 6px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 13px;
            font-weight: 500;
            z-index: 200;
            text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
            background: rgba(0,0,0,0.5);
            padding: 5px 14px;
            border-radius: 12px;
            white-space: nowrap;
        }
        #stats span {
            color: #FFD700;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div id="stats">⌨️ <span id="keystroke-count">0</span> &nbsp;|&nbsp; 🐟 <span id="fish-count">0</span></div>
    <div id="game-container">
        <div id="cat-wrapper">
            <div id="emote"></div>
            <div id="cat"></div>
        </div>
    </div>

    <script nonce="${nonce}">
    (function() {
        const vscode = acquireVsCodeApi();

        const FRAME_SIZE = 32, COLS = 8, ROWS = 10, SCALE = 1.5;
        const DISPLAY_SIZE = FRAME_SIZE * SCALE;

        // 物理常量
        const GRAVITY = 0.0004;      // 重力加速度
        const BOUNCE_DAMPING = 0.6;  // 弹跳衰减系数
        const GROUND_Y = 25;         // 地面高度
        const MIN_BOUNCE_VEL = 0.02; // 最小弹跳速度，低于此值停止弹跳

        const ANIMS = {
            idle: { 
                frames: [{r:0,c:0},{r:0,c:1},{r:0,c:2},{r:0,c:3},{r:1,c:0},{r:1,c:1},{r:1,c:2},{r:1,c:3}],
                speed: 180
            },
            clean: {
                frames: [{r:2,c:0},{r:2,c:1},{r:2,c:2},{r:2,c:3},{r:3,c:0},{r:3,c:1},{r:3,c:2},{r:3,c:3}],
                speed: 150
            },
            walk: {
                frames: [{r:4,c:0},{r:4,c:1},{r:4,c:2},{r:4,c:3},{r:4,c:4},{r:4,c:5},{r:4,c:6},{r:4,c:7}],
                speed: 100
            },
            run: {
                frames: [{r:5,c:0},{r:5,c:1},{r:5,c:2},{r:5,c:3},{r:5,c:4},{r:5,c:5},{r:5,c:6},{r:5,c:7}],
                speed: 60
            },
            sleep: {
                frames: [{r:6,c:0},{r:6,c:1},{r:6,c:2},{r:6,c:3}],
                speed: 300
            },
            eat: {
                frames: [{r:7,c:0},{r:7,c:1},{r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5}],
                speed: 120
            }
        };

        const catEl = document.getElementById('cat');
        const catWrapper = document.getElementById('cat-wrapper');
        const emoteEl = document.getElementById('emote');
        const gameContainer = document.getElementById('game-container');
        const fishCountEl = document.getElementById('fish-count');
        const keystrokeCountEl = document.getElementById('keystroke-count');

        // 表情图配置 - 12列 x 13行，每个16x16，放大到32x32显示
        const EMOTE_SIZE = 16;
        const EMOTE_SCALE = 2;
        const EMOTE_COLS = 12;
        // 爱心位置：第7行第2列 (从1开始计数) = (row: 6, col: 1) 从0开始
        const HEART_ROW = 6;
        const HEART_COL = 1;
        let emoteTimer = null;

        catEl.style.backgroundSize = (COLS * DISPLAY_SIZE) + 'px ' + (ROWS * DISPLAY_SIZE) + 'px';
        catEl.style.width = DISPLAY_SIZE + 'px';
        catEl.style.height = DISPLAY_SIZE + 'px';
        catWrapper.style.width = DISPLAY_SIZE + 'px';

        // 设置表情背景位置
        emoteEl.style.backgroundPosition = (-HEART_COL * EMOTE_SIZE * EMOTE_SCALE) + 'px ' + (-HEART_ROW * EMOTE_SIZE * EMOTE_SCALE) + 'px';

        let catX = 10, facingLeft = false;
        let currentAnim = 'idle', frameIndex = 0, lastFrameTime = 0;
        let state = 'idle', stateTimer = 0, nextStateTime = 2000;
        let isEating = false, targetFish = null;
        let fishes = [], fishEaten = 0, keystrokeCount = 0;

        // 显示爱心表情
        function showHeartEmote() {
            if (emoteTimer) {
                clearTimeout(emoteTimer);
            }
            emoteEl.classList.remove('show');
            // 强制重绘以重新触发动画
            void emoteEl.offsetWidth;
            emoteEl.classList.add('show');
            
            emoteTimer = setTimeout(function() {
                emoteEl.classList.remove('show');
                emoteTimer = null;
            }, 5000);
        }

        function setFrame(animName, index) {
            const anim = ANIMS[animName];
            if (!anim || index >= anim.frames.length) return;
            const frame = anim.frames[index];
            catEl.style.backgroundPosition = (-frame.c * DISPLAY_SIZE) + 'px ' + (-frame.r * DISPLAY_SIZE) + 'px';
        }

        function updateCatPosition() {
            catWrapper.style.left = catX + 'px';
            catEl.style.transform = facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
        }

        function setAnimation(name) {
            if (currentAnim === name) return;
            currentAnim = name;
            frameIndex = 0;
            lastFrameTime = 0;
            setFrame(name, 0);
        }

        function setState(newState) {
            state = newState;
            const animMap = {idle:'idle',clean:'clean',walk:'walk',run:'run',sleep:'sleep',eat:'eat'};
            if (animMap[newState]) setAnimation(animMap[newState]);
        }

        function getBounds() {
            const rect = gameContainer.getBoundingClientRect();
            return { 
                minX: 5, 
                maxX: Math.max(rect.width - DISPLAY_SIZE - 5, 60),
                height: rect.height
            };
        }

        // 鱼类 - 带物理属性
        function createFish() {
            const bounds = getBounds();
            const x = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
            const startY = bounds.height || 150; // 从顶部开始掉落
            
            const fish = document.createElement('div');
            fish.className = 'fish';
            fish.textContent = '🐟';
            fish.style.left = x + 'px';
            fish.style.bottom = startY + 'px';
            gameContainer.appendChild(fish);
            
            // 鱼的物理状态
            const fishObj = {
                el: fish,
                x: x,
                y: startY,
                vy: 0,                           // 垂直速度
                vx: (Math.random() - 0.5) * 0.1, // 随机水平速度
                bouncing: true,                   // 是否还在弹跳
                rotation: 0                       // 旋转角度
            };
            
            fishes.push(fishObj);
            
            // 有鱼了，猫立即去追
            if (!isEating && state !== 'eat') {
                targetFish = fishObj;
                setState('run');
            }
        }

        // 更新鱼的物理状态
        function updateFish(fish, dt) {
            if (!fish.bouncing) return;
            
            const bounds = getBounds();
            
            // 应用重力
            fish.vy -= GRAVITY * dt;
            
            // 更新位置
            fish.y += fish.vy * dt;
            fish.x += fish.vx * dt;
            
            // 水平边界反弹
            if (fish.x < bounds.minX) {
                fish.x = bounds.minX;
                fish.vx = Math.abs(fish.vx) * 0.8;
            } else if (fish.x > bounds.maxX) {
                fish.x = bounds.maxX;
                fish.vx = -Math.abs(fish.vx) * 0.8;
            }
            
            // 地面碰撞和弹跳
            if (fish.y <= GROUND_Y) {
                fish.y = GROUND_Y;
                
                // 如果速度足够大，弹跳
                if (Math.abs(fish.vy) > MIN_BOUNCE_VEL) {
                    fish.vy = -fish.vy * BOUNCE_DAMPING;
                    // 弹跳时随机改变水平方向
                    fish.vx = (Math.random() - 0.5) * 0.08;
                    // 旋转效果
                    fish.rotation += (Math.random() - 0.5) * 30;
                } else {
                    // 停止弹跳
                    fish.vy = 0;
                    fish.vx = 0;
                    fish.bouncing = false;
                }
            }
            
            // 更新DOM
            fish.el.style.left = fish.x + 'px';
            fish.el.style.bottom = fish.y + 'px';
            fish.el.style.transform = 'rotate(' + fish.rotation + 'deg)';
        }

        function eatFish(fish) {
            fish.el.classList.add('eaten');
            setTimeout(function() { fish.el.remove(); }, 300);
            fishes = fishes.filter(function(f) { return f !== fish; });
            fishEaten++;
            fishCountEl.textContent = fishEaten;
            vscode.postMessage({ type: 'fishEaten', count: fishEaten });
            
            // 吃到鱼后显示爱心表情
            showHeartEmote();
        }

        function findNearestFish() {
            if (!fishes.length) return null;
            let nearest = null, minD = Infinity;
            for (let i = 0; i < fishes.length; i++) {
                const d = Math.abs(fishes[i].x - catX);
                if (d < minD) { minD = d; nearest = fishes[i]; }
            }
            return nearest;
        }

        // 检查猫是否能抓到鱼（鱼在地面且猫靠近）
        function canCatchFish(fish) {
            const dx = Math.abs(fish.x - catX);
            // 鱼必须在较低位置（接近地面）且猫足够近
            return dx < 15 && fish.y < GROUND_Y + 20;
        }

        function decideNextAction() {
            const bounds = getBounds();
            if (fishes.length > 0 && !isEating) {
                targetFish = findNearestFish();
                if (targetFish) { setState('run'); return; }
            }
            const r = Math.random();
            if (r < 0.2) { setState('walk'); nextStateTime = 4000 + Math.random() * 3000; }
            else if (r < 0.35) { setState('run'); nextStateTime = 2000 + Math.random() * 2000; }
            else if (r < 0.5) { setState('clean'); nextStateTime = 3000 + Math.random() * 3000; }
            else if (r < 0.65) { setState('sleep'); nextStateTime = 4000 + Math.random() * 4000; }
            else { setState('idle'); nextStateTime = 2000 + Math.random() * 2000; }
        }

        function updateCounter(count) {
            keystrokeCount = count;
            keystrokeCountEl.textContent = count.toLocaleString();
        }

        let lastTime = 0;
        function gameLoop(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const dt = timestamp - lastTime;
            lastTime = timestamp;

            // 更新所有鱼的物理
            for (let i = 0; i < fishes.length; i++) {
                updateFish(fishes[i], dt);
            }

            const anim = ANIMS[currentAnim];
            if (anim && timestamp - lastFrameTime >= anim.speed) {
                frameIndex = (frameIndex + 1) % anim.frames.length;
                setFrame(currentAnim, frameIndex);
                lastFrameTime = timestamp;
            }

            stateTimer += dt;
            const bounds = getBounds();

            // 如果有目标鱼，持续追踪
            if (targetFish && fishes.indexOf(targetFish) !== -1 && !isEating) {
                // 更新目标位置（因为鱼可能在移动）
                const targetX = targetFish.x;
                const dx = targetX - catX;
                
                if (state !== 'run') setState('run');
                
                if (Math.abs(dx) > 10) {
                    // 还没追上，继续跑
                    facingLeft = dx < 0;
                    catX += (dx > 0 ? 1 : -1) * 0.12 * dt;
                    catX = Math.max(bounds.minX, Math.min(bounds.maxX, catX));
                } else if (canCatchFish(targetFish)) {
                    // 追上了且鱼在可捕捉位置，开始吃
                    isEating = true;
                    setState('eat');
                    setTimeout(function() {
                        if (targetFish && fishes.indexOf(targetFish) !== -1) {
                            eatFish(targetFish);
                        }
                        targetFish = null;
                        isEating = false;
                        stateTimer = 0;
                        // 检查是否还有其他鱼
                        if (fishes.length > 0) {
                            targetFish = findNearestFish();
                            setState('run');
                        } else {
                            decideNextAction();
                        }
                    }, 700);
                }
                // 如果鱼还在弹跳，猫会继续追
            } else if (state === 'walk' || state === 'run') {
                // 没有目标鱼时的随机移动
                if (!targetFish && fishes.length > 0 && !isEating) {
                    targetFish = findNearestFish();
                    if (targetFish) setState('run');
                }
            }

            if (stateTimer >= nextStateTime && !isEating && !targetFish) { 
                stateTimer = 0; 
                decideNextAction(); 
            }
            
            // 空闲状态发现新鱼
            if ((state === 'idle' || state === 'clean' || state === 'sleep') && fishes.length > 0 && !isEating) {
                targetFish = findNearestFish();
                if (targetFish) setState('run');
            }

            updateCatPosition();
            requestAnimationFrame(gameLoop);
        }

        window.addEventListener('message', function(e) {
            const msg = e.data;
            switch (msg.type) {
                case 'keystroke': updateCounter(msg.count); if (msg.spawnFish) createFish(); break;
                case 'init': updateCounter(msg.count || 0); if (msg.fishEaten !== undefined) { fishEaten = msg.fishEaten; fishCountEl.textContent = fishEaten; } break;
                case 'reset': updateCounter(0); fishEaten = 0; fishCountEl.textContent = '0'; fishes.forEach(function(f) { f.el.remove(); }); fishes = []; break;
                case 'spawnFish': createFish(); break;
            }
        });

        setFrame('idle', 0);
        updateCatPosition();
        setTimeout(decideNextAction, 1000);
        requestAnimationFrame(gameLoop);
        vscode.postMessage({ type: 'ready' });
    })();
    </script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)); }
    return text;
}
