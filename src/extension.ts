import * as vscode from 'vscode';
import { CatViewProvider } from './CatViewProvider';

let catViewProvider: CatViewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Feed Cat extension is now active!');

    // Create the cat view provider
    catViewProvider = new CatViewProvider(context.extensionUri);

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
}

export function deactivate() {}
