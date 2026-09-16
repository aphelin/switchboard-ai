"use client";

import { useEffect, useState } from "react";

const GROUND_ART = "/art/ground.jpg";
const SCENE_ART = "/art/scene.webp";

/**
 * The ground: a dark forest floor seen from below the canopy, one cool mint light
 * breaking through at the top centre with soft shafts, haze and dust, and a little
 * earth warmth low in the frame. The leaf masses framing the opening are a CSS
 * layer over the light (globals.css `.canopy`). When a rendered background lands
 * in public/art it sits under the drawn light.
 *
 * The drawn scene (`public/art/scene.svg`: fractal-noise haze, nine light shafts from
 * an apex above a 1600×1000 frame, dust discs) ships pre-rendered as `scene.webp` and
 * is cover-fitted from the top centre. As inline SVG its turbulence and blur filters
 * were re-rasterised on the main thread whenever anything above the ground changed,
 * which is what made menus open late in Firefox. Re-render it per docs/art-assets.md.
 * `data-intensity` is "hero" on the welcome page and "app" inside.
 */
export function Aurora({ intensity = "app" }: { intensity?: "hero" | "app" }) {
  const [photo, setPhoto] = useState<boolean>(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setPhoto(true);
    img.src = GROUND_ART;
  }, []);

  return (
    <div className="ember" aria-hidden="true" data-slot="ground" data-intensity={intensity} data-photo={photo ? "" : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && <img src={GROUND_ART} alt="" className="photo" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SCENE_ART} alt="" className="scene" width={1920} height={1200} decoding="async" fetchPriority="high" />

      {/* Leaf masses over the light: the opening the light comes through. */}
      <div className="canopy" />
      <div className="sun" />
    </div>
  );
}
