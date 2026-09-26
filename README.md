# 🤖 Astra ka Chota Bhai

> **See. Think. Act. Verify.**

An AI-powered browser agent that can understand tasks, control a real browser, verify its actions, and recover when things go wrong.

**Astra ka Chota Bhai** is an experimental AI browser-agent project built using **Playwright + React + TypeScript + Gemini/OpenRouter**.

Instead of simply telling you what to click, the agent can actually interact with websites.

---

## ✨ What is Astra ka Chota Bhai?

Astra ka Chota Bhai is a browser automation agent designed around a simple loop:

```text
        USER TASK
            │
            ▼
      ┌─────────────┐
      │ AI PLANNER  │
      └──────┬──────┘
             │
             ▼
        TASK STAGES
             │
             ▼
      ┌─────────────┐
      │   OBSERVE   │
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │     ACT     │
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │   VERIFY    │
      └──────┬──────┘
             │
        ┌────┴────┐
        │         │
      SUCCESS   FAILURE
        │         │
        ▼         ▼
    NEXT STAGE  RECOVER
                  │
                  ▼
                RETRY


The key idea:

Don't assume the browser action worked. Verify it.

🚀 Features
🧠 AI Planning

Convert a natural-language task into executable browser stages.

Example:

Go to YouTube, search for CarryMinati,
open the first actual video and play it.

The agent can break this into:

1. Open YouTube
2. Find search box
3. Enter CarryMinati
4. Submit search
5. Verify search results
6. Find first actual video
7. Open video
8. Verify video page
9. Start playback
10. Verify playback
🌐 Real Browser Automation

Powered by Playwright.

The agent can:

Navigate
Click
Type
Select
Scroll
Read page content
Download files
Navigate back/forward
Reload pages
Verify browser state
👀 Observe → Act → Verify

The agent does not blindly execute actions.

After meaningful actions it checks the actual browser state.

Example:

Click Search
      ↓
Observe Page
      ↓
Search Results Visible?
      ↓
YES → Continue
NO  → Recovery
🔄 Self-Healing

Websites change.

Elements move.

Buttons disappear.

Pages load slowly.

Astra ka Chota Bhai attempts recovery instead of immediately failing.

ACTION FAILED
     ↓
CLASSIFY ERROR
     ↓
RE-OBSERVE PAGE
     ↓
RE-LOCATE ELEMENT
     ↓
RETRY
     ↓
VERIFY
🤖 Multiple AI Brains

The agent can use different AI providers.

Currently supported:

Google Gemini
OpenRouter

This keeps the agent architecture independent from a single AI provider.

📱 Mobile Agent Mode

The browser can run using a mobile-sized viewport.

This allows websites to render their actual mobile layout while the browser is displayed inside a phone-style interface.

Perfect for:

Mobile browser testing
Agent demos
Screen recording
Responsive workflow testing
📡 Live Browser Streaming

The Playwright browser session can be streamed into the WebPilot interface.

The frontend can display:

Browser screenshot
Agent cursor
Target highlights
Activity timeline
Agent status
FPS
Stream information
Browser controls
🎯 Agent Radar

The Agent Radar HUD provides runtime information such as:

FPS
Stream
Load
Status

Example:

┌────────────────────┐
│ AGENT RADAR        │
│                    │
│ FPS     14         │
│ STREAM  LIVE       │
│ LOAD    32%        │
│ STATUS  ACTING     │
└────────────────────┘
🛠️ Tech Stack
Technology	Purpose
React	Frontend
TypeScript	Application logic
Vite	Frontend development
Tailwind CSS	UI styling
Node.js	Backend runtime
Playwright	Browser automation
WebSocket	Browser streaming / realtime events
Google Gemini	AI brain
OpenRouter	AI model gateway
📋 Requirements

Before starting, install:

Node.js

Recommended:

Node.js 20+

Check:

node --version

and:

npm --version
📥 Installation

Clone the repository:

git clone YOUR_REPOSITORY_URL

Move into the project:

cd astra-ka-chota-bhai

Install dependencies:

npm install
🎭 Install Playwright Browser

Playwright needs a browser binary.

Run:

npx playwright install chromium

If you are on Linux and Playwright reports missing system dependencies:

npx playwright install --with-deps chromium
🔐 Environment Variables

Create a .env file in the project root.

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
⚠️ IMPORTANT

Never commit your API keys.

Add this to .gitignore:

.env
.env.local
.env.*.local
node_modules/
dist/
🧠 Gemini Setup

Get your Gemini API key from Google AI Studio.

Add it to:

GEMINI_API_KEY=your_key_here

Then configure the model:

GEMINI_MODEL=your_model_here

The exact model available to you may depend on your API access and current Google model availability.

🌐 OpenRouter Setup

Create an OpenRouter API key.

Add:

OPENROUTER_API_KEY=your_key_here

Then configure:

OPENROUTER_MODEL=your_model_here

Example:

OPENROUTER_MODEL=google/gemini-2.5-flash
🧠 Choosing the AI Brain

If the application has a Brain Selector, you can choose between:

Google Gemini
        OR
OpenRouter

Conceptually:

                 ┌──────────────┐
                 │ Astra Agent  │
                 └──────┬───────┘
                        │
                 Brain Selector
                   /          \
                  /            \
             Gemini          OpenRouter
                \              /
                 \            /
                  AI Planner
                      │
                      ▼
                 Browser Agent

The browser execution layer remains the same.

Only the AI provider changes.

▶️ Run the Project

Start the development server:

npm run dev

Vite will normally provide a local URL such as:

http://localhost:5173

Open it in your browser.

🖥️ Development Architecture

The application consists of two major parts:

┌─────────────────────────────────────────┐
│              FRONTEND                   │
│                                         │
│ React + Vite + TypeScript + Tailwind    │
│                                         │
│ Browser UI                              │
│ Activity Timeline                       │
│ Agent Radar                             │
│ Brain Selector                          │
└──────────────────┬──────────────────────┘
                   │
              WebSocket/API
                   │
                   ▼
┌─────────────────────────────────────────┐
│              BACKEND                    │
│                                         │
│ Node.js + Playwright                    │
│                                         │
│ AI Provider Manager                     │
│ Task Planner                            │
│ Action Executor                         │
│ Verification                            │
│ Recovery                                │
└──────────────────┬──────────────────────┘
                   │
                   ▼
            Chromium Browser
                   │
                   ▼
              Real Website
🧩 Agent Architecture

The runtime follows:

User
 │
 ▼
Task
 │
 ▼
Planner
 │
 ▼
Stages
 │
 ▼
Observe
 │
 ▼
Action
 │
 ▼
Playwright
 │
 ▼
Browser
 │
 ▼
Verify
 │
 ├───────────────┐
 │               │
 ▼               ▼
Success        Failure
 │               │
 ▼               ▼
Next Stage    Recovery
                 │
                 ▼
               Retry
📝 Example Task

Try:

Go to YouTube, search for "CarryMinati",
open the first actual video result,
and start playing it.

The agent should preserve the exact search query:

CarryMinati

and execute the task stage-by-stage.

🌐 Example: Website Navigation

A simple task:

Open YouTube.

The agent:

Task
 ↓
Navigate
 ↓
Wait for DOMContentLoaded
 ↓
Observe
 ↓
Verify URL/title/page
 ↓
Complete
🖱️ Example: Click

The agent should not blindly click a random coordinate.

Preferred resolution:

Role + Name
      ↓
Visible Text
      ↓
ARIA Label
      ↓
Title
      ↓
Stable Selector
      ↓
Contextual Element

Then:

Resolve Element
      ↓
Scroll Into View
      ↓
Click
      ↓
Verify Result
⌨️ Example: Form Input

For text fields, the agent should interact with the actual input control.

Preferred strategy:

Find Input
   ↓
Check Editable
   ↓
Fill
   ↓
Read Actual Value
   ↓
Verify

Verification should use the control's actual value rather than searching the entire page text.

🔄 Recovery System

Common errors are classified before recovery.

Examples:

ELEMENT_NOT_FOUND
ELEMENT_NOT_VISIBLE
STALE_ELEMENT
TIMEOUT
NAVIGATION_CHANGED
OVERLAY_BLOCKED
CLICK_FAILED
INPUT_FAILED
SCROLL_FAILED
DOWNLOAD_FAILED
NAVIGATION_NETWORK_ERROR
OPENROUTER_ERROR
UNKNOWN

Example recovery:

ELEMENT_NOT_FOUND
       ↓
Fresh DOM observation
       ↓
Re-locate element
       ↓
Scroll into view
       ↓
Retry
🛑 Safety & User Constraints

The agent should always respect explicit user constraints.

For example:

Fill all questions.
Do NOT click Submit.

The agent must never click Submit.

User constraints take priority over autonomous decisions.

🚫 What This Project Does NOT Do

This project is not designed to:

Bypass CAPTCHAs
Bypass authentication
Bypass security challenges
Circumvent anti-bot protections
Bypass paywalls
Steal credentials
Perform unauthorized actions
Automatically make purchases without user control

If a website presents a CAPTCHA or security challenge, the agent should stop rather than attempting to bypass it.

📱 Mobile Mode

Switch the agent to:

Mobile Mode

The browser uses a mobile-style viewport.

The frontend displays the browser inside a phone-style frame.

Example:

Laptop Screen

┌───────────────────────────────────┐
│                                   │
│          ┌─────────────┐          │
│          │             │          │
│          │   Browser   │          │
│          │             │          │
│          │   Website   │          │
│          │             │          │
│          └─────────────┘          │
│                                   │
└───────────────────────────────────┘

This is especially useful for screen recording and demos.

🎥 Record Mode

Record Mode is designed for creating clean agent demonstrations.

It can:

Maximize browser presentation
Hide unnecessary UI
Center the mobile browser
Keep the browser readable
Preserve the Agent Radar
Preserve the agent cursor
Maintain the same browser session

Press:

ESC

to exit fullscreen/focus presentation mode.

📂 Project Structure

Your exact structure may vary, but conceptually:

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
🧪 Development Workflow

Recommended development flow:

1. Start project
       ↓
2. Start backend
       ↓
3. Open WebPilot
       ↓
4. Select AI Brain
       ↓
5. Enter task
       ↓
6. Start Agent
       ↓
7. Observe Activity Timeline
       ↓
8. Watch browser execution
       ↓
9. Verify final result
🐛 Troubleshooting
npm run dev fails

Try:

rm -rf node_modules
npm install

Then:

npm run dev

On Windows PowerShell:

Remove-Item -Recurse -Force node_modules
npm install
npm run dev
Playwright browser not found

Run:

npx playwright install chromium

Linux:

npx playwright install --with-deps chromium
OpenRouter returns 402

This generally means the request requires more credits than the API key currently allows.

Check:

OPENROUTER_API_KEY=
OPENROUTER_MODEL=

Also make sure your application isn't requesting an unnecessarily huge output limit.

For example, avoid:

max_tokens = 65536

for normal planning requests.

Use a reasonable output limit appropriate to the task.

OpenRouter returns 401

Check that:

OPENROUTER_API_KEY=...

is correct.

Restart the development server after changing .env.

Gemini API key error

Check:

GEMINI_API_KEY=...

Make sure the key is available to the backend and is not exposed through a frontend VITE_ variable.

Restart the server after modifying .env.

Browser navigation fails

Check:

Internet connection
Target website availability
Playwright Chromium installation
Proxy configuration
Browser launch configuration
Navigation timeout

The agent should classify navigation failures rather than pretending the page loaded.

ERR_HTTP2_PROTOCOL_ERROR

If a website works in normal Chrome but fails in Playwright:

Check:

- Chromium version
- Playwright version
- Proxy configuration
- Custom browser arguments
- Custom headers
- VPN/network configuration

Do not attempt to bypass website security.

🔒 Security

Never commit secrets.

Your .gitignore should include:

.env
.env.local
.env.*.local
node_modules/
dist/
*.log

Never put API keys directly inside:

React components
Frontend code
Vite client code
GitHub repository
Public configuration

AI provider keys should remain server-side.

💡 Improving the Agent

When adding new capabilities, prefer the generic agent architecture instead of creating a hardcoded script for every website.

For example, instead of:

if website == youtube:
    click("#some-button")

prefer:

Task
 ↓
Observe
 ↓
Understand
 ↓
Resolve Target
 ↓
Execute
 ↓
Verify
 ↓
Recover if necessary

This makes the system reusable across websites.

🧠 Core Principles
1. Observe before acting

Never assume the page is in the expected state.

2. Verify after acting

An action is not successful just because Playwright didn't throw an error.

3. Use fresh DOM state

After navigation or major page changes, re-observe the page.

4. Recover locally

If one action fails, recover the current stage instead of restarting the entire task.

5. Respect constraints

Explicit user restrictions must never be ignored.

6. Never fake success

If the agent cannot verify the result, report the actual state.

🔮 Future Roadmap

Potential future improvements:

 Better visual page understanding
 Improved element targeting
 Multi-tab workflows
 Persistent task memory
 Voice-controlled browser agent
 More AI providers
 Better mobile-agent support
 More robust recovery strategies
 Advanced browser state verification
 Better agent observability
 More workflow templates
🤝 Contributing

Contributions are welcome.

A simple workflow:

git checkout -b feature/your-feature

Make your changes.

Test locally:

npm run dev

Then:

git add .
git commit -m "Add: your feature"
git push origin feature/your-feature

Open a Pull Request.

⭐ Support the Project

If you find the project interesting:

⭐ Star the repository

🍴 Fork it

🐛 Open an issue

💡 Suggest improvements

🤝 Contribute

👨‍💻 Creator

Built by Shivang Sharma

AI experiments, automation and agentic systems:

@aiwithshivang

🤖 Astra ka Chota Bhai
See. Think. Act. Verify.

What if an AI could actually use the browser instead of just telling you what to click?

Built for experimentation, learning and exploring the future of browser agents.


### GitHub repo ka top section bhi ye rakhna

**Name:**
`astra-ka-chota-bhai`

**Description:**
> 🤖 An AI-powered browser agent that can see, think, act, and verify tasks on real websites using Playwright + Gemini/OpenRouter.

**Topics:**
```text
ai
ai-agent
browser-agent
browser-automation
playwright
gemini
openrouter
agentic-ai
automation
react
typescript
vite
web-automation
llm
