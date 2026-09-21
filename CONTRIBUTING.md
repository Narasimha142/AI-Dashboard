# Contributing

Thank you for helping. Most contributions are a new lesson ("stop"), a fix to an existing one, or a translation. None of these need code.

## Quick start

1. Fork the repository and create a branch.
2. Copy `docs/stop-template.json` to `content/stops/<your-id>.json`.
3. Fill it in. Add the id to `content/order.json` where it belongs (stops are grouped by line).
4. Run `node scripts/validate.mjs` (Node 18 or newer). Fix anything it reports. It also prints a coverage table so you can see whether your stop fills a gap. Run `node scripts/coverage.mjs` to refresh `docs/COVERAGE.md`.
5. Preview with `python3 -m http.server 8000` and open http://localhost:8000.
6. Open a pull request. Automated checks run the same validator.

## What a stop contains

| Field | What to write |
|---|---|
| `id` | Short, lowercase, unique. Must match the file name. |
| `line` | Which line it belongs to (1 to 7, see `content/lines.json`). |
| `level` | `beginner`, `intermediate` or `advanced`. Beginner needs no background. Intermediate assumes the basics. Advanced is about building, testing and running real systems. |
| `shortTitle` | 40 characters or fewer. It is the label on the map. |
| `title`, `hook` | The page title, and one sentence on what the stop covers. |
| `inPlainWords` | Optional. Two or three sentences that explain the concept to a beginner. |
| `useCase` | A problem at ShopEase. Real numbers and constraints make it concrete. |
| `approaches` | At least four ways to solve it. Each has `name`, `what`, `greatWhen` and/or `avoidWhen`, and an `example`. |
| `challenge` | A question about the use case with three to five options. Each option has a `verdict` (`best`, `ok` or `poor`) and a `why`. Exactly one is `best`. |
| `bestCase`, `worstCase` | A short title and a concrete example for each. |
| `route` | The architecture as a route. See below. |
| `takeaway` | One memorable sentence. |

### The route

`route.lanes[].steps[]` are the stops on the architecture diagram, in order. Each has:

- `label`: a few words, 32 characters or fewer.
- `goes`: what happens to the example at this step when everything works.
- `goesWrong`: only on the step where the worst case begins. The route player shows this text in red, and treats every later step as built on the mistake.

`route.travelling` is the example that moves along the route. Use one lane for a simple flow, or two lanes when there is a "prepare once" part and a "every time" part.

## Style rules

- **Plain words.** Write for someone who has never seen the topic. Explain a term the first time it appears.
- **No math or formulas.** Use everyday descriptions. "Of the payments we flagged, how many were fraud?" beats a formula.
- **Same use case.** Stay inside ShopEase so the stops build on each other. Numbers can be illustrative, but keep them believable.
- **Compare all realistic approaches,** including the tempting wrong ones. Say when each is great and when to avoid it.
- **Best and worst must be specific.** Show what happens, with an example, not just "this is bad".
- **Do not invent facts.** If a claim is not obvious, say how you know or soften it. Avoid product names, version numbers and prices, which go out of date.
- **Plain text only.** No HTML or markdown inside the JSON. The page escapes it.
- **Legal and health topics** are questions to ask professionals, not advice.
- Sentence case, active voice, no filler.

## Changing the app or design

- Colors are CSS variables at the top of `css/style.css`. The seven lines use `--l1` to `--l7`, with light and dark values.
- `js/app.js` contains the map, the stop page, the route player, the Big picture and the Design lab. The Big picture and Design lab refer to stops by id. If you rename or remove a stop they use, the validator warns you and the link is hidden.
- Keep it working without a build step, and keep it accessible: visible focus, keyboard use, and respect for reduced motion.

## Pull requests

Keep each pull request to one topic. Say what you changed and why, and link any source for a factual claim. A maintainer will check for accuracy, tone and fit with the rest of the map.
