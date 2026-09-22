# X Follow Status

![X Follow Status demo](assets/x-follow-status-demo.gif)

An unpacked Manifest V3 Chrome/Chromium extension that adds one bilingual, two-line relationship badge next to each loaded post or reply on X:

- Blue: `互关` / `Mutual follow`
- Red: `未回关我` / `Not following you`
- Yellow: `待回关他` / `You don't follow them`
- Green: `新朋友` / `New friend`

It observes X's existing `TweetDetail`, `TweetResultByRestId`, and user-detail responses in the logged-in tab. It never sends a follow, unfollow, or other account action.

## Non-mutual follow highlight

The extension adds a persistent red outline to non-mutual follows without changing your account. The outline stays visible on hover; it does not add a text label:

- On `/<handle>/following`, it marks people you follow who do **not** follow you: `未关注你 / Not following you` (`following: true`, `followed_by: false`).
- On `/<handle>/verified_followers`, it marks people you do **not** follow back: `你未关注 / You don't follow` (`following: false`).

It reads X's existing `Following` and `BlueVerifiedFollowers` responses; it never presses X's **Follow** or **Follow back** buttons.

On `/<handle>/following`, the fixed, bilingual top-right button `滚动到下个没关注我的人 / Next non-follower` stops at the nearest next already-loaded red-outline account. If none remains in the loaded list, it searches toward the bottom and stops as soon as X loads the next red-outline account.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this directory.
4. Refresh an already-open X tab, then open a post or replies page.

The extension only sees new X responses after it has loaded. X's internal GraphQL schema can change, so a future X web update may require adjusting the response matcher or relationship field path.

## Privacy and permissions

- Runs only on `x.com` and `twitter.com` pages.
- Reads relationship fields already returned to the signed-in X tab; it does not call X's follow or unfollow endpoints.
- Does not send data to a server, use analytics, or persist account data.
- Has no background worker, storage permission, or access to pages outside X.

## Verify

```sh
node --test relationship-parser.test.js
node --check relationship-parser.js
node --check response-matcher.js
node --check relationship-display.js
node --check page-hook.js
node --check content.js
node -e 'JSON.parse(require("node:fs").readFileSync("manifest.json", "utf8"))'
```
