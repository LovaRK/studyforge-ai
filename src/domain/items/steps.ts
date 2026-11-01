const STEP_MARKER = /^\s*(?:(?:step\s*)?\d{1,2}\s*[.):]|[-*•])\s+/i;

/**
 * Reads a how-to or process answer as ordered steps when it is written as a
 * numbered or bulleted list ("1. …", "Step 2: …", "- …"). Lines that do not
 * start a step continue the previous one. Returns null for prose, so the
 * caller shows it as paragraphs instead of inventing steps.
 */
export function splitSteps(text: string): string[] | null {
  const steps: string[] = [];
  let sawMarker = false;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (STEP_MARKER.test(line)) {
      sawMarker = true;
      steps.push(line.replace(STEP_MARKER, "").trim());
    } else if (sawMarker) {
      steps[steps.length - 1] = `${steps[steps.length - 1]} ${line.trim()}`;
    } else {
      // Text before the first marker is an introduction, not a step.
      return null;
    }
  }
  return steps.length >= 2 ? steps : null;
}
