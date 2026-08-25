# 3D Websites & 3D Online Stores — Open-Source Landscape
## Research brief for offering 3D web development as a Qimmah Digital service

**Prepared for:** Sultan, Founder — Qimmah Digital (قمة ديجيتال), Oman
**Task ref:** `research / "3D websites and 3D online stores — open-source landscape" / High`
**Date:** August 2026

---

## 1. Executive Summary

- **The stack is settled: Three.js + React Three Fiber (R3F) + drei is the mainstream choice** for an agency already on Vite + React. Three.js has ~114.8k GitHub stars and ~5–10M weekly npm downloads; R3F adds ~31.8k stars and ~3.5M weekly downloads. All MIT-licensed, free for commercial client work.
- **The fastest, cheapest 3D offer is not a full 3D website — it is a 3D product viewer** embedded in an existing store using Google's `<model-viewer>` web component (8.2k stars, Apache-2.0, works with any site including Shopify/WordPress). This is Qimmah's quick-win product.
- **The business case is proven:** interactive 3D lifts conversion 25–40% on average (up to 200% in some Shopify deployments), cuts returns 30–40% (Shopify data), and AR furniture viewers convert 3–4x baseline. 60%+ of shoppers say they are more likely to buy when a product is shown in 3D/AR.
- **The OSS "full 3D store" landscape is thin.** There is no mature open-source 3D e-commerce platform; the best repos are configurators and demos (see §3). This is a market gap — agencies that productize this win. Full walk-in "metaverse shops" mostly failed commercially; product viewers, configurators and 360° tours are what actually sell.
- **Performance discipline is non-negotiable in the GCC:** Oman is ~78% mobile internet usage and ~98% internet penetration, so every 3D deliverable must hit 60fps on a mid-range Android over 4G. Rules: glTF + Draco/meshopt compression, KTX2 textures, product models ≤1–2 MB, hero scenes ≤800 KB, lazy-load everything below the fold.
- **Pricing precedent:** basic 3D product configurator packages sell at $2,250–$4,500; premium $4,500–$9,750; custom builds $15k–$50k. A simple `<model-viewer>` embed can be productized at OMR 150–400 per product page as an entry offer.
- **Spline is the design-side shortcut** (browser 3D editor, free tier with watermark; $12–15/user/mo removes watermark) — good for hero animations and prototypes, not open-source and per-seat pricing hurts agency economics at scale.

---

## 2. Core Open-Source Tech Stack

| Tool | What it is | Best for | License | GitHub stars (Aug 2026) | npm weekly downloads | Learning curve |
|---|---|---|---|---|---|---|
| **Three.js** ([mrdoob/three.js](https://github.com/mrdoob/three.js)) | The foundational WebGL/WebGPU 3D library | Anything 3D in the browser; maximum control | MIT | ~114,800 | ~5–10M | Medium-high (scenes, cameras, materials, render loops) |
| **React Three Fiber** ([pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber)) | React renderer for Three.js | React codebases (Qimmah's Vite+React stack); reusable 3D components | MIT | ~31,800 | ~3.5M | Low-medium if you know React |
| **drei** ([pmndrs/drei](https://github.com/pmndrs/drei)) | Helper library for R3F (controls, loaders, staging, text) | Cuts R3F boilerplate by ~70% | MIT | ~9,800 | ~2.7M | Low |
| **Babylon.js** ([BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js)) | Full 3D *engine* (physics, audio, XR built-in), Microsoft-backed | Games, simulations, complex XR; teams wanting an opinionated engine | Apache-2.0 | ~26,000 | Low (ecosystem split across packages) | Medium (guided but heavy, ~1.4 MB bundle) |
| **`<model-viewer>`** ([google/model-viewer](https://github.com/google/model-viewer)) | Google web component: drop-in interactive 3D + AR viewer | Product viewers on any site/store with 2 lines of HTML | Apache-2.0 | ~8,200 | n/a (web component) | Very low |
| **PlayCanvas** ([playcanvas/engine](https://github.com/playcanvas/engine)) | Open-source engine + optional cloud editor, Snap-owned | Team-edited scenes, games, Gaussian splats | MIT | ~16,600 | Low | Medium (cloud IDE lowers the bar) |
| **A-Frame** ([aframevr/aframe](https://github.com/aframevr/aframe)) | HTML-like VR framework on top of Three.js | Quick WebXR/VR scenes, 360° spaces | MIT | ~17,600 | n/a | Very low (declarative HTML) |
| **Spline** ([spline.design](https://spline.design)) | Browser-based 3D *design tool* (closed-source SaaS); exports/embeds to web, React, Webflow | Hero animations, product mockups, fast prototypes without 3D skills | Proprietary (free tier) | n/a | n/a | Very low (Figma-like) |

**Spline free vs paid (as of 2026):** Free = limited files, web exports carry a Spline watermark (a hard blocker for client work). Starter ~$12–15/user/mo removes watermark + unlimited files. Professional ~$20–25/user/mo adds code exports, mobile exports, version history. Team ~$36/seat/mo. AI features are a paid add-on (~$5/seat/mo). **Agency note:** per-seat pricing gets expensive across clients; use Spline for pitching/prototyping, but deliver production in R3F where you own the code. The `@splinetool/runtime` / `@splinetool/react-spline` embed libraries are free to use; the paid part is the editor.

**Selection guidance for Qimmah:**
- Default production stack: **Vite + React + R3F + drei** (matches existing stack, biggest talent pool, MIT).
- **`<model-viewer>` for the entry-level offer** — it even gives free AR ("view in your space") on iOS/Android out of the box.
- Babylon.js only if a client specifically needs a game-like simulation with built-in physics/XR.
- A-Frame for cheap 360°/VR showrooms; PlayCanvas if a client wants to edit scenes themselves in a visual editor.

---

## 3. 3D E-Commerce: Open-Source Landscape

**Headline finding:** there is no WordPress-equivalent open-source "3D store" platform. The ecosystem is (a) viewer/configurator building blocks, (b) small demo stores, (c) commercial SaaS (Threekit, Zakeke, Expivi, VividWorks, Roomle) that charge $199–$2,000+/mo. The gap between (b) and (c) is exactly where an agency sells.

### 3.1 Building blocks (high-star, production-grade)

| Repo | Stars | What it gives you |
|---|---|---|
| [google/model-viewer](https://github.com/google/model-viewer) | 8.2k | `<model-viewer src="product.glb" ar camera-controls>` — interactive 3D + AR in one tag; works in Shopify, WooCommerce, any HTML page |
| [donmccurdy/three-gltf-viewer](https://github.com/donmccurdy/three-gltf-viewer) | 2.5k | Drag-and-drop glTF QA viewer — use internally to check client models |
| [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | 2.0k | CLI/SDK to optimize, compress, resize textures on glTF models |
| [zeux/meshoptimizer](https://github.com/zeux/meshoptimizer) | 8.3k | `gltfpack` CLI — Draco/meshopt compression + KTX2 texture pipeline in one command |
| [google/draco](https://github.com/google/draco) | 7.5k | Mesh compression (built into gltfpack/Three.js DRACOLoader) |

### 3.2 Configurators & store demos (fork/adapt)

| Repo | Stars | Stack | Use |
|---|---|---|---|
| [CodeHole7/threejs-3d-room-designer](https://github.com/CodeHole7/threejs-3d-room-designer) | 460 | React + Three.js | 3D room planner + product configurator — closest thing to a real-estate/furniture showroom starter |
| [Dygmalab/Bazecor](https://github.com/Dygmalab/Bazecor) | 493 | TypeScript | Production keyboard configurator (proof configurators ship as OSS) |
| [iosorin/cup-demo](https://github.com/iosorin/cup-demo) | 87 | Nuxt + Three.js + Fabric.js | Classic "customize a mug" product configurator demo |
| [afilahkle/3D-Clothing-Configurator](https://github.com/afilahkle/3D-Clothing-Configurator) | 83 | **Vite + React + R3F** | Clothing configurator (colors, logos, resize) — directly on Qimmah's stack |
| [HTTP3D/WalkTheWeb](https://github.com/HTTP3D/WalkTheWeb) | 50 | Babylon.js + PHP + WooCommerce | Self-hosted multiplayer 3D shopping/CMS — the only "3D store platform" attempt with traction |
| [VinayMatta63/Virtual-Shop](https://github.com/VinayMatta63/Virtual-Shop) | 5 | R3F + Firebase | Walk-through 3D store demo |
| [wistant/suburbia](https://github.com/wistant/suburbia) and [fizzi](https://github.com/sheyda0/fizzi-3d-ecommerce-landing)-style clones | 1–2 | Next.js + R3F + GSAP + Prismic | Recreations of Prismic's Suburbia skateboard-shop and Fizzi soda-shop course projects — polished 3D e-commerce landing patterns worth studying |

**Reality check:** most "metaverse shop" repos are abandoned hackathon projects with <20 stars. Do not sell walk-in virtual malls to Omani SMEs; sell product viewers, configurators and 360° tours that measurably convert.

### 3.3 How agencies price/deliver these (market benchmarks)

- **SaaS configurators:** $199–$2,000/mo (Zakeke, Expivi) + per-SKU modeling fees; enterprise (Threekit, VividWorks, Hive CPQ) $20k–$100k+/yr.
- **Agency packages (published example, Techversol):** Starter configurator $2,250 (client's model) / $3,000 (agency models it), 2–3 weeks; Premium $4,500–$9,750, 6–8 weeks; Custom from $12,000.
- **Custom builds:** $15k–$50k+ upfront; maintenance 10–20%/yr.
- **OSS self-host cost model:** ~40 dev-days + ~$100–$500 per 3D model (simple products) up to $2k–$10k for complex machinery; hosting negligible on Vercel.
- **3D model creation is the real cost driver** — budget it per SKU, reuse forever, and make clear in contracts that the client owns the models.

---

## 4. Showcase: Award-Winning 3D Sites & Their Stacks

| Site | Award | Stack | Lesson for Qimmah |
|---|---|---|---|
| **Bruno Simon Portfolio** ([bruno-simon.com](https://bruno-simon.com)) | Awwwards Site of the Year 2019; Site of the Month Jan 2026 (rebuild) | Three.js (new version: TSL/WebGPU), Blender authoring, Draco + ETC1S/UASTC compression, custom physics | One bold interaction mechanic beats ten pages; code is open-source — study it |
| **Star Atlas** | Awwwards Site of the Year 2021 | Three.js + WebGL (game site) | Full-3D can win the top award when the concept is coherent |
| **Hatom** (hatom.com, by Immersive Garden) | Awwwards SOTD + Developer Award, Nov 2024 | Three.js + Vue/Nuxt + GSAP + Lenis, progressive preloader | Scroll-driven 3D storytelling with staged asset loading — the "cinematic landing" pattern clients love |
| **Iventions** (SERIOUS.BUSINESS) | CSSDA Website of the Month + Awwwards SOTD & Developer | Next.js + headless WordPress + Three.js + GSAP | 3D can coexist with a client-editable CMS — key for SME handover |
| **UNESCO Virtual Museum of Stolen Cultural Objects** (makemepulse) | Awwwards case study 2026 | Nuxt + TypeScript + Tailwind, custom NanoGL engine, WebXR, AI-assisted 3D reconstruction | LOD streaming: distant geometry unloads; AI + manual retopo pipeline for artifacts |
| **DeepSee Commerce** (hontran.dev) | Awwwards Honorable Mention | Three.js scroll-descent scene, capped DPR, compressed assets, render-only-when-visible | A 3D **e-commerce** site that stays fast on mid-range Android — the exact GCC constraint |
| **Scout Motors** | Awwwards E-commerce Site of the Year | Product configurator + brand storytelling in one scroll journey | Configuration, heritage story and checkout unified — the premium automotive/real-estate template |
| **Lando Norris** (OFF+BRAND) / **Messenger** / **Igloo Inc** | Awwwards Site of the Year 2025 | Cinematic scroll narrative / real-time WebGL planet / immersive navigation | Personal-brand and business sites can both reach award level with WebGL |

Browse [awwwards.com/websites/three-js](https://www.awwwards.com/websites/three-js/) for the continuously updated gallery. Common denominator: **Three.js/R3F + GSAP (or Lenis) scroll choreography + aggressive asset budgets.**

---

## 5. Ready Templates & Starters (adaptable for Omani SME clients)

| Template | Stars | Stack | Client fit |
|---|---|---|---|
| [pmndrs/react-three-next](https://github.com/pmndrs/react-three-next) | 2.9k | R3F + Next.js + Tailwind | Official Poimandres starter — base for any 3D client site |
| [Andrew-Tsegaye/Stunning_3D_Portfolio_Website](https://github.com/Andrew-Tsegaye/Stunning_3D_Portfolio_Website) | 35 | **Vite + R3F + Tailwind + Framer Motion** | Matches Qimmah stack exactly — freelancer/small-business sites |
| [AirHua-byte.github.io](https://github.com/AirHua-byte/AirHua-byte.github.io) | 37 | Three.js, GitHub Pages | Interactive 3D portfolio template |
| [Devang47/ThreeJS-Portfolio-template](https://github.com/Devang47/ThreeJS-Portfolio-template) / [ALI-QADIR/3dPortfolioTemplate](https://github.com/ALI-QADIR/3dPortfolioTemplate) | 17 / 15 | Three.js | Simple single-page 3D sites |
| [CodeHole7/threejs-3d-room-designer](https://github.com/CodeHole7/threejs-3d-room-designer) | 460 | React + Three.js | **Real estate / furniture showrooms** |
| [afilahkle/3D-Clothing-Configurator](https://github.com/afilahkle/3D-Clothing-Configurator) | 83 | Vite + R3F | **Fashion/apparel SMEs** (Oman's biggest e-commerce category, 28% share) |
| Prismic "Suburbia" & "Fizzi" course projects ([wistant/suburbia](https://github.com/wistant/suburbia)) | ~2 | Next.js + R3F + GSAP + Prismic | **Product-launch landing pages** (soda brand, skateboard shop) — the pattern to copy for a burger-restaurant hero |
| **Spline template library** ([spline.design](https://spline.design)) | n/a | Spline editor | Clone-and-edit 3D scenes for pitches; remember watermark on free tier |
| **360° tours:** [mpetroff/pannellum](https://github.com/mpetroff/pannellum) (4.9k), [google/marzipano](https://github.com/google/marzipano) (2.3k, archived but stable), Photo Sphere Viewer (~890) | — | Plain JS, embed anywhere | **Restaurants, cafés, real-estate walkthroughs** — shoot 360° photos of the venue, embed a tour; cheapest "3D" offer of all |

**Suggested Qimmah internal starters to build once and reuse:** (1) `qimmah-3d-product-viewer` (model-viewer wrapper), (2) `qimmah-3d-hero` (R3F scroll hero à la Fizzi/Suburbia), (3) `qimmah-360-tour` (Pannellum wrapper). Each new client = re-skin, not rebuild.

---

## 6. Practical Guidance (mobile-first, GCC)

### 6.1 Performance budget (Oman: ~78% of internet use is mobile, ~98% penetration, 4G/5G dominant)

| Budget item | Target |
|---|---|
| 3D model (single product) | ≤ 1–2 MB optimized (raw exports are typically 8–15 MB) |
| Hero scene total assets | ≤ 800 KB |
| First paint | ≤ 1.5s on 4G — lazy-load 3D below the fold via IntersectionObserver |
| Frame rate | 60fps on a mid-range Android; cap device-pixel-ratio (DPR ≤ 2) |
| Lighthouse mobile | ≥ 85 |
| JS bundle (Three.js core) | ~168 kB gzipped — fine; Babylon (~1.4 MB) needs justification |

### 6.2 The compression pipeline (memorize this)

1. Model in Blender (free) → export **glTF/GLB** (the only web format that matters; USDZ export for Apple AR via model-viewer).
2. Run `gltfpack -i in.glb -o out.glb -cc -tc` ([meshoptimizer](https://github.com/zeux/meshoptimizer)): Draco/meshopt mesh compression + KTX2/Basis texture compression (3–5x smaller than JPG/PNG) + decimation. Typical result: **50–90% size reduction**.
3. Inspect in [gltf.report](https://gltf.report) or three-gltf-viewer before delivery.
4. Serve via Vercel CDN with immutable caching; lazy-load; show poster image while loading.

### 6.3 When 3D helps vs hurts conversion

**Helps (measured):** 25–40% average conversion lift from interactive 3D; AR furniture 3–4x; returns down 30–40%; dwell time up ~20% (HBR); Motorola LatAm +47–53%; EQ3 +36% conversion and +88% AOV; Shopify merchants up to +200% on 3D/AR listings.
**Hurts / overkill:** simple low-consideration products (a plain burger menu item needs a good photo, not a 3D model); slow-loading 3D (every +100ms latency ≈ −8% conversion); information-dense pages where 3D buries the content; users on old devices with no fallback. **Rule: 3D must answer a buying question** (size, finish, configuration, space) — decoration alone rarely pays.

### 6.4 SEO

- WebGL canvas content is **invisible to crawlers** — keep all copy, prices, product names, and CTAs in real HTML. 3D is the garnish, HTML is the meal.
- Google renders JS but in a delayed "second wave"; social crawlers (WhatsApp/Instagram link previews — huge in Oman) don't render JS at all. With Vite SPA: **prerender key routes** (e.g., vite-plugin-prerender or a Puppeteer build script) so meta/OG/JSON-LD are in static HTML.
- Vercel preview deployments are auto-`noindex` (safe for client demos on `.vercel.app` URLs).
- Use `Product` schema JSON-LD; page speed (Core Web Vitals) is a ranking factor — another reason for the budgets above.
- For bilingual EN/AR: SSR/prerender both locales, `hreflang` tags, and ensure 3D UI text supports RTL.

### 6.5 Hosting on Vercel

Vite + React + R3F deploys cleanly; static assets (GLB/KTX2) go in `/public` with long cache headers. Bandwidth: watch GLB sizes on the free/hobby tier — another reason to compress hard. No server needed unless adding custom configurator backends (then Vercel serverless functions suffice).

---

## 7. Business Angle

### 7.1 What to charge (Omani SME calibration)

| Offer | Scope | Suggested price | Benchmark |
|---|---|---|---|
| **Quick win: 3D product viewer** | `<model-viewer>` embed + model optimization on existing store, per product | OMR 100–400/product (or OMR 500–900 for a 5-product bundle) | SaaS tools alone cost clients $199+/mo — one-time pricing undercuts them |
| **360° virtual tour** | Pannellum tour of venue (restaurant/showroom) + embed | OMR 300–800 + photography | Cheapest "wow" deliverable |
| **3D configurator** | R3F color/material configurator on Vite+React | OMR 900–2,500 | Market: $2,250–$9,750 |
| **3D landing page / product launch** | Scroll-driven R3F hero (Fizzi/Suburbia pattern) | OMR 700–2,000 | — |
| **Full 3D store experience** | Multi-scene R3F shopfront + CMS | OMR 3,000–6,000+ | Custom builds run $15k+ in US/EU |
| **Model creation add-on** | Blender modeling + optimization per SKU | OMR 40–150/simple product | Market: $100–$500 |

Always price 3D model creation separately, state that the client owns the models, and add a maintenance plan (10–20%/yr).

### 7.2 How to demo to clients

1. **Lead with their own product:** take one photo/item from the prospect's menu or catalog, model it (or generate via AI tools like Meshy/Tripo, free tiers), and send a WhatsApp link to a Vercel preview (`noindex`, free) — "your burger in 3D, tap to rotate."
2. **Show, don't tell, with numbers:** GANT +6.3% conversion, Zach Footwear −29% returns, AR furniture 3–4x conversion (§7 of any proposal).
3. **Live AR moment:** model-viewer's "view in your space" AR on the client's own phone closes deals — zero app install.
4. **Awwwards wall:** show Bruno Simon / Hatom / Scout Motors to sell the premium tier vision, then anchor the realistic SME deliverable.

### 7.3 Quick-win offers (ranked by effort ÷ revenue)

1. **"3D product viewer on your existing store"** — model-viewer embed; days, not weeks. Gateway drug.
2. **360° venue tour** — for the burger restaurants: shoot the dining room, embed a tour on Google Maps-adjacent pages.
3. **3D hero for a product launch** — one R3F scroll scene; reusable internal starter makes margins excellent.
4. **Configurator** — only for clients with genuinely customizable products (jewelry, furniture, abayas, gift boxes).
5. **Full 3D store** — flagship/portfolio piece; sell selectively, price properly.

---

## 8. Recommended Qimmah Stack & 90-Day Plan

**Default stack:** Vite + React + @react-three/fiber + drei + GSAP/Lenis; `<model-viewer>` for embeds; Blender + gltfpack for assets; Pannellum for tours; Spline (Starter seat) for pitching; Vercel hosting.

1. **Weeks 1–2:** Build the 3 internal starters (product viewer, 3D hero, 360 tour) from the repos in §5; learn the gltfpack pipeline; drop a Draco+KTX2 model under 1 MB.
2. **Weeks 3–4:** Build Qimmah's own 3D portfolio piece (agencies are judged by their own site — see Active Theory) + 2 free/cheap demos for friendly local businesses (e.g., a burger in 3D).
3. **Month 2:** Package the 3 quick-win offers with OMR pricing; pitch existing clients first.
4. **Month 3:** First paid configurator project using afilahkle/3D-Clothing-Configurator or CodeHole7 room-designer as the base; publish a case study with conversion metrics.

---

## 9. Key Sources

- Core library stats: GitHub (Aug 2026) + npm registry; [utsubo.com Three.js vs Babylon vs PlayCanvas](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison); [React Three Fiber in Production](https://actualintelligencelabs.ai/research/react-three-fiber-in-production)
- Spline pricing: [spline.design/pricing](https://spline.design/pricing) snapshots via xpay.sh / comparetiers.com
- Conversion data: [fibbl.com](https://fibbl.com/best-product-rendering-visualization-services/), [rendimension.com 2026 guide](https://rendimension.com/blog/product-visualization-for-ecommerce-a-complete-2026-guide/), [3devision.com](https://3devision.com/blog/how-3d-visualization-drives-a-200-conversion-boost/), [cylindo.com](https://blog.cylindo.com/3d-product-visualization-furniture-ecommerce)
- Configurator pricing: [cpq3d.com](https://cpq3d.com/3d-product-configurator-cost/), [polymuse.tech](https://polymuse.tech/blog/3d-product-configurator-cost), [techversol.com](https://techversol.com/pricing/interactive-3d-configurations/), [eyedex.co](https://eyedex.co/blog/product-configurator-cost-pricing)
- Showcases: [hontran.dev WebGL examples](https://www.hontran.dev/blog/webgl-website-examples), [roughworks.ca Awwwards 2026 patterns](https://roughworks.ca/blog/awwwards-2026-patterns/), [webgpu.com Hatom breakdown](https://www.webgpu.com/showcase/hatom-griffin-mythology-webgl/), [awwwards.com](https://www.awwwards.com)
- Performance pipeline: [svilenkovic.com GLB optimization](https://svilenkovic.com/3d/glb-optimization)
- SEO: [Vercel/MERJ JavaScript SEO study](https://vercel.com/blog/how-google-handles-javascript-throughout-the-indexing-process), [Vercel preview noindex](https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines), [SPA prerendering with Puppeteer](https://alessandrofuda.github.io/react-spa-seo-puppeteer-prerendering/)
- Oman/GCC market: [IMARC Oman e-commerce](https://www.imarcgroup.com/oman-e-commerce-market), [stateglobe Oman internet stats](https://data.stateglobe.com/oman/internet-penetration-rate-statistics)
