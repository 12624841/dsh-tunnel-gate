window.__ModuleLoader__.load({ id: "dsh-tunnel-gate", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/panel.jsx
var import_react2 = require("react");
var import_react_dom = require("react-dom");

// node_modules/qrcode.react/lib/esm/index.js
var import_react = __toESM(require("react"), 1);
var __defProp2 = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp2.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp2.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var qrcodegen;
((qrcodegen2) => {
  const _QrCode = class _QrCode2 {
    /*-- Constructor (low level) and fields --*/
    // Creates a new QR Code with the given version number,
    // error correction level, data codeword bytes, and mask number.
    // This is a low-level API that most users should not use directly.
    // A mid-level API is the encodeSegments() function.
    constructor(version, errorCorrectionLevel, dataCodewords, msk) {
      this.version = version;
      this.errorCorrectionLevel = errorCorrectionLevel;
      this.modules = [];
      this.isFunction = [];
      if (version < _QrCode2.MIN_VERSION || version > _QrCode2.MAX_VERSION)
        throw new RangeError("Version value out of range");
      if (msk < -1 || msk > 7)
        throw new RangeError("Mask value out of range");
      this.size = version * 4 + 17;
      let row = [];
      for (let i = 0; i < this.size; i++)
        row.push(false);
      for (let i = 0; i < this.size; i++) {
        this.modules.push(row.slice());
        this.isFunction.push(row.slice());
      }
      this.drawFunctionPatterns();
      const allCodewords = this.addEccAndInterleave(dataCodewords);
      this.drawCodewords(allCodewords);
      if (msk == -1) {
        let minPenalty = 1e9;
        for (let i = 0; i < 8; i++) {
          this.applyMask(i);
          this.drawFormatBits(i);
          const penalty = this.getPenaltyScore();
          if (penalty < minPenalty) {
            msk = i;
            minPenalty = penalty;
          }
          this.applyMask(i);
        }
      }
      assert(0 <= msk && msk <= 7);
      this.mask = msk;
      this.applyMask(msk);
      this.drawFormatBits(msk);
      this.isFunction = [];
    }
    /*-- Static factory functions (high level) --*/
    // Returns a QR Code representing the given Unicode text string at the given error correction level.
    // As a conservative upper bound, this function is guaranteed to succeed for strings that have 738 or fewer
    // Unicode code points (not UTF-16 code units) if the low error correction level is used. The smallest possible
    // QR Code version is automatically chosen for the output. The ECC level of the result may be higher than the
    // ecl argument if it can be done without increasing the version.
    static encodeText(text, ecl) {
      const segs = qrcodegen2.QrSegment.makeSegments(text);
      return _QrCode2.encodeSegments(segs, ecl);
    }
    // Returns a QR Code representing the given binary data at the given error correction level.
    // This function always encodes using the binary segment mode, not any text mode. The maximum number of
    // bytes allowed is 2953. The smallest possible QR Code version is automatically chosen for the output.
    // The ECC level of the result may be higher than the ecl argument if it can be done without increasing the version.
    static encodeBinary(data, ecl) {
      const seg = qrcodegen2.QrSegment.makeBytes(data);
      return _QrCode2.encodeSegments([seg], ecl);
    }
    /*-- Static factory functions (mid level) --*/
    // Returns a QR Code representing the given segments with the given encoding parameters.
    // The smallest possible QR Code version within the given range is automatically
    // chosen for the output. Iff boostEcl is true, then the ECC level of the result
    // may be higher than the ecl argument if it can be done without increasing the
    // version. The mask number is either between 0 to 7 (inclusive) to force that
    // mask, or -1 to automatically choose an appropriate mask (which may be slow).
    // This function allows the user to create a custom sequence of segments that switches
    // between modes (such as alphanumeric and byte) to encode text in less space.
    // This is a mid-level API; the high-level API is encodeText() and encodeBinary().
    static encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
      if (!(_QrCode2.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= _QrCode2.MAX_VERSION) || mask < -1 || mask > 7)
        throw new RangeError("Invalid value");
      let version;
      let dataUsedBits;
      for (version = minVersion; ; version++) {
        const dataCapacityBits2 = _QrCode2.getNumDataCodewords(version, ecl) * 8;
        const usedBits = QrSegment.getTotalBits(segs, version);
        if (usedBits <= dataCapacityBits2) {
          dataUsedBits = usedBits;
          break;
        }
        if (version >= maxVersion)
          throw new RangeError("Data too long");
      }
      for (const newEcl of [_QrCode2.Ecc.MEDIUM, _QrCode2.Ecc.QUARTILE, _QrCode2.Ecc.HIGH]) {
        if (boostEcl && dataUsedBits <= _QrCode2.getNumDataCodewords(version, newEcl) * 8)
          ecl = newEcl;
      }
      let bb = [];
      for (const seg of segs) {
        appendBits(seg.mode.modeBits, 4, bb);
        appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
        for (const b of seg.getData())
          bb.push(b);
      }
      assert(bb.length == dataUsedBits);
      const dataCapacityBits = _QrCode2.getNumDataCodewords(version, ecl) * 8;
      assert(bb.length <= dataCapacityBits);
      appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
      appendBits(0, (8 - bb.length % 8) % 8, bb);
      assert(bb.length % 8 == 0);
      for (let padByte = 236; bb.length < dataCapacityBits; padByte ^= 236 ^ 17)
        appendBits(padByte, 8, bb);
      let dataCodewords = [];
      while (dataCodewords.length * 8 < bb.length)
        dataCodewords.push(0);
      bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << 7 - (i & 7));
      return new _QrCode2(version, ecl, dataCodewords, mask);
    }
    /*-- Accessor methods --*/
    // Returns the color of the module (pixel) at the given coordinates, which is false
    // for light or true for dark. The top left corner has the coordinates (x=0, y=0).
    // If the given coordinates are out of bounds, then false (light) is returned.
    getModule(x, y) {
      return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
    }
    // Modified to expose modules for easy access
    getModules() {
      return this.modules;
    }
    /*-- Private helper methods for constructor: Drawing function modules --*/
    // Reads this object's version field, and draws and marks all function modules.
    drawFunctionPatterns() {
      for (let i = 0; i < this.size; i++) {
        this.setFunctionModule(6, i, i % 2 == 0);
        this.setFunctionModule(i, 6, i % 2 == 0);
      }
      this.drawFinderPattern(3, 3);
      this.drawFinderPattern(this.size - 4, 3);
      this.drawFinderPattern(3, this.size - 4);
      const alignPatPos = this.getAlignmentPatternPositions();
      const numAlign = alignPatPos.length;
      for (let i = 0; i < numAlign; i++) {
        for (let j = 0; j < numAlign; j++) {
          if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0))
            this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
        }
      }
      this.drawFormatBits(0);
      this.drawVersion();
    }
    // Draws two copies of the format bits (with its own error correction code)
    // based on the given mask and this object's error correction level field.
    drawFormatBits(mask) {
      const data = this.errorCorrectionLevel.formatBits << 3 | mask;
      let rem = data;
      for (let i = 0; i < 10; i++)
        rem = rem << 1 ^ (rem >>> 9) * 1335;
      const bits = (data << 10 | rem) ^ 21522;
      assert(bits >>> 15 == 0);
      for (let i = 0; i <= 5; i++)
        this.setFunctionModule(8, i, getBit(bits, i));
      this.setFunctionModule(8, 7, getBit(bits, 6));
      this.setFunctionModule(8, 8, getBit(bits, 7));
      this.setFunctionModule(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++)
        this.setFunctionModule(14 - i, 8, getBit(bits, i));
      for (let i = 0; i < 8; i++)
        this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++)
        this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
      this.setFunctionModule(8, this.size - 8, true);
    }
    // Draws two copies of the version bits (with its own error correction code),
    // based on this object's version field, iff 7 <= version <= 40.
    drawVersion() {
      if (this.version < 7)
        return;
      let rem = this.version;
      for (let i = 0; i < 12; i++)
        rem = rem << 1 ^ (rem >>> 11) * 7973;
      const bits = this.version << 12 | rem;
      assert(bits >>> 18 == 0);
      for (let i = 0; i < 18; i++) {
        const color = getBit(bits, i);
        const a = this.size - 11 + i % 3;
        const b = Math.floor(i / 3);
        this.setFunctionModule(a, b, color);
        this.setFunctionModule(b, a, color);
      }
    }
    // Draws a 9*9 finder pattern including the border separator,
    // with the center module at (x, y). Modules can be out of bounds.
    drawFinderPattern(x, y) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const xx = x + dx;
          const yy = y + dy;
          if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
            this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
        }
      }
    }
    // Draws a 5*5 alignment pattern, with the center module
    // at (x, y). All modules must be in bounds.
    drawAlignmentPattern(x, y) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++)
          this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
      }
    }
    // Sets the color of a module and marks it as a function module.
    // Only used by the constructor. Coordinates must be in bounds.
    setFunctionModule(x, y, isDark) {
      this.modules[y][x] = isDark;
      this.isFunction[y][x] = true;
    }
    /*-- Private helper methods for constructor: Codewords and masking --*/
    // Returns a new byte string representing the given data with the appropriate error correction
    // codewords appended to it, based on this object's version and error correction level.
    addEccAndInterleave(data) {
      const ver = this.version;
      const ecl = this.errorCorrectionLevel;
      if (data.length != _QrCode2.getNumDataCodewords(ver, ecl))
        throw new RangeError("Invalid argument");
      const numBlocks = _QrCode2.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
      const blockEccLen = _QrCode2.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
      const rawCodewords = Math.floor(_QrCode2.getNumRawDataModules(ver) / 8);
      const numShortBlocks = numBlocks - rawCodewords % numBlocks;
      const shortBlockLen = Math.floor(rawCodewords / numBlocks);
      let blocks = [];
      const rsDiv = _QrCode2.reedSolomonComputeDivisor(blockEccLen);
      for (let i = 0, k = 0; i < numBlocks; i++) {
        let dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
        k += dat.length;
        const ecc = _QrCode2.reedSolomonComputeRemainder(dat, rsDiv);
        if (i < numShortBlocks)
          dat.push(0);
        blocks.push(dat.concat(ecc));
      }
      let result = [];
      for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
          if (i != shortBlockLen - blockEccLen || j >= numShortBlocks)
            result.push(block[i]);
        });
      }
      assert(result.length == rawCodewords);
      return result;
    }
    // Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
    // data area of this QR Code. Function modules need to be marked off before this is called.
    drawCodewords(data) {
      if (data.length != Math.floor(_QrCode2.getNumRawDataModules(this.version) / 8))
        throw new RangeError("Invalid argument");
      let i = 0;
      for (let right = this.size - 1; right >= 1; right -= 2) {
        if (right == 6)
          right = 5;
        for (let vert = 0; vert < this.size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            const upward = (right + 1 & 2) == 0;
            const y = upward ? this.size - 1 - vert : vert;
            if (!this.isFunction[y][x] && i < data.length * 8) {
              this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
              i++;
            }
          }
        }
      }
      assert(i == data.length * 8);
    }
    // XORs the codeword modules in this QR Code with the given mask pattern.
    // The function modules must be marked and the codeword bits must be drawn
    // before masking. Due to the arithmetic of XOR, calling applyMask() with
    // the same mask value a second time will undo the mask. A final well-formed
    // QR Code needs exactly one (not zero, two, etc.) mask applied.
    applyMask(mask) {
      if (mask < 0 || mask > 7)
        throw new RangeError("Mask value out of range");
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          let invert;
          switch (mask) {
            case 0:
              invert = (x + y) % 2 == 0;
              break;
            case 1:
              invert = y % 2 == 0;
              break;
            case 2:
              invert = x % 3 == 0;
              break;
            case 3:
              invert = (x + y) % 3 == 0;
              break;
            case 4:
              invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
              break;
            case 5:
              invert = x * y % 2 + x * y % 3 == 0;
              break;
            case 6:
              invert = (x * y % 2 + x * y % 3) % 2 == 0;
              break;
            case 7:
              invert = ((x + y) % 2 + x * y % 3) % 2 == 0;
              break;
            default:
              throw new Error("Unreachable");
          }
          if (!this.isFunction[y][x] && invert)
            this.modules[y][x] = !this.modules[y][x];
        }
      }
    }
    // Calculates and returns the penalty score based on state of this QR Code's current modules.
    // This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
    getPenaltyScore() {
      let result = 0;
      for (let y = 0; y < this.size; y++) {
        let runColor = false;
        let runX = 0;
        let runHistory = [0, 0, 0, 0, 0, 0, 0];
        for (let x = 0; x < this.size; x++) {
          if (this.modules[y][x] == runColor) {
            runX++;
            if (runX == 5)
              result += _QrCode2.PENALTY_N1;
            else if (runX > 5)
              result++;
          } else {
            this.finderPenaltyAddHistory(runX, runHistory);
            if (!runColor)
              result += this.finderPenaltyCountPatterns(runHistory) * _QrCode2.PENALTY_N3;
            runColor = this.modules[y][x];
            runX = 1;
          }
        }
        result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * _QrCode2.PENALTY_N3;
      }
      for (let x = 0; x < this.size; x++) {
        let runColor = false;
        let runY = 0;
        let runHistory = [0, 0, 0, 0, 0, 0, 0];
        for (let y = 0; y < this.size; y++) {
          if (this.modules[y][x] == runColor) {
            runY++;
            if (runY == 5)
              result += _QrCode2.PENALTY_N1;
            else if (runY > 5)
              result++;
          } else {
            this.finderPenaltyAddHistory(runY, runHistory);
            if (!runColor)
              result += this.finderPenaltyCountPatterns(runHistory) * _QrCode2.PENALTY_N3;
            runColor = this.modules[y][x];
            runY = 1;
          }
        }
        result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * _QrCode2.PENALTY_N3;
      }
      for (let y = 0; y < this.size - 1; y++) {
        for (let x = 0; x < this.size - 1; x++) {
          const color = this.modules[y][x];
          if (color == this.modules[y][x + 1] && color == this.modules[y + 1][x] && color == this.modules[y + 1][x + 1])
            result += _QrCode2.PENALTY_N2;
        }
      }
      let dark = 0;
      for (const row of this.modules)
        dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
      const total = this.size * this.size;
      const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      assert(0 <= k && k <= 9);
      result += k * _QrCode2.PENALTY_N4;
      assert(0 <= result && result <= 2568888);
      return result;
    }
    /*-- Private helper functions --*/
    // Returns an ascending list of positions of alignment patterns for this version number.
    // Each position is in the range [0,177), and are used on both the x and y axes.
    // This could be implemented as lookup table of 40 variable-length lists of integers.
    getAlignmentPatternPositions() {
      if (this.version == 1)
        return [];
      else {
        const numAlign = Math.floor(this.version / 7) + 2;
        const step = this.version == 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
        let result = [6];
        for (let pos = this.size - 7; result.length < numAlign; pos -= step)
          result.splice(1, 0, pos);
        return result;
      }
    }
    // Returns the number of data bits that can be stored in a QR Code of the given version number, after
    // all function modules are excluded. This includes remainder bits, so it might not be a multiple of 8.
    // The result is in the range [208, 29648]. This could be implemented as a 40-entry lookup table.
    static getNumRawDataModules(ver) {
      if (ver < _QrCode2.MIN_VERSION || ver > _QrCode2.MAX_VERSION)
        throw new RangeError("Version number out of range");
      let result = (16 * ver + 128) * ver + 64;
      if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7)
          result -= 36;
      }
      assert(208 <= result && result <= 29648);
      return result;
    }
    // Returns the number of 8-bit data (i.e. not error correction) codewords contained in any
    // QR Code of the given version number and error correction level, with remainder bits discarded.
    // This stateless pure function could be implemented as a (40*4)-cell lookup table.
    static getNumDataCodewords(ver, ecl) {
      return Math.floor(_QrCode2.getNumRawDataModules(ver) / 8) - _QrCode2.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * _QrCode2.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    }
    // Returns a Reed-Solomon ECC generator polynomial for the given degree. This could be
    // implemented as a lookup table over all possible parameter values, instead of as an algorithm.
    static reedSolomonComputeDivisor(degree) {
      if (degree < 1 || degree > 255)
        throw new RangeError("Degree out of range");
      let result = [];
      for (let i = 0; i < degree - 1; i++)
        result.push(0);
      result.push(1);
      let root = 1;
      for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) {
          result[j] = _QrCode2.reedSolomonMultiply(result[j], root);
          if (j + 1 < result.length)
            result[j] ^= result[j + 1];
        }
        root = _QrCode2.reedSolomonMultiply(root, 2);
      }
      return result;
    }
    // Returns the Reed-Solomon error correction codeword for the given data and divisor polynomials.
    static reedSolomonComputeRemainder(data, divisor) {
      let result = divisor.map((_) => 0);
      for (const b of data) {
        const factor = b ^ result.shift();
        result.push(0);
        divisor.forEach((coef, i) => result[i] ^= _QrCode2.reedSolomonMultiply(coef, factor));
      }
      return result;
    }
    // Returns the product of the two given field elements modulo GF(2^8/0x11D). The arguments and result
    // are unsigned 8-bit integers. This could be implemented as a lookup table of 256*256 entries of uint8.
    static reedSolomonMultiply(x, y) {
      if (x >>> 8 != 0 || y >>> 8 != 0)
        throw new RangeError("Byte out of range");
      let z = 0;
      for (let i = 7; i >= 0; i--) {
        z = z << 1 ^ (z >>> 7) * 285;
        z ^= (y >>> i & 1) * x;
      }
      assert(z >>> 8 == 0);
      return z;
    }
    // Can only be called immediately after a light run is added, and
    // returns either 0, 1, or 2. A helper function for getPenaltyScore().
    finderPenaltyCountPatterns(runHistory) {
      const n = runHistory[1];
      assert(n <= this.size * 3);
      const core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
      return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
    }
    // Must be called at the end of a line (row or column) of modules. A helper function for getPenaltyScore().
    finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
      if (currentRunColor) {
        this.finderPenaltyAddHistory(currentRunLength, runHistory);
        currentRunLength = 0;
      }
      currentRunLength += this.size;
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      return this.finderPenaltyCountPatterns(runHistory);
    }
    // Pushes the given value to the front and drops the last value. A helper function for getPenaltyScore().
    finderPenaltyAddHistory(currentRunLength, runHistory) {
      if (runHistory[0] == 0)
        currentRunLength += this.size;
      runHistory.pop();
      runHistory.unshift(currentRunLength);
    }
  };
  _QrCode.MIN_VERSION = 1;
  _QrCode.MAX_VERSION = 40;
  _QrCode.PENALTY_N1 = 3;
  _QrCode.PENALTY_N2 = 3;
  _QrCode.PENALTY_N3 = 40;
  _QrCode.PENALTY_N4 = 10;
  _QrCode.ECC_CODEWORDS_PER_BLOCK = [
    // Version: (note that index 0 is for padding, and is set to an illegal value)
    //0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // Low
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    // Medium
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // Quartile
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
    // High
  ];
  _QrCode.NUM_ERROR_CORRECTION_BLOCKS = [
    // Version: (note that index 0 is for padding, and is set to an illegal value)
    //0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    // Low
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    // Medium
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    // Quartile
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
    // High
  ];
  let QrCode = _QrCode;
  qrcodegen2.QrCode = _QrCode;
  function appendBits(val, len, bb) {
    if (len < 0 || len > 31 || val >>> len != 0)
      throw new RangeError("Value out of range");
    for (let i = len - 1; i >= 0; i--)
      bb.push(val >>> i & 1);
  }
  function getBit(x, i) {
    return (x >>> i & 1) != 0;
  }
  function assert(cond) {
    if (!cond)
      throw new Error("Assertion error");
  }
  const _QrSegment = class _QrSegment2 {
    /*-- Constructor (low level) and fields --*/
    // Creates a new QR Code segment with the given attributes and data.
    // The character count (numChars) must agree with the mode and the bit buffer length,
    // but the constraint isn't checked. The given bit buffer is cloned and stored.
    constructor(mode, numChars, bitData) {
      this.mode = mode;
      this.numChars = numChars;
      this.bitData = bitData;
      if (numChars < 0)
        throw new RangeError("Invalid argument");
      this.bitData = bitData.slice();
    }
    /*-- Static factory functions (mid level) --*/
    // Returns a segment representing the given binary data encoded in
    // byte mode. All input byte arrays are acceptable. Any text string
    // can be converted to UTF-8 bytes and encoded as a byte mode segment.
    static makeBytes(data) {
      let bb = [];
      for (const b of data)
        appendBits(b, 8, bb);
      return new _QrSegment2(_QrSegment2.Mode.BYTE, data.length, bb);
    }
    // Returns a segment representing the given string of decimal digits encoded in numeric mode.
    static makeNumeric(digits) {
      if (!_QrSegment2.isNumeric(digits))
        throw new RangeError("String contains non-numeric characters");
      let bb = [];
      for (let i = 0; i < digits.length; ) {
        const n = Math.min(digits.length - i, 3);
        appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
        i += n;
      }
      return new _QrSegment2(_QrSegment2.Mode.NUMERIC, digits.length, bb);
    }
    // Returns a segment representing the given text string encoded in alphanumeric mode.
    // The characters allowed are: 0 to 9, A to Z (uppercase only), space,
    // dollar, percent, asterisk, plus, hyphen, period, slash, colon.
    static makeAlphanumeric(text) {
      if (!_QrSegment2.isAlphanumeric(text))
        throw new RangeError("String contains unencodable characters in alphanumeric mode");
      let bb = [];
      let i;
      for (i = 0; i + 2 <= text.length; i += 2) {
        let temp = _QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
        temp += _QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
        appendBits(temp, 11, bb);
      }
      if (i < text.length)
        appendBits(_QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
      return new _QrSegment2(_QrSegment2.Mode.ALPHANUMERIC, text.length, bb);
    }
    // Returns a new mutable list of zero or more segments to represent the given Unicode text string.
    // The result may use various segment modes and switch modes to optimize the length of the bit stream.
    static makeSegments(text) {
      if (text == "")
        return [];
      else if (_QrSegment2.isNumeric(text))
        return [_QrSegment2.makeNumeric(text)];
      else if (_QrSegment2.isAlphanumeric(text))
        return [_QrSegment2.makeAlphanumeric(text)];
      else
        return [_QrSegment2.makeBytes(_QrSegment2.toUtf8ByteArray(text))];
    }
    // Returns a segment representing an Extended Channel Interpretation
    // (ECI) designator with the given assignment value.
    static makeEci(assignVal) {
      let bb = [];
      if (assignVal < 0)
        throw new RangeError("ECI assignment value out of range");
      else if (assignVal < 1 << 7)
        appendBits(assignVal, 8, bb);
      else if (assignVal < 1 << 14) {
        appendBits(2, 2, bb);
        appendBits(assignVal, 14, bb);
      } else if (assignVal < 1e6) {
        appendBits(6, 3, bb);
        appendBits(assignVal, 21, bb);
      } else
        throw new RangeError("ECI assignment value out of range");
      return new _QrSegment2(_QrSegment2.Mode.ECI, 0, bb);
    }
    // Tests whether the given string can be encoded as a segment in numeric mode.
    // A string is encodable iff each character is in the range 0 to 9.
    static isNumeric(text) {
      return _QrSegment2.NUMERIC_REGEX.test(text);
    }
    // Tests whether the given string can be encoded as a segment in alphanumeric mode.
    // A string is encodable iff each character is in the following set: 0 to 9, A to Z
    // (uppercase only), space, dollar, percent, asterisk, plus, hyphen, period, slash, colon.
    static isAlphanumeric(text) {
      return _QrSegment2.ALPHANUMERIC_REGEX.test(text);
    }
    /*-- Methods --*/
    // Returns a new copy of the data bits of this segment.
    getData() {
      return this.bitData.slice();
    }
    // (Package-private) Calculates and returns the number of bits needed to encode the given segments at
    // the given version. The result is infinity if a segment has too many characters to fit its length field.
    static getTotalBits(segs, version) {
      let result = 0;
      for (const seg of segs) {
        const ccbits = seg.mode.numCharCountBits(version);
        if (seg.numChars >= 1 << ccbits)
          return Infinity;
        result += 4 + ccbits + seg.bitData.length;
      }
      return result;
    }
    // Returns a new array of bytes representing the given string encoded in UTF-8.
    static toUtf8ByteArray(str) {
      str = encodeURI(str);
      let result = [];
      for (let i = 0; i < str.length; i++) {
        if (str.charAt(i) != "%")
          result.push(str.charCodeAt(i));
        else {
          result.push(parseInt(str.substring(i + 1, i + 3), 16));
          i += 2;
        }
      }
      return result;
    }
  };
  _QrSegment.NUMERIC_REGEX = /^[0-9]*$/;
  _QrSegment.ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
  _QrSegment.ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  let QrSegment = _QrSegment;
  qrcodegen2.QrSegment = _QrSegment;
})(qrcodegen || (qrcodegen = {}));
((qrcodegen2) => {
  let QrCode;
  ((QrCode2) => {
    const _Ecc = class _Ecc {
      // The QR Code can tolerate about 30% erroneous codewords
      /*-- Constructor and fields --*/
      constructor(ordinal, formatBits) {
        this.ordinal = ordinal;
        this.formatBits = formatBits;
      }
    };
    _Ecc.LOW = new _Ecc(0, 1);
    _Ecc.MEDIUM = new _Ecc(1, 0);
    _Ecc.QUARTILE = new _Ecc(2, 3);
    _Ecc.HIGH = new _Ecc(3, 2);
    let Ecc = _Ecc;
    QrCode2.Ecc = _Ecc;
  })(QrCode = qrcodegen2.QrCode || (qrcodegen2.QrCode = {}));
})(qrcodegen || (qrcodegen = {}));
((qrcodegen2) => {
  let QrSegment;
  ((QrSegment2) => {
    const _Mode = class _Mode {
      /*-- Constructor and fields --*/
      constructor(modeBits, numBitsCharCount) {
        this.modeBits = modeBits;
        this.numBitsCharCount = numBitsCharCount;
      }
      /*-- Method --*/
      // (Package-private) Returns the bit width of the character count field for a segment in
      // this mode in a QR Code at the given version number. The result is in the range [0, 16].
      numCharCountBits(ver) {
        return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
      }
    };
    _Mode.NUMERIC = new _Mode(1, [10, 12, 14]);
    _Mode.ALPHANUMERIC = new _Mode(2, [9, 11, 13]);
    _Mode.BYTE = new _Mode(4, [8, 16, 16]);
    _Mode.KANJI = new _Mode(8, [8, 10, 12]);
    _Mode.ECI = new _Mode(7, [0, 0, 0]);
    let Mode = _Mode;
    QrSegment2.Mode = _Mode;
  })(QrSegment = qrcodegen2.QrSegment || (qrcodegen2.QrSegment = {}));
})(qrcodegen || (qrcodegen = {}));
var qrcodegen_default = qrcodegen;
var ERROR_LEVEL_MAP = {
  L: qrcodegen_default.QrCode.Ecc.LOW,
  M: qrcodegen_default.QrCode.Ecc.MEDIUM,
  Q: qrcodegen_default.QrCode.Ecc.QUARTILE,
  H: qrcodegen_default.QrCode.Ecc.HIGH
};
var DEFAULT_SIZE = 128;
var DEFAULT_LEVEL = "L";
var DEFAULT_BGCOLOR = "#FFFFFF";
var DEFAULT_FGCOLOR = "#000000";
var DEFAULT_INCLUDEMARGIN = false;
var DEFAULT_MINVERSION = 1;
var SPEC_MARGIN_SIZE = 4;
var DEFAULT_MARGIN_SIZE = 0;
var DEFAULT_IMG_SCALE = 0.1;
function generatePath(modules, margin = 0) {
  const ops = [];
  modules.forEach(function(row, y) {
    let start = null;
    row.forEach(function(cell, x) {
      if (!cell && start !== null) {
        ops.push(
          `M${start + margin} ${y + margin}h${x - start}v1H${start + margin}z`
        );
        start = null;
        return;
      }
      if (x === row.length - 1) {
        if (!cell) {
          return;
        }
        if (start === null) {
          ops.push(`M${x + margin},${y + margin} h1v1H${x + margin}z`);
        } else {
          ops.push(
            `M${start + margin},${y + margin} h${x + 1 - start}v1H${start + margin}z`
          );
        }
        return;
      }
      if (cell && start === null) {
        start = x;
      }
    });
  });
  return ops.join("");
}
function excavateModules(modules, excavation) {
  return modules.slice().map((row, y) => {
    if (y < excavation.y || y >= excavation.y + excavation.h) {
      return row;
    }
    return row.map((cell, x) => {
      if (x < excavation.x || x >= excavation.x + excavation.w) {
        return cell;
      }
      return false;
    });
  });
}
function getImageSettings(cells, size, margin, imageSettings) {
  if (imageSettings == null) {
    return null;
  }
  const numCells = cells.length + margin * 2;
  const defaultSize = Math.floor(size * DEFAULT_IMG_SCALE);
  const scale = numCells / size;
  const w = (imageSettings.width || defaultSize) * scale;
  const h = (imageSettings.height || defaultSize) * scale;
  const x = imageSettings.x == null ? cells.length / 2 - w / 2 : imageSettings.x * scale;
  const y = imageSettings.y == null ? cells.length / 2 - h / 2 : imageSettings.y * scale;
  const opacity = imageSettings.opacity == null ? 1 : imageSettings.opacity;
  let excavation = null;
  if (imageSettings.excavate) {
    let floorX = Math.floor(x);
    let floorY = Math.floor(y);
    let ceilW = Math.ceil(w + x - floorX);
    let ceilH = Math.ceil(h + y - floorY);
    excavation = { x: floorX, y: floorY, w: ceilW, h: ceilH };
  }
  const crossOrigin = imageSettings.crossOrigin;
  return { x, y, h, w, excavation, opacity, crossOrigin };
}
function getMarginSize(includeMargin, marginSize) {
  if (marginSize != null) {
    return Math.max(Math.floor(marginSize), 0);
  }
  return includeMargin ? SPEC_MARGIN_SIZE : DEFAULT_MARGIN_SIZE;
}
function useQRCode({
  value,
  level,
  minVersion,
  includeMargin,
  marginSize,
  imageSettings,
  size,
  boostLevel
}) {
  let qrcode = import_react.default.useMemo(() => {
    const values = Array.isArray(value) ? value : [value];
    const segments = values.reduce((accum, v) => {
      accum.push(...qrcodegen_default.QrSegment.makeSegments(v));
      return accum;
    }, []);
    return qrcodegen_default.QrCode.encodeSegments(
      segments,
      ERROR_LEVEL_MAP[level],
      minVersion,
      void 0,
      void 0,
      boostLevel
    );
  }, [value, level, minVersion, boostLevel]);
  const { cells, margin, numCells, calculatedImageSettings } = import_react.default.useMemo(() => {
    let cells2 = qrcode.getModules();
    const margin2 = getMarginSize(includeMargin, marginSize);
    const numCells2 = cells2.length + margin2 * 2;
    const calculatedImageSettings2 = getImageSettings(
      cells2,
      size,
      margin2,
      imageSettings
    );
    return {
      cells: cells2,
      margin: margin2,
      numCells: numCells2,
      calculatedImageSettings: calculatedImageSettings2
    };
  }, [qrcode, size, imageSettings, includeMargin, marginSize]);
  return {
    qrcode,
    margin,
    cells,
    numCells,
    calculatedImageSettings
  };
}
var SUPPORTS_PATH2D = (function() {
  try {
    new Path2D().addPath(new Path2D());
  } catch (e) {
    return false;
  }
  return true;
})();
var QRCodeCanvas = import_react.default.forwardRef(
  function QRCodeCanvas2(props, forwardedRef) {
    const _a = props, {
      value,
      size = DEFAULT_SIZE,
      level = DEFAULT_LEVEL,
      bgColor = DEFAULT_BGCOLOR,
      fgColor = DEFAULT_FGCOLOR,
      includeMargin = DEFAULT_INCLUDEMARGIN,
      minVersion = DEFAULT_MINVERSION,
      boostLevel,
      marginSize,
      imageSettings
    } = _a, extraProps = __objRest(_a, [
      "value",
      "size",
      "level",
      "bgColor",
      "fgColor",
      "includeMargin",
      "minVersion",
      "boostLevel",
      "marginSize",
      "imageSettings"
    ]);
    const _b = extraProps, { style } = _b, otherProps = __objRest(_b, ["style"]);
    const imgSrc = imageSettings == null ? void 0 : imageSettings.src;
    const _canvas = import_react.default.useRef(null);
    const _image = import_react.default.useRef(null);
    const setCanvasRef = import_react.default.useCallback(
      (node) => {
        _canvas.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );
    const [isImgLoaded, setIsImageLoaded] = import_react.default.useState(false);
    const { margin, cells, numCells, calculatedImageSettings } = useQRCode({
      value,
      level,
      minVersion,
      boostLevel,
      includeMargin,
      marginSize,
      imageSettings,
      size
    });
    import_react.default.useEffect(() => {
      if (_canvas.current != null) {
        const canvas = _canvas.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }
        let cellsToDraw = cells;
        const image = _image.current;
        const haveImageToRender = calculatedImageSettings != null && image !== null && image.complete && image.naturalHeight !== 0 && image.naturalWidth !== 0;
        if (haveImageToRender) {
          if (calculatedImageSettings.excavation != null) {
            cellsToDraw = excavateModules(
              cells,
              calculatedImageSettings.excavation
            );
          }
        }
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.height = canvas.width = size * pixelRatio;
        const scale = size / numCells * pixelRatio;
        ctx.scale(scale, scale);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, numCells, numCells);
        ctx.fillStyle = fgColor;
        if (SUPPORTS_PATH2D) {
          ctx.fill(new Path2D(generatePath(cellsToDraw, margin)));
        } else {
          cells.forEach(function(row, rdx) {
            row.forEach(function(cell, cdx) {
              if (cell) {
                ctx.fillRect(cdx + margin, rdx + margin, 1, 1);
              }
            });
          });
        }
        if (calculatedImageSettings) {
          ctx.globalAlpha = calculatedImageSettings.opacity;
        }
        if (haveImageToRender) {
          ctx.drawImage(
            image,
            calculatedImageSettings.x + margin,
            calculatedImageSettings.y + margin,
            calculatedImageSettings.w,
            calculatedImageSettings.h
          );
        }
      }
    });
    import_react.default.useEffect(() => {
      setIsImageLoaded(false);
    }, [imgSrc]);
    const canvasStyle = __spreadValues({ height: size, width: size }, style);
    let img = null;
    if (imgSrc != null) {
      img = /* @__PURE__ */ import_react.default.createElement(
        "img",
        {
          src: imgSrc,
          key: imgSrc,
          style: { display: "none" },
          onLoad: () => {
            setIsImageLoaded(true);
          },
          ref: _image,
          crossOrigin: calculatedImageSettings == null ? void 0 : calculatedImageSettings.crossOrigin
        }
      );
    }
    return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(
      "canvas",
      __spreadValues({
        style: canvasStyle,
        height: size,
        width: size,
        ref: setCanvasRef,
        role: "img"
      }, otherProps)
    ), img);
  }
);
QRCodeCanvas.displayName = "QRCodeCanvas";
var QRCodeSVG = import_react.default.forwardRef(
  function QRCodeSVG2(props, forwardedRef) {
    const _a = props, {
      value,
      size = DEFAULT_SIZE,
      level = DEFAULT_LEVEL,
      bgColor = DEFAULT_BGCOLOR,
      fgColor = DEFAULT_FGCOLOR,
      includeMargin = DEFAULT_INCLUDEMARGIN,
      minVersion = DEFAULT_MINVERSION,
      boostLevel,
      title,
      marginSize,
      imageSettings
    } = _a, otherProps = __objRest(_a, [
      "value",
      "size",
      "level",
      "bgColor",
      "fgColor",
      "includeMargin",
      "minVersion",
      "boostLevel",
      "title",
      "marginSize",
      "imageSettings"
    ]);
    const { margin, cells, numCells, calculatedImageSettings } = useQRCode({
      value,
      level,
      minVersion,
      boostLevel,
      includeMargin,
      marginSize,
      imageSettings,
      size
    });
    let cellsToDraw = cells;
    let image = null;
    if (imageSettings != null && calculatedImageSettings != null) {
      if (calculatedImageSettings.excavation != null) {
        cellsToDraw = excavateModules(
          cells,
          calculatedImageSettings.excavation
        );
      }
      image = /* @__PURE__ */ import_react.default.createElement(
        "image",
        {
          href: imageSettings.src,
          height: calculatedImageSettings.h,
          width: calculatedImageSettings.w,
          x: calculatedImageSettings.x + margin,
          y: calculatedImageSettings.y + margin,
          preserveAspectRatio: "none",
          opacity: calculatedImageSettings.opacity,
          crossOrigin: calculatedImageSettings.crossOrigin
        }
      );
    }
    const fgPath = generatePath(cellsToDraw, margin);
    return /* @__PURE__ */ import_react.default.createElement(
      "svg",
      __spreadValues({
        height: size,
        width: size,
        viewBox: `0 0 ${numCells} ${numCells}`,
        ref: forwardedRef,
        role: "img"
      }, otherProps),
      !!title && /* @__PURE__ */ import_react.default.createElement("title", null, title),
      /* @__PURE__ */ import_react.default.createElement(
        "path",
        {
          fill: bgColor,
          d: `M0,0 h${numCells}v${numCells}H0z`,
          shapeRendering: "crispEdges"
        }
      ),
      /* @__PURE__ */ import_react.default.createElement("path", { fill: fgColor, d: fgPath, shapeRendering: "crispEdges" }),
      image
    );
  }
);
QRCodeSVG.displayName = "QRCodeSVG";

// src/client/api.js
async function fetchStatus() {
  const response = await fetch("/api/tunnel-gate/status", { cache: "no-store" });
  if (!response.ok) throw new Error(`status ${String(response.status)}`);
  return response.json();
}
async function postAction(action, body) {
  const response = await fetch(`/api/tunnel-gate/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === void 0 ? void 0 : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.reason ?? String(response.status));
    error.payload = payload;
    throw error;
  }
  return payload;
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// src/client/format.js
function secondsRemaining(expiresAt, now) {
  if (typeof expiresAt !== "number" || typeof now !== "number") return 0;
  return Math.max(0, Math.ceil((expiresAt - now) / 1e3));
}
function countdownLabel(expiresAt, now) {
  const seconds = secondsRemaining(expiresAt, now);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function lastSeenLabel(timestamp, now) {
  if (typeof timestamp !== "number" || typeof now !== "number" || now < timestamp) return "\u521A\u521A";
  const seconds = Math.floor((now - timestamp) / 1e3);
  if (seconds < 60) return "\u521A\u521A";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} \u5206\u949F\u524D`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} \u5C0F\u65F6\u524D`;
  return `${Math.floor(hours / 24)} \u5929\u524D`;
}
function tunnelBadge(state) {
  switch (state) {
    case "running":
      return { text: "\u8FD0\u884C\u4E2D", color: "var(--dsw-alias-state-success-primary)" };
    case "starting":
      return { text: "\u542F\u52A8\u4E2D", color: "var(--dsw-alias-state-warn-primary)" };
    case "error":
      return { text: "\u51FA\u9519", color: "var(--dsw-alias-state-error-primary)" };
    default:
      return { text: "\u5DF2\u505C\u6B62", color: "var(--dsw-alias-label-tertiary)" };
  }
}

// src/loopback.js
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

// src/client/save-state.js
var SAVE_STATE = {
  idle: "idle",
  saving: "saving",
  saved: "saved",
  failed: "failed"
};
function saveOutcome(results) {
  const attempted = results.filter((result) => result !== "skipped");
  if (attempted.length === 0) return SAVE_STATE.failed;
  return attempted.every((result) => result === true) ? SAVE_STATE.saved : SAVE_STATE.failed;
}
function savePlan(form, draft) {
  if (form === void 0) return [];
  const writes = [];
  if (typeof draft?.publicHostname === "string" && draft.publicHostname.trim() !== "") {
    writes.push({ field: "publicHostname", value: draft.publicHostname.trim() });
  }
  if (typeof draft?.tunnelToken === "string" && draft.tunnelToken.trim() !== "") {
    writes.push({ field: "tunnelToken", value: draft.tunnelToken.trim() });
  }
  writes.push({ field: "autoTunnel", value: draft?.autoTunnel === true });
  if (typeof draft?.gateHost === "string" && draft.gateHost.trim() !== "") {
    writes.push({ field: "gateHost", value: draft.gateHost.trim() });
  }
  return writes;
}
function settingsAccess(form, pageHostname) {
  if (form === void 0) return { mode: "unavailable" };
  const local = isLoopbackHostname(typeof pageHostname === "string" ? pageHostname : "");
  const snapshot = form?.getSnapshot?.();
  if (!local) return { mode: "readonly", value: snapshot?.value ?? {} };
  if (snapshot?.status !== "ready") return { mode: "loading" };
  if (snapshot.writable === false) {
    return { mode: "readonly", value: snapshot.value ?? {} };
  }
  return { mode: "editable", value: snapshot.value ?? {} };
}

// src/client/panel.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var REPO_URL = "https://github.com/12624841/dsh-tunnel-gate";
var DICT = {
  title: "\u8FDC\u7A0B\u96A7\u9053",
  disclaimer: "\u516C\u7F51\u66B4\u9732\u6709\u98CE\u9669\uFF1A\u8BF7\u4FDD\u7BA1\u597D\u914D\u5BF9\u7801\uFF0C\u53CA\u65F6\u65AD\u5F00\u4E0D\u7528\u7684\u8BBE\u5907",
  github: "GitHub",
  pairCard: "\u8BBE\u5907\u914D\u5BF9",
  codeHint: "\u5728\u624B\u673A\u4E0A\u6253\u5F00\u914D\u5BF9\u94FE\u63A5\u5E76\u8F93\u5165\u6B64\u7801\uFF1B\u914D\u5BF9\u7801\u6BCF 60 \u79D2\u8F6E\u6362\u3002",
  scanHint: "\u626B\u7801\u6253\u5F00\u914D\u5BF9\u9875\uFF08\u5DF2\u5E26\u4E0A\u914D\u5BF9\u7801\uFF09",
  refresh: "\u5237\u65B0",
  copyLink: "\u590D\u5236\u94FE\u63A5",
  copied: "\u5DF2\u590D\u5236",
  copy: "\u590D\u5236",
  tunnelCard: "Cloudflare \u96A7\u9053",
  restart: "\u91CD\u542F\u96A7\u9053",
  cfHint: "Cloudflare \u63A7\u5236\u53F0\u91CC\u628A\u516C\u5171\u4E3B\u673A\u540D\u7684\u670D\u52A1\u6307\u5411 http://localhost:16177\u3002",
  devicesCard: "\u5DF2\u914D\u5BF9\u8BBE\u5907",
  noDevices: "\u8FD8\u6CA1\u6709\u8BBE\u5907\u914D\u5BF9",
  disconnect: "\u65AD\u5F00",
  disconnectAll: "\u5168\u90E8\u65AD\u5F00",
  settingsCard: "\u8BBE\u7F6E\uFF08\u57DF\u540D / Token\uFF09",
  enabled: "\u542F\u7528\u8FDC\u7A0B\u8BBF\u95EE",
  hostname: "\u56FA\u5B9A\u57DF\u540D",
  gateBind: "\u76D1\u542C\u5730\u5740",
  readonlyHint: "\u8FDC\u7A0B\u9875\u9762\u4E3A\u53EA\u8BFB\uFF1A\u8BF7\u5728\u7535\u8111\u672C\u673A (localhost) \u7684\u9762\u677F\u4FEE\u6539\u8BBE\u7F6E",
  loadingHint: "\u52A0\u8F7D\u4E2D\u2026",
  hostnamePh: "https://dsh.example.com",
  token: "\u96A7\u9053 Token",
  tokenPh: "Cloudflare \u547D\u540D\u96A7\u9053 Token",
  autoTunnel: "\u6CA1\u6709\u56FA\u5B9A\u57DF\u540D\u65F6\u7528\u5FEB\u901F\u96A7\u9053",
  save: "\u4FDD\u5B58\u8BBE\u7F6E",
  saved: "\u5DF2\u4FDD\u5B58",
  saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A\u914D\u7F6E\u6761\u76EE\u4E0D\u53EF\u5199",
  settingsUnavailable: "\u8BBE\u7F6E\u4E0D\u53EF\u7528\uFF1A\u63D2\u4EF6\u6761\u76EE\u672A\u6301\u4E45\u5316\u3002\u91CD\u542F\u4E00\u6B21 dsh web \u540E\u5373\u53EF\u4FDD\u5B58\u3002",
  gateBindPh: "\u76D1\u542C\u5730\u5740 127.0.0.1 / 0.0.0.0 / 192.0.2.22",
  gateRestart: "\u91CD\u542F 16177",
  lan: "\u5185\u7F51",
  unreachable: "\u65E0\u6CD5\u8FDE\u63A5\u4E3B\u673A\u7AEF\uFF08\u63D2\u4EF6\u672A\u8FD0\u884C\uFF1F\uFF09",
  online: "\u5728\u7EBF",
  offline: "\u79BB\u7EBF",
  expire: "\u6709\u6548\u671F",
  cooldown: "\u51B7\u5374\u4E2D",
  close: "\u5173\u95ED"
};
function makeT(propsT) {
  return (key) => {
    const viaProps = typeof propsT === "function" ? propsT(key) : void 0;
    return typeof viaProps === "string" && viaProps !== "" ? viaProps : DICT[key] ?? key;
  };
}
var activeSettingsForm = void 0;
function provideSettingsForm(form) {
  activeSettingsForm = form;
}
var formOf = (form) => form ?? activeSettingsForm;
function formEnabled(form) {
  const snapshot = formOf(form)?.getSnapshot?.();
  if (snapshot?.status !== "ready") return true;
  return snapshot.value?.enabled !== false;
}
function GateIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3.6 9h16.8M3.6 15h16.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18z" })
  ] });
}
var S = {
  card: {
    border: "1px solid var(--dsw-alias-border-l2)",
    borderRadius: 12,
    background: "var(--dsw-alias-bg-layer-1)",
    padding: "10px 12px",
    marginBottom: 10
  },
  cardTitle: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-secondary)", marginBottom: 8, letterSpacing: "0.02em" },
  code: {
    fontFamily: "var(--dsw-font-mono)",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "0.22em",
    textAlign: "center",
    color: "var(--dsw-alias-label-primary)",
    fontVariantNumeric: "tabular-nums",
    margin: "2px 0 2px 0.22em"
  },
  row: { display: "flex", alignItems: "center", gap: 8 },
  spacer: { flex: 1 },
  input: {
    width: "100%",
    border: "1px solid var(--dsw-alias-border-l2)",
    background: "var(--dsw-alias-bg-base)",
    color: "var(--dsw-alias-label-primary)",
    borderRadius: 8,
    padding: "6px 9px",
    fontSize: 13,
    outline: "none",
    marginBottom: 8
  },
  inputFocus: { borderColor: "var(--dsw-alias-brand-primary)" },
  hint: { fontSize: 11, color: "var(--dsw-alias-label-secondary)", lineHeight: 1.5, marginTop: 6 },
  badge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 },
  url: { fontSize: 12, wordBreak: "break-all", color: "var(--dsw-alias-brand-primary)" }
};
function DeviceRow({ device, t, onRevoke }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...S.row, justifyContent: "space-between", padding: "5px 0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { ...S.row, fontSize: 13, minWidth: 0, color: "var(--dsw-alias-label-primary)" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          "aria-label": device.online ? t("online") : t("offline"),
          style: {
            width: 7,
            height: 7,
            borderRadius: 999,
            flex: "none",
            background: device.online ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-label-tertiary)"
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: device.name }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11, flex: "none" }, children: lastSeenLabel(device.lastSeenAt, Date.now()) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "tg-btn tg-btn-danger", onClick: () => onRevoke(device.id), children: t("disconnect") })
  ] });
}
function Panel({ t, onClose }) {
  const settingsForm = formOf(void 0);
  const [status, setStatus] = (0, import_react2.useState)(void 0);
  const [error, setError] = (0, import_react2.useState)(false);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [copied, setCopied] = (0, import_react2.useState)(false);
  const [copiedUrl, setCopiedUrl] = (0, import_react2.useState)(false);
  const [tick, setTick] = (0, import_react2.useState)(0);
  const [showSettings, setShowSettings] = (0, import_react2.useState)(false);
  const [draft, setDraft] = (0, import_react2.useState)({ publicHostname: "", tunnelToken: "", autoTunnel: false, gateHost: "" });
  const [saveState, setSaveState] = (0, import_react2.useState)(SAVE_STATE.idle);
  const refresh = (0, import_react2.useCallback)(async () => {
    try {
      const snapshot = await fetchStatus();
      setStatus(snapshot);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  (0, import_react2.useEffect)(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), 5e3);
    const ticker = setInterval(() => setTick((value) => value + 1), 1e3);
    return () => {
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, [refresh]);
  (0, import_react2.useEffect)(() => {
    const syncDraft = () => {
      const snapshot = settingsForm?.getSnapshot?.();
      if (snapshot?.status !== "ready") return;
      setDraft((current) => ({
        ...current,
        publicHostname: typeof snapshot.value?.publicHostname === "string" ? snapshot.value.publicHostname : current.publicHostname,
        gateHost: typeof snapshot.value?.gateHost === "string" ? snapshot.value.gateHost : current.gateHost,
        autoTunnel: snapshot.value?.autoTunnel === true
      }));
    };
    syncDraft();
    return settingsForm?.subscribe?.(syncDraft);
  }, [settingsForm]);
  const writeField = (0, import_react2.useCallback)(async (field, value) => {
    const form = formOf(void 0);
    setBusy(true);
    try {
      let ok = false;
      try {
        ok = await form?.set?.(field, value) === true;
      } catch {
        ok = false;
      }
      setSaveState(ok ? SAVE_STATE.saved : SAVE_STATE.failed);
      if (ok) setTimeout(() => setSaveState(SAVE_STATE.idle), 2500);
      return ok;
    } finally {
      setBusy(false);
    }
  }, []);
  const saveSettings = (0, import_react2.useCallback)(() => {
    void (async () => {
      const form = formOf(void 0);
      const writes = savePlan(form, draft);
      setBusy(true);
      try {
        const results = [];
        for (const write of writes) {
          try {
            results.push(await form.set(write.field, write.value) === true);
          } catch {
            results.push(false);
          }
        }
        const outcome = saveOutcome(results);
        setSaveState(outcome);
        if (outcome === SAVE_STATE.saved) {
          setDraft((current) => ({ ...current, tunnelToken: "" }));
          setTimeout(() => setSaveState(SAVE_STATE.idle), 2500);
        }
      } finally {
        setBusy(false);
      }
    })();
  }, [draft]);
  const act = (0, import_react2.useCallback)(async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (actionError) {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const expiry = status === void 0 ? void 0 : countdownLabel(status.codeExpiresAt, Date.now());
  void tick;
  const badge = tunnelBadge(status?.tunnel?.state);
  const publicUrl = status?.publicUrl ?? status?.tunnel?.publicUrl ?? void 0;
  const cooling = status?.cooldownUntil !== void 0 && Date.now() < status.cooldownUntil;
  const coolingLeft = cooling ? countdownLabel(status.cooldownUntil, Date.now()) : "";
  const cfgEcho = { ...access.value ?? {}, ...status?.config ?? {} };
  const access = settingsAccess(settingsForm, window.location.hostname);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { width: 330, maxHeight: "72vh", overflowY: "auto" }, role: "dialog", "aria-label": t("title"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...S.row, marginBottom: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { style: { fontSize: 14 }, children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.spacer }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "tg-btn", onClick: onClose, "aria-label": t("close"), children: "\u2715" })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.hint, color: "var(--dsw-alias-state-error-primary)", marginBottom: 8 }, children: t("unreachable") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.cardTitle, children: t("pairCard") }),
      status ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.code, children: status.code }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.row, justifyContent: "center", fontSize: 11, marginBottom: 8, color: cooling ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-secondary)" }, children: cooling ? `${t("cooldown")} ${coolingLeft}` : `${t("expire")} ${expiry}` }),
        status.pairUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.row, justifyContent: "center", marginBottom: 10 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "a",
          {
            href: status.pairUrl,
            target: "_blank",
            rel: "noreferrer",
            title: t("scanHint"),
            style: { background: "#ffffff", borderRadius: 10, padding: 8, display: "inline-block", lineHeight: 0 },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QRCodeSVG, { value: status.pairUrl, size: 144, bgColor: "#ffffff", fgColor: "#000000", level: "M" })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...S.row, justifyContent: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "tg-btn", disabled: busy, onClick: () => void act(() => postAction("rotate")), children: t("refresh") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "tg-btn",
              disabled: busy || !status.pairUrl,
              onClick: () => {
                void copyText(status.pairUrl ?? "").then((ok) => {
                  if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }
                });
              },
              children: copied ? t("copied") : t("copyLink")
            }
          )
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.hint, textAlign: "center" }, children: "\u2026" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...S.row, marginBottom: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.cardTitle, children: t("tunnelCard") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.spacer }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...S.badge, background: `color-mix(in srgb, ${badge.color} 15%, transparent)`, color: badge.color }, children: badge.text })
      ] }),
      publicUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...S.row, marginTop: 2 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "a",
          {
            href: publicUrl,
            target: "_blank",
            rel: "noreferrer",
            title: publicUrl,
            style: { ...S.url, textDecoration: "none" },
            children: publicUrl.replace(/^https?:\/\//, "")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.spacer }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "tg-btn",
            disabled: copiedUrl,
            onClick: () => {
              void copyText(publicUrl).then((ok) => {
                if (ok) {
                  setCopiedUrl(true);
                  setTimeout(() => setCopiedUrl(false), 1500);
                }
              });
            },
            children: copiedUrl ? t("copied") : t("copy")
          }
        )
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.hint, children: t("cfHint") }),
      (status?.gate?.lanUrls ?? []).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 6 }, children: (status?.gate?.lanUrls ?? []).map((url) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "a",
        {
          href: url,
          target: "_blank",
          rel: "noreferrer",
          style: { ...S.url, display: "block", fontSize: 11, textDecoration: "none" },
          children: [
            t("lan"),
            ": ",
            url.replace(/^https?:\/\//, ""),
            " \u2197"
          ]
        },
        url
      )) }),
      status?.tunnel?.error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.hint, color: "var(--dsw-alias-state-error-primary)" }, children: status.tunnel.error }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...S.row, marginTop: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: S.spacer }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "tg-btn", disabled: busy, onClick: () => void act(() => postAction("gate/restart")), title: t("gateBindPh"), children: t("gateRestart") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "tg-btn", disabled: busy, onClick: () => void act(() => postAction("tunnel/restart")), children: t("restart") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.cardTitle, children: t("devicesCard") }),
      (status?.devices ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.hint, children: t("noDevices") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        (status?.devices ?? []).map((device) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceRow, { device, t, onRevoke: (id) => void act(() => postAction("devices/revoke", { id })) }, device.id)),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.row, justifyContent: "flex-end", marginTop: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "tg-btn tg-btn-danger", disabled: busy, onClick: () => void act(() => postAction("devices/revoke-all")), children: t("disconnectAll") }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: S.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          style: { ...S.btn, border: 0, background: "transparent", padding: 0, opacity: 0.65, fontWeight: 600, fontSize: 12 },
          onClick: () => setShowSettings((value) => !value),
          children: [
            showSettings ? "\u25BE " : "\u25B8 ",
            t("settingsCard")
          ]
        }
      ),
      showSettings && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 10 }, children: access.mode === "unavailable" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.hint, color: "var(--dsw-alias-state-error-primary)" }, children: t("settingsUnavailable") }) : access.mode === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: S.hint, children: t("loadingHint") }) : access.mode === "readonly" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, lineHeight: 2 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            t("hostname"),
            ": ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: cfgEcho.publicHostname || "\u2014" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            t("gateBind"),
            ": ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: cfgEcho.gateHost || "127.0.0.1" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            t("autoTunnel"),
            ": ",
            cfgEcho.autoTunnel === true ? "\u2713" : "\u2014"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            t("enabled"),
            ": ",
            cfgEcho.enabled !== false ? "\u2713" : "\u2014"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...S.hint, color: "var(--dsw-alias-state-warn-primary)", marginTop: 6 }, children: t("readonlyHint") })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { fontSize: 11, opacity: 0.7, display: "block", marginBottom: 4 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked: formEnabled(settingsForm),
              style: { marginRight: 6, verticalAlign: "-2px" },
              onChange: (event) => void writeField("enabled", event.target.checked)
            }
          ),
          t("enabled")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            style: S.input,
            placeholder: t("hostnamePh"),
            value: draft.publicHostname,
            onChange: (event) => setDraft((current) => ({ ...current, publicHostname: event.target.value }))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            style: S.input,
            type: "password",
            placeholder: t("tokenPh"),
            value: draft.tunnelToken,
            onChange: (event) => setDraft((current) => ({ ...current, tunnelToken: event.target.value }))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            style: S.input,
            placeholder: t("gateBindPh"),
            value: draft.gateHost,
            onChange: (event) => setDraft((current) => ({ ...current, gateHost: event.target.value }))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { fontSize: 11, opacity: 0.7, display: "block", marginBottom: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked: draft.autoTunnel,
              style: { marginRight: 6, verticalAlign: "-2px" },
              onChange: (event) => setDraft((current) => ({ ...current, autoTunnel: event.target.checked }))
            }
          ),
          t("autoTunnel")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...S.row }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "tg-btn tg-btn-primary", disabled: busy, onClick: saveSettings, children: saveState === SAVE_STATE.saved ? t("saved") : t("save") }),
          saveState === SAVE_STATE.saved && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 11, color: "var(--dsw-alias-state-success-primary)" }, children: [
            "\u2713 ",
            t("saved")
          ] }),
          saveState === SAVE_STATE.failed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 11, color: "var(--dsw-alias-state-error-primary)" }, children: [
            "\u2717 ",
            t("saveFailed")
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...S.row, justifyContent: "center", marginTop: 10, fontSize: 10, color: "var(--dsw-alias-label-tertiary)", gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { textAlign: "center" }, children: t("disclaimer") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: "none", opacity: 0.6 }, children: "\xB7" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: REPO_URL, target: "_blank", rel: "noreferrer", style: { color: "var(--dsw-alias-brand-primary)", textDecoration: "none", flex: "none" }, children: t("github") })
      ] })
    ] })
  ] });
}
function FooterEntry(props = {}) {
  const t = makeT(props.t);
  const [open, setOpen] = (0, import_react2.useState)(false);
  const buttonRef = (0, import_react2.useRef)(void 0);
  const [pos, setPos] = (0, import_react2.useState)(void 0);
  const openPanel = () => {
    const rect = buttonRef.current?.getBoundingClientRect?.();
    if (rect !== void 0) {
      setPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 350)),
        bottom: Math.max(8, window.innerHeight - rect.top + 8)
      });
    }
    setOpen(true);
  };
  (0, import_react2.useEffect)(() => {
    if (!open) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event) => {
      if (event.target instanceof Element && event.target.closest?.("[data-tunnel-gate-panel]") === null && event.target.closest?.("[data-tunnel-gate-trigger]") === null) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { position: "relative", display: "inline-flex" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        ref: buttonRef,
        type: "button",
        "data-tunnel-gate-trigger": true,
        title: t("title"),
        "aria-label": t("title"),
        "aria-expanded": open,
        onClick: () => open ? setOpen(false) : openPanel(),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GateIcon, {})
      }
    ),
    open && pos !== void 0 && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          "data-tunnel-gate-panel": true,
          style: {
            position: "fixed",
            left: pos.left,
            bottom: pos.bottom,
            zIndex: 1e4,
            background: "var(--dsw-alias-bg-layer-2)",
            color: "var(--dsw-alias-label-primary)",
            border: "1px solid var(--dsw-alias-border-l2)",
            borderRadius: 16,
            boxShadow: "var(--dsw-shadow-lv3)",
            padding: 14
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { t, onClose: () => setOpen(false) })
        }
      ),
      document.body
    )
  ] });
}

// src/client/index.jsx
var NS = "tunnel-gate";
var zh = {
  title: "\u8FDC\u7A0B\u96A7\u9053",
  disclaimer: "\u516C\u7F51\u66B4\u9732\u6709\u98CE\u9669\uFF1A\u8BF7\u4FDD\u7BA1\u597D\u914D\u5BF9\u7801\uFF0C\u53CA\u65F6\u65AD\u5F00\u4E0D\u7528\u7684\u8BBE\u5907",
  github: "GitHub",
  pairCard: "\u8BBE\u5907\u914D\u5BF9",
  codeHint: "\u5728\u624B\u673A\u4E0A\u6253\u5F00\u914D\u5BF9\u94FE\u63A5\u5E76\u8F93\u5165\u6B64\u7801\uFF1B\u914D\u5BF9\u7801\u6BCF 60 \u79D2\u8F6E\u6362\u3002",
  refresh: "\u5237\u65B0",
  copyLink: "\u590D\u5236\u94FE\u63A5",
  copied: "\u5DF2\u590D\u5236",
  copy: "\u590D\u5236",
  tunnelCard: "Cloudflare \u96A7\u9053",
  restart: "\u91CD\u542F\u96A7\u9053",
  cfHint: "Cloudflare \u63A7\u5236\u53F0\u91CC\u628A\u516C\u5171\u4E3B\u673A\u540D\u7684\u670D\u52A1\u6307\u5411 http://localhost:16177\u3002",
  devicesCard: "\u5DF2\u914D\u5BF9\u8BBE\u5907",
  noDevices: "\u8FD8\u6CA1\u6709\u8BBE\u5907\u914D\u5BF9",
  disconnect: "\u65AD\u5F00",
  disconnectAll: "\u5168\u90E8\u65AD\u5F00",
  settingsCard: "\u8BBE\u7F6E\uFF08\u57DF\u540D / Token\uFF09",
  enabled: "\u542F\u7528\u8FDC\u7A0B\u8BBF\u95EE",
  hostname: "\u56FA\u5B9A\u57DF\u540D",
  gateBind: "\u76D1\u542C\u5730\u5740",
  readonlyHint: "\u8FDC\u7A0B\u9875\u9762\u4E3A\u53EA\u8BFB\uFF1A\u8BF7\u5728\u7535\u8111\u672C\u673A (localhost) \u7684\u9762\u677F\u4FEE\u6539\u8BBE\u7F6E",
  loadingHint: "\u52A0\u8F7D\u4E2D\u2026",
  hostnamePh: "https://dsh.example.com\uFF08\u53EF\u5E26 https:// \u6216 http://\uFF09",
  token: "\u96A7\u9053 Token",
  tokenPh: "Cloudflare \u547D\u540D\u96A7\u9053 Token",
  autoTunnel: "\u6CA1\u6709\u56FA\u5B9A\u57DF\u540D\u65F6\u7528\u5FEB\u901F\u96A7\u9053",
  save: "\u4FDD\u5B58\u8BBE\u7F6E",
  saved: "\u5DF2\u4FDD\u5B58",
  saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A\u914D\u7F6E\u6761\u76EE\u4E0D\u53EF\u5199",
  settingsUnavailable: "\u8BBE\u7F6E\u4E0D\u53EF\u7528\uFF1A\u63D2\u4EF6\u6761\u76EE\u672A\u6301\u4E45\u5316\u3002\u91CD\u542F\u4E00\u6B21 dsh web \u540E\u5373\u53EF\u4FDD\u5B58\u3002",
  gateBindPh: "\u76D1\u542C\u5730\u5740 127.0.0.1 / 0.0.0.0 / 192.0.2.22",
  gateRestart: "\u91CD\u542F 16177",
  lan: "\u5185\u7F51",
  unreachable: "\u65E0\u6CD5\u8FDE\u63A5\u4E3B\u673A\u7AEF\uFF08\u63D2\u4EF6\u672A\u8FD0\u884C\uFF1F\uFF09",
  online: "\u5728\u7EBF",
  offline: "\u79BB\u7EBF",
  expire: "\u6709\u6548\u671F",
  cooldown: "\u51B7\u5374\u4E2D",
  close: "\u5173\u95ED"
};
var en = {
  title: "Remote tunnel",
  disclaimer: "Exposing to the internet has risks: guard your pairing code and unpair idle devices",
  github: "GitHub",
  pairCard: "Pair a device",
  codeHint: "Open the pairing link on your phone and enter this code; it rotates every 60s.",
  refresh: "Refresh",
  copyLink: "Copy link",
  copied: "Copied",
  copy: "Copy",
  tunnelCard: "Cloudflare tunnel",
  restart: "Restart tunnel",
  cfHint: "Point the public hostname service at http://localhost:16177 in the Cloudflare dashboard.",
  devicesCard: "Paired devices",
  noDevices: "No device has paired yet",
  disconnect: "Unpair",
  disconnectAll: "Unpair all",
  settingsCard: "Settings (hostname / token)",
  enabled: "Enable remote access",
  hostname: "Fixed hostname",
  gateBind: "Bind address",
  readonlyHint: "Read-only on remote pages: edit settings from the local (localhost) panel",
  loadingHint: "Loading\u2026",
  hostnamePh: "https://dsh.example.com (https:// or http://)",
  token: "Tunnel token",
  tokenPh: "Cloudflare named tunnel token",
  autoTunnel: "Use a quick tunnel when no hostname is set",
  save: "Save settings",
  saved: "Saved",
  saveFailed: "Save failed: the config entry is not writable",
  settingsUnavailable: "Settings unavailable: the plugin entry is not persisted. Restart dsh web once to enable saving.",
  gateBindPh: "Bind address 127.0.0.1 / 0.0.0.0 / 192.0.2.22",
  gateRestart: "Restart 16177",
  lan: "LAN",
  unreachable: "Host unreachable (plugin not running?)",
  online: "online",
  offline: "offline",
  expire: "expires in",
  cooldown: "Cooling down",
  close: "Close"
};
var inject = ["slots", "locale", "configForms"];
var STYLE_ID = "dsh-tunnel-gate-styles";
var STYLE_TEXT = `
[data-tunnel-gate-trigger] {
  width: 36px; height: 36px; border: none; border-radius: 50%; padding: 0;
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
[data-tunnel-gate-trigger]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary);
}
[data-tunnel-gate-trigger]:active:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-active);
}
[data-tunnel-gate-trigger][aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary);
}
[data-tunnel-gate-trigger]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);
}
.tg-btn {
  border: none; border-radius: 8px; padding: 4px 10px;
  background: var(--dsw-alias-button-elevated-fill); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap;
  transition: background-color 120ms ease;
}
.tg-btn:hover:not(:disabled) { background: var(--dsw-alias-button-floating-hover); }
.tg-btn:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }
.tg-btn:disabled { opacity: 0.5; cursor: default; }
.tg-btn-danger { background: transparent; color: var(--dsw-alias-state-error-primary); }
.tg-btn-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.tg-btn-primary {
  border: 1px solid var(--dsw-alias-button-primary-fill);
  background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground);
  font-weight: 500; padding: 6px 12px;
  transition: background-color 120ms ease, border-color 120ms ease, opacity 120ms ease;
}
.tg-btn-primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover); border-color: var(--dsw-alias-button-primary-hover);
}
.tg-btn-primary:disabled { opacity: 0.6; cursor: default; }
`;
function apply(ctx) {
  try {
    ctx.locale?.register?.(NS, { zh, en });
  } catch {
  }
  let settingsForm;
  try {
    settingsForm = ctx.configForms?.get?.(NS) ?? void 0;
  } catch {
    settingsForm = void 0;
  }
  provideSettingsForm(settingsForm);
  let style = document.getElementById(STYLE_ID);
  if (style === null) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
  }
  ctx.effect(() => () => style?.remove?.(), "tunnel-gate-client: styles");
  ctx.slots?.inject?.("sidebar.footer.action", () => {
    let disposeEntry;
    const enabled = () => {
      const snapshot = settingsForm?.getSnapshot?.();
      return snapshot?.status !== "ready" || snapshot.value?.enabled !== false;
    };
    const syncEntry = () => {
      if (enabled() && disposeEntry === void 0) {
        try {
          disposeEntry = ctx.slots.register({ name: "sidebar.footer.action", id: NS, locale: NS }, FooterEntry);
        } catch {
        }
      } else if (!enabled() && disposeEntry !== void 0) {
        try {
          disposeEntry();
        } catch {
        }
        disposeEntry = void 0;
      }
    };
    let unsubscribe;
    try {
      unsubscribe = settingsForm?.subscribe?.(syncEntry);
    } catch {
      unsubscribe = void 0;
    }
    syncEntry();
    return () => {
      try {
        unsubscribe?.();
      } catch {
      }
      try {
        disposeEntry?.();
      } catch {
      }
    };
  });
}
return module.exports; } });
//# sourceMappingURL=client.js.map
