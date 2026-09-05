import { CAPTURE_START, FOV_Y, PLATE_ASPECT, goldenMotionAt, smoothstep } from "@/lib/golden-path";
import { CORE_IN } from "@/lib/capture-core";
import { captureReleaseAt } from "@/lib/capture-release";

/** Join the shot from the actual viewport/camera, reaching the authored
 * framing before the baked core arrives. No fixed-distance cut on press.
 */
export function captureEntryBlend(shotTime: number) {
  return smoothstep(CAPTURE_START, CORE_IN, shotTime);
}

export function captureEntryValue(
  authored: number,
  authoredAtPress: number,
  actualAtPress: number,
  shotTime: number,
) {
  return authored + (actualAtPress - authoredAtPress) * (1 - captureEntryBlend(shotTime));
}

export function captureSkyOpacity(shotTime: number, renderTime: number, children: boolean) {
  const shot = 1 + (goldenMotionAt(renderTime).nebulaOpacity - 1) * captureEntryBlend(shotTime);
  const back = children ? captureReleaseAt(renderTime).lightReturn : 0;
  return shot + (1 - shot) * back;
}

/** Keep the gas beyond the viewport edges while a wide camera opens back
 * out. At authored framing this is exactly 1, preserving registration.
 */
export function capturePlateScale(aspect: number, fovDegrees: number) {
  return Math.max(1, aspect / PLATE_ASPECT)
    * Math.tan(fovDegrees * Math.PI / 360) / Math.tan(FOV_Y / 2);
}
