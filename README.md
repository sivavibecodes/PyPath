# PyPath 🐍📱

> **Production-Ready, Offline-First Mobile Python Learning App for iOS & Android**  
> *Built with React Native, Expo SDK 52, TypeScript, Zustand, MMKV, CodeMirror 6, and Pyodide WebAssembly.*

---

## Key Highlights

- **Embedded On-Device Python Runtime**: Runs real CPython directly on-device using a sandboxed WebAssembly runtime (Pyodide) inside a headless WebView bridge. Zero external backend required for basic code execution. Instant feedback, 100% offline.
- **The 4-Card Micro-Learning Loop**:
  1. **Explain**: Bite-sized concept breakdown with collapsible real-world ROI callout and flow diagrams.
  2. **Demonstrate**: Interactive code walkthrough with line-by-line explanations and an inline "Run" button.
  3. **Practice**: Live coding challenge in the split-screen Code Lab with test case assertions and stdout diffs.
  4. **Reinforce**: Instant retrieval practice quiz (multiple-choice, predict output, fill-in-the-blanks).
- **Curriculum Architecture**:
  - **Core Certification Track**: 4 Progression Tiers aligned with official Python Institute standards (**PCEP-30-02**, **PCAP-31-03**, **PCPP1**).
  - **4 Applied Industry Tracks**:
    1. **Marketing & Growth**: UTM bulk auto-tagging, competitor ad scrapers, Google Analytics CSV parsing, sentiment analysis.
    2. **Finance & Accounting**: Multi-sheet Excel reconciliation with Pandas, automated invoice generation, FX currency conversion, DuPont ratio analysis.
    3. **Product & Operations**: Jira/Slack webhook incident dispatchers, cohort retention matrices, SLA compliance monitoring, Monte Carlo sprint velocity forecasting.
    4. **Data Analysts & Scientists**: Vectorized data cleaning, IQR/Z-score outlier detection, bivariate linear regression, A/B test significance testing, RFM segmentation.
- **Touch-Optimized Mobile Code Editor**: Custom CodeMirror 6 engine inlined offline with a mobile accessory bar (`⇥`, `⇤`, `( )`, `[ ]`, `{ }`, `" "`, `:`, `_`, `=`, `print`, `var`, `def`, `for`, `if`, undo/redo).
- **Humanized Error Messages**: Intercepts raw Python tracebacks (`IndexError`, `SyntaxError`, `KeyError`, `AttributeError`) and translates them into beginner-friendly explanations with actionable advice.
- **Gamified Progress & Mistake Analytics**: Dual XP reward curves, day streaks with freeze protection, concept mastery tracking, and offline MMKV storage with Supabase cloud sync outbox.
- **Certification Readiness Hub**: Official mock exam simulator with countdown timer, question navigator, and objective-by-objective readiness scoring.
- **Offline Cheat Sheet Dictionary**: Searchable W3Schools-style syntax quick-reference sheet with runnable examples.

---

## Installation & Running the App

For a step-by-step walkthrough on testing on physical devices, Android Studio emulators, iOS simulators, or exporting a standalone APK, see the **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)**.

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Prepare offline assets (CodeMirror 6, audio chimes, Pyodide Wasm)
npm run prepare:assets

# 3. Start Expo development server
npm start
```
- Press **`a`** to launch in an Android Emulator.
- Press **`i`** to launch in an iOS Simulator.
- Or scan the terminal QR code using **Expo Go** on your physical phone!

---

## Documentation
For deep-dive architectural specifications, refer to [ARCHITECTURE.md](docs/ARCHITECTURE.md):
- High-level system architecture and diagram
- Complete repository directory tree
- The on-device Python execution bridge design & watchdogs
- Offline-first state persistence & sync outbox protocol
- Humanized error messages and AST stack introspection
