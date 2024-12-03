"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UniqueSet = exports.BloomSet = void 0;

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

function _get() { if (typeof Reflect !== "undefined" && Reflect.get) { _get = Reflect.get; } else { _get = function _get(target, property, receiver) { var base = _superPropBase(target, property); if (!base) return; var desc = Object.getOwnPropertyDescriptor(base, property); if (desc.get) { return desc.get.call(arguments.length < 3 ? target : receiver); } return desc.value; }; } return _get.apply(this, arguments); }

function _superPropBase(object, property) { while (!Object.prototype.hasOwnProperty.call(object, property)) { object = _getPrototypeOf(object); if (object === null) break; } return object; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); Object.defineProperty(subClass, "prototype", { writable: false }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } else if (call !== void 0) { throw new TypeError("Derived constructors may only return object or undefined"); } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

var UniqueSet = /*#__PURE__*/function (_Set) {
  _inherits(UniqueSet, _Set);

  var _super = _createSuper(UniqueSet);

  function UniqueSet() {
    var _this;

    var iterable = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

    _classCallCheck(this, UniqueSet);

    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("UniqueSet requires an iterable");
    }

    _this = _super.call(this);

    var _iterator = _createForOfIteratorHelper(iterable),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var item = _step.value;

        _this.add(item);
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }

    return _this;
  }

  _createClass(UniqueSet, [{
    key: "has",
    value: function has(o) {
      var _iterator2 = _createForOfIteratorHelper(this),
          _step2;

      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var i = _step2.value;

          if ((0, _fastDeepEqual["default"])(o, i)) {
            return true;
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }

      return false;
    }
  }, {
    key: "add",
    value: function add(o) {
      if (!this.has(o)) {
        _get(_getPrototypeOf(UniqueSet.prototype), "add", this).call(this, o);
      }

      return this;
    }
  }]);

  return UniqueSet;
}( /*#__PURE__*/_wrapNativeSuper(Set));

exports.UniqueSet = UniqueSet;

var BloomSet = /*#__PURE__*/function (_Set2) {
  _inherits(BloomSet, _Set2);

  var _super2 = _createSuper(BloomSet);

  function BloomSet() {
    var _this2;

    var iterable = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$size = _ref.size,
        size = _ref$size === void 0 ? 28755000 : _ref$size,
        _ref$hashCount = _ref.hashCount,
        hashCount = _ref$hashCount === void 0 ? 20 : _ref$hashCount;

    _classCallCheck(this, BloomSet);

    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("BloomSet requires an iterable");
    }

    _this2 = _super2.call(this);

    if (typeof size !== "number" || size <= 0) {
      size = 28755000; // < 5 false positives, with 1M elements, using 3.5Mb RAM, needs 20 hashes
    }

    _this2.aSize = _this2._findNextPrime(size);

    if (typeof hashCount !== "number" || hashCount <= 0) {
      hashCount = 20;
    }

    _this2.hashCount = hashCount;
    _this2.bitArray = new Uint8Array(Math.ceil(size / 8));

    var _iterator3 = _createForOfIteratorHelper(iterable),
        _step3;

    try {
      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
        var item = _step3.value;

        _this2.add(item);
      }
    } catch (err) {
      _iterator3.e(err);
    } finally {
      _iterator3.f();
    }

    return _this2;
  }

  _createClass(BloomSet, [{
    key: "_findNextPrime",
    value: function _findNextPrime(num) {
      if (num < 2) return 2;
      if (num % 2 === 0) num++; // Odd numbers only

      while (!this._isPrime(num)) {
        num += 2; // Odd numbers only
      }

      return num;
    }
  }, {
    key: "_isPrime",
    value: function _isPrime(num) {
      if (num < 2) return false;
      if (num === 2 || num === 3) return true;
      if (num % 2 === 0 || num % 3 === 0) return false;
      var sqrt = Math.floor(Math.sqrt(num));

      for (var i = 5; i <= sqrt; i += 6) {
        if (num % i === 0 || num % (i + 2) === 0) return false;
      }

      return true;
    }
  }, {
    key: "_serialize",
    value: function _serialize(item) {
      if (typeof item === "number" && isNaN(item)) {
        return "NaN";
      }

      if (item && _typeof(item) === "object") {
        var serialize = this._serialize.bind(this);

        if (Array.isArray(item)) {
          return "[".concat(item.map(serialize).join(","), "]");
        } else {
          return "{".concat(Object.entries(item).sort(function (_ref2, _ref3) {
            var _ref4 = _slicedToArray(_ref2, 1),
                a = _ref4[0];

            var _ref5 = _slicedToArray(_ref3, 1),
                b = _ref5[0];

            return a.localeCompare(b);
          }).map(function (_ref6) {
            var _ref7 = _slicedToArray(_ref6, 2),
                k = _ref7[0],
                v = _ref7[1];

            return "".concat(k, ":").concat(serialize(v));
          }).join(","), "}");
        }
      }

      return String(item);
    }
  }, {
    key: "_hashes",
    value: function _hashes(item) {
      var hashes = [];

      var str = this._serialize(item);

      var hash = this._fnv1a(str); // Base hash
      // Bloom into hashCount hash values


      for (var i = 0; i < this.hashCount; i++) {
        while (hash >= this.aSize) {
          hash -= this.aSize; // Ensure hash is within bounds
        } // Track


        hashes.push(hash); // Modify

        hash = (hash ^ hash >>> 13) * 0xc2b2ae35;
        hash >>>= 0; // Ensure unsigned 32-bit integer
      }

      return hashes;
    }
  }, {
    key: "_fnv1a",
    value: function _fnv1a(str) {
      if (typeof str !== "string") {
        str = String(str);
      }

      var hash = 2166136261; // FNV offset basis for 32-bit

      for (var i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = hash * 16777619 >>> 0; // Multiply by the FNV prime and ensure 32-bit unsigned
      }

      return hash >>> 0;
    }
  }, {
    key: "_setBits",
    value: function _setBits(hashes) {
      var _iterator4 = _createForOfIteratorHelper(hashes),
          _step4;

      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var hash = _step4.value;
          var index = Math.floor(hash / 8);
          var bit = hash % 8;
          this.bitArray[index] |= 1 << bit;
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }
    }
  }, {
    key: "_checkBits",
    value: function _checkBits(hashes) {
      var _iterator5 = _createForOfIteratorHelper(hashes),
          _step5;

      try {
        for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
          var hash = _step5.value;
          var index = Math.floor(hash / 8);
          var bit = hash % 8;

          if (!(this.bitArray[index] & 1 << bit)) {
            return false;
          }
        }
      } catch (err) {
        _iterator5.e(err);
      } finally {
        _iterator5.f();
      }

      return true;
    }
  }, {
    key: "has",
    value: function has(o) {
      var hashes = this._hashes(o);

      if (!this._checkBits(hashes)) {
        return false; // Definitely not in the set
      } // Fall back to fast-deep-equal for false positives


      var _iterator6 = _createForOfIteratorHelper(this),
          _step6;

      try {
        for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
          var i = _step6.value;

          if ((0, _fastDeepEqual["default"])(o, i)) {
            return true;
          }
        }
      } catch (err) {
        _iterator6.e(err);
      } finally {
        _iterator6.f();
      }

      return false;
    }
  }, {
    key: "add",
    value: function add(o) {
      if (!this.has(o)) {
        var hashes = this._hashes(o);

        this._setBits(hashes);

        _get(_getPrototypeOf(BloomSet.prototype), "add", this).call(this, o);
      }

      return this;
    }
  }]);

  return BloomSet;
}( /*#__PURE__*/_wrapNativeSuper(Set));

exports.BloomSet = BloomSet;

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    UniqueSet: UniqueSet,
    BloomSet: BloomSet
  };
}