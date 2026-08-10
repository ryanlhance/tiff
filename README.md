# Ryan Hance · TIFF Fit Map

An interactive view of TIFF Investment Management's Senior Associate, AI Enablement Lead job description. Underlined phrases open a side panel with notes from Ryan's career experience relevant to that part of the role.

**Live page:** https://ryanlhance.github.io/tiff/

## How it works

- `index.html` + `styles.css` + `app.js` are a static page, no build step, no dependencies.
- `data.json` holds all page content: the job description, the highlighted phrases, and the experience notes each phrase opens.
- `build_data.py` is a convenience generator for `data.json`. Edit it and run `python3 build_data.py`.

## Run locally

The page fetches `data.json`, so it needs http:

```
python3 serve.py 8000
```

then open http://localhost:8000/.
