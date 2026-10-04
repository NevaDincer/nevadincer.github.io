# nevadincer.github.io

## Notes for later
### How to add a new Experience entry

Open `_data/experience.yml` and add a new block under `items:` (or under `extras:` for a short one-line item like a club role). No HTML needed.

### How to write a new blog post

1. Create a new file in `_posts/`, named `YYYY-MM-DD-slug.md` (the date is required by Jekyll, the slug becomes the URL).
2. Start it with:
   ```
   ---
   layout: post
   title: "Your Title Here"
   ---
   ```
3. Write the post in markdown below that.
4. If this post should be linked from an Experience entry, set that entry's `blog_slug` in `_data/experience.yml` to match your filename's slug (the part after the date).

