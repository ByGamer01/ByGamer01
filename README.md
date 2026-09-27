# David Gil

**Flutter developer who ships mobile apps end to end: client, Firebase backend, monetization and store releases.**

Mobile App Developer at **Grupo Barceló** · Studying Multi-platform Applications Development (DAM) at CIDE · Spain

Three apps live on the App Store under my own developer account, and FitVerso is also on Google Play.

[Portfolio](https://davidgil.netlify.app) · [LinkedIn](https://www.linkedin.com/in/david-gil-40b331387/) · [Email](mailto:davidgilrosa4@gmail.com) · [My apps on the App Store](https://apps.apple.com/developer/david-gil-rosa/id1879471266)

## Shipped apps

<table>
  <tr>
    <td width="84" align="center" valign="top">
      <a href="https://fitverso.app"><img src="assets/fitverso.png" width="64" height="64" alt="FitVerso app icon"></a>
    </td>
    <td valign="top">
      <b><a href="https://fitverso.app">FitVerso</a></b> &nbsp;<sub>Gamified fitness · iOS and Android · built solo</sub><br>
      Workout routes that unlock day by day, XP and levels, streaks, clubs, an AI nutrition chat and a PRO subscription.<br>
      <sub>Flutter · Riverpod · GoRouter · Firebase · Cloud Functions (TypeScript) · Supabase · RevenueCat · HealthKit / Health Connect · WidgetKit and Live Activities</sub><br><br>
      <a href="https://apps.apple.com/app/fitverso/id6759553681"><img src="https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/en-us" height="40" align="absmiddle" alt="Download FitVerso on the App Store"></a>
      <a href="https://play.google.com/store/apps/details?id=com.fitverso.app"><img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" height="60" align="absmiddle" alt="Get FitVerso on Google Play"></a>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top">
      <a href="https://aistarapp.netlify.app"><img src="assets/star-ai.png" width="64" height="64" alt="Star AI app icon"></a>
    </td>
    <td valign="top">
      <b><a href="https://aistarapp.netlify.app">Star AI</a></b> &nbsp;<sub>Gamified multi-model AI chat · iOS</sub><br>
      Free AI chat with an energy economy instead of fixed hourly limits. Switch between Fast, Smart, Code and Vision modes, earn XP and complete daily missions.<br>
      <sub>Flutter · Riverpod · GoRouter · Firebase · Cloud Functions (TypeScript) · AdMob rewarded ads</sub><br><br>
      <a href="https://apps.apple.com/app/star-ai-ai-unlocked/id6774253609"><img src="https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/en-us" height="40" align="absmiddle" alt="Download Star AI on the App Store"></a>
    </td>
  </tr>
  <tr>
    <td align="center" valign="top">
      <a href="https://sushiiapp.netlify.app"><img src="assets/sushii.png" width="64" height="64" alt="Sushii app icon"></a>
    </td>
    <td valign="top">
      <b><a href="https://sushiiapp.netlify.app">Sushii</a></b> &nbsp;<sub>Virtual-pet game · iOS</sub><br>
      Look after Nigi the nigiri, earn coins in a climbing minigame and keep a streak of real sushi dinners, solo or with a partner. No ads, no in-app purchases.<br>
      <sub>Flutter · Firebase (Auth, Firestore, Storage) · Game Center · WidgetKit</sub><br><br>
      <a href="https://apps.apple.com/app/sushii-your-cute-sushi-pet/id6807909139"><img src="https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/en-us" height="40" align="absmiddle" alt="Download Sushii on the App Store"></a>
    </td>
  </tr>
</table>

<sub>App source code is private. I'm happy to walk through it on request.</sub>

### How I build them

- **Server-authoritative economy.** In FitVerso, XP, coins and rewards are granted only by Cloud Functions inside atomic, idempotent transactions. PRO status is synced from a RevenueCat webhook instead of being trusted from the client, and new callables require Firebase App Check.
- **LLMs behind the backend.** LLM calls in FitVerso and Star AI go through Cloud Functions, with multi-model routing and automatic fallback. Model API keys stay server-side and never ship in the app.
- **Automated releases.** FitVerso's GitHub Actions workflows run analysis, tests and custom quality gates (file size, design tokens, callable contracts), build a signed Android App Bundle, upload iOS builds to App Store Connect and deploy Cloud Functions.
- **Tested and bilingual.** FitVerso has 230+ Flutter test files, plus Jest tests for Cloud Functions and for security rules on the Firebase emulator. All three apps are localized in English and Spanish.

## Open source

**[TradeShips.io](https://github.com/ByGamer01/TradeShips.io)**: a browser strategy game about naval trade and warfare. It is a fork of [OpenFront.io](https://github.com/openfrontio/OpenFrontIO) (AGPL-3.0) that I reworked around the sea: submarines, torpedoes, naval mines and aircraft carriers; a trade economy with trade lanes, tariffs and national debt; a World Congress voting mode; and fleet and economic AI for bot nations. My changes add about 20k lines across 285 files, 6.8k of them tests.<br><sub>TypeScript · Pixi.js · WebGL / GLSL · Vitest</sub>

## Experience

- **Mobile App Developer, Grupo Barceló** · Mar 2026 – present<br>Building mobile apps in a professional setting, contributing to product work, ongoing maintenance and development best practices.
- **Higher Technician in Multi-platform Applications Development (DAM), CIDE** · Sep 2025 – present<br>Non-university higher education (EQF level 5, 120 ECTS, 2,000 hours), combined with my own projects.

## Stack

**Mobile** &nbsp; ![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat-square&logo=flutter&logoColor=white) ![Dart](https://img.shields.io/badge/Dart-0175C2?style=flat-square&logo=dart&logoColor=white) ![iOS](https://img.shields.io/badge/iOS-000000?style=flat-square&logo=apple&logoColor=white) ![Android](https://img.shields.io/badge/Android-000000?style=flat-square&logo=android&logoColor=3DDC84)

**Backend** &nbsp; ![Firebase](https://img.shields.io/badge/Firebase-DD2C00?style=flat-square&logo=firebase&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-1C1C1C?style=flat-square&logo=supabase&logoColor=3ECF8E)

**Product & delivery** &nbsp; ![RevenueCat](https://img.shields.io/badge/RevenueCat-F25A5A?style=flat-square&logo=revenuecat&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)

**Also:** Riverpod, GoRouter, Swift (WidgetKit, Live Activities), Next.js, React, Tailwind CSS, Java, Python, SQL.

<br>

<sub>Apple, the Apple logo and App Store are trademarks of Apple Inc. Google Play and the Google Play logo are trademarks of Google LLC.</sub>
