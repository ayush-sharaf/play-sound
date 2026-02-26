const vscode = require('vscode');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let isEnabled = true;
let extensionContext;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    try {
        console.log('Terminal Sound Error extension is now active!');
        extensionContext = context;

        // Ensure global storage directory exists
        const storagePath = context.globalStorageUri.fsPath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }

        const config = vscode.workspace.getConfiguration('terminalSoundError');
        isEnabled = config.get('enabled', true);

        // Method 1: Stable API - detect when a command finishes with non-zero exit code (VS Code 1.93+)
        if (vscode.window.onDidEndTerminalShellExecution) {
            context.subscriptions.push(
                vscode.window.onDidEndTerminalShellExecution(e => {
                    if (!isEnabled) return;
                    if (e.exitCode !== undefined && e.exitCode !== 0) {
                        playSound();
                    }
                })
            );
        }

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('terminalSoundError.toggle', () => {
                isEnabled = !isEnabled;
                vscode.workspace.getConfiguration('terminalSoundError')
                    .update('enabled', isEnabled, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(
                    `Terminal sound ${isEnabled ? 'enabled' : 'disabled'}`
                );
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('terminalSoundError.testSound', () => {
                playSound();
                vscode.window.showInformationMessage('Playing terminal sound...');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('terminalSoundError.addSound', async () => {
                const options = {
                    canSelectMany: true,
                    openLabel: 'Add Sound',
                    filters: {
                        'Audio Files': ['mp3', 'wav', 'ogg', 'm4a', 'flac']
                    }
                };

                const fileUris = await vscode.window.showOpenDialog(options);
                if (fileUris && fileUris.length > 0) {
                    for (const uri of fileUris) {
                        const fileName = path.basename(uri.fsPath);
                        const destPath = path.join(storagePath, fileName);
                        fs.copyFileSync(uri.fsPath, destPath);
                    }
                    vscode.window.showInformationMessage(`Added ${fileUris.length} sound(s) successfully!`);
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('terminalSoundError.openSoundsFolder', () => {
                vscode.env.openExternal(vscode.Uri.file(storagePath));
            })
        );

        // Listen for configuration changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('terminalSoundError.enabled')) {
                    isEnabled = vscode.workspace.getConfiguration('terminalSoundError').get('enabled', true);
                }
            })
        );

        vscode.window.showInformationMessage('Terminal Sound Error extension activated!');
    } catch (error) {
        console.error('Error activating extension:', error);
        vscode.window.showErrorMessage('Terminal Sound Error failed to activate: ' + error.message);
    }
}

function playSound() {
    try {
        const config = vscode.workspace.getConfiguration('terminalSoundError');
        const volume = config.get('volume', 0.5);
        
        const bundledSoundsDir = path.join(extensionContext.extensionPath, 'sounds');
        const userSoundsDir = extensionContext.globalStorageUri.fsPath;
        
        let audioFiles = [];
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

        // Get bundled sounds
        if (fs.existsSync(bundledSoundsDir)) {
            const bundledFiles = fs.readdirSync(bundledSoundsDir)
                .filter(file => audioExtensions.includes(path.extname(file).toLowerCase()))
                .map(file => path.join(bundledSoundsDir, file));
            audioFiles = audioFiles.concat(bundledFiles);
        }

        // Get user sounds
        if (fs.existsSync(userSoundsDir)) {
            const userFiles = fs.readdirSync(userSoundsDir)
                .filter(file => audioExtensions.includes(path.extname(file).toLowerCase()))
                .map(file => path.join(userSoundsDir, file));
            audioFiles = audioFiles.concat(userFiles);
        }

        if (audioFiles.length === 0) {
            vscode.window.showWarningMessage('No audio files found.');
            return;
        }

        const soundPath = audioFiles[Math.floor(Math.random() * audioFiles.length)];

        if (process.platform === 'linux') {
            exec(`ffplay -nodisp -autoexit -volume ${Math.round(volume * 100)} "${soundPath}" 2>/dev/null || paplay "${soundPath}" 2>/dev/null || aplay "${soundPath}" 2>/dev/null`);
        } else if (process.platform === 'darwin') {
            exec(`afplay "${soundPath}" -v ${volume}`);
        } else if (process.platform === 'win32') {
            exec(`powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync()"`);
        }
    } catch (error) {
        console.error('Error playing sound:', error);
    }
}

function deactivate() {
    console.log('Terminal Sound Error extension deactivated');
}

module.exports = { activate, deactivate };
