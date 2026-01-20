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

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
    <title>Feed Cat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            width: 100%;
            height: 100%;
            min-height: 120px;
            overflow: hidden;
        }

        body {
            background: linear-gradient(180deg, 
                #87CEEB 0%, 
                #7CB342 60%, 
                #558B2F 100%
            );
            position: relative;
            font-family: 'Segoe UI', sans-serif;
        }

        /* Ground */
        .ground {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 40%;
            background: linear-gradient(180deg, #7CB342 0%, #558B2F 100%);
        }

        /* Sun */
        .sun {
            position: absolute;
            top: 5px;
            right: 10px;
            width: 20px;
            height: 20px;
            background: radial-gradient(circle, #FFD54F 0%, #FF9800 100%);
            border-radius: 50%;
            box-shadow: 0 0 10px #FFD54F;
        }

        /* Cloud */
        .cloud {
            position: absolute;
            top: 8px;
            left: 10px;
            width: 25px;
            height: 10px;
            background: white;
            border-radius: 10px;
            opacity: 0.9;
        }
        .cloud::before {
            content: '';
            position: absolute;
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            top: -6px;
            left: 5px;
        }

        /* Game container - fills most of the view */
        #game-container {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            top: 30px;
        }

        /* Cat container */
        #cat-container {
            position: absolute;
            bottom: 5px;
            left: 10px;
            width: 48px;
            height: 48px;
        }

        /* Cat sprite - smaller size for compact view */
        #cat {
            width: 48px;
            height: 48px;
            background-image: url('${spriteUri}');
            background-size: 384px 480px;
            background-repeat: no-repeat;
            image-rendering: pixelated;
            transform-origin: center bottom;
        }

        #cat.flip {
            transform: scaleX(-1);
        }

        /* Counter above cat */
        #counter {
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: #FFD700;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
            z-index: 100;
            border: 1px solid #FFD700;
        }

        /* Fish */
        .fish {
            position: absolute;
            font-size: 16px;
            z-index: 50;
            filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.3));
        }

        .fish.eaten {
            animation: eaten 0.3s ease-out forwards;
        }

        @keyframes eaten {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0); opacity: 0; }
        }

        @keyframes fishDrop {
            0% { transform: translateY(-20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
        }

        .fish.dropping {
            animation: fishDrop 0.3s ease-out forwards;
        }

        /* Stats in corner */
        #stats {
            position: absolute;
            top: 3px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 9px;
            z-index: 200;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
            background: rgba(0,0,0,0.3);
            padding: 2px 8px;
            border-radius: 8px;
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
    
    <div id="stats">
        ⌨️ <span id="keystroke-count">0</span> | 🐟 <span id="fish-count">0</span>
    </div>

    <div id="game-container">
        <div id="cat-container">
            <div id="counter">0</div>
            <div id="cat"></div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Sprite config - 1.5x scale (32->48)
        const FRAME_SIZE = 32;
        const SCALE = 1.5;
        const SCALED_SIZE = FRAME_SIZE * SCALE;
        const COLS = 8;

        const ANIMATIONS = {
            idle: { row: 0, frames: 4, speed: 200 },
            sit: { row: 1, frames: 4, speed: 300 },
            walk: { row: 2, frames: 8, speed: 100 },
            run: { row: 3, frames: 8, speed: 60 },
            eat: { row: 5, frames: 4, speed: 150 }
        };

        let catX = 10;
        let targetX = catX;
        let currentAnimation = 'idle';
        let currentFrame = 0;
        let isFlipped = false;
        let keystrokeCount = 0;
        let fishEaten = 0;
        let fishes = [];
        let isEating = false;
        let targetFish = null;

        const STATES = { IDLE: 'idle', WALKING: 'walking', RUNNING: 'running', SITTING: 'sitting', EATING: 'eating' };
        let catState = STATES.IDLE;
        let stateTimer = 0;
        let nextStateTime = 2000;

        const cat = document.getElementById('cat');
        const catContainer = document.getElementById('cat-container');
        const counter = document.getElementById('counter');
        const gameContainer = document.getElementById('game-container');
        const fishCountEl = document.getElementById('fish-count');
        const keystrokeCountEl = document.getElementById('keystroke-count');

        function getContainerBounds() {
            const rect = gameContainer.getBoundingClientRect();
            return { minX: 5, maxX: Math.max(rect.width - SCALED_SIZE - 5, 60) };
        }

        function setFrame(animation, frame) {
            const anim = ANIMATIONS[animation];
            if (!anim) return;
            const col = frame % COLS;
            const row = anim.row;
            cat.style.backgroundPosition = (-col * SCALED_SIZE) + 'px ' + (-row * SCALED_SIZE) + 'px';
        }

        let lastAnimTime = 0;
        function animateSprite(timestamp) {
            const anim = ANIMATIONS[currentAnimation];
            if (anim && timestamp - lastAnimTime > anim.speed) {
                currentFrame = (currentFrame + 1) % anim.frames;
                setFrame(currentAnimation, currentFrame);
                lastAnimTime = timestamp;
            }
            requestAnimationFrame(animateSprite);
        }

        function updateCatPosition() {
            catContainer.style.left = catX + 'px';
            cat.classList.toggle('flip', isFlipped);
        }

        function spawnFish() {
            const bounds = getContainerBounds();
            const fishX = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
            const fish = document.createElement('div');
            fish.className = 'fish dropping';
            fish.innerHTML = '🐟';
            fish.style.left = fishX + 'px';
            fish.style.bottom = '25px';
            gameContainer.appendChild(fish);
            setTimeout(() => fish.classList.remove('dropping'), 300);
            fishes.push({ element: fish, x: fishX });
        }

        function findNearestFish() {
            if (fishes.length === 0) return null;
            let nearest = null, minDist = Infinity;
            for (const fish of fishes) {
                const dist = Math.abs(fish.x - catX);
                if (dist < minDist) { minDist = dist; nearest = fish; }
            }
            return nearest;
        }

        function eatFish(fish) {
            fish.element.classList.add('eaten');
            setTimeout(() => fish.element.remove(), 300);
            fishes = fishes.filter(f => f !== fish);
            fishEaten++;
            fishCountEl.textContent = fishEaten;
        }

        function changeState(newState) {
            catState = newState;
            currentAnimation = newState === STATES.WALKING ? 'walk' : 
                              newState === STATES.RUNNING ? 'run' : 
                              newState === STATES.SITTING ? 'sit' : 
                              newState === STATES.EATING ? 'eat' : 'idle';
            currentFrame = 0;
        }

        function decideNextAction() {
            const bounds = getContainerBounds();
            if (fishes.length > 0 && !isEating) {
                targetFish = findNearestFish();
                if (targetFish) { targetX = targetFish.x; changeState(STATES.RUNNING); return; }
            }
            const rand = Math.random();
            if (rand < 0.3) {
                targetX = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
                changeState(STATES.WALKING);
                nextStateTime = 3000 + Math.random() * 3000;
            } else if (rand < 0.5) {
                targetX = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
                changeState(STATES.RUNNING);
                nextStateTime = 2000 + Math.random() * 2000;
            } else if (rand < 0.7) {
                changeState(STATES.SITTING);
                nextStateTime = 3000 + Math.random() * 4000;
            } else {
                changeState(STATES.IDLE);
                nextStateTime = 2000 + Math.random() * 3000;
            }
        }

        let lastTime = 0;
        function gameLoop(timestamp) {
            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;
            stateTimer += deltaTime;
            const bounds = getContainerBounds();

            if (catState === STATES.WALKING || catState === STATES.RUNNING) {
                const speed = catState === STATES.RUNNING ? 0.12 : 0.05;
                const dx = targetX - catX;
                if (Math.abs(dx) > 2) {
                    isFlipped = dx < 0;
                    catX += Math.sign(dx) * speed * deltaTime;
                    catX = Math.max(bounds.minX, Math.min(bounds.maxX, catX));
                } else {
                    if (targetFish && fishes.includes(targetFish)) {
                        isEating = true;
                        changeState(STATES.EATING);
                        setTimeout(() => {
                            if (targetFish && fishes.includes(targetFish)) eatFish(targetFish);
                            targetFish = null;
                            isEating = false;
                            stateTimer = 0;
                            decideNextAction();
                        }, 500);
                    } else {
                        stateTimer = nextStateTime;
                    }
                }
            }

            if (stateTimer >= nextStateTime && !isEating) { stateTimer = 0; decideNextAction(); }
            if ((catState === STATES.IDLE || catState === STATES.SITTING) && fishes.length > 0) stateTimer = nextStateTime;

            updateCatPosition();
            requestAnimationFrame(gameLoop);
        }

        function updateCounter(count) {
            keystrokeCount = count;
            counter.textContent = count;
            keystrokeCountEl.textContent = count.toLocaleString();
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'keystroke':
                    updateCounter(message.count);
                    if (message.spawnFish) spawnFish();
                    break;
                case 'init':
                    updateCounter(message.count);
                    break;
                case 'reset':
                    updateCounter(0);
                    fishEaten = 0;
                    fishCountEl.textContent = '0';
                    fishes.forEach(f => f.element.remove());
                    fishes = [];
                    break;
                case 'spawnFish':
                    spawnFish();
                    break;
            }
        });

        setFrame('idle', 0);
        updateCatPosition();
        requestAnimationFrame(animateSprite);
        requestAnimationFrame(gameLoop);
        vscode.postMessage({ type: 'ready' });
        setTimeout(() => decideNextAction(), 1000);
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
