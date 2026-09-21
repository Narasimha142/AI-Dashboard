# The AI Line

Learn AI, machine learning, deep learning, language models, RAG and agents by solving one online store's real problems. Fifty-seven stops on one subway-style map, each tagged beginner, intermediate or advanced, with no math.

Every stop follows the same pattern:

1. **The problem.** A concrete situation at ShopEase, a made-up online shop.
2. **Every way to solve it.** Each approach, with when it is great, when to avoid it, and an example.
3. **Your move.** Pick an approach, then see which was best and why.
4. **Best case and worst case.** What good and bad outcomes look like, with examples.
5. **Ride the architecture.** A short route diagram. Play it to watch the best case succeed, or the worst case go wrong at the exact step where it breaks.
6. **Remember this.** One sentence to take away.

The map has seven lines: Foundations, Machine learning, Deep learning, Language models, RAG, Agents, Production. Filter the map by level to ride the beginner stops first, then intermediate, then advanced. There is also a **Big picture** page (how AI, ML and deep learning nest, a ladder for adding power only when needed, and a coverage table of every stop by line and level) and a **Design lab** that turns a list of needs into a build order.

Progress is saved in the visitor's own browser. There is no server, no account and no tracking.

## Use it

**Online:** enable GitHub Pages (Settings, then Pages, then deploy from the `main` branch, root folder). Your site will be at `https://<your-username>.github.io/<repo-name>/`.

**On your computer:** the page loads its lessons from `content/`, so it needs a small web server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

**One file:** `node scripts/build.mjs` writes `dist/ai-line.html`, a single self-contained file that works by double-clicking, in an email, or on any host. It needs Node 18 or newer.

## How it is organized

```
index.html            page shell
css/style.css         all styling (light and dark themes)
js/app.js             app logic: map, stop pages, route player, big picture, design lab
content/lines.json    the seven lines and the rank name earned by finishing each
content/order.json    the order of stops on the map
content/stops/*.json  one lesson per file  <-- most contributions go here
scripts/validate.mjs  checks every lesson file and prints the coverage table
scripts/coverage.mjs  writes docs/COVERAGE.md
scripts/build.mjs     builds the single-file version
docs/stop-template.json  a blank stop to copy
```

## Contribute

You do not need to write code. A new stop is one JSON file. Read [CONTRIBUTING.md](CONTRIBUTING.md), copy `docs/stop-template.json`, and open a pull request. `node scripts/validate.mjs` tells you what to fix.

See [docs/COVERAGE.md](docs/COVERAGE.md) for exactly what is covered at each level, and what is deliberately left out. Ideas not covered yet:

- Graph machine learning
- Robotics and embodied AI
- Energy and environmental cost of AI
- Alignment and interpretability research
- Certification mapping (which stops help with which exam)
- Translations
- Screen-reader and keyboard testing reports

## A note on accuracy

The first version of the lessons was drafted with AI assistance and has not had a full expert review. Please open an issue if you find something wrong, misleading, or out of date. The lessons teach lasting concepts, not product names or prices, but the field moves quickly. The privacy and governance stop is a list of questions to ask, not legal advice.

## License

Code is under the [MIT License](LICENSE). Lesson text in `content/` is under [CC BY 4.0](CONTENT_LICENSE.md).
