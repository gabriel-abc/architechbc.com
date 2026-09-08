# tools

One-off generators for committed artifacts. Nothing here runs at build time —
the site has no build step. Each needs Pillow (`python -m pip install pillow`).

- **`make-icons.py`** — regenerates the full favicon set: multi-resolution
  `favicon.ico` at the repo root, PNG fallbacks, Apple touch icon and maskable
  Android icons. Everything is drawn at 4x and downsampled; below 24px the
  crossbar of the "A" is dropped because at that size it merges into a blob.
- **`make-og-image.py`** — regenerates `assets/img/og.png`, the 1200x630 social
  preview card.

Re-run only when the brand marks or palette change, then commit the output.
