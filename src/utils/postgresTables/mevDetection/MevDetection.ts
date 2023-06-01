import { updateSandwichDetection } from "./SandwichDetection.js";

export async function updateMevDetection(): Promise<void> {
  await updateSandwichDetection();
  // Opportunity for Extensions to detect other kinds of MEV-Activity.
  // <- plug them here
}
