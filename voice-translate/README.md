# Voice Translate

Listens to a conversation, transcribes it live, and translates each sentence into the language you pick.

## Run
```bash
npm start            # http://localhost:3000
```
Open in **Chrome / Edge / Safari** (they provide live speech recognition) and allow the microphone.

**Translation provider**
- `ANTHROPIC_API_KEY=... npm start` → Claude (best quality, context-aware; model via `CLAUDE_MODEL`)
- no key → free MyMemory API (rate-limited, fine for trying it out)

## Features
- Live transcript + translation, 20 languages, one-tap swap for two-way conversations
- **Audio prompt on start:** save audio *during* the conversation (button saves it any time) / keep it and decide at the end / transcript only
- Read translations aloud (speech synthesis)
- Speaker labels (tap the badge to switch)
- Export `.txt`, `.srt` subtitles, or JSON

## Notes
- Speech recognition language is the "Speaking" language; for a two-way chat, hit ⇄ when the other person talks.
- Chrome's recognizer sends audio to Google's service; this app doesn't store anything server-side.
- Test: `npm test`
