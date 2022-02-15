import equal from "fast-deep-equal";

class UniqueSet extends Set {
  constructor(...args) {
    super(...args);
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
      Set.prototype.add.call(this, o);
    }
  }
}

module.exports = UniqueSet;
