
# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Current - Unreleased

### Added

- Sandbox support for getAppInfo call on Ledger Device
- Implemented ethGetPublicKeys() which uses the ETH getAddress() call and filters out any non ETH account paths

### Changed

- Function definition for getPublicKeys() return type. Allow null.
- Broke out logic that existed in getPublicKeys() into Bitcoin specific btcGetPublicKeys()
- Ledger getPublicKeys() calls appropriate function based on app open on device (BTC or ETH)

### Fixed

- Correct descriptions for the supported Ledger ETH account paths

...

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
