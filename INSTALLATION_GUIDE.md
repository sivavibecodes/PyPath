# PyPath — Complete Installation & Emulator Testing Guide

This guide walks you step-by-step through installing, preparing, and running **PyPath** on:
1. **Your Physical Mobile Device (iOS / Android)** using the free **Expo Go** app *(Easiest & quickest — no emulators required)*
2. **Android Emulator** via **Android Studio** (Windows, macOS, Linux)
3. **iOS Simulator** via **Xcode** (macOS only)
4. **Standalone Android APK Installation** (Installing a standalone `.apk` directly onto any Android phone)

---

## 1. Prerequisites

Before starting, ensure your computer has the following tools installed:

### A. Node.js & npm
- Download and install **Node.js (LTS v18 or v20+)** from [nodejs.org](https://nodejs.org/).
- Ensure `node` and `npm` are added to your system `PATH`.
- Verify in your terminal (PowerShell, Command Prompt, or Bash):
  ```bash
  node -v
  npm -v
  ```

### B. Git (Optional, for version control)
- Download from [git-scm.com](https://git-scm.com/).

---

## 2. Project Installation & Asset Preparation

Open your terminal, navigate to the PyPath project directory, and run the setup scripts:

```bash
# 1. Navigate to the project directory
cd "c:\Users\HAMZA\Documents\Gemini Projects\PyPath"

# 2. Install dependencies
npm install

# 3. Generate offline assets (CodeMirror bundle, audio chimes, Pyodide Wasm)
npm run prepare:assets
```

### What `npm run prepare:assets` does:
- `assets:editor`: Runs `esbuild` to compile and minify the touch-optimized CodeMirror 6 Python editor into an offline inlined bundle.
- `assets:sounds`: Synthesizes 16-bit PCM WAV feedback chimes for test successes, partial runs, and level-ups.
- `assets:pyodide`: Downloads and vendors the Pyodide WebAssembly CPython runtime along with pre-compiled wheels for **NumPy**, **Pandas**, and **BeautifulSoup4** into `assets/pyodide/`. *(Note: If you are offline during installation, PyPath automatically defaults to CDN fallback mode when you later connect to the internet).*

---

## 3. Option A: Run on a Physical Phone via Expo Go (Fastest)

You can run the app directly on your personal iPhone or Android device in 2 minutes without setting up heavy emulators.

### Step 1: Install Expo Go on your phone
- **Android**: Install [Expo Go from Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent).
- **iOS**: Install [Expo Go from the App Store](https://apps.apple.com/app/expo-go/id982107779).

### Step 2: Start the Metro Bundler
In your computer terminal, run:
```bash
npx expo start
```
*(Tip: If your computer and phone are on different Wi-Fi networks or guest Wi-Fi, run `npx expo start --tunnel` instead).*

### Step 3: Open the App
- **Android**: Open the **Expo Go** app and tap **"Scan QR code"**. Point your phone camera at the QR code displayed in your computer terminal.
- **iOS**: Open your phone's native **Camera** app, scan the QR code displayed in the terminal, and tap the notification banner that says **"Open in Expo Go"**.

The JavaScript bundle will stream to your phone, and PyPath will boot immediately!

---

## 4. Option B: Run in an Android Emulator (Windows / macOS / Linux)

### Step 1: Install Android Studio
1. Download and install **Android Studio** from [developer.android.com/studio](https://developer.android.com/studio).
2. During setup, make sure to check:
   - **Android SDK**
   - **Android SDK Platform-Tools**
   - **Android Virtual Device (AVD)**

### Step 2: Set Android Environment Variables (Windows)
Add the following to your User or System Environment Variables:
- `ANDROID_HOME`: `C:\Users\<Your-Username>\AppData\Local\Android\Sdk`
- Add to `PATH`:
  - `%ANDROID_HOME%\platform-tools`
  - `%ANDROID_HOME%\emulator`

### Step 3: Create a Virtual Device (AVD)
1. In Android Studio, click **Virtual Device Manager** (or **Tools -> Device Manager**).
2. Click **Create Device**.
3. Choose a device definition (e.g. **Pixel 8** or **Pixel 7**).
4. Select a system image: **API 34** or **API 35** (UpsideDownCake / VanillaIceCream with Google APIs).
5. Click **Finish**.
6. Click the **▶ (Play)** button next to the device to launch the emulator.

### Step 4: Launch PyPath on the Emulator
With the emulator running on your screen, run:
```bash
npm run android
```
Or start with `npx expo start` and press the **`a`** key in your terminal. Expo will automatically detect the running emulator, install Expo Go or the dev client, and open PyPath.

---

## 5. Option C: Run in an iOS Simulator (macOS only)

### Step 1: Install Xcode
1. Open the Mac App Store and install **Xcode**.
2. Open Xcode, navigate to **Settings -> Platforms**, and install the latest **iOS Simulator runtime** (e.g. iOS 17 or 18).
3. Open your terminal and install Xcode command-line tools:
   ```bash
   xcode-select --install
   ```

### Step 2: Launch PyPath
In your terminal:
```bash
npm run ios
```
Or start with `npx expo start` and press the **`i`** key. Expo will boot your iOS Simulator and launch PyPath automatically.

---

## 6. Option D: Build and Install a Standalone Android APK

If you want an installable `.apk` file that runs natively on any Android device without needing a development server or computer running:

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Login to Expo
```bash
eas login
```
*(If you don't have an Expo account, create one for free at [expo.dev](https://expo.dev/signup)).*

### Step 3: Trigger the Cloud APK Build
Run:
```bash
eas build -p android --profile preview
```
- EAS will build the `.apk` in the cloud using the pre-configured [`eas.json`](file:///c:/Users/HAMZA/Documents/Gemini%20Projects/PyPath/eas.json).
- When the build finishes (typically ~5-10 minutes), terminal will provide a download link and a QR code.
- Download the `.apk` file to your phone, tap it to install, and enjoy PyPath as a standalone native app!

---

## 7. Connecting Cloud Sync (Supabase - Optional)

PyPath is 100% functional offline out of the box using local MMKV storage. If you want to connect cloud synchronization, user authentication, and global leaderboards:

1. Create a free account and new project at [supabase.com](https://supabase.com).
2. Open your Supabase project dashboard and go to **SQL Editor**.
3. Copy the contents of [`supabase/schema.sql`](file:///c:/Users/HAMZA/Documents/Gemini%20Projects/PyPath/supabase/schema.sql) and click **Run**. This creates:
   - User profiles with XP and streak fields
   - Challenge and quiz submission tracking
   - Row Level Security (RLS) policies
   - Atomic XP increment RPC function
4. Open [`app.json`](file:///c:/Users/HAMZA/Documents/Gemini%20Projects/PyPath/app.json) and fill in your Supabase credentials:
   ```json
   "extra": {
     "supabaseUrl": "https://your-project-id.supabase.co",
     "supabaseAnonKey": "your-anon-public-key"
   }
   ```
5. Any progress made offline will automatically queue in the local outbox and synchronize to your Supabase Postgres database as soon as an internet connection is established!

---

## 8. Troubleshooting & Common Issues

### 1. `node : The term 'node' is not recognized`
- **Cause**: Node.js is either not installed or not in your current shell's PATH.
- **Fix**: Install Node.js from [nodejs.org](https://nodejs.org/). Make sure to restart your terminal window or VS Code after installing.

### 2. Pyodide Wheel Loading / Offline Assets
- **Symptom**: Console warns that Pyodide is running from CDN.
- **Explanation**: If `npm run assets:pyodide` was skipped or interrupted, PyPath automatically switches to online CDN streaming so you can still run Python without crashing.
- **Fix**: Connect to the internet and run `npm run assets:pyodide` once to vendor the full runtime offline (~12 MB).

### 3. Clear Metro Cache
If you encounter caching errors after making code edits:
```bash
npx expo start -c
```

### 4. Reset Local Python Engine Runtime
If a script ever corrupts the virtual filesystem:
- Go to the **Analytics / Profile** tab inside the app.
- Scroll down to **Engine Controls**.
- Tap **"Reset Offline Pyodide Runtime Cache"**.
