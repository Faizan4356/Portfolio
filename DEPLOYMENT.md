# Deployment

This is a static site — plain HTML/CSS/JS, no build step, no backend. Any static host works.

## GitHub Pages
1. Push this folder to a GitHub repo (root of the repo, or a `/docs` folder).
2. Repo Settings → Pages → Source: choose the branch (e.g. `main`) and folder (`/` or `/docs`).
3. Your site publishes at `https://<username>.github.io/<repo>/`.
4. Before pushing, replace the absolute `/` paths in `sitemap.xml` and the `og:url` / `canonical` meta tags with your real domain, since GitHub Pages project sites are served from a sub-path.

## Netlify
- **Drag-and-drop**: zip or drag this folder onto app.netlify.com/drop.
- **Connect-repo**: New site from Git → pick the repo → leave the build command empty → publish directory `/` (repo root).

## Vercel
- Import the repo at vercel.com/new, framework preset "Other", no build command, output directory `/`.

## Notes
- `assets/img/headshot.jpg` must be supplied (see README) before deploying — it's referenced from every page's hero and social meta tags.
- All internal links are relative, so the site works unmodified from a sub-path (GitHub Pages project sites) or a custom domain root.
- Update `sitemap.xml`'s `<loc>` values and every page's `canonical`/`og:url` meta tag to your real deployed domain for correct SEO — they are placeholder root-relative paths.
