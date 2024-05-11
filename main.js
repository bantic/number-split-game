const LOG = true;
function log(...data) {
  if (!LOG) return;
  console.log(...data);
}

function createEl(classes = "", data = {}) {
  let el = document.createElement("div");
  for (let kls of classes.split(" ")) {
    el.classList.add(kls);
  }
  for (let [key, val] of Object.entries(data)) {
    el.dataset[key] = val;
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

class GameState {
  constructor() {
    this.els = toUnsorted(uniqueList());
    this.goal = this.els.toSorted();
    this.mode = MODES.PLAY;
    this.moves = [];
    this.selectedTileIndex = null;
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
    this.moves.push(move);
    if (move instanceof MoveSplitTile) {
      let { tileIndex, splitIndex } = move;
      let value = this.els[tileIndex];
      let splitLeft = splitIndex + 1;
      let splitRight = value - splitLeft;
      let nextEls = [...this.els];
      nextEls.splice(tileIndex, 1, splitLeft, splitRight);

      this.els = nextEls;
      this.changeMode(MODES.PLAY);
      return true;
    } else if (move instanceof MoveMergeTiles) {
      let { tileIndexA, tileIndexB } = move;
      let [beforeIndex, afterIndex] = [tileIndexA, tileIndexB].toSorted();
      let merged = this.els[beforeIndex] + this.els[afterIndex];
      let nextEls = [...this.els];
      nextEls.splice(beforeIndex, 2, merged);
      this.els = nextEls;
      this.changeMode(MODES.PLAY);
      return true;
    }
  }
}

class MoveSplitTile {
  constructor(tileIndex, splitIndex) {
    this.tileIndex = tileIndex;
    this.splitIndex = splitIndex;
  }
}

class MoveMergeTiles {
  constructor(tileIndexA, tileIndexB) {
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
      if (this.state.isSelected(tileIndex)) {
        log("tile at index", tileIndex, "is selected, splitting");
        let unit = event.target;
        let splitIndex = parseInt(unit.dataset.index);
        let move = new MoveSplitTile(tileIndex, splitIndex);
        if (!this.state.applyMove(move)) {
          throw new Error("cannot apply move split tile");
        }
        // which unit did we click on?
        // let target =
      } else if (this.state.isAdjacentToSelected(tileIndex)) {
        let move = new MoveMergeTiles(this.state.selectedTileIndex, tileIndex);
        if (!this.state.applyMove(move)) {
          throw new Error("cannt apply movemergetiles");
        }
      }
      // if clicking again on a selected tile, split
      // at that spot (if valid)
      // if clicking on a neighbor tile, merge (if valid)
    }

    this.render();
  }

  render() {
    this.root.innerHTML = "";
    let board = createEl("board");

    for (let tileIndex = 0; tileIndex < this.state.els.length; tileIndex++) {
      let value = this.state.els[tileIndex];
      let tile = createEl("tile", { index: tileIndex, value });
      if (this.state.isSelected(tileIndex)) {
        tile.classList.add("selected");
      }
      for (let j = 0; j < value; j++) {
        let unit = createEl("unit");
        unit.textContent = `${j + 1}`;
        unit.dataset.index = j;
        tile.appendChild(unit);
      }
      let label = document.createElement("div");
      label.classList.add("label");
      label.textContent = `${value}`;
      tile.appendChild(label);
      tile.addEventListener("click", this.handleClick.bind(this));

      board.appendChild(tile);
    }
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
