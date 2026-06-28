# Layman Bible — Web

A static web version of the Layman Bible reader: the Bible explained in plain
language, with verse-by-verse notes, chapter context, cultural notes,
cross-references, "Then vs Now," and Greek/Hebrew word studies.

No build step — plain HTML/CSS/JS. The reading content lives as JSON in `data/`.

## Local preview

```bash
cd laymanbible-web
python3 -m http.server 4173
# open http://localhost:4173
```

(A plain `file://` open won't work because the app `fetch()`es JSON — use a local server.)

## Structure

```
index.html        # shell
css/styles.css    # styles + light/dark themes
js/app.js         # hash-router SPA (home, chapters, reader)
data/             # manifest.json + one JSON file per book (66 books) + reading-plans
.nojekyll         # tells GitHub Pages to serve files as-is
```

## Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `laymanbible-web`).
2. Push this folder to it.
3. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`.
4. Your site appears at `https://<username>.github.io/laymanbible-web/`.

## Updating content

The JSON in `data/` is copied from the iOS app's `Resources/`. To refresh,
re-copy those files and regenerate `data/manifest.json`.
