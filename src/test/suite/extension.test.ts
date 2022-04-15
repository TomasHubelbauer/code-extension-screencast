import * as path from 'path';
import fetch from 'node-fetch';
import * as ws from 'ws';
import * as fs from 'fs-extra';
import * as vscode from 'vscode';
const apng = require('node-apng');

function defer<T>() {
  let resolve: (value: T) => void = undefined!;
  let reject: (reason: any) => void = undefined!;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  if (!resolve || !reject) {
    throw new Error('Settlement methods have not been bound!');
  }

  return { promise, resolve, reject };
}

async function retry<T>(action: () => Promise<T>) {
  let attempt = 1;
  do {
    try {
      return await action();
    }
    catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } while (attempt < 5);

  throw new Error(`Failed to invoke action successfuly in ${attempt} attempts.`);
}

suite("Extension Tests", function () {
  test("Screenshot", async function () {
    // Generate the demo file
    console.log('Generating the demo file');

    // Go up and out of the directory with the test version of VS Code in it
    const directoryPath = '../../demo';
    await fs.emptyDir(directoryPath);
    const filePath = path.resolve(path.join(directoryPath, 'readme.md'));
    await fs.writeFile(filePath, '');

    // Open the demo file in the VS Code instance used for testing
    console.log('Opening the demo file');
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);

    // Wait for the document to open in VS Code
    // TODO: Figure out how to detect this better, the VS Code API resolves too soon
    console.log('Waiting for the document to open and syntax highlighting to kick in');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Download the debugger connection information
    // https://chromedevtools.github.io/devtools-protocol/#endpoints
    // chrome://inspect
    console.log('Downloading the debugger connection information');
    const response = await retry(() => fetch('http://localhost:9229/json'));
    const data = await response.json();
    const url = data[0].webSocketDebuggerUrl as string;

    // Wait for the web socket to be ready
    // TODO: Implement a retry mechanism instead, sometimes in GitHub Actions this fails otherwise
    console.log('Waiting for the web socket to be ready');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Connect to the debugger web socket
    console.log('Connecting to the debugger web socket');
    const socket = new ws(url, { perMessageDeflate: false });
    await new Promise(resolve => socket.once('open', resolve));

    let done = false;
    let progress = 0;
    new Promise(async () => {
      const editor = vscode.window.activeTextEditor!;
      const content = [
        '# VS Code Extension `npm test` Screenshot',
        '',
        'This screenshot was captured completely automatically for the purpose of',
        'VS Code extension documentation generation.',
        '',
        `It was captured on *${new Date().toLocaleString()}*.`,
        '',
        '## How does it work?',
        '',
        '1. Find VS Code process IDs',
        '2. Find main VS Code process ID (is its own PPID)',
        '3. Attach debugger to the main VS Code process ID',
        '4. Download debugger connection information',
        '5. Connect to the web socket and use CDP',
        '6. Issue CDP command Runtime.evaluate running webContents.capturePage repeatedly',
        '7. Use the VS Code API from the test runner to manipulate VS Code and your extension',
        '8. Stich the individual screenshots into an APNG and embed in in the readme',
        '10. Profit? Hah! This is open source you fool',
        '',
        '## Who made this?',
        '',
        '[Tomas Hubelbauer](https://hubelbauer.net)',
      ].join('\n') + '\n';

      // Make for a dramatic opening
      await new Promise(resolve => setTimeout(resolve, 500));

      for (let index = 0; index < content.length; index++) {
        await editor.edit(editBuilder => editBuilder.insert(editor.selection.end, content[index]));

        // Slow down the pace of the typing
        await new Promise(resolve => setTimeout(resolve, 20));

        progress = index / content.length;
      }

      // Make for a dramatic closing
      await new Promise(resolve => setTimeout(resolve, 2000));
      done = true;
    });

    // Defer anticipated messages to promises based on callbacks
    console.log('Deferring anticipated messages to promises based on callbacks');
    let index = 0;
    let deferred = defer<string>();
    socket.on('message', async data => {
      //console.log('Processing a message', (data as any).id);

      const { id, result, error, ...rest } = JSON.parse(data.toString());
      if (id !== index || !result || !result.result || result.result.type !== 'string' || !result.result.value || error) {
        deferred.reject({ id, result, error, rest });
      }

      deferred.resolve(result.result.value);
      deferred = defer<string>();
    });

    const buffers: Buffer[] = [];
    const fps = 10;
    do {
      console.log('Recording the screencast', ~~(progress * 100), '%');

      // Evaluate the expression which logs the screenshot data URL to the console
      // Note that `Page.captureScreenshot` cannot be used probably due to this being Node not Electron
      //console.log('Evaluating the expression which captures the screenshot', ~~(progress * 100), '%');

      // Note that we are sending a data URI of the image as we cannot send the `NativeImage` instance itself
      const expression = `process.mainModule.require('electron').webContents.getFocusedWebContents().capturePage().then(nativeImage => nativeImage.toDataURL())`;
      socket.send(JSON.stringify({ id: index, method: 'Runtime.evaluate', params: { expression, awaitPromise: true } }));

      // Await the evaluation completion with the screenshot data URL
      //console.log('Awaiting the evaluation completion with the data URL', ~~(progress * 100), '%');
      const dataUrl = await deferred.promise;

      // Bufferize the data URL
      //console.log('Bufferizing the screenshot Base64', ~~(progress * 100), '%');
      const buffer = Buffer.from(dataUrl.substring('data:image/png;base64,'.length), 'base64');
      buffers.push(buffer);

      await new Promise(resolve => setTimeout(resolve, 100 / fps));

      index++;
    } while (!done);

    // Save the screenshot to an APNG file
    console.log('Saving the screencast buffer');
    // Note that in local, `process.cwd()` is in `.vscode-test/vscode-version`
    const screencastPath = path.resolve((process.cwd().includes('.vscode-test') ? '../../' : '') + `screencast-${process.platform}.apng`);
    const buffer = apng(buffers, () => ({ numerator: 1, denominator: fps }));
    await fs.writeFile(screencastPath, buffer);
    console.log('Screencast saved:', screencastPath);

    // Delete the temporary demo file
    console.log('Deleting the temporary demo file');
    await fs.remove(directoryPath);
  }).timeout(Number.MAX_SAFE_INTEGER);
});
