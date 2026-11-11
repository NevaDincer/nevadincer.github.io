"""
Daily nonogram: generator and solver.

This is the readable reference version. The site runs the same logic in
JavaScript (assets/js/nonogram.js), and both use the same random number
generator, so for a given date they produce exactly the same puzzle.

    python3 tools/nonogram.py              # today's puzzle (UTC date)
    python3 tools/nonogram.py 2026-10-26   # the puzzle for a given date
    python3 tools/nonogram.py --test       # sanity checks

How it works, in short:
1. Make a random grid of filled and empty cells.
2. Read the clues off it (the lengths of the filled runs in each row/column).
3. Try to solve the puzzle from the clues alone, using only line logic:
   look at one row or column at a time and mark the cells that are filled
   (or empty) in every arrangement that fits its clue. Repeat until nothing
   changes.
4. If line logic fills in the whole grid, the puzzle has exactly one
   solution and a person can solve it without guessing. Keep it.
   Otherwise throw the grid away and try the next one.

Cell values used everywhere below:  UNKNOWN = -1, EMPTY = 0, FILLED = 1
"""

import sys
from datetime import datetime, timezone

UNKNOWN, EMPTY, FILLED = -1, 0, 1

SIZE = 10          # the daily puzzle is SIZE x SIZE
DENSITY = 0.58     # chance that a cell is filled in the random grid
MAX_TRIES = 500    # grids to try before giving up (never reached in practice)


# Random numbers that are the same in Python and JavaScript

def fnv1a(text):
    """Turn a string (the date) into a 32-bit seed. FNV-1a hash."""
    h = 0x811C9DC5
    for byte in text.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def mulberry32(seed):
    """mulberry32. Returns a function that gives
    floats in [0, 1). Written with 32-bit masks so it matches the JS version
    bit for bit."""
    state = seed & 0xFFFFFFFF

    def imul(a, b):
        # 32-bit integer multiply, like Math.imul in JavaScript
        return (a * b) & 0xFFFFFFFF

    def rand():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rand


# Clues

def clue_for(line):
    """[1,1,0,1,1,1,0] -> [2, 3]. An empty line has the clue [] (shown as 0)."""
    runs, count = [], 0
    for cell in line:
        if cell == FILLED:
            count += 1
        elif count:
            runs.append(count)
            count = 0
    if count:
        runs.append(count)
    return runs


def clues_for(grid):
    rows = [clue_for(row) for row in grid]
    cols = [clue_for([grid[r][c] for r in range(len(grid))]) for c in range(len(grid[0]))]
    return rows, cols


# Solving one line

def solve_line(clue, line):
    """Given a clue and what we already know about a line, return a new line
    where every cell that is FILLED in all valid arrangements is FILLED,
    every cell that is EMPTY in all of them is EMPTY, and the rest stay
    UNKNOWN. Returns None if no arrangement fits (a contradiction).

    Instead of listing every arrangement (there can be thousands), we walk
    through "states" (i, j) = "cell i is the next free cell, block j is the
    next block to place". From each state there are only two moves: leave
    cell i empty, or start block j at cell i.
    """
    n, k = len(line), len(clue)

    # fits[i][j]: can blocks j..k-1 be placed in cells i..n-1?
    # Filled from the end backwards, so each answer reuses later ones.
    fits = [[False] * (k + 1) for _ in range(n + 2)]
    for i in range(n + 1, -1, -1):
        for j in range(k, -1, -1):
            if i >= n:
                # no cells left: only OK if no blocks are left either
                fits[i][j] = (j == k)
                continue
            ok = False
            # move 1: cell i stays empty
            if line[i] != FILLED and fits[i + 1][j]:
                ok = True
            # move 2: block j starts at cell i
            if not ok and j < k and block_fits(line, i, clue[j]):
                end = i + clue[j]          # first cell after the block
                ok = fits[end + 1][j + 1] if end < n else (j + 1 == k)
            fits[i][j] = ok

    if not fits[0][0]:
        return None

    # Now walk forward from (0, 0), only through states that can still
    # finish, and record what each cell is allowed to be.
    can_fill = [False] * n
    can_empty = [False] * n
    seen = set()
    stack = [(0, 0)]
    while stack:
        i, j = stack.pop()
        if (i, j) in seen or i >= n:
            continue
        seen.add((i, j))
        if line[i] != FILLED and fits[i + 1][j]:
            can_empty[i] = True
            stack.append((i + 1, j))
        if j < k and block_fits(line, i, clue[j]):
            end = i + clue[j]
            if (end < n and fits[end + 1][j + 1]) or (end == n and j + 1 == k):
                for x in range(i, end):
                    can_fill[x] = True
                if end < n:
                    can_empty[end] = True
                    stack.append((end + 1, j + 1))

    result = []
    for x in range(n):
        if can_fill[x] and not can_empty[x]:
            result.append(FILLED)
        elif can_empty[x] and not can_fill[x]:
            result.append(EMPTY)
        else:
            result.append(line[x])
    return result


def block_fits(line, start, length):
    """Can a block of `length` filled cells start at `start`? None of its
    cells may be known EMPTY, and the cell right after it may not be FILLED."""
    end = start + length
    if end > len(line):
        return False
    if any(line[x] == EMPTY for x in range(start, end)):
        return False
    if end < len(line) and line[end] == FILLED:
        return False
    return True


# Solving the whole grid

def line_solve(row_clues, col_clues, grid=None):
    """Apply solve_line to every row and column until nothing changes.
    Returns the (possibly partly) solved grid, or None on a contradiction."""
    h, w = len(row_clues), len(col_clues)
    if grid is None:
        grid = [[UNKNOWN] * w for _ in range(h)]
    else:
        grid = [row[:] for row in grid]

    changed = True
    while changed:
        changed = False
        for r in range(h):
            new = solve_line(row_clues[r], grid[r])
            if new is None:
                return None
            if new != grid[r]:
                grid[r] = new
                changed = True
        for c in range(w):
            col = [grid[r][c] for r in range(h)]
            new = solve_line(col_clues[c], col)
            if new is None:
                return None
            if new != col:
                for r in range(h):
                    grid[r][c] = new[r]
                changed = True
    return grid


def is_complete(grid):
    return all(cell != UNKNOWN for row in grid for cell in row)


def count_solutions(row_clues, col_clues, limit=2, grid=None):
    """Count solutions, stopping at `limit`. Uses line logic, then guesses
    one unknown cell both ways when line logic gets stuck. Slow in theory,
    fast enough for small grids. Used only to double-check the generator."""
    grid = line_solve(row_clues, col_clues, grid)
    if grid is None:
        return 0
    if is_complete(grid):
        return 1
    r, c = next((r, c) for r, row in enumerate(grid) for c, v in enumerate(row) if v == UNKNOWN)
    total = 0
    for guess in (FILLED, EMPTY):
        trial = [row[:] for row in grid]
        trial[r][c] = guess
        total += count_solutions(row_clues, col_clues, limit - total, trial)
        if total >= limit:
            break
    return total


# Making the daily puzzle

def random_grid(rand, size, density):
    return [[FILLED if rand() < density else EMPTY for _ in range(size)] for _ in range(size)]


def has_empty_line(grid):
    """Skip grids with a completely empty row or column. They're legal but dull."""
    if any(not any(row) for row in grid):
        return True
    return any(not any(grid[r][c] for r in range(len(grid))) for c in range(len(grid[0])))


def puzzle_for(date_string, size=SIZE, density=DENSITY):
    """Return (solution, row_clues, col_clues, tries) for a date like '2026-10-26'."""
    rand = mulberry32(fnv1a("nonogram:" + date_string))
    for tries in range(1, MAX_TRIES + 1):
        grid = random_grid(rand, size, density)
        if has_empty_line(grid):
            continue
        rows, cols = clues_for(grid)
        solved = line_solve(rows, cols)
        if solved is not None and is_complete(solved):
            # Line logic alone finished the grid, so this is the only solution.
            return grid, rows, cols, tries
    raise RuntimeError("no line-solvable grid found")


def show(grid, rows, cols):
    width = max(len(" ".join(map(str, r or [0]))) for r in rows)
    depth = max(len(c) for c in cols)
    for d in range(depth):
        cells = []
        for c in cols:
            pad = depth - len(c)
            cells.append(f"{c[d - pad]:>2}" if d >= pad else "  ")
        print(" " * (width + 1) + "".join(cells))
    for r, row in enumerate(grid):
        label = " ".join(map(str, rows[r] or [0]))
        print(f"{label:>{width}} " + "".join(" #" if v == FILLED else " ." for v in row))


# Checks

def run_tests():
    import itertools
    import random

    # solve_line against brute force on random short lines
    rng = random.Random(1)
    for _ in range(3000):
        n = rng.randint(1, 9)
        truth = [rng.randint(0, 1) for _ in range(n)]
        clue = clue_for(truth)
        known = [v if rng.random() < 0.3 else UNKNOWN for v in truth]
        options = [list(p) for p in itertools.product([0, 1], repeat=n)
                   if clue_for(list(p)) == clue
                   and all(k == UNKNOWN or k == v for k, v in zip(known, p))]
        expected = [options[0][x] if all(o[x] == options[0][x] for o in options) else UNKNOWN
                    for x in range(n)]
        assert solve_line(clue, known) == expected, (clue, known)

    # a line-solved grid really has exactly one solution (5x5 brute force:
    # try every combination of rows that fit the row clues, check columns)
    all_rows = [list(p) for p in itertools.product([0, 1], repeat=5)]
    for _ in range(300):
        grid = [[rng.randint(0, 1) for _ in range(5)] for _ in range(5)]
        rows, cols = clues_for(grid)
        choices = [[r for r in all_rows if clue_for(r) == rc] for rc in rows]
        brute = sum(1 for g in itertools.product(*choices) if clues_for(list(g))[1] == cols)
        assert count_solutions(rows, cols, limit=99) == brute
        solved = line_solve(rows, cols)
        if solved is not None and is_complete(solved):
            assert brute == 1

    # the daily generator: every puzzle checks out, and how many tries it takes
    tries = []
    for day in range(1, 61):
        date = f"2026-{(day - 1) // 30 + 11:02d}-{(day - 1) % 30 + 1:02d}"
        grid, rows, cols, t = puzzle_for(date)
        assert count_solutions(rows, cols) == 1
        tries.append(t)
    print(f"all checks passed; tries per puzzle: avg {sum(tries) / len(tries):.1f}, max {max(tries)}")


if __name__ == "__main__":
    if "--test" in sys.argv:
        run_tests()
    else:
        date = sys.argv[1] if len(sys.argv) > 1 else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        grid, rows, cols, tries = puzzle_for(date)
        print(f"{date}  (found after {tries} random grid{'s' if tries > 1 else ''})\n")
        show(grid, rows, cols)
