---
sketch: 001
name: library-home
question: "What's the library home structure — how do muscle-group browse and search coexist?"
winner: "C"
tags: [layout, exercises, navigation, gap-4]
---

# Sketch 001: Library Home

## Design Question
How should the Exercises tab's home screen be structured so a lifter finds any exercise in under 3 seconds — muscle-group-first browse (StrengthLog-like) vs the current search+chips+flat-list?

## How to View
open .planning/sketches/001-library-home/index.html

## Variants
- **A: Group Grid** — search bar on top; 2-column grid of muscle-group cards with counts; "All exercises" row; tapping a group slides in a drilled list. Search takes over the screen when typing.
- **B: Group List** — same structure as A but muscle groups as full-width list rows with counts and chevrons instead of a grid.
- **C: Pills + A–Z** — restructured version of the current implementation: search + horizontal muscle-group pill row + sectioned A–Z list with sticky letter headers.

## What to Look For
- Which gets you from cold screen → "Chest Supported Machine Row" fastest (via browse AND via search)?
- Does drill-in navigation (A/B) feel better or worse than filtering-in-place (C)?
- Grid vs list for the 10 groups: scan speed, thumb reach, wasted space.
- Empty search state offers "+ Create" — does that placement feel right?
- Row anatomy preview: icon + name + "group · equipment" meta + CUSTOM badge.
