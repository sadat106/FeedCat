import * as vscode from 'vscode';
import { CatViewProvider } from './CatViewProvider';

let catViewProvider: CatViewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('[FeedCat] Extension activating...');
    
    // 使用 globalStorageUri 作为持久化存储路径
    const storagePath = context.globalStorageUri.fsPath;
    console.log('[FeedCat] Storage path:', storagePath);

    // Create the cat view provider with file-based storage
    catViewProvider = new CatViewProvider(context.extensionUri, storagePath);

    // Register the webview view provider in Explorer sidebar
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            CatViewProvider.viewType,
            catViewProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register commands
    const showCommand = vscode.commands.registerCommand('feedcat.show', () => {
        vscode.commands.executeCommand('feedcat.catView.focus');
    });

    const resetCommand = vscode.commands.registerCommand('feedcat.reset', () => {
        catViewProvider.resetCounter();
        vscode.window.showInformationMessage('🐱 Cat counter has been reset!');
    });

    const spawnFishCommand = vscode.commands.registerCommand('feedcat.spawnFish', () => {
        catViewProvider.spawnFish();
    });

    context.subscriptions.push(showCommand, resetCommand, spawnFishCommand);

    // Listen for text document changes (keystrokes)
    const keystrokeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0) {
            for (const change of event.contentChanges) {
                const addedLength = change.text.length;
                if (addedLength > 0) {
                    for (let i = 0; i < Math.min(addedLength, 10); i++) {
                        catViewProvider.onKeystroke();
                    }
                } else if (change.rangeLength > 0) {
                    catViewProvider.onKeystroke();
                }
            }
        }
    });

    context.subscriptions.push(keystrokeDisposable);
    
    console.log('[FeedCat] Extension activated!');
}

export function deactivate() {
    console.log('[FeedCat] Extension deactivating, saving state...');
    if (catViewProvider) {
        catViewProvider.saveState();
    }
    console.log('[FeedCat] Extension deactivated');
}
