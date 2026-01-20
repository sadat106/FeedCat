import * as vscode from 'vscode';

export class CatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'feedcat.catView';
    
    private _view?: vscode.WebviewView;
    private _keystrokeCount: number = 0;
    private _totalKeystrokes: number = 0;

    constructor(private readonly _extensionUri: vscode.Uri) {}

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
                    this._view?.webview.postMessage({
                        type: 'init',
                        count: this._totalKeystrokes
                    });
                    break;
            }
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
    }

    public resetCounter() {
        this._keystrokeCount = 0;
        this._totalKeystrokes = 0;
        this._view?.webview.postMessage({
            type: 'reset'
        });
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
            background: linear-gradient(180deg, #87CEEB 0%, #7CB342 60%, #558B2F 100%);
            font-family: 'Segoe UI', sans-serif;
        }
        .ground {
            position: absolute; bottom: 0; left: 0; right: 0; height: 40%;
            background: linear-gradient(180deg, #7CB342 0%, #558B2F 100%);
        }
        .sun {
            position: absolute; top: 5px; right: 10px; width: 20px; height: 20px;
            background: radial-gradient(circle, #FFD54F 0%, #FF9800 100%);
            border-radius: 50%; box-shadow: 0 0 10px #FFD54F;
        }
        .cloud {
            position: absolute; top: 8px; left: 10px; width: 25px; height: 10px;
            background: white; border-radius: 10px; opacity: 0.9;
        }
        .cloud::before {
            content: ''; position: absolute; width: 12px; height: 12px;
            background: white; border-radius: 50%; top: -6px; left: 5px;
        }
        #game-container {
            position: absolute; bottom: 0; left: 0; right: 0; top: 30px;
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
        #counter {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: #FFD700;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
            border: 1px solid #FFD700;
        }
        .fish {
            position: absolute;
            font-size: 16px;
            z-index: 50;
            transition: opacity 0.3s;
        }
        .fish.eaten { opacity: 0; transform: scale(0); }
        #stats {
            position: absolute; top: 3px; left: 50%; transform: translateX(-50%);
            color: white; font-size: 9px; z-index: 200;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
            background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 8px;
        }
        #stats span { color: #FFD700; font-weight: bold; }
    </style>
</head>
<body>
    <div class="sun"></div>
    <div class="cloud"></div>
    <div class="ground"></div>
    <div id="stats">⌨️ <span id="keystroke-count">0</span> | 🐟 <span id="fish-count">0</span></div>
    <div id="game-container">
        <div id="cat-wrapper">
            <div id="counter">0</div>
            <div id="cat"></div>
        </div>
    </div>

    <script nonce="${nonce}">
    (function() {
        const vscode = acquireVsCodeApi();

        // 精灵图配置: 256x320, 8列x10行, 每帧32x32
        const FRAME_W = 32, FRAME_H = 32, COLS = 8, SCALE = 1.5;
        const DISPLAY_W = FRAME_W * SCALE, DISPLAY_H = FRAME_H * SCALE;

        // 动画行定义
        // Row 0-1: Idle, Row 2-3: Clean, Row 4-5: Movement, Row 6: Sleep, Row 7: Paw, Row 8: Jump, Row 9: Scared
        const ANIMS = {
            idle:  { startRow: 0, rowCount: 2, framesPerRow: 8, speed: 150 },
            clean: { startRow: 2, rowCount: 2, framesPerRow: 8, speed: 120 },
            walk:  { startRow: 4, rowCount: 1, framesPerRow: 8, speed: 100 },
            run:   { startRow: 5, rowCount: 1, framesPerRow: 8, speed: 60 },
            sleep: { startRow: 6, rowCount: 1, framesPerRow: 8, speed: 250 },
            eat:   { startRow: 7, rowCount: 1, framesPerRow: 8, speed: 100 },
            jump:  { startRow: 8, rowCount: 1, framesPerRow: 8, speed: 80 },
            scared:{ startRow: 9, rowCount: 1, framesPerRow: 8, speed: 60 }
        };

        // 获取动画的总帧数
        function getTotalFrames(anim) {
            return anim.rowCount * anim.framesPerRow;
        }

        // 根据帧索引获取行列
        function getFramePos(anim, frameIndex) {
            const localFrame = frameIndex % getTotalFrames(anim);
            const rowOffset = Math.floor(localFrame / anim.framesPerRow);
            const col = localFrame % anim.framesPerRow;
            return { row: anim.startRow + rowOffset, col: col };
        }

        // DOM
        const catEl = document.getElementById('cat');
        const catWrapper = document.getElementById('cat-wrapper');
        const counterEl = document.getElementById('counter');
        const gameContainer = document.getElementById('game-container');
        const fishCountEl = document.getElementById('fish-count');
        const keystrokeCountEl = document.getElementById('keystroke-count');

        // 初始化精灵图尺寸
        catEl.style.backgroundSize = (COLS * DISPLAY_W) + 'px ' + (10 * DISPLAY_H) + 'px';
        catEl.style.width = DISPLAY_W + 'px';
        catEl.style.height = DISPLAY_H + 'px';
        catWrapper.style.width = DISPLAY_W + 'px';

        // 游戏状态
        let catX = 10;
        let targetX = 10;
        let facingLeft = false;
        let currentAnim = 'idle';
        let frameIndex = 0;
        let lastFrameTime = 0;
        let state = 'idle'; // idle, clean, walk, run, sleep, eat
        let stateTimer = 0;
        let nextStateTime = 2000;
        let isEating = false;
        let targetFish = null;
        let fishes = [];
        let fishEaten = 0;
        let keystrokeCount = 0;

        // 设置精灵帧 - 最关键的函数，直接设置背景位置
        function setFrame(anim, index) {
            const a = ANIMS[anim];
            if (!a) return;
            const pos = getFramePos(a, index);
            const bgX = -pos.col * DISPLAY_W;
            const bgY = -pos.row * DISPLAY_H;
            catEl.style.backgroundPosition = bgX + 'px ' + bgY + 'px';
        }

        // 设置猫的位置 - 使用 left 而非 transform，翻转用单独的 scaleX
        function updateCatPosition() {
            catWrapper.style.left = catX + 'px';
            catEl.style.transform = facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
        }

        // 切换动画
        function setAnimation(name) {
            if (currentAnim === name) return;
            currentAnim = name;
            frameIndex = 0;
            setFrame(name, 0);
        }

        // 切换状态
        function setState(newState) {
            state = newState;
            switch (newState) {
                case 'idle': setAnimation('idle'); break;
                case 'clean': setAnimation('clean'); break;
                case 'walk': setAnimation('walk'); break;
                case 'run': setAnimation('run'); break;
                case 'sleep': setAnimation('sleep'); break;
                case 'eat': setAnimation('eat'); break;
            }
        }

        // 获取边界
        function getBounds() {
            const rect = gameContainer.getBoundingClientRect();
            return { minX: 5, maxX: Math.max(rect.width - DISPLAY_W - 5, 60) };
        }

        // 生成鱼
        function spawnFish() {
            const bounds = getBounds();
            const x = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
            const fish = document.createElement('div');
            fish.className = 'fish';
            fish.textContent = '🐟';
            fish.style.left = x + 'px';
            fish.style.bottom = '25px';
            gameContainer.appendChild(fish);
            fishes.push({ el: fish, x: x });
        }

        // 吃鱼
        function eatFish(fish) {
            fish.el.classList.add('eaten');
            setTimeout(() => fish.el.remove(), 300);
            fishes = fishes.filter(f => f !== fish);
            fishEaten++;
            fishCountEl.textContent = fishEaten;
        }

        // 找最近的鱼
        function findNearestFish() {
            if (!fishes.length) return null;
            let nearest = null, minD = Infinity;
            for (const f of fishes) {
                const d = Math.abs(f.x - catX);
                if (d < minD) { minD = d; nearest = f; }
            }
            return nearest;
        }

        // 决定下一个行为
        function decideNextAction() {
            const bounds = getBounds();
            
            // 有鱼就去吃
            if (fishes.length > 0 && !isEating) {
                targetFish = findNearestFish();
                if (targetFish) {
                    targetX = targetFish.x;
                    setState('run');
                    return;
                }
            }

            // 随机行为
            const r = Math.random();
            if (r < 0.2) {
                targetX = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
                setState('walk');
                nextStateTime = 4000 + Math.random() * 3000;
            } else if (r < 0.35) {
                targetX = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
                setState('run');
                nextStateTime = 2000 + Math.random() * 2000;
            } else if (r < 0.5) {
                setState('clean');
                nextStateTime = 3000 + Math.random() * 3000;
            } else if (r < 0.65) {
                setState('sleep');
                nextStateTime = 4000 + Math.random() * 4000;
            } else {
                setState('idle');
                nextStateTime = 2000 + Math.random() * 2000;
            }
        }

        // 更新计数器
        function updateCounter(count) {
            keystrokeCount = count;
            counterEl.textContent = count;
            keystrokeCountEl.textContent = count.toLocaleString();
        }

        // 主循环 - 使用固定时间步长避免闪烁
        let lastTime = 0;
        function gameLoop(timestamp) {
            // 计算时间差
            if (!lastTime) lastTime = timestamp;
            const dt = timestamp - lastTime;
            lastTime = timestamp;

            // 更新动画帧
            const anim = ANIMS[currentAnim];
            if (anim && timestamp - lastFrameTime >= anim.speed) {
                frameIndex = (frameIndex + 1) % getTotalFrames(anim);
                setFrame(currentAnim, frameIndex);
                lastFrameTime = timestamp;
            }

            // 更新状态计时
            stateTimer += dt;

            // 处理移动
            if (state === 'walk' || state === 'run') {
                const speed = state === 'run' ? 0.1 : 0.04;
                const dx = targetX - catX;
                
                if (Math.abs(dx) > 2) {
                    facingLeft = dx < 0;
                    catX += Math.sign(dx) * speed * dt;
                    const bounds = getBounds();
                    catX = Math.max(bounds.minX, Math.min(bounds.maxX, catX));
                } else {
                    // 到达目标
                    if (targetFish && fishes.includes(targetFish)) {
                        isEating = true;
                        setState('eat');
                        setTimeout(() => {
                            if (targetFish && fishes.includes(targetFish)) {
                                eatFish(targetFish);
                            }
                            targetFish = null;
                            isEating = false;
                            stateTimer = 0;
                            decideNextAction();
                        }, 600);
                    } else {
                        stateTimer = nextStateTime; // 触发状态切换
                    }
                }
            }

            // 检查是否需要切换状态
            if (stateTimer >= nextStateTime && !isEating) {
                stateTimer = 0;
                decideNextAction();
            }

            // 空闲时发现鱼
            if ((state === 'idle' || state === 'clean' || state === 'sleep') && fishes.length > 0 && !isEating) {
                stateTimer = nextStateTime;
            }

            updateCatPosition();
            requestAnimationFrame(gameLoop);
        }

        // 消息处理
        window.addEventListener('message', e => {
            const msg = e.data;
            switch (msg.type) {
                case 'keystroke':
                    updateCounter(msg.count);
                    if (msg.spawnFish) spawnFish();
                    break;
                case 'init':
                    updateCounter(msg.count);
                    break;
                case 'reset':
                    updateCounter(0);
                    fishEaten = 0;
                    fishCountEl.textContent = '0';
                    fishes.forEach(f => f.el.remove());
                    fishes = [];
                    break;
                case 'spawnFish':
                    spawnFish();
                    break;
            }
        });

        // 初始化
        setFrame('idle', 0);
        updateCatPosition();
        setTimeout(() => decideNextAction(), 1000);
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
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
