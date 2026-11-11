# nevadincer.github.io

My personal site. I built it with Jekyll on GitHub Pages, without a theme, so everything is in this repo.

## Writing a post

I add a file to `_posts/` named `YYYY-MM-DD-short-name.md`. The short name becomes the address, `/writing/short-name/`. The front matter only needs two fields:

```yaml
---
title: "Post title"
description: "One line. It shows under the title on the Writing page and in link previews."
---
```

If a post has math, I also add `math: true`. KaTeX only loads on those posts. Sources are cited IEEE style. In the text I write `[[1]](#ref-1)`, and under a `## References` heading each entry is a paragraph that ends with `{: #ref-1}` on the next line, so the number links to it. The contents list, reading time, Writing page and RSS feed update on their own.

## Experience

Each block in `_data/experience.yml` is one row on the home page. If I add `post: short-name`, the row links to that post.

## Nonogram

`assets/js/nonogram.js` makes a new puzzle every day in the browser. `tools/nonogram.py` has the same logic in Python with comments, and makes the exact same puzzle for a given date:

```
python3 tools/nonogram.py 2026-10-26
python3 tools/nonogram.py --test
```

## Files

- `index.html` home, `writing/index.html` Writing, `nonogram/index.html`, `404.html`
- `_layouts/` page frames, `_includes/` head, nav and two SVGs (grid icon, rose)
- `assets/css/main.css` all styles (colors at the top), `assets/css/syntax.css` code colors
- `assets/img/` portrait, favicons, link preview image (`og.png`)

## Old addresses

Posts used to live under `/blog/`. Each post has a `redirect_from` line for its old address, so I don't need to touch those.

## Updating the CV

I overwrite `assets/Neva_Dincer_CV.pdf` and keep the file name, so the links keep working.
