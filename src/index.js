import equal from "fast-deep-equal";

class UniqueSet extends Set {
  constructor(iterable = []) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("UniqueSet requires an iterable");
    }
    super(iterable);
  }

  has(o) {
    for (const i of this) {
      if (equal(o, i)) {
        return true;
      }
    }
    return false;
  }

  add(o) {
    if (!this.has(o)) {
      super.add(o);
    }
    return this;
  }
}

export default UniqueSet;

// Support CommonJS by conditionally setting `module.exports`
if (typeof module !== "undefined" && module.exports) {
  module.exports = UniqueSet;
}
