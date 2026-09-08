# architechbc.com

The website for Architech Business Consulting, LLC.

Plain HTML, CSS and vanilla JavaScript. **No build step, no framework, no
dependencies, no package manager.** Served directly by GitHub Pages from the
repository root. This is deliberate: the site should still work untouched in five
years, and there is nothing here that can rot, expire, or fail an audit.

## Layout

```
index.html          Home — the whole marketing site
scope/index.html    Salesforce Readiness Review
favicon.ico         Multi-resolution (16-64px); browsers request this by default
site.webmanifest    Android / PWA icons and theming
404.html            Not found
assets/css/         site.css (design system + home), scope.css (review)
assets/js/          assessment-model.js (questions), assessment.js (engine)
assets/img/         Logo, favicon, Open Graph card
CNAME               Custom domain for GitHub Pages — do not delete
```

## Editing

Open a file, change it, commit, push. GitHub Pages redeploys in about a minute.
There is nothing to install and nothing to run.

To preview locally:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

### Changing the colour scheme

Every colour is a CSS custom property at the top of `assets/css/site.css`, under
`:root` (light) and the `prefers-color-scheme: dark` block. The brass accent is
`--accent`; changing those two values restyles the entire site.

### The readiness review

`/scope/` is a review of up to 76 questions across eighteen sections, structured after the
Salesforce *Getting Started Implementation Guide* (Prepare / Set Up / Engage)
with sections added for automation, integration, release management, portals, data
volume, AI and governance. Three depths — Quick pass, Standard review, Full audit
— are a tier ceiling; every question carries `t` 1–3 and the estimated times in
the gate are computed from the live count, never hardcoded.

Two files, and the split matters:

- **`assets/js/assessment-model.js`** is pure data — sections, questions,
  options, scores and findings. Extending the review means adding entries here
  and nothing else.
- **`assets/js/assessment.js`** is the engine. It renders whatever the model
  defines, scores it, and manages URL state.

**Answers live in the URL fragment**, after `#r=`. Browsers never transmit a
fragment in an HTTP request, so answers reach no server — not GitHub's, not
anyone's. That is the whole privacy model, and the page says so explicitly.

Encoding is **keyed, so links survive change**. Each answer is a token of
`<questionId><optionKey>` (for example `own1a`), and role, cloud and depth are
written by id. A question that no longer exists is ignored; a new question is
simply unanswered, which never affects the score; a retired option is ignored.
Add, remove, reorder and reword freely — no saved link breaks. Only a change to
the `FORMAT` constant in `assessment.js` invalidates links, and it should
essentially never change.

Two rules make that hold. Every option carries a permanent single-letter key
`k`: reword the label freely, but never change or reuse a key, and retire an
option with `retired: true` rather than deleting it. And question ids are
letters-then-digits, so tokens parse back unambiguously. `node validate-model.js`
enforces both, along with wording-vs-answer shape, one "Not sure" per question,
flag coverage, tier range, duplicate ids and cloud-fork symmetry. **Run it after
every change to the questions.**

State is also mirrored to **`localStorage`** so a returning visitor resumes.
Deliberately *not* a cookie: cookies are transmitted to the server on every
request, which would make the privacy claim on the page false. Never move this
to a cookie, a query string, or a form service without rewriting those claims.

**Two gate questions come first and shape everything after them.** `role`
rewords questions via each question's `qr` map — an executive and a day-to-day
user both know whether releases break things, but neither recognises the
question phrased for the other, and wrong wording makes people answer "Not
sure" when they actually know. `cloud` forks the process sections entirely
(asking a Service Cloud org about opportunity stages is nonsense) while
platform-hygiene sections stay common to all.

There is no backend, no analytics and no tracking on this site. Keep it that
way: the privacy promise on `/scope/` must remain literally true.

Scoring: each option carries `v` = 0..3; a section scores the mean of its
*answered* questions normalised to 100. Unanswered questions are excluded rather
than counted as zero, so a partial review is not unfairly penalised. An option's
`flag` is the finding shown when it is chosen.

## Hosting

GitHub Pages, served from `main`. `CNAME` binds the custom domain and HTTPS is
provisioned automatically by GitHub via Let's Encrypt.

DNS is at Squarespace Domains (registration) — the apex `A` records point to
GitHub Pages, and `www` is a `CNAME` to `gabriel-abc.github.io`. The Google
Workspace `MX`, `SPF` and `DKIM` records are unrelated to hosting and must be
left alone.

## HTTPS

The site is HTTPS-only. GitHub Pages has HTTPS enforcement enabled, which 301s
all HTTP traffic. GitHub cannot send HSTS headers for custom domains, so each
page additionally carries a small redirect guard in `<head>` and a
`upgrade-insecure-requests` policy. If you ever add a resource, use `https://`
or a root-relative path — never plain `http://`.
