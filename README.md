# VS Code `npm test` Screenshot

Windows:

![](screencast-win32.apng)

Linux:

![](screencast-linux.apng)

This repository contains a VS Code extension which has a faux test which does
the following:

- Instruments the VS Code instance to start with the `--inspect` launch argument
- Dresses the extension host window by opening a generated demo MarkDown doc
- Attaches a debugger to self and connects to the debugger using CDP over WS
- Executes a script within the context of the host to capture its screenshot

This is a proof of concept and I plan on making it into a library which could be
used by any VS Code extension. The utility of this would be to in addition to
having a normal test suite have a test suite which would generates screenshots
showcasing the extension functionality for the docs and the readme.

## Running

```sh
npm compile
node ./out/test/runTest.js
# screencast-*.apng
```

## To-Do

### Package this as a library for use in VS Code extension building

The library will need to have a pre-requisite of `--inspect` in `launchArgs`
unless I figure out a way to do this for the user.

```js
await startScreencast();
/* Use the VS Code API / Electron and CDP to manipulate the window's contents */
const buffer = await stopScreencast();
```

### Use this in my MarkDown To-Do and MarkDown Link Suggestions extensions

### Use https://github.com/TomasHubelbauer/node-cdp-ws instead of `ws`

https://github.com/TomasHubelbauer/vscode-bare-extension uses it and this should
too to be standalone.

### Use https://github.com/TomasHubelbauer/svg-screencast for smaller image size

Purge the APNGs from repo history to make the repo overall smaller.

### Add a workflow to run this on macOS and Windows in GitHub Actions as well

I want all three screenshots all generated automatically.
