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
    private readonly _stateFilePath: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _globalStoragePath: string
    ) {
        // 使用全局存储路径保存状态文件
        this._stateFilePath = path.join(_globalStoragePath, 'cat-state.json');
        
        // 确保目录存在
        if (!fs.existsSync(_globalStoragePath)) {
            fs.mkdirSync(_globalStoragePath, { recursive: true });
        }
        
        // Load saved state immediately
        this._loadState();
        console.log('[FeedCat] State file path:', this._stateFilePath);
        console.log('[FeedCat] Loaded state:', this._totalKeystrokes, this._fishEaten);
    }

    private _loadState() {
        try {
            if (fs.existsSync(this._stateFilePath)) {
                const data = fs.readFileSync(this._stateFilePath, 'utf8');
                const state: CatState = JSON.parse(data);
                console.log('[FeedCat] Raw state from file:', state);
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
            const state: CatState = {
                totalKeystrokes: this._totalKeystrokes,
                keystrokeCount: this._keystrokeCount,
                fishEaten: this._fishEaten
            };
            console.log('[FeedCat] Saving state to file:', state);
            fs.writeFileSync(this._stateFilePath, JSON.stringify(state, null, 2), 'utf8');
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
            position: absolute; top: 8px; right: 12px; width: 24px; height: 24px;
            background: radial-gradient(circle, #FFD54F 0%, #FF9800 100%);
            border-radius: 50%; box-shadow: 0 0 12px #FFD54F;
        }
        .cloud {
            position: absolute; top: 12px; left: 12px; width: 30px; height: 12px;
            background: white; border-radius: 12px; opacity: 0.9;
        }
        .cloud::before {
            content: ''; position: absolute; width: 14px; height: 14px;
            background: white; border-radius: 50%; top: -7px; left: 6px;
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
        #counter {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            color: #FFD700;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            border: 1.5px solid #FFD700;
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
    <div class="sun"></div>
    <div class="cloud"></div>
    <div class="ground"></div>
    <div id="stats">⌨️ <span id="keystroke-count">0</span> &nbsp;|&nbsp; 🐟 <span id="fish-count">0</span></div>
    <div id="game-container">
        <div id="cat-wrapper">
            <div id="counter">0</div>
            <div id="cat"></div>
        </div>
    </div>

    <script nonce="${nonce}">
    (function() {
        const vscode = acquireVsCodeApi();

        const FRAME_SIZE = 32;
        const COLS = 8;
        const ROWS = 10;
        const SCALE = 1.5;
        const DISPLAY_SIZE = FRAME_SIZE * SCALE;

        const ANIMS = {
            idle: { 
                frames: [
                    {r:0,c:0}, {r:0,c:1}, {r:0,c:2}, {r:0,c:3},
                    {r:1,c:0}, {r:1,c:1}, {r:1,c:2}, {r:1,c:3}
                ],
                speed: 180
            },
            clean: {
                frames: [
                    {r:2,c:0}, {r:2,c:1}, {r:2,c:2}, {r:2,c:3},
                    {r:3,c:0}, {r:3,c:1}, {r:3,c:2}, {r:3,c:3}
                ],
                speed: 150
            },
            walk: {
                frames: [
                    {r:4,c:0}, {r:4,c:1}, {r:4,c:2}, {r:4,c:3},
                    {r:4,c:4}, {r:4,c:5}, {r:4,c:6}, {r:4,c:7}
                ],
                speed: 100
            },
            run: {
                frames: [
                    {r:5,c:0}, {r:5,c:1}, {r:5,c:2}, {r:5,c:3},
                    {r:5,c:4}, {r:5,c:5}, {r:5,c:6}, {r:5,c:7}
                ],
                speed: 60
            },
            sleep: {
                frames: [
                    {r:6,c:0}, {r:6,c:1}, {r:6,c:2}, {r:6,c:3}
                ],
                speed: 300
            },
            eat: {
                frames: [
                    {r:7,c:0}, {r:7,c:1}, {r:7,c:2}, {r:7,c:3}, {r:7,c:4}, {r:7,c:5}
                ],
                speed: 120
            },
            jump: {
                frames: [
                    {r:8,c:0}, {r:8,c:1}, {r:8,c:2}, {r:8,c:3},
                    {r:8,c:4}, {r:8,c:5}, {r:8,c:6}
                ],
                speed: 100
            },
            scared: {
                frames: [
                    {r:9,c:0}, {r:9,c:1}, {r:9,c:2}, {r:9,c:3},
                    {r:9,c:4}, {r:9,c:5}, {r:9,c:6}, {r:9,c:7}
                ],
                speed: 80
            }
        };

        const catEl = document.getElementById('cat');
        const catWrapper = document.getElementById('cat-wrapper');
        const counterEl = document.getElementById('counter');
        const gameContainer = document.getElementById('game-container');
        const fishCountEl = document.getElementById('fish-count');
        const keystrokeCountEl = document.getElementById('keystroke-count');

        catEl.style.backgroundSize = (COLS * DISPLAY_SIZE) + 'px ' + (ROWS * DISPLAY_SIZE) + 'px';
        catEl.style.width = DISPLAY_SIZE + 'px';
        catEl.style.height = DISPLAY_SIZE + 'px';
        catWrapper.style.width = DISPLAY_SIZE + 'px';

        let catX = 10;
        let targetX = 10;
        let facingLeft = false;
        let currentAnim = 'idle';
        let frameIndex = 0;
        let lastFrameTime = 0;
        let state = 'idle';
        let stateTimer = 0;
        let nextStateTime = 2000;
        let isEating = false;
        let targetFish = null;
        let fishes = [];
        let fishEaten = 0;
        let keystrokeCount = 0;

        function setFrame(animName, index) {
            const anim = ANIMS[animName];
            if (!anim || !anim.frames || index >= anim.frames.length) return;
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
            switch (newState) {
                case 'idle': setAnimation('idle'); break;
                case 'clean': setAnimation('clean'); break;
                case 'walk': setAnimation('walk'); break;
                case 'run': setAnimation('run'); break;
                case 'sleep': setAnimation('sleep'); break;
                case 'eat': setAnimation('eat'); break;
            }
        }

        function getBounds() {
            const rect = gameContainer.getBoundingClientRect();
            return { minX: 5, maxX: Math.max(rect.width - DISPLAY_SIZE - 5, 60) };
        }

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

        function eatFish(fish) {
            fish.el.classList.add('eaten');
            setTimeout(function() { fish.el.remove(); }, 300);
            fishes = fishes.filter(function(f) { return f !== fish; });
            fishEaten++;
            fishCountEl.textContent = fishEaten;
            vscode.postMessage({ type: 'fishEaten', count: fishEaten });
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

        function decideNextAction() {
            const bounds = getBounds();
            
            if (fishes.length > 0 && !isEating) {
                targetFish = findNearestFish();
                if (targetFish) {
                    targetX = targetFish.x;
                    setState('run');
                    return;
                }
            }

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

        function updateCounter(count) {
            keystrokeCount = count;
            counterEl.textContent = count;
            keystrokeCountEl.textContent = count.toLocaleString();
        }

        let lastTime = 0;
        function gameLoop(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const dt = timestamp - lastTime;
            lastTime = timestamp;

            const anim = ANIMS[currentAnim];
            if (anim && anim.frames) {
                if (timestamp - lastFrameTime >= anim.speed) {
                    frameIndex = (frameIndex + 1) % anim.frames.length;
                    setFrame(currentAnim, frameIndex);
                    lastFrameTime = timestamp;
                }
            }

            stateTimer += dt;

            if (state === 'walk' || state === 'run') {
                const speed = state === 'run' ? 0.1 : 0.04;
                const dx = targetX - catX;
                
                if (Math.abs(dx) > 2) {
                    facingLeft = dx < 0;
                    catX += (dx > 0 ? 1 : -1) * speed * dt;
                    const bounds = getBounds();
                    if (catX < bounds.minX) catX = bounds.minX;
                    if (catX > bounds.maxX) catX = bounds.maxX;
                } else {
                    if (targetFish && fishes.indexOf(targetFish) !== -1) {
                        isEating = true;
                        setState('eat');
                        setTimeout(function() {
                            if (targetFish && fishes.indexOf(targetFish) !== -1) {
                                eatFish(targetFish);
                            }
                            targetFish = null;
                            isEating = false;
                            stateTimer = 0;
                            decideNextAction();
                        }, 700);
                    } else {
                        stateTimer = nextStateTime;
                    }
                }
            }

            if (stateTimer >= nextStateTime && !isEating) {
                stateTimer = 0;
                decideNextAction();
            }

            if ((state === 'idle' || state === 'clean' || state === 'sleep') && fishes.length > 0 && !isEating) {
                stateTimer = nextStateTime;
            }

            updateCatPosition();
            requestAnimationFrame(gameLoop);
        }

        window.addEventListener('message', function(e) {
            const msg = e.data;
            switch (msg.type) {
                case 'keystroke':
                    updateCounter(msg.count);
                    if (msg.spawnFish) spawnFish();
                    break;
                case 'init':
                    updateCounter(msg.count || 0);
                    if (msg.fishEaten !== undefined) {
                        fishEaten = msg.fishEaten;
                        fishCountEl.textContent = fishEaten;
                    }
                    break;
                case 'reset':
                    updateCounter(0);
                    fishEaten = 0;
                    fishCountEl.textContent = '0';
                    fishes.forEach(function(f) { f.el.remove(); });
                    fishes = [];
                    break;
                case 'spawnFish':
                    spawnFish();
                    break;
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
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
