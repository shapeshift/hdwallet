
# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Current - Unreleased

...

## [0.13.0] - 2019-11-04]

### Added

- Add portis BTC support

## [0.12.1] - 2019-11-01]

### Fixed

- Nano X getFirmwareVersion
- Better guards for isObject checks

## [0.12.0] - 2019-10-28]

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
