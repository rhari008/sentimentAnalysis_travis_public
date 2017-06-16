'use strict';

var _ = require('lodash');
var zipLib = require('yazl');
var unzipLib = require('yauzl');
var VError = require('verror');
var ctypes = require('../../ctypes');
var ResultSet = require('../db/dbapi/ResultSet');
var bufferUtils = require('../../utils/buffer-utils');
var compressionUtils = require('../../utils/compression-utils');

module.exports = Zip;

function Zip(source, index, settings) {
  if (!(this instanceof Zip)) { // if the constructor is used without the "new" keyword
    return new Zip(source, index, settings);
  }

  if (arguments.length > 3) {
    throw new VError('Zip.constructor: expects at most 3 arguments, got %d', arguments.length);
  }

  var argsCount = Array.prototype.slice.call(arguments).reduce(function(prev, current) {
    return prev + !!current;
  }, 0);

  if (argsCount && !_.isObject(source)) {
    throw new Error('Zip.constructor: Expected one of the following as first argument: ArrayBuffer, Body object, ResultSet object or JS object');
  }

  Object.defineProperty(this, '_metadata_', {
    enumerable: false,
    get: function() {
      updateZipContent.sync(this);
      return readZip.sync(this, false);
    }
  });
  defineZipProperty(this, '_zipAsBuffer', null);
  defineZipProperty(this, '_uncompressedSizeRestriction', Infinity);

  switch (argsCount) {
  case 1: // case: (ArrayBuffer or Body) or Settings object
    if (compressionUtils.isWebBodyOrArrayBuffer(source)) {
      this._zipAsBuffer = compressionUtils.extractBuffer(source);
    } else {
      this._uncompressedSizeRestriction = extractZipSettingsFromJsObject(source, argsCount);
    }
    break;
  case 2:
    if (compressionUtils.isWebBodyOrArrayBuffer(source)) { // case: (ArrayBuffer or Body) and Settings object
      this._zipAsBuffer = compressionUtils.extractBuffer(source);
      this._uncompressedSizeRestriction = extractZipSettingsFromJsObject(index, argsCount);
    } else if (source instanceof ResultSet) { // case: ResultSet and index
      this._zipAsBuffer = extractBufferFromResultSet(source, index);
    } else {
      throw new Error('Zip.constructor: Expected ArrayBuffer, Body object, ResultSet object or JS object as first argument');
    }
    break;
  case 3: // case: ResultSet, index and settings
    if (source instanceof ResultSet) {
      this._zipAsBuffer = extractBufferFromResultSet(source, index);
      this._uncompressedSizeRestriction = extractZipSettingsFromJsObject(settings, argsCount);
    } else {
      throw new Error('Zip.constructor: Expected ResultSet as first argument and Number as a second argument');
    }
    break;
  }

  if (this._zipAsBuffer) {
    readZip.sync(this, true);
  }
}

defineZipProperty(Zip.prototype, 'asArrayBuffer', function() {
  updateZipContent.sync(this);
  return bufferUtils.toArrayBuffer(this._zipAsBuffer);
});

function updateZipContent(zipInstance, fibrousCallback) {
  var zipFileChunks = [];
  var zipFileSize = 0;

  var zip = new zipLib.ZipFile();
  zip.outputStream.on('data', function(data) {
    zipFileChunks.push(data);
    zipFileSize += data.length;
  });

  zip.outputStream.on('end', function() {
    zipInstance._zipAsBuffer = bufferUtils.toBuffer(constructFileFromFileChunks(zipFileChunks, zipFileSize));
    fibrousCallback();
  });

  for (var entry in zipInstance) {
    var content = zipInstance[entry];
    zip.addBuffer(_.isString(content) ? new Buffer(content, 'utf8') : bufferUtils.toBuffer(content), entry);
  }
  zip.end();
}

function defineZipProperty(zipInstance, key, value) {
  Object.defineProperty(zipInstance, key, { value: value, writable: true, enumerable: false });
}

// loads the entries and the metadata for the zip
function readZip(zipInstance, checkZipSize, fibrousCallback) {
  unzipLib.fromBuffer(zipInstance._zipAsBuffer, { lazyEntries: true }, function (err, zipfile) {
    if (err) {
      return fibrousCallback(new Error('Failed to load zip archive'));
    }

    var currentCompressedSizeInBytes = 0;
    var currentUncompressedSizeInBytes = 0;
    zipfile.readEntry();

    zipfile.on('entry', function(entry) {
      currentCompressedSizeInBytes += entry.compressedSize;
      currentUncompressedSizeInBytes += entry.uncompressedSize;
      if (checkZipSize && currentUncompressedSizeInBytes > zipInstance._uncompressedSizeRestriction) { // zip bomb prevention
        return fibrousCallback(new VError(
          'The uncompressed size of the given zip exceeds the maximum allowed size of %d bytes. The zip will not be loaded.',
          zipInstance._uncompressedSizeRestriction
        ));
      }

      var fileChunks = [];
      var fileSize = 0;
      zipfile.openReadStream(entry, function(err, readStream) {
        if (err) {
          return fibrousCallback(err);
        }

        readStream.on('data', function(chunk) {
          fileChunks.push(chunk);
          fileSize += chunk.length;
        });

        readStream.on('end', function() {
          var fileContent = constructFileFromFileChunks(fileChunks, fileSize);
          zipInstance[entry.fileName] = fileContent;
          zipfile.readEntry();
        });
      });
    });

    zipfile.on('error', function(err) {
      if (err) {
        return fibrousCallback(err);
      }
    });

    zipfile.once('end', function() {
      fibrousCallback(null, {
        compressedSizeInBytes: currentCompressedSizeInBytes,
        uncompressedSizeInBytes: currentUncompressedSizeInBytes
      });
    });
  });
}

function extractBufferFromResultSet(resultSet, index) {
  if (!Number.isInteger(index)) {
    throw new Error('Zip.constructor: second argument expected to be a positive integer');
  }

  try {
    return bufferUtils.toBuffer(resultSet.getBlob(index));
  } catch (exception) {
    throw new VError.WError(exception, 'Zip.constructor: Failed to create a zip out of a ResultSet with index %d', index);
  }
}

function extractZipSettingsFromJsObject(settings, argumentPosition) {
  if (!_.isObject(settings)) {
    throw new VError('Zip.constructor: expected argument %d to be a JS object', argumentPosition);
  }

  if (settings.hasOwnProperty('password')) {
    throw new Error('Feature not supported: Creating zip with password encryption');
  }

  var sizeSetting = getUncompressedSizeRestriction(settings);
  if (sizeSetting && !_.isNumber(sizeSetting)) {
    throw new Error('Zip.constructor: value of property maxUncompressedSizeInBytes got to be a safe JS Number or ctypes.Int64.');
  }
  return sizeSetting;
}

function getUncompressedSizeRestriction(settings) {
  if (settings.maxUncompressedSizeInBytes instanceof ctypes.Int64) {
    return settings.maxUncompressedSizeInBytes.toJSON();
  }
  return settings.maxUncompressedSizeInBytes || Infinity;
}

function constructFileFromFileChunks(fileChunks, fileSize) {
  var fileContent = new Uint8Array(fileSize);
  var offset = 0;

  fileChunks.forEach(function(chunk) {
    fileContent.set(chunk, offset);
    offset += chunk.length;
  });

  return fileContent.buffer;
}
