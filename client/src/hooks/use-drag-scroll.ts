"use client";

import { useEffect, type RefObject } from "react";

const DRAG_THRESHOLD_PX = 4;
const INTERACTIVE = "a, button, input, textarea, select, [role=button], [contenteditable]";

/**
 * Lets a scroll container be panned with the mouse: press anywhere in it and drag, the way a
 * touch screen scrolls, instead of reaching for the scrollbar. Touch and pen keep their native
 * panning. A press on a control (button, link, field) is left alone, a drag that moved cancels
 * the click it would otherwise land, and text cannot be selected while dragging.
 *
 * The container gets `data-drag="idle" | "active"` and `data-can-scroll` while it overflows,
 * which the `.drag-scroll` styles use for the grab cursors.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      const scrollable = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
      if (scrollable) node.setAttribute("data-can-scroll", ""); else node.removeAttribute("data-can-scroll");
    };
    node.setAttribute("data-drag", "idle");
    update();
    const resize = new ResizeObserver(update);
    resize.observe(node);
    const content = new MutationObserver(update);
    content.observe(node, { childList: true, subtree: true });

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;

    const swallowClick = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      node.removeEventListener("click", swallowClick, true);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (!node.hasAttribute("data-can-scroll")) return;
      if ((event.target as Element).closest(INTERACTIVE)) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = node.scrollLeft;
      startTop = node.scrollTop;
      moved = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        moved = true;
        node.setPointerCapture(pointerId);
        node.setAttribute("data-drag", "active");
        window.getSelection()?.removeAllRanges();
      }
      node.scrollLeft = startLeft - dx;
      node.scrollTop = startTop - dy;
      event.preventDefault();
    };

    const end = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (moved) {
        node.releasePointerCapture(pointerId);
        // The mouseup lands as a click on whatever is under the pointer: eat that one click.
        node.addEventListener("click", swallowClick, true);
        setTimeout(() => node.removeEventListener("click", swallowClick, true), 0);
      }
      node.setAttribute("data-drag", "idle");
      pointerId = null;
      moved = false;
    };

    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);
    return () => {
      resize.disconnect();
      content.disconnect();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", end);
      node.removeEventListener("pointercancel", end);
      node.removeEventListener("click", swallowClick, true);
    };
  }, [ref]);
}
