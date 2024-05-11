const LOG = true;
function log(...data) {
  if (!LOG) return;
  console.log(...data);
}

function createEl(classes = "", data = {}, textContent = null) {
  let el = document.createElement("div");
  for (let kls of classes.split(" ")) {
    el.classList.add(kls);
  }
  for (let [key, val] of Object.entries(data)) {
    el.dataset[key] = val;
  }
  if (textContent) {
    el.textContent = textContent;
  }
  return el;
}

function uniqueList(n = 3, min = 1, max = 9) {
  let els = new Set();

  while (els.size < n) {
    let v = min + Math.floor(Math.random() * (max - min + 1));
    if (els.has(v)) {
      continue;
    }
    els.add(v);
  }
  return Array.from(els);
}

function arrayEqual(lhs, rhs) {
  if (lhs.length !== rhs.length) {
    return false;
  }
  for (let i = 0; i < lhs.length; i++) {
    if (lhs[i] !== rhs[i]) {
      return false;
    }
  }
  return true;
}

function toShuffled(list) {
  list = [...list];
  let shuffled = [];
  while (list.length) {
    let idx = Math.floor(Math.random() * list.length);
    shuffled.push(list[idx]);
    list.splice(idx, 1);
  }
  return shuffled;
}

function toUnsorted(list) {
  let sorted = list.toSorted();
  let shuffled;
  do {
    shuffled = toShuffled(list);
  } while (arrayEqual(shuffled, sorted));
  return shuffled;
}

function isUnique(array) {
  return new Set(array).size === array.length;
}

const GAME_RULES = [
  {
    description: "No duplicates",
    validate: (list) => isUnique(list),
  },
  {
    description: "No numbers larger than the original largest",
    validate: (list, { max } = {}) => list.every((v) => v <= max),
  },
];

class GameEngine {
  hash(list) {
    return list.join(",");
  }

  validate(els, max) {
    let failed = GAME_RULES.filter((rule) => !rule.validate(els, { max })).map(
      (rule) => rule.description
    );
    return failed;
  }

  validateMove(move, els, { max } = {}) {
    let nextEls = this.unconditionallyApplyMove(move, els);
    let failures = this.validate(nextEls, max);
    return [failures, nextEls];
  }

  solve(els) {
    let seen = new Set();
    let goal = els.toSorted();

    // to ensure we don't think something is solved because it starts solved
    els = toUnsorted(els);
    let max = Math.max(...goal);
    let stack = [];
    stack.push([els, this.possibleMoves(els)]);
    while (stack.length) {
      let [els, possibleMoves] = stack.pop();
      if (seen.has(this.hash(els))) {
        continue;
      }
      if (arrayEqual(goal, els)) {
        return true;
      }
      seen.add(this.hash(els));

      for (let move of possibleMoves) {
        let [failures, nextEls] = this.validateMove(move, els, { max });
        if (failures.length === 0) {
          stack.push([nextEls, this.possibleMoves(nextEls)]);
        }
      }
    }

    return false;
  }

  possibleMoves(els) {
    let moves = [];

    let unsplittable = [1, 2];

    // splits
    for (let i = 0; i < els.length; i++) {
      let v = els[i];
      if (unsplittable.includes(v)) {
        continue;
      }
      let tileIndex = i;
      for (let j = 0; j < v; j++) {
        let splitIndex = j;
        moves.push(new MoveSplitTile(tileIndex, splitIndex));
      }
    }

    // merges
    for (let i = 0; i < els.length - 1; i++) {
      moves.push(new MoveMergeTiles(i, i + 1));
    }

    return moves;
  }

  unconditionallyApplyMove(move, els) {
    if (move instanceof MoveSplitTile) {
      let { tileIndex, splitIndex } = move;
      let value = els[tileIndex];
      let splitLeft = splitIndex + 1;
      let splitRight = value - splitLeft;
      let nextEls = [...els];
      nextEls.splice(tileIndex, 1, splitLeft, splitRight);
      return nextEls;
    } else if (move instanceof MoveMergeTiles) {
      let { tileIndexA, tileIndexB } = move;
      let [beforeIndex, afterIndex] = [tileIndexA, tileIndexB].toSorted();
      let merged = els[beforeIndex] + els[afterIndex];
      let nextEls = [...els];
      nextEls.splice(beforeIndex, 2, merged);
      return nextEls;
    } else if (move instanceof MoveReset) {
      return els;
    } else {
      throw new Error("unknown move: " + move);
    }
  }
}

class GameState {
  constructor() {
    let els;
    do {
      els = uniqueList();
    } while (!new GameEngine().solve(els));
    this.els = toUnsorted(els);
    this.goal = this.els.toSorted();
    this.max = Math.max(...this.els);
    this.mode = MODES.PLAY;
    this.moves = [];
    this.selectedTileIndex = null;
    this.engine = new GameEngine();
  }

  isSolved() {
    return arrayEqual(this.els, this.goal);
  }

  changeMode(newMode) {
    if (newMode === MODES.PLAY) {
      this.selectedTileIndex = null;
    }
    // todo: validate that we can transition to this new mode
    this.mode = newMode;
  }

  select(tileIndex) {
    if (!this.mode === MODES.PLAY) {
      throw new Error("Cannot select");
    }
    this.selectedTileIndex = tileIndex;
    this.mode = MODES.SELECTED_TILE;
  }

  isSelected(tileIndex) {
    return this.selectedTileIndex === tileIndex;
  }

  isAdjacentToSelected(tileIndex) {
    let { selectedTileIndex } = this;
    let ret = Math.abs(this.selectedTileIndex - tileIndex) === 1;
    log("isAdjacentToSelected", { tileIndex, selectedTileIndex, ret });
    return ret;
  }

  applyMove(move) {
    let [failures, nextEls] = this.engine.validateMove(move, this.els, {
      max: this.max,
    });

    if (failures.length) {
      log("Could not apply move:", failures);
      this.changeMode(MODES.PLAY);
      return false;
    }

    if (!move.isNoOp()) {
      // Only record history for real moves
      this.moves.push(move);
    }

    this.els = nextEls;
    this.changeMode(MODES.PLAY);
    return true;
  }
}

class GameMove {
  isNoOp() {
    return false;
  }
}

// Default no-op move
class MoveReset extends GameMove {
  isNoOp() {
    return true;
  }
}

class MoveSplitTile extends GameMove {
  constructor(tileIndex, splitIndex) {
    super();
    this.tileIndex = tileIndex;
    this.splitIndex = splitIndex;
  }
}

class MoveMergeTiles extends GameMove {
  constructor(tileIndexA, tileIndexB) {
    super();
    this.tileIndexA = tileIndexA;
    this.tileIndexB = tileIndexB;
  }
}

const MODES = {
  PLAY: "PLAY",
  SELECTED_TILE: "SELECTED_TILE",
};

class Game {
  constructor(root) {
    this.root = root;
  }

  start() {
    this.state = new GameState();
    this.render();
  }

  handleClick(event) {
    let tile = event.currentTarget;
    let tileIndex = parseInt(tile.dataset.index);

    if (this.state.mode === MODES.PLAY) {
      this.state.select(tileIndex);
    } else if (this.state.mode === MODES.SELECTED_TILE) {
      let move = new MoveReset(); // default move

      if (this.state.isSelected(tileIndex)) {
        log("tile at index", tileIndex, "is selected, splitting");
        let unit = event.target;
        let splitIndex = parseInt(unit.dataset.index);
        let tileValue = parseInt(tile.dataset.value);
        if (splitIndex === tileValue - 1) {
          // Can't split into a "0"-sized tile
          move = new MoveReset();
        } else {
          move = new MoveSplitTile(tileIndex, splitIndex);
        }
      } else if (this.state.isAdjacentToSelected(tileIndex)) {
        move = new MoveMergeTiles(this.state.selectedTileIndex, tileIndex);
      }

      this.state.applyMove(move);
    }

    this.render();
  }

  render() {
    this.root.innerHTML = "";
    let goal = createEl("goal", {}, `Goal: ${this.state.goal.join(" ")}`);
    let moves = createEl("moves", {}, `Moves: ${this.state.moves.length}`);
    let board = createEl("board");

    for (let tileIndex = 0; tileIndex < this.state.els.length; tileIndex++) {
      let value = this.state.els[tileIndex];
      let tile = createEl("tile", { index: tileIndex, value });
      if (this.state.isSelected(tileIndex)) {
        tile.classList.add("selected");
      }
      for (let j = 0; j < value; j++) {
        let unit = createEl("unit", { index: j }, `${j + 1}`);
        tile.appendChild(unit);
      }
      let label = createEl("label", {}, `${value}`);
      tile.appendChild(label);
      tile.addEventListener("click", this.handleClick.bind(this));

      board.appendChild(tile);
    }

    this.root.appendChild(goal);
    this.root.appendChild(moves);
    this.root.appendChild(board);
  }
}

document.addEventListener("DOMContentLoaded", run);

function run() {
  let main = document.querySelector("main");
  document
    .querySelector("#btn-new-game")
    .addEventListener("click", () => new Game(main).start());
  new Game(main).start();
}
