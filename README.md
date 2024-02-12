# HDWallet

[![CircleCI](https://circleci.com/gh/shapeshift/hdwallet.svg?style=svg)](https://circleci.com/gh/shapeshift/hdwallet)

A library for interacting with hardware wallets from JS/TS. Supports KeepKey,
Trezor, and Ledger. Intended for use in web apps, chrome apps/extensions, and
electron/node apps.

Try it out [here](https://hdwallet.shapeshift.now.sh/)!

## Documentation

- [HDWallet](#hdwallet)
  - [Documentation](#documentation)
  - [Installation](#installation)
  - [Importing Library](#importing-library)
  - [Usage](#usage)
  - [Building](#building)
  - [Developing](#developing)
  - [Tests](#tests)
  - [Contributing](#contributing)

## Installation

```bash
yarn add @keepkey/hdwallet-core
yarn add @keepkey/hdwallet-keepkey-webusb
yarn add @keepkey/hdwallet-trezor-connect
yarn add @keepkey/hdwallet-ledger-webusb
```

## Importing Library

You can import the generated bundle to use each of the component libraries:

```javascript
import { HDWallet } from "@keepkey/hdwallet-core";
import { isKeepKey, KeepKeyHDWallet } from "@keepkey/hdwallet-keepkey";
import { WebUSBKeepKeyAdapter } from "@keepkey/hdwallet-keepkey-webusb";
```

## Usage

The recommended way to use the library is through a `Keyring` singleton,
which manages connected devices:

```javascript
import { Keyring } from "@keepkey/hdwallet-core";
const keyring = new Keyring();
```

To add in support for a given wallet type, add in the relevant `Transport`
adapter by calling `useKeyring()` on it:

```javascript
import { WebUSBKeepKeyAdapter } from "@keepkey/hdwallet-keepkey-webusb";

const keepkeyAdapter = WebUSBKeepKeyAdapter.useKeyring(keyring);
```

After setting up a `Keyring`, and plugging various transport adapters into
it, the next step is to pair a device:

```javascript
let wallet = await keepkeyAdapter.pairDevice();

wallet.getLabel().then((result) => {
  console.log(result);
});
```

## Building

It is expected that this take quite some time (around 10 minutes), due to the
large size of the compiled KeepKey protobuf encoder/decoder.

```bash
yarn clean
yarn
yarn build
```

## Developing

To compile and watch the browser bundle, run:

```bash
yarn dev:sandbox
```

This will launch an ssl webserver that runs at `https://localhost:1234`, with
a small demo app that shows how to use various HDWallet functionality.

We use [Zeit Now](https://zeit.co/home) for continuous deployment of this
sandbox app. On pull requests, the builder will publish a new version of that
app with the changes included (for example
[#68](https://github.com/shapeshift/hdwallet/pull/68#issuecomment-542779289)).
Try out the latest build here: https://hdwallet.shapeshift.now.sh/

## Tests

```bash
yarn
yarn build
yarn test
```

The integration tests have been set up to run either against a physical KeepKey
with debug firmware on it, or in CI pointed at a dockerized version of the
emulator. Trezor and Ledger tests run against mocks of their respective
transport layers.

## Contributing

See our developer guidelines [here](CONTRIBUTING.md).
