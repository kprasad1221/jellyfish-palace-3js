# Palace design references

These files are reference material supplied by the user, not runtime dependencies. They are excluded from the deployed static directory. No third-party renderer or template JavaScript is executed by the palace.

- **Temple Night:** complete registered source extracted from the supplied code attachment. Revision `4399487d2fb42bce39c7b032fbbb50d230bf4f0b`, Three.js r149. All three registered SHA-256 values match; see `temple-night/manifest.json`. Useful for authored architecture, atmosphere, camera composition, pointer response, and the full bloom pipeline. The exact effect must retain its authored renderer and matching runtime if implemented; do not present a partial adaptation as Temple Night.
- **Sylva:** full supplied page source, used to study panel overlap, depth, parallax, and the floating dock.
- **Pixel Rhythms Jukebox:** `https://github.com/kprasad1221/pixel-rhythms-jukebox`, inspected at commit `18a5b4a01931187f9d6765118e0677934aa2b1de`. Its rounded pads, inset displays, and physical fader provide the existing interaction language to adapt to the palace.

## Applied in v0.3

The palace keeps its own procedural world and Three.js 0.186.0 runtime. Temple Night informs depth haze, localized light, foreground layers, and pointer response. Sylva informs the arched translucent field-guide panel, overlapping scene layers, and floating dock. Jukebox informs the actual viewpoint pads, inset audio display, round playback control, and physical volume fader. None of these references is presented as an exact renderer integration.

The user's Krea / H3 palace image and film in `dist/assets/` remain the visual target. The Notion [Bell Vault study](https://app.notion.com/p/4141f16ba96281d8a84ad5ceee617526?pvs=204) supplies symmetrical warm architecture, separate living jellyfish motion, pearl membranes, and fine filaments against dark water. [New Atlantis as a diegetic storyworld](https://app.notion.com/p/2bd1f16ba962805c854ed64fa994c002?pvs=204) informs the instrument's place in the environment.

Audio filtering is deliberately unchanged in v0.3 and remains unresolved. Browser UI checks and shader compilation passed, but WebGL is disabled in the preview browser, so the actual 3D result has not received a rendered visual comparison.
