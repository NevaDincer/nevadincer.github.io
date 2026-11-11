---
title: "Making a daily nonogram"
description: "How the daily puzzle on this site is made, and how I make sure each one has exactly one solution."
redirect_from:
  - /blog/making-a-daily-nonogram/
---

When I rebuilt this site I wanted a daily nonogram on it, since I still play one almost every day. The puzzle on the [Nonogram](/nonogram/) page changes every day, and each one has exactly one solution.

I got the idea for the solver from two YouTube videos ([one](https://www.youtube.com/watch?v=JcXbROgBlc4), [two](https://www.youtube.com/watch?v=iCxz20hINyY)). I made the JavaScript for the page and the Python version, tests included, with an AI assistant, then went through the code to understand how it works.

## What a nonogram is

A nonogram is a grid with numbers next to each row and above each column. The numbers are the lengths of the filled blocks in that line, in order. A row with the clue "3 1" has a block of three filled squares, then at least one empty square, then a single filled square. Where the blocks start is up to you to figure out. When every row and column matches its clue, the filled squares form the solution.

## Solving one line at a time

Most of the solving happens one line at a time. Take a row of five squares with the clue "3". The block can start at the first, second or third square:

```
# # # . .
. # # # .
. . # # #
```

The middle square is filled in all three, so it has to be filled, even though you don't know where the block is yet. Empty squares work the same way. If a square is empty in every arrangement that fits, you can cross it out.

Listing every arrangement gets slow for long lines with many blocks, so the solver never builds that list. It walks along the line one square at a time, and at each square it either leaves it empty or starts the next block there. A first pass, going from the end of the line backwards, finds which of these choices lead to a dead end. A second pass skips them and records whether each square can be filled, empty, or both. The answer is the same as checking every arrangement one by one.

## Making a new puzzle every day

GitHub Pages has no server, so the puzzle is made in your browser when you open the page. Everyone still gets the same puzzle because the random numbers come from the date.

The code hashes today's date (in UTC) with FNV-1a and uses the result as the seed for mulberry32, a small random number generator. Mulberry32 always gives the same numbers for the same seed, so every browser builds the same puzzle. Because the date is in UTC, the new puzzle shows up at 03:00 for me in Turkey.

With those numbers the code makes a 10×10 grid. A square is filled if its random number, between 0 and 1, is below 0.58. The code skips grids with a completely empty row or column because they're dull. Then it reads the clues off the grid and checks that they have only one solution (next section). If they don't, it makes a new grid and tries again.

There's also a Python version of the same code ([tools/nonogram.py](https://github.com/NevaDincer/nevadincer.github.io/blob/main/tools/nonogram.py)) that makes the exact same puzzle for any date. I use it for testing.

## Making sure there's only one solution

A grid of random squares can have clues that fit more than one picture, so I only keep grids that the line solver can finish on its own. If the solver fills in every square using only the line logic above, every square was forced and there's no room for a second solution. That also means you can solve the puzzle without guessing. If the solver gets stuck, the generator throws the grid away and tries the next one.

The Python file has three tests for this. The first checks the line solver against brute force on 3000 random short lines. The second takes 300 random 5×5 grids and counts their solutions twice, once with a slower solver that guesses when it gets stuck and once by brute force over every grid that fits the row clues. The third generates 60 days of daily puzzles and checks that each one has exactly one solution. Over those 60 days the generator needed 1.2 random grids per puzzle on average and never more than 4, so making the daily puzzle takes a fraction of a second.

You can play today's puzzle on the [Nonogram](/nonogram/) page.
