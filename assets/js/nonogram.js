/*
  Daily nonogram. Same logic as tools/nonogram.py (read that file for the
  explanation); the random generator matches it bit for bit, so Python and
  the browser make the same puzzle for the same date.
*/
(function () {
  var UNKNOWN = -1, EMPTY = 0, FILLED = 1;
  var SIZE = 10, DENSITY = 0.58, MAX_TRIES = 500;

  /* random numbers */

  function fnv1a(text) {
    var h = 0x811c9dc5;
    var bytes = new TextEncoder().encode(text);
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ ((t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0)) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* clues */

  function clueFor(line) {
    var runs = [], count = 0;
    for (var i = 0; i < line.length; i++) {
      if (line[i] === FILLED) count++;
      else if (count) { runs.push(count); count = 0; }
    }
    if (count) runs.push(count);
    return runs;
  }

  function column(grid, c) {
    return grid.map(function (row) { return row[c]; });
  }

  function cluesFor(grid) {
    var rows = grid.map(clueFor), cols = [];
    for (var c = 0; c < grid[0].length; c++) cols.push(clueFor(column(grid, c)));
    return { rows: rows, cols: cols };
  }

  /* line solver */

  function blockFits(line, start, length) {
    var end = start + length;
    if (end > line.length) return false;
    for (var x = start; x < end; x++) if (line[x] === EMPTY) return false;
    if (end < line.length && line[end] === FILLED) return false;
    return true;
  }

  function solveLine(clue, line) {
    var n = line.length, k = clue.length, i, j;
    var fits = [];
    for (i = 0; i <= n + 1; i++) fits.push(new Array(k + 1).fill(false));
    for (i = n + 1; i >= 0; i--) {
      for (j = k; j >= 0; j--) {
        if (i >= n) { fits[i][j] = (j === k); continue; }
        var ok = line[i] !== FILLED && fits[i + 1][j];
        if (!ok && j < k && blockFits(line, i, clue[j])) {
          var end = i + clue[j];
          ok = end < n ? fits[end + 1][j + 1] : (j + 1 === k);
        }
        fits[i][j] = ok;
      }
    }
    if (!fits[0][0]) return null;

    var canFill = new Array(n).fill(false), canEmpty = new Array(n).fill(false);
    var seen = {}, stack = [[0, 0]];
    while (stack.length) {
      var s = stack.pop(); i = s[0]; j = s[1];
      var key = i + "," + j;
      if (seen[key] || i >= n) continue;
      seen[key] = true;
      if (line[i] !== FILLED && fits[i + 1][j]) { canEmpty[i] = true; stack.push([i + 1, j]); }
      if (j < k && blockFits(line, i, clue[j])) {
        var e = i + clue[j];
        if ((e < n && fits[e + 1][j + 1]) || (e === n && j + 1 === k)) {
          for (var x = i; x < e; x++) canFill[x] = true;
          if (e < n) { canEmpty[e] = true; stack.push([e + 1, j + 1]); }
        }
      }
    }
    return line.map(function (v, x) {
      if (canFill[x] && !canEmpty[x]) return FILLED;
      if (canEmpty[x] && !canFill[x]) return EMPTY;
      return v;
    });
  }

  function lineSolve(rows, cols) {
    var h = rows.length, w = cols.length, r, c;
    var grid = [];
    for (r = 0; r < h; r++) grid.push(new Array(w).fill(UNKNOWN));
    var changed = true;
    while (changed) {
      changed = false;
      for (r = 0; r < h; r++) {
        var nr = solveLine(rows[r], grid[r]);
        if (!nr) return null;
        if (nr.join() !== grid[r].join()) { grid[r] = nr; changed = true; }
      }
      for (c = 0; c < w; c++) {
        var col = column(grid, c), nc = solveLine(cols[c], col);
        if (!nc) return null;
        if (nc.join() !== col.join()) {
          for (r = 0; r < h; r++) grid[r][c] = nc[r];
          changed = true;
        }
      }
    }
    return grid;
  }

  function isComplete(grid) {
    return grid.every(function (row) { return row.indexOf(UNKNOWN) === -1; });
  }

  /* daily puzzle */

  function hasEmptyLine(grid) {
    if (grid.some(function (row) { return row.indexOf(FILLED) === -1; })) return true;
    for (var c = 0; c < grid[0].length; c++) if (column(grid, c).indexOf(FILLED) === -1) return true;
    return false;
  }

  function puzzleFor(dateString) {
    var rand = mulberry32(fnv1a("nonogram:" + dateString));
    for (var t = 0; t < MAX_TRIES; t++) {
      var grid = [];
      for (var r = 0; r < SIZE; r++) {
        var row = [];
        for (var c = 0; c < SIZE; c++) row.push(rand() < DENSITY ? FILLED : EMPTY);
        grid.push(row);
      }
      if (hasEmptyLine(grid)) continue;
      var clues = cluesFor(grid);
      var solved = lineSolve(clues.rows, clues.cols);
      if (solved && isComplete(solved)) return { solution: grid, rows: clues.rows, cols: clues.cols };
    }
    return null;
  }

  /* the page */

  var root = document.getElementById("nonogram");
  if (!root) return;

  var today = new Date().toISOString().slice(0, 10);   // UTC date, same for everyone
  var puzzle = puzzleFor(today);
  if (!puzzle) { root.textContent = "Couldn't make today's puzzle."; return; }

  var storeKey = "nonogram:" + today;
  var state;   // 0 blank, 1 filled, 2 crossed
  try { state = JSON.parse(localStorage.getItem(storeKey)); } catch (e) { state = null; }
  if (!state || state.length !== SIZE) {
    state = [];
    for (var r = 0; r < SIZE; r++) state.push(new Array(SIZE).fill(0));
  }

  var mode = 1;   // what a tap does: 1 fill, 2 cross
  var board = root.querySelector(".ng-board");
  var status = root.querySelector(".ng-status");
  root.querySelector(".ng-date").textContent = new Date(today + "T00:00:00Z")
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  function save() { try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch (e) {} }

  /* corner + column clues + (row clue, cells) per row, laid out in one CSS grid */
  board.style.setProperty("--n", SIZE);
  board.appendChild(document.createElement("div"));
  puzzle.cols.forEach(function (clue) {
    var d = document.createElement("div");
    d.className = "ng-clue ng-col";
    (clue.length ? clue : [0]).forEach(function (v) {
      var s = document.createElement("span"); s.textContent = v; d.appendChild(s);
    });
    board.appendChild(d);
  });
  var cells = [];
  puzzle.rows.forEach(function (clue, r) {
    var d = document.createElement("div");
    d.className = "ng-clue ng-row";
    d.textContent = (clue.length ? clue : [0]).join(" ");
    board.appendChild(d);
    cells.push([]);
    for (var c = 0; c < SIZE; c++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ng-cell";
      b.dataset.r = r; b.dataset.c = c;
      if (c % 5 === 0 && c) b.classList.add("ng-gap-l");
      if (r % 5 === 0 && r) b.classList.add("ng-gap-t");
      if (c === 0) b.classList.add("ng-first-c");
      if (r === 0) b.classList.add("ng-first-r");
      board.appendChild(b);
      cells[r].push(b);
    }
  });

  function paint(r, c) {
    var b = cells[r][c], v = state[r][c];
    b.classList.toggle("is-filled", v === 1);
    b.classList.toggle("is-crossed", v === 2);
    b.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1) + ": " +
      (v === 1 ? "filled" : v === 2 ? "crossed" : "blank"));
  }

  function solved() {
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if ((state[r][c] === 1) !== (puzzle.solution[r][c] === FILLED)) return false;
    return true;
  }

  function update() {
    var done = solved();
    root.classList.toggle("is-solved", done);
    status.textContent = done ? "Solved. See you tomorrow." : "";
  }

  /* tap or drag: the first cell decides what the drag paints */
  var dragValue = null;
  function apply(b) {
    var r = +b.dataset.r, c = +b.dataset.c;
    if (state[r][c] === dragValue) return;
    state[r][c] = dragValue; paint(r, c);
  }
  board.addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".ng-cell");
    if (!b || root.classList.contains("is-solved")) return;
    e.preventDefault();
    var use = e.button === 2 ? 2 : mode;          // right click always crosses
    dragValue = state[+b.dataset.r][+b.dataset.c] === use ? 0 : use;
    apply(b);
    /* touch screens capture the pointer on the first cell; let go so the drag reaches the others */
    if (b.hasPointerCapture && b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId);
  });
  board.addEventListener("pointerover", function (e) {
    if (dragValue === null) return;
    var b = e.target.closest(".ng-cell");
    if (b) apply(b);
  });
  window.addEventListener("pointerup", function () {
    if (dragValue === null) return;
    dragValue = null; save(); update();
  });
  board.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  board.addEventListener("keydown", function (e) {
    var b = e.target.closest(".ng-cell");
    if (!b) return;
    var r = +b.dataset.r, c = +b.dataset.c;
    var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      var nr = Math.min(SIZE - 1, Math.max(0, r + moves[e.key][0]));
      var nc = Math.min(SIZE - 1, Math.max(0, c + moves[e.key][1]));
      cells[nr][nc].focus();
    } else if (e.key === "Enter" || e.key === " " || e.key === "x" || e.key === "X") {
      e.preventDefault();
      if (root.classList.contains("is-solved")) return;
      var want = (e.key === "x" || e.key === "X") ? 2 : mode;
      state[r][c] = state[r][c] === want ? 0 : want;
      paint(r, c); save(); update();
    }
  });

  var modeButtons = root.querySelectorAll(".ng-mode");
  modeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      mode = +btn.dataset.mode;
      modeButtons.forEach(function (o) { o.setAttribute("aria-pressed", o === btn ? "true" : "false"); });
    });
  });
  var help = document.getElementById("ng-help");
  if (help && help.showModal) {
    root.querySelector(".ng-help-open").addEventListener("click", function () { help.showModal(); });
    help.querySelector(".ng-help-close").addEventListener("click", function () { help.close(); });
    help.addEventListener("click", function (e) { if (e.target === help) help.close(); });
  }

  root.querySelector(".ng-reset").addEventListener("click", function () {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) { state[r][c] = 0; paint(r, c); }
    save(); update();
  });

  for (var rr = 0; rr < SIZE; rr++) for (var cc = 0; cc < SIZE; cc++) paint(rr, cc);
  update();

  /* exposed so tools can check that JS and Python agree */
  window.__nonogram = { puzzleFor: puzzleFor };
})();
