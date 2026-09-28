# X Follow Status

![X Follow Status demo](assets/x-follow-status-demo.gif)

在 X 的帖子、评论和关注列表中识别双方的关注关系，并把帖子或回复草稿一键翻译成英文。

An unpacked Manifest V3 Chrome/Chromium extension that shows follow relationships directly on X and translates post or reply drafts to English. It never follows, unfollows, posts, or changes your account relationships.

## Translate posts and replies to English

The extension adds a `Trans` button immediately to the left of X's `Post` and `Reply` buttons. Write a post or reply in any supported language and select `Trans` to replace the draft with its English translation. The translated draft remains editable and is never posted automatically.

Translation uses Google's keyless `translate.googleapis.com` endpoint with automatic source-language detection and English as the target language. Google may rate-limit or change this unofficial, no-SLA endpoint.

## Posts and replies

Each loaded post or reply gets one compact, bilingual two-line badge when both directions of the relationship are available:

| Relationship | Badge | Color |
| --- | --- | --- |
| You follow each other | `互关`<br>`Mutual follow` | Blue |
| You follow them; they do not follow you | `未回关我`<br>`Not following you` | Red |
| They follow you; you do not follow them | `待回关他`<br>`You don't follow them` | Yellow |
| Neither account follows the other | `新朋友`<br>`New friend` | Green |

If either relationship direction is absent from X's loaded data, no badge is shown rather than guessing.

## Follow lists

The extension adds a persistent red outline without changing your account. The outline stays visible on hover and does not add a text label:

- On `/<handle>/following`, it marks people you follow who do **not** follow you (`following: true`, `followed_by: false`).
- On `/<handle>/verified_followers`, it marks people you do **not** follow back (`following: false`).

On `/<handle>/following`, use the fixed top-right button `滚动到下个没关注我的人 / Next non-follower` to find the next red-outline account. Each account is visited at most once on the current profile route. When none of the already-loaded accounts remains, the page scrolls down and stops as soon as X loads the next match.

## How it works

It observes X's existing `TweetDetail`, `TweetResultByRestId`, user-detail, `Following`, and `BlueVerifiedFollowers` responses in the logged-in tab. It does not make follow or unfollow requests. Draft translation is a separate request to Google Translate that runs only after you select `Trans`.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this directory.
4. Refresh an already-open X tab.

The extension only sees new X responses after it has loaded. X's internal GraphQL schema can change, so a future X web update may require adjusting the response matcher or relationship field path.

## Privacy and permissions

- Runs only on `x.com` and `twitter.com` pages.
- Reads relationship fields already returned to the signed-in X tab; it does not call X's follow or unfollow endpoints.
- When you select `Trans`, sends only the current post or reply draft to `translate.googleapis.com` to translate it into English.
- Does not use analytics or persist account data or drafts.
- Uses a background service worker only for the Google Translate request. It has no storage permission and cannot access other browsing data.

## Verify

```sh
node --test relationship-parser.test.js translation-api.test.js runtime-bridge.test.js editor-text.test.js
node --check relationship-parser.js
node --check response-matcher.js
node --check relationship-display.js
node --check runtime-bridge.js
node --check editor-text.js
node --check page-hook.js
node --check content.js
node --check translation-api.js
node --check background.js
node -e 'JSON.parse(require("node:fs").readFileSync("manifest.json", "utf8"))'
```
