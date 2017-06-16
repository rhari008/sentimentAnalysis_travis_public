# Change Log
All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## 1.15.1 - 2017-04-13

### Fixed
 - Allow query parameters for OData $batch requests

## 1.15.0 - 2017-04-06

### Added
 - API for clearing OData model cache.

## 1.14.2 - 2017-04-04

### Fixed
 - http compression was not enabled when configured.

### Added
 - README.md table of content.

## 1.14.1 - 2017-03-20

### Fixed
 -	ResultSet::getTimestamp regression when getting `null` values.
 -	`xsjob` can refer `.xsjs` files placed in the application root directory.

## 1.14.0 - 2017-03-13

### Added
- Multitenancy support via integration with Instance Manager

## 1.13.1 - 2017-02-21

### Fixed
- Fix jobs execution with authentication.
- Improve ResultSet getters parameter validation and functionallity.
- Fix $.session.hasAppPrivilege when using anonymous access.

## 1.13.0 - 2017-01-30

### Added
- Adding, altering and deleting entries from Zip objects.
- Log error for jobs without HANA config.

### Changed
- Rename package to use @sap scope

### Fixed
- npm restriction.

## 1.12.0 - 2017-01-06

### Added
- Column indexing functionality for $.hdb.ResultSet
- SAP passport support when connecting to db

### Fixed
- Jobs callback url
- Direct execution of queries in $.hdb

## 1.11.4 - 2016-11-25

### Fixed
- Fix in xsodata: use same quoting semantic for input parameters of calcviews as in XS Classic

## 1.11.3 - 2016-11-16

### Fixed
- Adapt Zip objects in xsjs APIs
- Align TupelList behavior
- Fix ReDoS issue in negotiator
- Use getter/setter for library execution result property assignment
- Do not trace an error stack for 4xx status codes
- Document decimal column incompatibility
- Use default previous component name in SAP passport

## 1.11.2 - 2016-10-14

### Fixed
 - Fixes database connectivity

## 1.11.1 - 2016-10-13

### Fixed
 - Fixes in xsodata

## 1.11.0 - 2016-10-11

### Fixed
 - Minor fixes and improvements

## 1.10.1 - 2016-09-28

### Fixed
 - Fixes in xsodata

## 1.10.0 - 2016-09-28

### Added
 - $.util.Zip
 - $.util.SAXParser

### Fixed
 - Align content-type header values with XS Classic
 - Minor bug fixes

## 1.9.0 - 2016-08-29

### Added
 - HANA connection pooling
 - Support for Node.js v6

## 1.8.0 - 2016-08-05

### Added
 - 'context' property in xsjs bootstrap options which can be used if you want to extend the xsjs scripts with additional global variables

### Fixed
 - Fixes in database connectivity

## 1.7.0 - 2016-07-13

### Added
 - $.util.compression
 - $.text.mining support
 - Support for compression
