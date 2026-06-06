//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

/* eslint-disable */
var qrcode = function () {
  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function (typeNumber, errorCorrectionLevel) {
    var PAD0 = 0xec;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function (test, maskPattern) {
      _moduleCount = _typeNumber * 4 + 17;
      _modules = (function (moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      })(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function (row, col) {
      for (var r = -1; r <= 7; r += 1) {
        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {
          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if (
            (0 <= r && r <= 6 && (c == 0 || c == 6)) ||
            (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)
          ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function () {
      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {
        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function () {
      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = r % 2 == 0;
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = c % 2 == 0;
      }
    };

    var setupPositionAdjustPattern = function () {
      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {
        for (var j = 0; j < pos.length; j += 1) {
          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {
            for (var c = -2; c <= 2; c += 1) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function (test) {
      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = !test && ((bits >> i) & 1) == 1;
        _modules[Math.floor(i / 3)][(i % 3) + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = !test && ((bits >> i) & 1) == 1;
        _modules[(i % 3) + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function (test, maskPattern) {
      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {
        var mod = !test && ((bits >> i) & 1) == 1;

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {
        var mod = !test && ((bits >> i) & 1) == 1;

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = !test;
    };

    var mapData = function (data, maskPattern) {
      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col -= 1;

        while (true) {
          for (var c = 0; c < 2; c += 1) {
            if (_modules[row][col - c] == null) {
              var dark = false;

              if (byteIndex < data.length) {
                dark = ((data[byteIndex] >>> bitIndex) & 1) == 1;
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function (buffer, rsBlocks) {
      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {
        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function (typeNumber, errorCorrectionLevel, dataList) {
      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber));
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw (
          "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")"
        );
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function (data, mode) {
      mode = mode || "Byte";

      var newData = null;

      switch (mode) {
        case "Numeric":
          newData = qrNumber(data);
          break;
        case "Alphanumeric":
          newData = qrAlphaNum(data);
          break;
        case "Byte":
          newData = qr8BitByte(data);
          break;
        case "Kanji":
          newData = qrKanji(data);
          break;
        default:
          throw "mode:" + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function (row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + "," + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function () {
      return _moduleCount;
    };

    _this.make = function () {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber));
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i += 1) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern());
    };

    _this.renderTo2dContext = function (context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? "black" : "white";
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    default: function (s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    },
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs["default"];

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER: 1 << 0,
    MODE_ALPHA_NUM: 1 << 1,
    MODE_8BIT_BYTE: 1 << 2,
    MODE_KANJI: 1 << 3,
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2,
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7,
  };

  //---------------------------------------------------------------------
  // QRUtil (subset)
  //---------------------------------------------------------------------

  var QRUtil = (function () {
    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170],
    ];
    var G15 =
      (1 << 10) |
      (1 << 8) |
      (1 << 5) |
      (1 << 4) |
      (1 << 2) |
      (1 << 1) |
      (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var getBCHDigit = function (data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    return {
      getBCHTypeInfo: function (data) {
        var d = data << 10;
        while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
          d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15));
        }
        return ((data << 10) | d) ^ G15_MASK;
      },
      getBCHTypeNumber: function (data) {
        var d = data << 12;
        while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
          d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18));
        }
        return (data << 12) | d;
      },
      getPatternPosition: function (typeNumber) {
        return PATTERN_POSITION_TABLE[typeNumber - 1];
      },
      getMaskFunction: function (maskPattern) {
        switch (maskPattern) {
          case QRMaskPattern.PATTERN000:
            return function (i, j) { return (i + j) % 2 == 0; };
          case QRMaskPattern.PATTERN001:
            return function (i, j) { return i % 2 == 0; };
          case QRMaskPattern.PATTERN010:
            return function (i, j) { return j % 3 == 0; };
          case QRMaskPattern.PATTERN011:
            return function (i, j) { return (i + j) % 3 == 0; };
          case QRMaskPattern.PATTERN100:
            return function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0; };
          case QRMaskPattern.PATTERN101:
            return function (i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
          case QRMaskPattern.PATTERN110:
            return function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 == 0; };
          case QRMaskPattern.PATTERN111:
            return function (i, j) { return ((i * j) % 3 + (i + j) % 2) % 2 == 0; };
          default:
            throw "bad maskPattern:" + maskPattern;
        }
      },
      // (Minimal) polynomial helpers for error correction.
      getErrorCorrectPolynomial: function (errorCorrectLength) {
        var a = qrPolynomial([1], 0);
        for (var i = 0; i < errorCorrectLength; i += 1) {
          a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
        }
        return a;
      },
      getLengthInBits: function (mode, type) {
        if (1 <= type && type < 10) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 10;
            case QRMode.MODE_ALPHA_NUM: return 9;
            case QRMode.MODE_8BIT_BYTE: return 8;
            case QRMode.MODE_KANJI: return 8;
            default: throw "mode:" + mode;
          }
        } else if (type < 27) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 12;
            case QRMode.MODE_ALPHA_NUM: return 11;
            case QRMode.MODE_8BIT_BYTE: return 16;
            case QRMode.MODE_KANJI: return 10;
            default: throw "mode:" + mode;
          }
        } else if (type < 41) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 14;
            case QRMode.MODE_ALPHA_NUM: return 13;
            case QRMode.MODE_8BIT_BYTE: return 16;
            case QRMode.MODE_KANJI: return 12;
            default: throw "mode:" + mode;
          }
        } else {
          throw "type:" + type;
        }
      },
      getLostPoint: function () { return 0; }, // not needed for our rendering use
    };
  })();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = (function () {
    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    for (var i = 0; i < 8; i += 1) EXP_TABLE[i] = 1 << i;
    for (var i = 8; i < 256; i += 1)
      EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
    for (var i = 0; i < 255; i += 1) LOG_TABLE[EXP_TABLE[i]] = i;

    return {
      glog: function (n) {
        if (n < 1) throw "glog(" + n + ")";
        return LOG_TABLE[n];
      },
      gexp: function (n) {
        while (n < 0) n += 255;
        while (n >= 256) n -= 255;
        return EXP_TABLE[n];
      },
    };
  })();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {
    if (typeof num.length == "undefined") throw num.length + "/" + shift;

    var _num = (function () {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) offset += 1;
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) _num[i] = num[i + offset];
      return _num;
    })();

    var _this = {};
    _this.getAt = function (index) { return _num[index]; };
    _this.getLength = function () { return _num.length; };
    _this.multiply = function (e) {
      var num = new Array(_this.getLength() + e.getLength() - 1);
      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
        }
      }
      return qrPolynomial(num, 0);
    };
    _this.mod = function (e) {
      if (_this.getLength() - e.getLength() < 0) return _this;
      var ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
      var num = new Array(_this.getLength());
      for (var i = 0; i < _this.getLength(); i += 1) num[i] = _this.getAt(i);
      for (var i = 0; i < e.getLength(); i += 1) num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
      return qrPolynomial(num, 0).mod(e);
    };
    return _this;
  }

  //---------------------------------------------------------------------
  // QRRSBlock (minimal)
  //---------------------------------------------------------------------

  var QRRSBlock = (function () {
    // Keep small for demo: use table for version auto. We'll use typeNumber=0 anyway.
    // To keep this file small-ish, we use the original table only for low versions.
    // In practice, typeNumber=0 with small data usually picks low versions.
    var RS_BLOCK_TABLE = [
      [1, 26, 19],[1, 26, 16],[1, 26, 13],[1, 26, 9],
      [1, 44, 34],[1, 44, 28],[1, 44, 22],[1, 44, 16],
      [1, 70, 55],[1, 70, 44],[2, 35, 17],[2, 35, 13],
      [1, 100, 80],[2, 50, 32],[2, 50, 24],[4, 25, 9],
    ];
    function qrRSBlock(totalCount, dataCount) { return { totalCount, dataCount }; }
    function getRsBlockTable(typeNumber, errorCorrectionLevel) {
      var idx = (typeNumber - 1) * 4;
      if (idx < 0 || idx + 3 >= RS_BLOCK_TABLE.length) throw "RS table missing for type " + typeNumber;
      switch (errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L: return RS_BLOCK_TABLE[idx + 0];
        case QRErrorCorrectionLevel.M: return RS_BLOCK_TABLE[idx + 1];
        case QRErrorCorrectionLevel.Q: return RS_BLOCK_TABLE[idx + 2];
        case QRErrorCorrectionLevel.H: return RS_BLOCK_TABLE[idx + 3];
        default: return undefined;
      }
    }
    return {
      getRSBlocks: function (typeNumber, errorCorrectionLevel) {
        var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
        if (typeof rsBlock == "undefined") throw "bad rs block @ typeNumber:" + typeNumber;
        var length = rsBlock.length / 3;
        var list = [];
        for (var i = 0; i < length; i += 1) {
          var count = rsBlock[i * 3 + 0];
          var totalCount = rsBlock[i * 3 + 1];
          var dataCount = rsBlock[i * 3 + 2];
          for (var j = 0; j < count; j += 1) list.push(qrRSBlock(totalCount, dataCount));
        }
        return list;
      },
    };
  })();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function () {
    var _buffer = [];
    var _length = 0;
    return {
      getBuffer: function () { return _buffer; },
      put: function (num, length) {
        for (var i = 0; i < length; i += 1) this.putBit(((num >>> (length - i - 1)) & 1) == 1);
      },
      getLengthInBits: function () { return _length; },
      putBit: function (bit) {
        var bufIndex = Math.floor(_length / 8);
        if (_buffer.length <= bufIndex) _buffer.push(0);
        if (bit) _buffer[bufIndex] |= 0x80 >>> (_length % 8);
        _length += 1;
      },
    };
  };

  //---------------------------------------------------------------------
  // data encoders (byte only for demo)
  //---------------------------------------------------------------------
  var qr8BitByte = function (data) {
    var _mode = QRMode.MODE_8BIT_BYTE;
    var _bytes = qrcode.stringToBytes(data);
    return {
      getMode: function () { return _mode; },
      getLength: function () { return _bytes.length; },
      write: function (buffer) {
        for (var i = 0; i < _bytes.length; i += 1) buffer.put(_bytes[i], 8);
      },
    };
  };

  //---------------------------------------------------------------------
  // return qrcode function
  //---------------------------------------------------------------------
  return qrcode;
}();

// multibyte support
qrcode.stringToBytesFuncs["UTF-8"] = function (s) {
  function toUTF8Array(str) {
    var utf8 = [];
    for (var i = 0; i < str.length; i++) {
      var charcode = str.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      else if (charcode < 0xd800 || charcode >= 0xe000)
        utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      else {
        i++;
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        utf8.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f),
        );
      }
    }
    return utf8;
  }
  return toUTF8Array(s);
};
qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
/* eslint-enable */

