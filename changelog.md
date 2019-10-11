
# Change Log
All notable changes to this project will be documented in this file.
 
The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).
 
## [0.10.0] - 2019-10-11
 
### Added

- Automaticaly log user out of portis wallet after 10 minutes of inactivity
 
### Changed
  
- Removed getInitializeCount from keyring
 
### Fixed
 
- Create new portis object everytime wallet is paired instead of using existing object.