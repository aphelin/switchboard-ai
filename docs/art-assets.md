# Art assets

The ground layer (`client/src/components/layout/aurora.tsx`) shows a drawn scene: a mint light at the top centre, soft shafts through the canopy, haze, dust, dark leaf masses at the corners, a little earth warmth at the foot, vignette and grain. It stands on its own. When `ground.jpg` exists in this folder the layer shows it under the drawn light (the drawn scene drops to 55% so the two blend), which adds real depth and texture.

## scene.svg and scene.webp

- `scene.svg` is the source of the drawn light: a 1600 × 1000 frame with a fractal-noise haze, nine blurred light shafts from an apex above the frame and dust discs. Edit it with any text editor.
- `scene.webp` is what the app ships (1920 × 1200, WebP quality 80, alpha). The layer cover-fits it from the top centre, the same slice the SVG used. It is a raster on purpose: as inline SVG, its `feTurbulence` and Gaussian blur filters were re-rasterised on the main thread every time something opened above the ground, which made menus open late in Firefox.
- Re-render after editing the SVG, with any headless Chrome, for example:

  ```bash
  npx -y puppeteer browsers install chrome   # once
  node -e '
  const p=require("puppeteer");(async()=>{const b=await p.launch();const g=await b.newPage();
  await g.setViewport({width:1920,height:1200});
  await g.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:1920px;height:1200px}</style>`+require("fs").readFileSync("client/public/art/scene.svg","utf8"));
  await g.screenshot({path:"client/public/art/scene.webp",type:"webp",quality:80,omitBackground:true});await b.close();})()'
  ```

## ground.jpg

- Size: 2400 × 1400 px, JPEG quality 80 or so (aim for under 400 KB).
- Content: a dark cinematic background only, no text, no UI, no logo.
- Drop it at `client/public/art/ground.jpg`; nothing else to change.
- Status (2026-09-15): in place, generated with Nano Banana 2 from the prompt below and converted from a 1376 × 768 PNG export (JPEG q82, 73 KB). Its provenance is embedded in the file's JPEG comment (`impeccable embed-prompt`). It is upscaled on large and high-density screens; a 2K or wider export from the same prompt can replace it at the same path, then re-run `impeccable embed-prompt` on the new file.
- On phones the layer pushes the image up (`top: -30vh; height: 130vh`, 68 % opacity) so the bright opening sits behind the header rather than the headline.

Prompt for Nano Banana:

> Cinematic wide background, 16:9, almost entirely dark. The forest floor at night seen from below, looking up at one opening in a dense canopy at the top centre of the frame. Cool moonlight breaks through the opening: a soft mint-white core, volumetric shafts of light fanning down through thin mist, fine dust catching the light. The canopy around the opening is very dark, out of focus, with soft leaf silhouettes at the top corners. Below the light the frame falls into near-black brown-green; the bottom half is very dark with only a faint warm earth tone on the ground. Soft focus everywhere, no hard shapes, no people, no text, no lens-flare streaks, fine film grain, gentle vignette. Colours: #0e0c0a brown-black, #1f5a3e deep forest, #5fd9a3 moss-mint in the shafts, #a9f3d3 only at the core.

Keep the opening in the top centre; the landing places the headline on the left and the glass panel on the right under it, and the bottom 60 % of the frame must stay dark enough for white text.
