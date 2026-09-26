<div align="center">

# 🤖 Astra ka Chota Bhai

### *See. Think. Act. Verify.*

**An AI-powered browser agent that actually uses the browser — instead of just telling you what to click.**

Built with Playwright + Gemini/OpenRouter for real, verifiable browser automation.

[![React](https://img.shields.io/badge/React-frontend-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-app%20logic-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-dev%20server-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-automation-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#-license)

[Features](#-features) • [Installation](#-installation) • [Architecture](#-agent-architecture) • [Troubleshooting](#-troubleshooting) • [Contributing](#-contributing)

</div>

---

## 💡 What is this?

Most "AI browser agents" fire off a click and hope for the best. **Astra ka Chota Bhai** doesn't.

Every meaningful action goes through a strict loop — **Observe → Act → Verify** — so the agent knows the actual state of the page instead of assuming its last action worked.

```
USER TASK
   │
   ▼
AI PLANNER  →  TASK STAGES
                    │
                    ▼
              ┌───────────┐
        ┌────▶│  OBSERVE  │
        │     └─────┬─────┘
        │           ▼
        │     ┌───────────┐
        │     │    ACT    │
        │     └─────┬─────┘
        │           ▼
        │     ┌───────────┐
        │     │  VERIFY   │
        │     └─────┬─────┘
        │           │
        │      ┌────┴────┐
        │   SUCCESS   FAILURE
        │      │         │
        │      ▼         ▼
        │  NEXT STAGE  RECOVER
        │                 │
        └─────────────────┘
               RETRY
```

**The key idea:** don't assume the browser action worked — verify it.

---

## 🚀 Features

### 🧠 AI Planning
Converts a natural-language task into a sequence of executable browser stages.

> **Example prompt:**
> *"Go to YouTube, search for CarryMinati, open the first actual video and play it."*

The planner breaks it down into concrete steps:

1. Open YouTube
2. Find the search box
3. Enter `CarryMinati`
4. Submit the search
5. Verify search results appeared
6. Find the first actual video
7. Open the video
8. Verify the video page loaded
9. Start playback
10. Verify playback is running

### 🌐 Real Browser Automation
Powered by **Playwright**, the agent can navigate, click, type, select, scroll, read page content, download files, go back/forward, reload, and verify live browser state.

### 👀 Observe → Act → Verify
The agent never fires actions blindly. After every meaningful step, it re-checks the actual DOM/browser state before moving on.

```
Click Search
     ↓
Observe Page
     ↓
Search Results Visible?
     ↓
  YES → Continue        NO → Recovery
```

### 🔄 Self-Healing
Websites change. Elements move. Buttons disappear. Pages load slowly. Instead of failing immediately, the agent attempts structured recovery:

```
ACTION FAILED → CLASSIFY ERROR → RE-OBSERVE PAGE
      → RE-LOCATE ELEMENT → RETRY → VERIFY
```

### 🤖 Multiple AI Brains
Swap the reasoning engine without touching the browser layer:

- **Google Gemini**
- **OpenRouter** (model gateway to many providers)

### 📱 Mobile Agent Mode
Runs the browser at a mobile-sized viewport, displayed inside a phone-style frame — great for mobile testing, demos, and screen recordings.

### 📡 Live Browser Streaming
The live Playwright session streams into the WebPilot UI, showing the screenshot feed, agent cursor, target highlights, activity timeline, agent status, and FPS.

### 🎯 Agent Radar
A runtime HUD with at-a-glance stats:

```
┌────────────────────┐
│ AGENT RADAR        │
│                    │
│ FPS     14         │
│ STREAM  LIVE       │
│ LOAD    32%        │
│ STATUS  ACTING     │
└────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + TypeScript + Vite | UI, activity timeline, agent radar |
| Styling | Tailwind CSS | Interface styling |
| Backend | Node.js | Runtime for the agent server |
| Automation | Playwright | Real browser control |
| Realtime | WebSocket | Browser streaming & live events |
| AI | Google Gemini / OpenRouter | Planning & reasoning |

---

## 📋 Requirements

- **Node.js 20+** recommended

```bash
node --version
npm --version
```

---

## 📥 Installation

**1. Clone the repository**

```bash
git clone YOUR_REPOSITORY_URL
cd astra-ka-chota-bhai
```

**2. Install dependencies**

```bash
npm install
```

**3. Install the Playwright browser binary**

```bash
npx playwright install chromium
```

On Linux, if Playwright reports missing system dependencies:

```bash
npx playwright install --with-deps chromium
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# ==========================================
# AI PROVIDER
# ==========================================
AI_PROVIDER=gemini

# ==========================================
# GOOGLE GEMINI
# ==========================================
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=YOUR_GEMINI_MODEL

# ==========================================
# OPENROUTER
# ==========================================
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
OPENROUTER_MODEL=YOUR_OPENROUTER_MODEL
```

> ⚠️ **Never commit your API keys.** Make sure your `.gitignore` includes:
> ```
> .env
> .env.local
> .env.*.local
> node_modules/
> dist/
> ```

### 🧠 Gemini setup
Get an API key from [Google AI Studio](https://aistudio.google.com/), then set `GEMINI_API_KEY` and `GEMINI_MODEL`. Available models depend on your API access.

### 🌐 OpenRouter setup
Create a key at [OpenRouter](https://openrouter.ai/), then set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, e.g.:

```env
OPENROUTER_MODEL=google/gemini-2.5-flash
```

### 🧠 Choosing the AI brain

If the app exposes a **Brain Selector**, you can switch between providers at runtime — the browser execution layer stays identical either way:

```
                 ┌──────────────┐
                 │ Astra Agent  │
                 └──────┬───────┘
                        │
                 Brain Selector
                   /          \
              Gemini        OpenRouter
                   \          /
                  AI Planner
                        │
                        ▼
                 Browser Agent
```

---

## ▶️ Run the Project

```bash
npm run dev
```

Vite will serve the app locally, typically at `http://localhost:5173`.

---

## 🖥️ Development Architecture

```
┌─────────────────────────────────────────┐
│                FRONTEND                  │
│  React + Vite + TypeScript + Tailwind    │
│                                           │
│  • Browser UI                            │
│  • Activity Timeline                     │
│  • Agent Radar                           │
│  • Brain Selector                        │
└──────────────────┬────────────────────────┘
                   │ WebSocket / API
                   ▼
┌─────────────────────────────────────────┐
│                 BACKEND                  │
│           Node.js + Playwright           │
│                                           │
│  • AI Provider Manager                   │
│  • Task Planner                          │
│  • Action Executor                       │
│  • Verification                          │
│  • Recovery                              │
└──────────────────┬────────────────────────┘
                   ▼
            Chromium Browser
                   ▼
              Real Website
```

---

## 🧩 Agent Architecture

```
User → Task → Planner → Stages → Observe → Action
  → Playwright → Browser → Verify
        │
   ┌────┴────┐
Success    Failure
   │           │
Next Stage   Recovery → Retry
```

---

## 📝 Example Tasks

**Search & play a video:**

```
Go to YouTube, search for "CarryMinati",
open the first actual video result,
and start playing it.
```

The agent preserves the exact search query and executes the task stage-by-stage.

**Simple navigation:**

```
Open YouTube.
```

```
Task → Navigate → Wait for DOMContentLoaded
  → Observe → Verify URL/Title/Page → Complete
```

**Clicking an element** — resolution priority, not blind coordinates:

```
Role + Name → Visible Text → ARIA Label
  → Title → Stable Selector → Contextual Element
```

Then: `Resolve Element → Scroll Into View → Click → Verify Result`

**Filling a form field:**

```
Find Input → Check Editable → Fill
  → Read Actual Value → Verify
```

Verification uses the control's actual value, not a page-wide text search.

---

## 🔄 Recovery System

Errors are classified before recovery is attempted:

| Error Type | Meaning |
|---|---|
| `ELEMENT_NOT_FOUND` | Target element missing from the DOM |
| `ELEMENT_NOT_VISIBLE` | Element exists but isn't visible |
| `STALE_ELEMENT` | Reference to element is outdated |
| `TIMEOUT` | Action or wait exceeded time limit |
| `NAVIGATION_CHANGED` | Page navigated unexpectedly |
| `OVERLAY_BLOCKED` | Something is covering the target |
| `CLICK_FAILED` | Click action didn't register |
| `INPUT_FAILED` | Text input failed |
| `SCROLL_FAILED` | Scroll action failed |
| `DOWNLOAD_FAILED` | File download failed |
| `NAVIGATION_NETWORK_ERROR` | Network issue during navigation |
| `OPENROUTER_ERROR` | Issue with the OpenRouter API |
| `UNKNOWN` | Unclassified failure |

**Example recovery flow:**

```
ELEMENT_NOT_FOUND → Fresh DOM Observation
  → Re-locate Element → Scroll Into View → Retry → Verify
```

---

## 🛑 Safety & User Constraints

The agent **always** respects explicit user constraints. For example:

> *"Fill all questions. Do NOT click Submit."*

The agent must never click Submit. **User constraints always override autonomous decisions.**

### 🚫 What this project does *not* do

This is not designed to:

- Bypass CAPTCHAs, authentication, or security challenges
- Circumvent anti-bot protections
- Bypass paywalls
- Steal credentials
- Perform unauthorized actions
- Make purchases without user control

If a website presents a CAPTCHA or security challenge, the agent **stops** rather than attempting to bypass it.

---

## 📱 Mobile Mode

Switch to **Mobile Mode** to run the browser with a mobile-sized viewport, rendered inside a phone-style frame in the UI — ideal for mobile testing, agent demos, and responsive workflow checks.

```
┌───────────────────────────────────┐
│                                    │
│          ┌─────────────┐           │
│          │             │           │
│          │   Browser   │           │
│          │   Website   │           │
│          │             │           │
│          └─────────────┘           │
│                                    │
└───────────────────────────────────┘
```

## 🎥 Record Mode

Designed for clean demo recordings. It maximizes the browser presentation, hides unnecessary UI, centers the mobile browser, and keeps the Agent Radar and cursor visible — all within the same session.

Press **`ESC`** to exit fullscreen/focus mode.

---

## 📂 Project Structure

```
.
├── src/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   ├── App.tsx
│   └── main.tsx
│
├── server/
│   ├── index.ts
│   ├── browser/
│   ├── agent/
│   ├── ai/
│   └── routes/
│
├── public/
│
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🧪 Development Workflow

1. Start the project
2. Start the backend
3. Open WebPilot
4. Select an AI Brain
5. Enter a task
6. Start the agent
7. Observe the Activity Timeline
8. Watch browser execution
9. Verify the final result

---

## 🐛 Troubleshooting

<details>
<summary><strong>npm run dev fails</strong></summary>

```bash
rm -rf node_modules
npm install
npm run dev
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```
</details>

<details>
<summary><strong>Playwright browser not found</strong></summary>

```bash
npx playwright install chromium
```

On Linux:

```bash
npx playwright install --with-deps chromium
```
</details>

<details>
<summary><strong>OpenRouter returns 402</strong></summary>

Usually means the request needs more credits than your API key currently allows. Check `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, and make sure you're not requesting an unnecessarily huge output limit (avoid `max_tokens = 65536` for normal planning calls — use a reasonable limit for the task).
</details>

<details>
<summary><strong>OpenRouter returns 401</strong></summary>

Double-check `OPENROUTER_API_KEY` is correct, then restart the dev server after editing `.env`.
</details>

<details>
<summary><strong>Gemini API key error</strong></summary>

Verify `GEMINI_API_KEY` is set and available to the **backend** (not exposed via a frontend `VITE_` variable). Restart the server after editing `.env`.
</details>

<details>
<summary><strong>Browser navigation fails</strong></summary>

Check: internet connection, target site availability, Playwright/Chromium installation, proxy configuration, browser launch configuration, and navigation timeout. The agent classifies navigation failures rather than pretending the page loaded.
</details>

<details>
<summary><strong>ERR_HTTP2_PROTOCOL_ERROR</strong></summary>

If a site works in normal Chrome but fails in Playwright, check the Chromium/Playwright version, proxy configuration, custom browser arguments/headers, and VPN/network configuration. Do not attempt to bypass website security.
</details>

---

## 🔒 Security

- Never commit secrets. Your `.gitignore` should include:
  ```
  .env
  .env.local
  .env.*.local
  node_modules/
  dist/
  *.log
  ```
- Never place API keys inside React components, frontend code, Vite client code, or public configuration.
- AI provider keys must remain **server-side only**.

---

## 💡 Improving the Agent

Prefer the generic agent architecture over hardcoded, site-specific scripts:

```diff
- if website == youtube:
-     click("#some-button")

+ Task → Observe → Understand → Resolve Target
+   → Execute → Verify → Recover if necessary
```

This keeps the system reusable across websites.

---

## 🧠 Core Principles

1. **Observe before acting** — never assume the page is in the expected state.
2. **Verify after acting** — an action isn't successful just because Playwright didn't throw.
3. **Use fresh DOM state** — re-observe after navigation or major page changes.
4. **Recover locally** — fix the current stage instead of restarting the whole task.
5. **Respect constraints** — explicit user restrictions are never overridden.
6. **Never fake success** — if the result can't be verified, report the actual state.

---

## 🔮 Future Roadmap

- [ ] Better visual page understanding
- [ ] Improved element targeting
- [ ] Multi-tab workflows
- [ ] Persistent task memory
- [ ] Voice-controlled browser agent
- [ ] More AI providers
- [ ] Better mobile-agent support
- [ ] More robust recovery strategies
- [ ] Advanced browser state verification
- [ ] Better agent observability
- [ ] More workflow templates

---

## 🤝 Contributing

Contributions are welcome!

```bash
git checkout -b feature/your-feature
# make your changes
npm run dev   # test locally
git add .
git commit -m "Add: your feature"
git push origin feature/your-feature
```

Then open a Pull Request. 🎉

---

## ⭐ Support the Project

If you find this project interesting:

⭐ Star the repo · 🍴 Fork it · 🐛 Open an issue · 💡 Suggest improvements · 🤝 Contribute

---

## 👨‍💻 Creator

Built by **Shivang Sharma**

AI experiments, automation, and agentic systems → [@aiwithshivang](https://github.com/aiwithshivang)

---

<div align="center">

### 🤖 Astra ka Chota Bhai
**See. Think. Act. Verify.**

*What if an AI could actually use the browser instead of just telling you what to click?*

Built for experimentation, learning, and exploring the future of browser agents.

</div>
