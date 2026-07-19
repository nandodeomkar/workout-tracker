# Feature Research

**Domain:** Strength-training workout tracker (mobile, StrengthLog/Strong/Hevy/Boostcamp category)
**Researched:** 2026-07-19
**Confidence:** MEDIUM (web search across competitor marketing pages, review sites, and aggregated Reddit sentiment; no direct API/docs source exists for this domain — cross-checked across 4 competitor products + community sentiment, see Sources)

## Feature Landscape

### Table Stakes (Users Expect These)

Features every competitor (StrengthLog, Strong, Hevy, Boostcamp) has for free. Missing any of these makes the app feel broken, not "lite."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fast set logging (weight/reps/checkmark) | The core loop; Reddit sentiment shows logging **speed** is the #1 reason users switch apps (users bounce Strong↔Hevy chasing faster logging) | MEDIUM | Must be ≤2 taps per set. Pre-fill from last performance (already in spec) is what makes this fast — don't ship without it. |
| Rest timer | Present in every competitor and in every dedicated rest-timer app; users expect auto-start on set completion + notification/vibrate when phone is in pocket | LOW-MEDIUM | Spec already covers this. Auto-start on checkmark tap, not manual start, is the expected UX — confirm this is the default. |
| Exercise library with search/filter (muscle group, equipment) | Every competitor ships hundreds of exercises; users expect to find "barbell bench press" in under 2 seconds | LOW-MEDIUM | ~250 seeded exercises (per spec) is adequate; filtering by muscle+equipment is the baseline, not a stretch feature. |
| Custom exercise creation | All 4 competitors support this; users always have a machine/movement not in any stock library | LOW | Straightforward CRUD. |
| Workout history (list + detail, editable) | Users expect to look back at "what did I lift last Tuesday" and to fix a logging mistake after the fact | LOW-MEDIUM | Calendar view is a nice-to-have wanted by Hevy users, not universally table stakes — spec includes it, keep it. |
| Templates/routines with pre-fill | Strong and Hevy both build the loop around "start from routine, weights pre-filled." Building a workout from scratch every session is a top complaint driver when missing. | MEDIUM | Already in spec (folders, pre-fill from last performance). |
| Personal records (PR) tracking | StrengthLog free tier explicitly ships "singles and rep record" PR tracking for free; users treat missing PRs as a broken app | LOW-MEDIUM | Spec's "compute from sets, never store" approach avoids the stale-cache pitfall other apps hit. |
| Offline functionality | Boostcamp complaints include "workouts didn't save without stable internet" — offline-first is a **differentiator against a real, current pain point**, but is functionally table stakes for a gym-use app | MEDIUM (architectural) | Spec's local-first SQLite design already solves this; make sure it never silently regresses. |
| Data export (CSV/JSON) | Reddit sentiment specifically resents "data lock-in" to a proprietary cloud; Boostcamp users explicitly request Excel/CSV export and don't get it | LOW | Cheap to build, disproportionately valued — do not cut this from any phase. |
| Units (kg/lb) | Every competitor supports both; global user base assumption | LOW | Spec: kg canonical, UI converts — correct approach. |
| No ads / no forced upsell nags | StrengthLog's freemium tier and Strong's Pro-gate are the explicit pain points this project exists to avoid | LOW (as a policy, not a feature) | This is a *product stance*, not a checkbox — audit every screen for "upgrade" prompts and remove. |

### Differentiators (Competitive Advantage)

For this project, the differentiators are specifically **features competitors paywall that this app ships free**, plus a few UX bets. This is the entire value proposition per PROJECT.md.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Advanced statistics free (est-1RM, top-set, volume charts, weekly volume/muscle group) | StrengthLog paywalls "advanced statistics" and the muscle-anatomy volume heatmap behind ~$17/mo; Hevy/Strong also gate deeper analytics behind Pro | MEDIUM-HIGH | Charting is the highest-complexity item in the spec (victory-native). Get correctness (Epley formula, volume math) right before visual polish. |
| Training programs with progression (linear + %TM) free | StrengthLog gates its "entire premium program catalog" behind Premium; Boostcamp gates exercise-substitution on some programs behind subscription | HIGH | Progression-rule engine (linear + percent-of-TM JSON) is architecturally the riskiest feature in the spec — get the data model right early since templates/programs/stats all depend on it. |
| Body measurements + graphs free | StrengthLog explicitly lists this as a premium feature | LOW-MEDIUM | Simple metric-log + chart; low risk, good early win since it's isolated from the workout-logging core. |
| Plate calculator + warm-up suggestions + 1RM calculator, all free and integrated in the active-workout flow | Competitors either omit these (Hevy: "no assistance with weight selection") or ship them as separate single-purpose apps (GymMath, Barbell Plate Calculator) — integrating them inline into the set-logging flow is a real UX advantage | LOW-MEDIUM each | Pure functions, easy to unit test (spec already flags these for vitest). Cheap, high perceived value — good candidates for an early phase to build confidence. |
| Zero paywall / zero locked screens anywhere in the app | Every competitor reviewed has a hard wall somewhere (routine count, exercise count, history window, or analytics). None of the four give away *everything* StrengthLog paywalls. | N/A (policy) | This is the actual moat. Every roadmap phase should be audited against "does this feel free," since users compare directly against StrengthLog's degrading free tier. |
| Crash-safe / never-lose-a-set architecture | Direct complaint found for both Strong ("no autosave, workouts lost after updates") and Boostcamp ("didn't save without stable internet," duplicate-workout bug) — this is a live, current pain point in the category, not a hypothetical | MEDIUM (architectural) | Spec's "every set write hits SQLite immediately" design directly targets a real competitor failure mode. Treat this as a hard requirement to verify with a specific manual test (kill app mid-set, mid-rest-timer), not just a nice property. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Social feed / leaderboards / friend following | Hevy has this and reviewers cite it as a motivator; feels like an obvious "engagement" win | Reddit sentiment (r/fitness, r/weightroom) is clear: serious lifters view social features as bloat and train for themselves, not likes; also drags in moderation/privacy/backend-cost surface the project explicitly wants to avoid (no server) | Already correctly out of scope per PROJECT.md. Revisit only at public release, and even then keep optional/off by default. |
| Gamification (streaks, badges, achievements) | Common in general fitness apps (Duolingo-style engagement patterns); looks cheap to add | Reddit users explicitly call this out as rarely appreciated and often annoying for this specific audience (serious lifters, not casual/beginner fitness-app users) | Rely on the PR feed and volume/1RM trend charts as the "reward" signal — real strength data is the motivator this audience wants. |
| AI-generated / auto-adjusted programming ("Trainer" style, e.g. Hevy Pro, Load Muscle) | Marketed as a premium differentiator by Hevy and Load Muscle; sounds like a natural "smart" feature | High complexity (needs a model or rule engine tuned across countless training contexts), directly contradicts the zero-server/zero-cost constraint, and this audience (owner + experienced-lifter friends) already knows how to program — Boostcamp reviews note advanced lifters don't want hand-holding | Ship well-designed manual progression rules (linear, %TM) that experienced lifters configure themselves — already the spec's approach. Don't build an "AI coach." |
| Exercise instruction videos/animations | StrengthLog's free tier explicitly includes video demos and reviewers cite them positively | Large content-production/licensing burden, legal risk (spec explicitly says no proprietary content may be copied), and low value for this app's actual users (experienced lifters who don't need form tutorials) | Already correctly out of scope per PROJECT.md. Static muscle-group/equipment tags are enough for this audience. |
| Excessive metric tracking / stat overload (RPE, RiR, tempo, bar velocity, etc. all mandatory) | StrengthLog Premium and Strong both push RPE/RiR as premium/advanced features; tempting to "out-feature" competitors by tracking everything | Reddit sentiment explicitly warns that overloading with metrics turns logging into a chore and that "50 features you'll never use" is worse than 10 that work — directly conflicts with the project's "fast, no clutter" core value | Keep RPE optional per-set (spec already has `rpe?` as nullable), never required, never surfaced unless the user opts in. |
| Accounts/auth beyond optional backup sign-in | Every competitor requires or strongly nudges account creation, sometimes for basic use | Adds a login wall friction point before first workout, and a bad first impression given this app's whole positioning is "no account needed to use it" | Already correctly scoped: Google sign-in is optional and only for Drive backup, never gates logging. |
| Workout/routine sharing or marketplace | StrengthLog Premium and Hevy Pro both offer sharing as a premium perk | Requires either a backend or a public data channel — conflicts with "no server" constraint; also a vector for exactly the social-feature bloat this project avoids | If ever wanted, keep to local export/import of a template as a JSON file a friend can import manually — no server needed. |

## Feature Dependencies

```
Fast set logging (core loop)
    └──requires──> Exercise library (need something to log against)
    └──requires──> Crash-safe SQLite writes (spec: every set write is immediate)

Rest timer
    └──enhances──> Fast set logging (auto-start on checkmark)

Templates (pre-fill from last performance)
    └──requires──> Workout history (need past sets to pre-fill from)
    └──requires──> Fast set logging (templates feed into the same active-workout screen)

Programs (ordered template days + progression)
    └──requires──> Templates (a program is a sequence of templates)
    └──requires──> Progression rules (linear / percent-of-TM) engine
                       └──requires──> Training maxes table (percent-of-TM needs a stored TM)

PR tracking / PR feed
    └──requires──> Workout history (sets) — computed, never stored, per spec

Stats (est-1RM, volume charts, weekly volume by muscle)
    └──requires──> Workout history (sets)
    └──requires──> Exercise library (muscle group tags, for volume-by-muscle-group)
    └──enhances──> Programs (percent-of-TM progression benefits from 1RM/TM visibility)

Plate calculator
    └──requires──> Settings (bar weight, plates owned)

Warm-up suggestion
    └──requires──> Plate calculator (suggested warm-up sets are plate-loadable)
    └──enhances──> Fast set logging (surfaced inline during active workout)

Body measurements + graphs
    ──independent──  (no dependency on workout-logging core; safe to build in isolation)

Backup/restore (Google Drive)
    └──requires──> Local SQLite as source of truth (spec: DB always wins, backup never blocks use)
    ──conflicts with── nothing, but must never gate any core feature (backup is enhancement, not requirement)

Social features, gamification, AI coaching
    ──anti-features── deliberately not built; no dependency chain needed
```

### Dependency Notes

- **Programs require progression rules, which require templates and training maxes.** This is the highest-risk dependency chain in the whole feature set (also flagged in PITFALLS.md). Build templates and simple linear progression first; add percent-of-TM (5/3/1-style) only once linear progression and training-max entry are solid — don't build both progression types simultaneously.
- **Stats require workout history to already contain real data with muscle-group tags on exercises.** If the exercise library's muscle-group tagging is inconsistent (a real risk with a trimmed/re-tagged public dataset), weekly-volume-by-muscle-group stats will be silently wrong. Validate exercise tagging before building this stat.
- **Warm-up suggestion enhances the plate calculator** — build plate calculator first as the standalone primitive, then layer warm-up-set suggestions on top (a warm-up suggestion is just a sequence of plate-calculator calls at percentages of the target weight).
- **Body measurements has zero dependency on the logging core** — it's an ideal candidate for an early phase to build momentum/confidence without touching the riskier active-workout or progression code.
- **Backup must never become a soft dependency of core logging.** The single biggest architectural pitfall in this category (per Strong and Boostcamp complaints) is any coupling between "can I log a set" and "is the network/cloud available." Verify with a specific test: airplane mode, no Google sign-in, full workout logging still works end-to-end.

## MVP Definition

### Launch With (v1)

Minimum to validate the concept with the owner + friends beta — matches PROJECT.md's Active requirements.

- [ ] Fast set logging (weight/reps/checkmark, steppers, pre-fill from last performance) — this is the entire product if nothing else works
- [ ] Rest timer with auto-start + notification — table stakes, low complexity, high daily-use value
- [ ] Exercise library (seeded ~250) + custom exercise creation — nothing to log against otherwise
- [ ] Workout history (list + calendar + edit) — users need to trust the app remembers everything
- [ ] Templates with folders, pre-fill — the loop that makes repeat workouts fast
- [ ] Crash-safe active workout (survives app kill/crash) — directly targets Strong/Boostcamp's most-cited failure mode
- [ ] PR detection (computed, not stored) — cheap given the data model, high perceived value
- [ ] Plate calculator, 1RM calculator, warm-up suggestions — low complexity, core differentiator vs. apps that omit these

### Add After Validation (v1.x)

Add once the core logging loop is proven stable in daily friends-beta use.

- [ ] Programs with progression (linear + percent-of-TM) — trigger: friends beta requests structured programming, or owner wants to run a 5/3/1-style cycle
- [ ] Stats (est-1RM/volume charts, weekly volume by muscle group) — trigger: enough history has accumulated (a few weeks) that charts have data worth looking at
- [ ] Body measurements log + graphs — trigger: any beta user asks to track bodyweight/measurements (low cost to build, can go earlier if convenient)
- [ ] Google Drive backup/restore + CSV/JSON export — trigger: before anyone's phone-loss risk becomes real, i.e. before wide friends-beta distribution

### Future Consideration (v2+)

Defer until after Play Store release and real usage data, per PROJECT.md's Out of Scope.

- [ ] iOS build — defer: all current users are Android; revisit only if Play Store release brings iOS-user demand
- [ ] Optional lightweight social (e.g., share a single workout as an image, not a feed) — defer: only if public users request it post-launch, and only in a form that doesn't require a backend or become a leaderboard
- [ ] Exercise videos/animations — defer indefinitely: legal risk and low value for this specific experienced-lifter audience; revisit only if public-release feedback strongly demands it

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Fast set logging + pre-fill | HIGH | MEDIUM | P1 |
| Rest timer | HIGH | LOW-MEDIUM | P1 |
| Exercise library + custom exercises | HIGH | LOW-MEDIUM | P1 |
| Crash-safe writes / offline | HIGH | MEDIUM (architectural) | P1 |
| Workout history + calendar | HIGH | LOW-MEDIUM | P1 |
| Templates + folders | HIGH | MEDIUM | P1 |
| PR tracking | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Plate/1RM/warm-up calculators | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Programs + progression rules | HIGH | HIGH | P2 |
| Stats/charts (1RM, volume) | HIGH | MEDIUM-HIGH | P2 |
| Body measurements + graphs | MEDIUM | LOW-MEDIUM | P2 |
| Backup/restore + export | MEDIUM (high stakes when needed) | MEDIUM | P2 |
| Zero-paywall policy audit | HIGH (moat) | LOW (ongoing discipline, not a build task) | P1 (ongoing) |
| Social/gamification/AI coaching | LOW for this audience | HIGH | Not planned (anti-feature) |

**Priority key:**
- P1: Must have for friends-beta launch
- P2: Should have, add once core logging is proven stable
- P3: Nice to have, future consideration (none identified beyond the deferred v2+ items above)

## Competitor Feature Analysis

| Feature | StrengthLog | Strong | Hevy | Boostcamp | Our Approach |
|---------|-------------|--------|------|-----------|--------------|
| Basic logging | Free | Free (capped) | Free, generous | Free | Free, unlimited, no caps |
| Advanced stats/volume charts | **Premium ($17/mo)** | Partial free, deeper behind Pro | Free (a real strength of Hevy) | Basic only | Free, full StrengthLog-Premium-equivalent depth |
| Training programs w/ progression | **Premium (full catalog)** | Manual only, no built-in progression | Free routines, AI "Trainer" is Pro | Free, 130+ programs (their core differentiator) | Free, linear + %TM progression built in |
| Body measurements | **Premium** | Free | Not a focus | Not a focus | Free |
| Plate/1RM/warm-up calculators | Not a headline feature | Warm-up calculator only | Not offered | Not offered | All three, free, integrated inline |
| Offline reliability | Unknown (not flagged in complaints) | Occasional autosave bugs reported | Generally solid | Explicit complaints: doesn't save offline, duplicate-workout bug | Local-first SQLite, verified crash-safe by design |
| Data export | Unknown | CSV export (free feature) | Unclear | Explicitly requested, not delivered | CSV/JSON export, free |
| Social/sharing | Premium feature | None | Free, has social feed | None | Deliberately excluded (anti-feature) |
| Ads/upsell friction | Free tier reportedly degrading (per PROJECT.md's stated motivation) | Pro-gate friction cited in reviews | Minimal | Minimal | Zero — explicit product stance |

## Sources

- [StrengthLog official site](https://www.strengthlog.com/) — free vs premium feature list, confidence MEDIUM
- [StrengthLog Premium support article](https://help.strengthlog.com/help-article/strengthlog-premium/) — premium feature breakdown and pricing, confidence MEDIUM
- [Strong app review — Dr. Muscle](https://dr-muscle.com/strong-workout-app-review/) — features and complaints, confidence MEDIUM
- [Strong App Review 2026 — Setgraph](https://setgraph.app/articles/strong-app-review-is-it-worth-it-honest-comparison-vs-setgraph) — free/pro tier breakdown, confidence MEDIUM
- [Hevy App Review — RepReturn](https://repreturn.com/hevy-app-review/) — free tier depth, complaints, confidence MEDIUM
- [Is Hevy Free? — Push/Pull](https://push-pull.app/blog/push-pull-vs-hevy) — free tier limits (4 routines/7 exercises/3mo history), confidence MEDIUM
- [Boostcamp review — Garage Gym Reviews](https://www.garagegymreviews.com/boostcamp-review) — program catalog and features, confidence MEDIUM
- [Boostcamp App Store reviews](https://apps.apple.com/us/app/boostcamp-workout-programs/id1529354455?see-all=reviews&platform=iphone) — user-reported bugs and complaints, confidence MEDIUM
- [Best Workout Tracker per Reddit — Cora App (200+ threads analyzed)](https://www.corahealth.app/blog/best-workout-tracker-reddit) — aggregated community sentiment on bloat/social/gamification, confidence MEDIUM
- [Best Workout Tracker App for 2026 — Hevy blog](https://www.hevyapp.com/best-workout-tracker-app/) — competitive positioning, confidence MEDIUM (vendor source, cross-checked against independent reviews)
- [FitNotes workout tools](http://www.fitnotesapp.com/workout_tools/) and [GymMath](https://apps.apple.com/us/app/gymmath-plates-1rm-calc/id1460137994) — plate/1RM calculator feature norms, confidence MEDIUM
- Internal: `.planning/PROJECT.md` and `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — approved project scope and data model (primary source for what's already decided, not re-researched)

---
*Feature research for: strength-training workout tracker (StrengthLog-style clone, paywalled features free)*
*Researched: 2026-07-19*
