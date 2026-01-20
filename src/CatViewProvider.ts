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

        .ground {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 40%;
            background: linear-gradient(180deg, #7CB342 0%, #558B2F 100%);
        }

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

        #game-container {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            top: 30px;
        }

        #cat-container {
            position: absolute;
            bottom: 5px;
            width: 48px;
            height: 48px;
            /* 使用 transform 而不是 left 来移动，避免闪烁 */
            will-change: transform;
        }

        #cat {
            width: 48px;
            height: 48px;
            background-image: url('${spriteUri}');
            background-repeat: no-repeat;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            /* 预加载精灵图，避免闪烁 */
            will-change: background-position;
        }

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

        .fish {
            position: absolute;
            font-size: 16px;
            z-index: 50;
            will-change: transform, opacity;
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
        (function() {
            'use strict';
            
            const vscode = acquireVsCodeApi();

            // ========== 精灵图配置 ==========
            // 精灵图: 256x320, 8列x10行, 每帧32x32
            // Row 0-1: Idle (空闲)
            // Row 2-3: Clean (清洁/舔毛) 
            // Row 4-5: Movement (移动)
            // Row 6: Sleep (睡觉)
            // Row 7: Paw (挥爪/吃东西)
            // Row 8: Jump (跳跃)
            // Row 9: Scared (受惊)
            
            const SPRITE = {
                frameSize: 32,
                scale: 1.5,
                cols: 8,
                rows: 10
            };
            const DISPLAY_SIZE = SPRITE.frameSize * SPRITE.scale; // 48px

            // 动画定义 - 每个动画可以跨多行
            const ANIMATIONS = {
                idle: {
                    frames: [
                        { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
                        { row: 0, col: 4 }, { row: 0, col: 5 }, { row: 0, col: 6 }, { row: 0, col: 7 },
                        { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
                        { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 1, col: 6 }, { row: 1, col: 7 }
                    ],
                    speed: 150
                },
                clean: {
                    frames: [
                        { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
                        { row: 2, col: 4 }, { row: 2, col: 5 }, { row: 2, col: 6 }, { row: 2, col: 7 },
                        { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
                        { row: 3, col: 4 }, { row: 3, col: 5 }, { row: 3, col: 6 }, { row: 3, col: 7 }
                    ],
                    speed: 120
                },
                walk: {
                    frames: [
                        { row: 4, col: 0 }, { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 },
                        { row: 4, col: 4 }, { row: 4, col: 5 }, { row: 4, col: 6 }, { row: 4, col: 7 }
                    ],
                    speed: 80
                },
                run: {
                    frames: [
                        { row: 5, col: 0 }, { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 },
                        { row: 5, col: 4 }, { row: 5, col: 5 }, { row: 5, col: 6 }, { row: 5, col: 7 }
                    ],
                    speed: 50
                },
                sleep: {
                    frames: [
                        { row: 6, col: 0 }, { row: 6, col: 1 }, { row: 6, col: 2 }, { row: 6, col: 3 },
                        { row: 6, col: 4 }, { row: 6, col: 5 }, { row: 6, col: 6 }, { row: 6, col: 7 }
                    ],
                    speed: 200
                },
                eat: {
                    frames: [
                        { row: 7, col: 0 }, { row: 7, col: 1 }, { row: 7, col: 2 }, { row: 7, col: 3 },
                        { row: 7, col: 4 }, { row: 7, col: 5 }, { row: 7, col: 6 }, { row: 7, col: 7 }
                    ],
                    speed: 100
                },
                jump: {
                    frames: [
                        { row: 8, col: 0 }, { row: 8, col: 1 }, { row: 8, col: 2 }, { row: 8, col: 3 },
                        { row: 8, col: 4 }, { row: 8, col: 5 }, { row: 8, col: 6 }, { row: 8, col: 7 }
                    ],
                    speed: 80
                },
                scared: {
                    frames: [
                        { row: 9, col: 0 }, { row: 9, col: 1 }, { row: 9, col: 2 }, { row: 9, col: 3 },
                        { row: 9, col: 4 }, { row: 9, col: 5 }, { row: 9, col: 6 }, { row: 9, col: 7 }
                    ],
                    speed: 60
                }
            };

            // ========== 游戏状态 ==========
            const State = {
                IDLE: 'idle',
                CLEANING: 'cleaning', 
                WALKING: 'walking',
                RUNNING: 'running',
                SLEEPING: 'sleeping',
                EATING: 'eating',
                JUMPING: 'jumping'
            };

            // ========== 猫咪类 ==========
            class Cat {
                constructor(element, container) {
                    this.element = element;
                    this.container = container;
                    this.x = 10;
                    this.targetX = 10;
                    this.facingLeft = false;
                    this.state = State.IDLE;
                    this.animation = 'idle';
                    this.frameIndex = 0;
                    this.lastFrameTime = 0;
                    this.stateTimer = 0;
                    this.nextStateTime = 2000;
                    this.isEating = false;
                    this.targetFish = null;
                    
                    // 预计算精灵图背景尺寸
                    this.bgWidth = SPRITE.cols * DISPLAY_SIZE;
                    this.bgHeight = SPRITE.rows * DISPLAY_SIZE;
                    this.element.style.backgroundSize = this.bgWidth + 'px ' + this.bgHeight + 'px';
                    
                    this.setFrame(0);
                    this.updatePosition();
                }

                getBounds() {
                    const rect = this.container.getBoundingClientRect();
                    return {
                        minX: 5,
                        maxX: Math.max(rect.width - DISPLAY_SIZE - 5, 60)
                    };
                }

                setFrame(index) {
                    const anim = ANIMATIONS[this.animation];
                    if (!anim || !anim.frames[index]) return;
                    
                    const frame = anim.frames[index];
                    const x = -frame.col * DISPLAY_SIZE;
                    const y = -frame.row * DISPLAY_SIZE;
                    this.element.style.backgroundPosition = x + 'px ' + y + 'px';
                }

                setAnimation(name) {
                    if (this.animation === name) return;
                    this.animation = name;
                    this.frameIndex = 0;
                    this.lastFrameTime = 0;
                    this.setFrame(0);
                }

                setState(newState) {
                    if (this.state === newState) return;
                    this.state = newState;
                    
                    switch (newState) {
                        case State.IDLE:
                            this.setAnimation('idle');
                            break;
                        case State.CLEANING:
                            this.setAnimation('clean');
                            break;
                        case State.WALKING:
                            this.setAnimation('walk');
                            break;
                        case State.RUNNING:
                            this.setAnimation('run');
                            break;
                        case State.SLEEPING:
                            this.setAnimation('sleep');
                            break;
                        case State.EATING:
                            this.setAnimation('eat');
                            break;
                        case State.JUMPING:
                            this.setAnimation('jump');
                            break;
                    }
                }

                updatePosition() {
                    // 使用 transform 来移动，比 left 更流畅
                    const scaleX = this.facingLeft ? -1 : 1;
                    this.container.style.transform = 'translateX(' + this.x + 'px) scaleX(' + scaleX + ')';
                }

                updateAnimation(timestamp) {
                    const anim = ANIMATIONS[this.animation];
                    if (!anim) return;

                    if (timestamp - this.lastFrameTime >= anim.speed) {
                        this.frameIndex = (this.frameIndex + 1) % anim.frames.length;
                        this.setFrame(this.frameIndex);
                        this.lastFrameTime = timestamp;
                    }
                }

                update(deltaTime, timestamp, fishes) {
                    this.updateAnimation(timestamp);
                    this.stateTimer += deltaTime;

                    const bounds = this.getBounds();
                    const walkSpeed = 0.04;
                    const runSpeed = 0.12;

                    // 处理移动状态
                    if (this.state === State.WALKING || this.state === State.RUNNING) {
                        const speed = this.state === State.RUNNING ? runSpeed : walkSpeed;
                        const dx = this.targetX - this.x;

                        if (Math.abs(dx) > 3) {
                            this.facingLeft = dx < 0;
                            this.x += Math.sign(dx) * speed * deltaTime;
                            this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.x));
                        } else {
                            // 到达目标
                            if (this.targetFish && fishes.includes(this.targetFish)) {
                                this.isEating = true;
                                this.setState(State.EATING);
                                return { action: 'startEating', fish: this.targetFish };
                            } else {
                                this.stateTimer = this.nextStateTime;
                            }
                        }
                    }

                    // 检查状态切换
                    if (this.stateTimer >= this.nextStateTime && !this.isEating) {
                        this.stateTimer = 0;
                        return { action: 'decideNext' };
                    }

                    // 如果空闲且有鱼，去吃
                    if ((this.state === State.IDLE || this.state === State.CLEANING || 
                         this.state === State.SLEEPING) && fishes.length > 0 && !this.isEating) {
                        this.stateTimer = this.nextStateTime;
                    }

                    this.updatePosition();
                    return null;
                }

                goToFish(fish) {
                    this.targetFish = fish;
                    this.targetX = fish.x;
                    this.setState(State.RUNNING);
                }

                finishEating() {
                    this.targetFish = null;
                    this.isEating = false;
                    this.stateTimer = 0;
                }

                decideNextAction(hasFishes, bounds) {
                    if (hasFishes && !this.isEating) {
                        return 'goToFish';
                    }

                    const rand = Math.random();
                    
                    if (rand < 0.2) {
                        // 走路
                        this.targetX = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
                        this.setState(State.WALKING);
                        this.nextStateTime = 3000 + Math.random() * 3000;
                    } else if (rand < 0.35) {
                        // 跑步
                        this.targetX = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
                        this.setState(State.RUNNING);
                        this.nextStateTime = 2000 + Math.random() * 2000;
                    } else if (rand < 0.5) {
                        // 清洁（舔毛）
                        this.setState(State.CLEANING);
                        this.nextStateTime = 3000 + Math.random() * 3000;
                    } else if (rand < 0.65) {
                        // 睡觉
                        this.setState(State.SLEEPING);
                        this.nextStateTime = 4000 + Math.random() * 4000;
                    } else {
                        // 空闲
                        this.setState(State.IDLE);
                        this.nextStateTime = 2000 + Math.random() * 2000;
                    }
                    
                    return null;
                }
            }

            // ========== 鱼类 ==========
            class Fish {
                constructor(x, container) {
                    this.x = x;
                    this.element = document.createElement('div');
                    this.element.className = 'fish dropping';
                    this.element.textContent = '🐟';
                    this.element.style.left = x + 'px';
                    this.element.style.bottom = '25px';
                    container.appendChild(this.element);
                    
                    setTimeout(() => {
                        this.element.classList.remove('dropping');
                    }, 300);
                }

                remove() {
                    this.element.classList.add('eaten');
                    setTimeout(() => {
                        if (this.element.parentNode) {
                            this.element.parentNode.removeChild(this.element);
                        }
                    }, 300);
                }
            }

            // ========== 游戏主类 ==========
            class Game {
                constructor() {
                    this.catElement = document.getElementById('cat');
                    this.catContainer = document.getElementById('cat-container');
                    this.gameContainer = document.getElementById('game-container');
                    this.counterElement = document.getElementById('counter');
                    this.fishCountElement = document.getElementById('fish-count');
                    this.keystrokeCountElement = document.getElementById('keystroke-count');
                    
                    this.cat = new Cat(this.catElement, this.catContainer);
                    this.fishes = [];
                    this.fishEaten = 0;
                    this.keystrokeCount = 0;
                    
                    this.lastTime = 0;
                    this.running = true;
                    
                    this.init();
                }

                init() {
                    // 开始游戏循环
                    requestAnimationFrame((t) => this.gameLoop(t));
                    
                    // 延迟开始行动
                    setTimeout(() => {
                        this.cat.decideNextAction(this.fishes.length > 0, this.cat.getBounds());
                    }, 1000);
                    
                    // 通知扩展已就绪
                    vscode.postMessage({ type: 'ready' });
                }

                gameLoop(timestamp) {
                    if (!this.running) return;

                    const deltaTime = this.lastTime ? timestamp - this.lastTime : 16;
                    this.lastTime = timestamp;

                    // 更新猫
                    const result = this.cat.update(deltaTime, timestamp, this.fishes);
                    
                    if (result) {
                        switch (result.action) {
                            case 'startEating':
                                setTimeout(() => {
                                    this.eatFish(result.fish);
                                    this.cat.finishEating();
                                    this.cat.decideNextAction(this.fishes.length > 0, this.cat.getBounds());
                                }, 600);
                                break;
                            case 'decideNext':
                                const action = this.cat.decideNextAction(this.fishes.length > 0, this.cat.getBounds());
                                if (action === 'goToFish') {
                                    const nearestFish = this.findNearestFish();
                                    if (nearestFish) {
                                        this.cat.goToFish(nearestFish);
                                    }
                                }
                                break;
                        }
                    }

                    requestAnimationFrame((t) => this.gameLoop(t));
                }

                findNearestFish() {
                    if (this.fishes.length === 0) return null;
                    
                    let nearest = null;
                    let minDist = Infinity;
                    
                    for (const fish of this.fishes) {
                        const dist = Math.abs(fish.x - this.cat.x);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = fish;
                        }
                    }
                    return nearest;
                }

                spawnFish() {
                    const bounds = this.cat.getBounds();
                    const x = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
                    const fish = new Fish(x, this.gameContainer);
                    this.fishes.push(fish);
                }

                eatFish(fish) {
                    fish.remove();
                    this.fishes = this.fishes.filter(f => f !== fish);
                    this.fishEaten++;
                    this.fishCountElement.textContent = this.fishEaten.toString();
                }

                updateCounter(count) {
                    this.keystrokeCount = count;
                    this.counterElement.textContent = count.toString();
                    this.keystrokeCountElement.textContent = count.toLocaleString();
                }

                reset() {
                    this.updateCounter(0);
                    this.fishEaten = 0;
                    this.fishCountElement.textContent = '0';
                    this.fishes.forEach(f => f.remove());
                    this.fishes = [];
                }

                handleMessage(message) {
                    switch (message.type) {
                        case 'keystroke':
                            this.updateCounter(message.count);
                            if (message.spawnFish) {
                                this.spawnFish();
                            }
                            break;
                        case 'init':
                            this.updateCounter(message.count);
                            break;
                        case 'reset':
                            this.reset();
                            break;
                        case 'spawnFish':
                            this.spawnFish();
                            break;
                    }
                }
            }

            // ========== 启动游戏 ==========
            const game = new Game();
            
            window.addEventListener('message', (event) => {
                game.handleMessage(event.data);
            });
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
