export class DisplayOption {
  constructor(key, label, title) {
    this.key = key;
    this.label = label;
    this.title = title;
  }
}

export class BooleanDisplayOption extends DisplayOption {}

export class RangeDisplayOption extends DisplayOption {
  constructor(key, label, title, { min, max, step }) {
    super(key, label, title);
    this.min = min;
    this.max = max;
    this.step = step;
  }
}

export class SelectDisplayOption extends DisplayOption {
  constructor(key, label, title, { choices }) {
    super(key, label, title);
    this.choices = choices;
  }
}
