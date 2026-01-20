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
            overflow: hidden;
        }

        body {
            background: linear-gradient(180deg, 
                #87CEEB 0%, 
                #98D8C8 50%, 
                #7CB342 50%, 
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
            height: 50%;
            background: linear-gradient(180deg, #7CB342 0%, #558B2F 100%);
        }

        /* Grass details */
        .grass {
            position: absolute;
            bottom: 50%;
            left: 0;
            right: 0;
            height: 8px;
            background: repeating-linear-gradient(
                90deg,
                transparent,
                transparent 4px,
                #8BC34A 4px,
                #8BC34A 6px
            );
        }

        /* Sun */
        .sun {
            position: absolute;
            top: 8px;
            right: 15px;
            width: 30px;
            height: 30px;
            background: radial-gradient(circle, #FFD54F 0%, #FF9800 100%);
            border-radius: 50%;
            box-shadow: 0 0 20px #FFD54F;
        }

        /* Cloud */
        .cloud {
            position: absolute;
            top: 15px;
            left: 15px;
            width: 40px;
            height: 15px;
            background: white;
            border-radius: 20px;
            opacity: 0.9;
        }
        .cloud::before {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            top: -10px;
            left: 8px;
        }

        /* Game container */
        #game-container {
            position: absolute;
            bottom: 5px;
            left: 5px;
            right: 5px;
            height: 100px;
        }

        /* Cat container */
        #cat-container {
            position: absolute;
            bottom: 0;
            left: 20px;
            width: 64px;
            height: 64px;
        }

        /* Cat sprite */
        #cat {
            width: 64px;
            height: 64px;
            background-image: url('${spriteUri}');
            background-size: 512px 640px;
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
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.75);
            color: #FFD700;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            z-index: 100;
            border: 1.5px solid #FFD700;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }

        #counter::after {
            content: '';
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid rgba(0, 0, 0, 0.75);
        }

        /* Fish */
        .fish {
            position: absolute;
            font-size: 20px;
            z-index: 50;
            filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));
        }

        .fish.eaten {
            animation: eaten 0.3s ease-out forwards;
        }

        @keyframes eaten {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0); opacity: 0; }
        }

        @keyframes fishDrop {
            0% { 
                transform: translateY(-30px) rotate(0deg); 
                opacity: 0;
            }
            20% {
                opacity: 1;
            }
            100% { 
                transform: translateY(0) rotate(10deg); 
                opacity: 1;
            }
        }

        .fish.dropping {
            animation: fishDrop 0.4s ease-out forwards;
        }

        /* Stats */
        #stats {
            position: absolute;
            top: 5px;
            left: 5px;
            color: white;
            font-size: 10px;
            z-index: 200;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
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
    <div class="grass"></div>
    <div class="ground"></div>
    
    <div id="stats">
        🐟 <span id="fish-count">0</span>
    </div>

    <div id="game-container">
        <div id="cat-container">
            <div id="counter">0 ⌨️</div>
            <div id="cat"></div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Sprite configuration
        const FRAME_SIZE = 32;
        const SCALE = 2;
        const SCALED_SIZE = FRAME_SIZE * SCALE;
        const COLS = 8;

        // Animation definitions
        const ANIMATIONS = {
            idle: { row: 0, frames: 4, speed: 200 },
            sit: { row: 1, frames: 4, speed: 300 },
            walk: { row: 2, frames: 8, speed: 100 },
            run: { row: 3, frames: 8, speed: 60 },
            jump: { row: 4, frames: 8, speed: 80 },
            eat: { row: 5, frames: 4, speed: 150 },
            sleep: { row: 6, frames: 4, speed: 400 },
            meow: { row: 7, frames: 4, speed: 150 }
        };

        // Game state
        let catX = 20;
        let targetX = catX;
        let currentAnimation = 'idle';
        let currentFrame = 0;
        let isFlipped = false;
        let keystrokeCount = 0;
        let fishEaten = 0;
        let fishes = [];
        let isEating = false;
        let targetFish = null;

        // Cat states
        const STATES = {
            IDLE: 'idle',
            WALKING: 'walking',
            RUNNING: 'running',
            SITTING: 'sitting',
            EATING: 'eating'
        };
        let catState = STATES.IDLE;
        let stateTimer = 0;
        let nextStateTime = 2000;

        // DOM elements
        const cat = document.getElementById('cat');
        const catContainer = document.getElementById('cat-container');
        const counter = document.getElementById('counter');
        const gameContainer = document.getElementById('game-container');
        const fishCountEl = document.getElementById('fish-count');

        // Get container bounds
        function getContainerBounds() {
            const rect = gameContainer.getBoundingClientRect();
            return {
                minX: 5,
                maxX: Math.max(rect.width - SCALED_SIZE - 5, 50)
            };
        }

        // Set sprite frame
        function setFrame(animation, frame) {
            const anim = ANIMATIONS[animation];
            if (!anim) return;
            
            const col = frame % COLS;
            const row = anim.row;
            const x = -col * SCALED_SIZE;
            const y = -row * SCALED_SIZE;
            
            cat.style.backgroundPosition = x + 'px ' + y + 'px';
        }

        // Animation loop
        let lastAnimTime = 0;
        function animateSprite(timestamp) {
            const anim = ANIMATIONS[currentAnimation];
            if (!anim) {
                requestAnimationFrame(animateSprite);
                return;
            }

            if (timestamp - lastAnimTime > anim.speed) {
                currentFrame = (currentFrame + 1) % anim.frames;
                setFrame(currentAnimation, currentFrame);
                lastAnimTime = timestamp;
            }

            requestAnimationFrame(animateSprite);
        }

        // Update cat position
        function updateCatPosition() {
            catContainer.style.left = catX + 'px';
            cat.classList.toggle('flip', isFlipped);
        }

        // Spawn fish
        function spawnFish() {
            const bounds = getContainerBounds();
            const fishX = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
            
            const fish = document.createElement('div');
            fish.className = 'fish dropping';
            fish.innerHTML = '🐟';
            fish.style.left = fishX + 'px';
            fish.style.bottom = '30px';
            
            gameContainer.appendChild(fish);
            
            setTimeout(() => {
                fish.classList.remove('dropping');
            }, 400);
            
            fishes.push({
                element: fish,
                x: fishX
            });
        }

        // Find nearest fish
        function findNearestFish() {
            if (fishes.length === 0) return null;
            
            let nearest = null;
            let minDist = Infinity;
            
            for (const fish of fishes) {
                const dist = Math.abs(fish.x - catX);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = fish;
                }
            }
            
            return nearest;
        }

        // Eat fish
        function eatFish(fish) {
            fish.element.classList.add('eaten');
            setTimeout(() => {
                fish.element.remove();
            }, 300);
            
            fishes = fishes.filter(f => f !== fish);
            fishEaten++;
            fishCountEl.textContent = fishEaten;
        }

        // Change cat state
        function changeState(newState) {
            catState = newState;
            
            switch (newState) {
                case STATES.IDLE:
                    currentAnimation = 'idle';
                    break;
                case STATES.WALKING:
                    currentAnimation = 'walk';
                    break;
                case STATES.RUNNING:
                    currentAnimation = 'run';
                    break;
                case STATES.SITTING:
                    currentAnimation = 'sit';
                    break;
                case STATES.EATING:
                    currentAnimation = 'eat';
                    break;
            }
            
            currentFrame = 0;
        }

        // Decide next action
        function decideNextAction() {
            const bounds = getContainerBounds();
            
            // If there are fish, go eat them
            if (fishes.length > 0 && !isEating) {
                targetFish = findNearestFish();
                if (targetFish) {
                    targetX = targetFish.x;
                    changeState(STATES.RUNNING);
                    return;
                }
            }
            
            // Random behavior
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

        // Game loop
        let lastTime = 0;
        function gameLoop(timestamp) {
            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;

            stateTimer += deltaTime;

            const bounds = getContainerBounds();

            const walkSpeed = 0.06;
            const runSpeed = 0.15;

            if (catState === STATES.WALKING || catState === STATES.RUNNING) {
                const speed = catState === STATES.RUNNING ? runSpeed : walkSpeed;
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
                            if (targetFish && fishes.includes(targetFish)) {
                                eatFish(targetFish);
                            }
                            targetFish = null;
                            isEating = false;
                            stateTimer = 0;
                            decideNextAction();
                        }, 600);
                    } else {
                        stateTimer = nextStateTime;
                    }
                }
            }

            if (stateTimer >= nextStateTime && !isEating) {
                stateTimer = 0;
                decideNextAction();
            }

            if ((catState === STATES.IDLE || catState === STATES.SITTING) && fishes.length > 0) {
                stateTimer = nextStateTime;
            }

            updateCatPosition();
            requestAnimationFrame(gameLoop);
        }

        // Update counter display
        function updateCounter(count) {
            keystrokeCount = count;
            counter.textContent = count.toLocaleString() + ' ⌨️';
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'keystroke':
                    updateCounter(message.count);
                    if (message.spawnFish) {
                        spawnFish();
                    }
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

        // Initialize
        setFrame('idle', 0);
        updateCatPosition();
        requestAnimationFrame(animateSprite);
        requestAnimationFrame(gameLoop);

        vscode.postMessage({ type: 'ready' });

        setTimeout(() => {
            decideNextAction();
        }, 1000);
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
