# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.0.1] - 2020-07-13

### Changed

- Native: Keep the mnemonic private

## [1.0.1] - 2020-07-13

### Changed

- Initialize each supported native wallet using seed derived from mnemonic (performance)

## [1.0.0] - 2020-06-25

### Added

- Native: New native software hdwallet package
- Native: Support for BTC, DASH, DGB, DOGE, LTC, ETH.
- Native: Support for Non-Segwit, Segwit, and Native-Segwit for applicable coins
- Native: Integration test suite
- Native: No support for Bitcoin clones at this time (BCH, BTG, etc.)
- Native: No support for UTXO message signing and verifying at this time
- Prettier formatting rules and a husky pre-commit hook to run prettier against changed files

### Changed

- Switched HDWallet from using Microbundle to tsc (no umd or esm support)
- Native wallet now utilizes mixins in an attempt to have a cleaner package

### Fixed

- Updated example payloads and data in the sandbox to support Native (using psbt which is validating inputs against pubkeyhash)

## [0.18.4] - 2020-01-08

### Fixed

- KeepKey: Fix Dash DIP2 payload logic

## [0.18.2] - 2019-12-09

### Changed

- Ledger: Call TransportWebUSB.request() instead of .create() so the permission modal is displayed on every call to getTransport()

## [0.18.1] - 2019-12-05

### Added

- Cosmos support for KeepKey

## [0.17.1] - 2019-11-20

### Changed

- Ledger: Improved logic for handling disconnect/connect event for ledger and discern if the event is due to app navigation

## [0.17.0] - 2019-11-19

### Added

- Ledger transport calls that require a specific app to be open will validateCurrentApp() before making the call
- Add appName to networkUtils object for ledger (BTC,BCH,DASH,DGB,DOGE,ETH,LTC)

### Changed

- validateCurrentApp() now takes the coin name instead of symbol
- Error message for WrongApp exception updated
- Increase ledger APP_NAVIGATION_DELAY time to allow for slower connect/discconect event propagation
- Move timing of ledger handleConnect timeout to reconnect as soon as possible despite increased delay
- Updated DGB config to support segwit

## [0.16.0] - 2019-11-14

### Added

- Sandbox support for getAppInfo call on Ledger Device
- Implemented ethGetPublicKeys() which uses the ETH getAddress() call and filters out any non ETH account paths

### Changed

- Function definition for getPublicKeys() return type. Allow null.
- Broke out logic that existed in getPublicKeys() into Bitcoin specific btcGetPublicKeys()
- Ledger getPublicKeys() calls appropriate function based on app open on device (BTC or ETH)

### Fixed

- Correct descriptions for the supported Ledger ETH account paths

## [0.15.0] - 2019-11-12

### Added

- More robust error handling for Ledger
- Dropped promises from several of the HDWalletInfo interfaces

## [0.14.0] - 2019-11-08

## Fixed

- Lock portis version to prevent regressions

## [0.13.1] - 2019-11-04

### Fixed

- Updated yarn.lock

## [0.13.0] - 2019-11-04

### Added

- Add portis BTC support
- Add ledger validateCurrentApp() and openApp()

### Fixed

- Ledger: use transport.call() to get firmware version

## [0.12.1] - 2019-11-01

### Fixed

- Nano X getFirmwareVersion
- Better guards for isObject checks

## [0.12.0] - 2019-10-28

### Fixed

- Better reliability on ledger-transport

## [0.11.1] - 2019-10-16

### Added

- Zeit Now pull request builder

### Fixed

- Fix Trezor getFirmwareVersion()
- Fix KeepKey + Trezor btcVerifyMessage() for invalid signatures

## [0.11.0] - 2019-10-15

### Fixed

- Ledger BCH transaction signing

## [0.10.1] - 2019-10-11

### Fixed

- Fix infinite recursion bug in keyring.get()

## [0.10.0] - 2019-10-11

### Added

- Automaticaly log user out of portis wallet after 10 minutes of inactivity

### Changed

- Removed getInitializeCount from keyring

### Fixed

- Create new portis object everytime wallet is paired instead of using existing object.
