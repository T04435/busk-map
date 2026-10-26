# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Street performers (buskers) in Melbourne. Before they go out, they plan where and when to play, and what to play. Phone first: they plan on the move and check the plan at the pitch.

## Product Purpose

Busk Map is an agent. Claude, using Qloo taste data and the city's open data, researches the crowds and returns the best pitches for a busker's slot. Each pitch comes with its window, why that crowd fits, and a setlist drawn from the performer's Repertoire (the songs they can sing). Success means a busker picks a pitch and a set they trust, and can see why.

## Positioning

Taste-matched pitches: who is actually out there at that hour, and what they like (Qloo), not busyness alone. Busk Map stays aware of where busking is allowed and shows its research live as the agent works.

## Operating Context

Built for the Qloo Agentic Hackathon 2026; submission is due 30 Oct. The live judge path is landing → plan a busk → the plan page → Repertoire → Brain (how Qloo taste data feeds it).

## Capabilities and Constraints

- Planning a busk: an act (artists, songs or your Repertoire), a city (Melbourne), a day, and a time (Any time · Busk Map picks by default), plus a permit.
- The plan page streams the agent's research, then shows three pitches on a map, each with details and a setlist.
- Repertoire: the songs you can sing, edited once and reused by every plan. Learn runs suggest songs worth learning.
- Brain: how each Qloo call feeds the plan.
- The Week planner and Tips are retired for this release.

## Brand Commitments

- The name is Busk Map, and the visual identity is Honeycomb (the published design system is the reference; the app is the source of truth for component code).
- The logo is the lockup: the hex mark beside the wordmark.
- Qloo is named in plain text only: no Qloo logo, no partner or sponsor wording. Busk Map is not affiliated with or endorsed by Qloo.
- Busk Map never confirms a pitch is legal: it tells buskers to check their permit conditions.
- No text glyphs as icons (arrows, chevrons, checks); icons are the design system's Icon set.
- One keyboard focus ring, never two.

## Evidence on Hand

Real data sources: Qloo (taste), City of Melbourne busking layers, Ticketmaster (events), Open-Meteo (weather), Spotify and Last.fm (songs). There are no testimonials, users or usage figures to cite; don't invent any.

## Product Principles

- Show the why: every pitch and song carries its reason, from real data.
- Honest data: label estimates, test data and gaps; never fabricate a number.
- The busker's time matters: the fastest path from "who I sound like" to "where and what to play".

## Accessibility & Inclusion

WCAG AA text contrast in day and night themes, a visible keyboard focus ring, reduced-motion support, and 48 px touch targets on phones.
