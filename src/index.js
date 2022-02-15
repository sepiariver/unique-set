import equal from "fast-deep-equal";

class UniqueSet extends Set {
  constructor() {
    super();
  }
  add(o) {
    let isUnique = true;
    for (let i of this) {
      if (equal(o, i)) {
        isUnique = false;
        break;
      }
    }
    if (isUnique) {
      Set.prototype.add.call(this, o);
    }
  }
}

module.exports = UniqueSet;