# Jellyfish Palace

An explorable audiovisual study by Pixel Rhythms Labs. Version 0.4, November 17, 2026.

The supplied **Jellyfish Palace** Krea / H3 film is the visual reference and the source of the included Daydream audio. This version builds a procedural 3D hall with symmetrical bell canopies, translucent jellyfish, fine hanging filaments, and a reflective patterned floor. It is an interpretation, not a recovered 3D model of the film.

## Run locally

Install Node.js if you do not already have it. Extract this folder, open a terminal here, and run:

```sh
npm start
```

On Windows PowerShell, use `npm.cmd start` if PowerShell blocks npm scripts. Open **http://localhost:8080**. No dependency installation or build is needed. All runtime libraries and media are included. Alternatively: `python -m http.server 8080 --directory dist`.

The browser needs WebGL 2. Click **Enter the palace** to start audio (browsers require a user gesture). Drag to look; scroll, WASD, or arrow keys to move. The three viewpoint buttons take you to the entrance, bell hall, or jellyfish garden. Mobile has forward/back buttons after entering. Space plays or pauses; H hides the interface.

## What follows the sound

| Part of the world | Measurement | Visual response |
| --- | --- | --- |
| Architecture | Sub and bass level, 30–150 Hz, plus upper mids for the branches | Gold crowns and canopy ribs, cyan branches, luminous beads |
| Jellyfish | Low-mid, mid and upper-mid levels, 150–2500 Hz | Pearl-to-peach bells, compression, expansion and a small rise |
| Filaments | Presence, brilliance, air, 2500–16000 Hz | Three distinct groups of line / tip brightness |
| Floor | Sub and bass levels and detected attacks | Cyan and pearl caustics, with outward traveling waves from attacks |

These are frequency ranges, not separated instruments. The scene does not claim beat, instrument, or stem detection. Gesture timing comes from detected attacks. No manually set BPM or automatic score clock drives the world.

**Sound** opens response and volume controls, meters, and an audio-file picker. **Response style → Fluid** is the default; choose **Original · compare** to hear the same audio with the earlier fast mapping. **Smoothing** scales the Fluid response times from 0.5× to 2×; higher means slower. **Audio response** enables or disables the sound-driven changes. **Light → Living currents** controls the independent idle movement of jellyfish, hanging strands, plankton, and water texture. Disable both and allow the response to settle to inspect the composition at rest. Set Response to zero for a second silence check. Uploaded audio stays in memory in this browser session; it is not sent to a server. Limit: 40 MB and 3 minutes to bound analysis memory and wait time.

## Version 0.4 — light across the Threshold

Fluid measures the active decibel range of each of the eight bands when a track loads. During playback it interpolates the level at the playhead, remaps it to 0–1, applies the Response setting, and filters the result separately for light, color and movement. On the supplied loop, the bass band maps about −43 to −38 dB onto the full target range. At the default Response setting, the combined architecture light signal spends the middle 90% of a settled loop between 0.22 and 0.96. In v0.3 it occupied 0.18 to 0.28.

At the default smoothing, light takes 0.26 seconds to travel 90% of the way toward a sustained brighter target and 0.53 seconds toward a dimmer target. Bell movement takes 0.80 and 1.00 seconds respectively. Upper mids bring cyan into branch beads and column roots while bass warms the crowns. Three groups of treble filaments brighten along the canopy rims. Small groups of jellyfish occupy the side bays at several depths, leaving the central aisle open.

The floor uses the same reflective surface for both the image of the palace and its mineral pattern. The membrane shader clamps edge coordinates before raising them to fractional powers, keeping invalid values out of the reflection and bloom.

## Version 0.3 — palace and instrument

This pass introduced the environment and instrument dock using the v0.2 response.

- A visible sea-glass instrument dock adapts the Jukebox's tactile viewpoint pads, inset display, round transport, and physical volume fader. Light and Sound panels remain separate. Compact layouts use two rows and move volume into Sound.
- An arched field guide describes the living bells, canopy, and tide floor. After entering, guide markers project from positions in the world. Viewpoint pads take the camera to the threshold, bell hall, and jellyfish garden.
- Column roots, scalloped canopy rims, pearl details, mineral stone texture, and repeated end arches give the architecture detail at several scales. Larger nearby jellyfish frame the nave.
- Cool depth haze, soft shafts, drifting plankton, and independently moving fine strands add ambient life. The rigid canopy remains symmetrical. Pointer movement gives slight camera and panel parallax; reduced-motion preferences disable these idle effects.
- **Light** offers Pearl tide and Amber glow, plus Living currents. These are visual atmosphere controls and do not alter the audio measurements.
- Floor veins and reflection now share one surface, replacing the overlapping planes. The shader softens reflection sampling, guards projected coordinates, and uses derivative-based vein edges. This addresses plausible artifact sources; a WebGL-enabled visual comparison is still needed to determine whether the reported artifacts are resolved.

Art direction follows the supplied Krea / H3 palace image and film, the Notion [Bell Vault study](https://app.notion.com/p/4141f16ba96281d8a84ad5ceee617526?pvs=204), and [New Atlantis as a diegetic storyworld](https://app.notion.com/p/2bd1f16ba962805c854ed64fa994c002?pvs=204): warm gold and pearl, dark sea, symmetrical architecture, living bodies distinct from the building, and an instrument that belongs to the world. See `references/README.md` for the other design references.

## Version 0.2 — first filtering experiment

The original adapter used an approximately 0.1-second level rise and separate 55-millisecond attack gestures, with shape, light, and hue sharing those fast signals. Fluid adds a final two-pole low-pass filter with continuous value and velocity. It keeps the existing audio measurements and detected events; it adds no musical clock or new analysis system.

These were the v0.2 times in seconds to follow 90% of a sustained change.

| Destination | Rise | Fall |
| --- | ---: | ---: |
| Architecture and jellyfish light | 0.65 | 1.5 |
| Jellyfish movement | 1.1 | 2.0 |
| Color | 2.2 | 3.0 |
| Filament light | 0.8 | 1.8 |
| Floor response envelope | 0.7 | 1.6 |

Attacks give the light and movement a small filtered push. Color follows sustained levels. Floor waves are slower and broader with a soft arrival; existing waves finish when playback stops. The scene, palette stops, and audio source remain the same for comparison. A rendering-rate indicator in Sound helps distinguish rapid response from dropped frames.

The supplied clip is about 5.18 seconds. It loops; its original audio edge is preserved. It is not a substitute for a longer song when assessing musical variation. Source film pauses the room audio while you compare, then resumes it when closed.

## Reused work

Copied unchanged from [Living Particles 3JS](https://github.com/kprasad1221/Living-Particles-3js/tree/c654ae403c5bece4822dd38024228c1fc468acd4), branch `study-01-composed-motion`, commit `c654ae403c5bece4822dd38024228c1fc468acd4`:

- `dist/src/analysis/features.js`, `fft.js`, `harmony.js`, and `worker.js`.
- `dist/src/shared/score.js` and `palette.js`.
- Original MIT notice in `LICENSE`.

`params.js` preserves the analyser's eight voice boundaries. The palace uses the `envelope()` function from `score.js` for detected events and interpolates material colors in Three.js. The analysis worker supplies the timing for the visual response.

World adapter: `dist/src/audio.js`; final visual filtering: `dist/src/response-filter.js`; geometry, material response and navigation: `dist/src/world.js`; surface shaders: `dist/src/palace-materials.js`; environmental light and particles: `dist/src/palace-atmosphere.js`; interface: `dist/src/main.js`. Three.js **0.186.0** and the used addons are vendored with their MIT notice in `dist/vendor/LICENSE-three.txt`.

## Verify

```sh
npm run check
npm test
npm run test:world
```

Checks cover imports and assets, silence, isolated frequencies, event envelopes, zero response and deterministic event sampling. Filter checks cover equivalent step responses at 30/60/120 fps, spike suppression, pause tails and settling to zero. A playback test runs the supplied loop through the same per-frame method as the player and checks that the architecture repeatedly brightens and recedes, bell motion stays smooth, and the level is continuous across the loop seam.

The v0.3 browser checks cover desktop, phone portrait, and phone landscape UI; playback/pause, volume synchronization, viewpoint selection, field guide, Light/Sound panels, Escape, and hiding/restoring controls. The scene-graph test checks finite geometry, fog uniforms, the single reflective floor, target sizing, ambient pause, light transitions, camera travel, and landmark projection. All six custom shader programs also compiled and linked in a separate EGL/GLES 3 compiler check.

The preview browser reports WebGL disabled and displays the film still behind the interactive controls. For v0.4, offscreen Mesa GLES rendered the Three.js Threshold view with its reflection, lighting and bloom at rest and at several times in the actual soundtrack. Those frames were used to tune the color separation and to inspect the floor. Frame pacing on a visitor's device requires a browser with WebGL enabled.

Reference material is preserved outside the served `dist` folder under `references/`: the complete user-supplied Temple Night registered source (all three SHA-256 hashes verified) and the Sylva template. This pass borrows their design principles, not their renderer code. Temple Night's exact renderer targets Three.js r149; it has not been embedded, ported, or replaced with an approximate Temple Night component.

## Fresh GitHub repository

The GitHub connector in this session could read the source repo but did not expose repository creation; CLI GitHub login was not available in the initial check. This delivery therefore uses the authorized Sites preview and a source ZIP. It does **not** claim that a new GitHub repository has been created.

Suggested name: `jellyfish-palace-3js`. In GitHub Desktop choose **File → Add local repository** for the extracted folder, choose **create a repository here** if prompted, then **Publish repository**. Keep it private until you decide how to share the source media. The Sites hosting manifest and Git metadata are omitted from the download so it starts independently. The included media rights remain with their respective owners; the code license does not grant new rights to the media.
