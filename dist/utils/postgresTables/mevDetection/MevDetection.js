import { updateSandwichDetection } from "./Sandwich/SandwichDetection.js";
export async function updateMevDetection() {
    await updateSandwichDetection();
    // Opportunity for Extensions to detect other kinds of MEV-Activity.
    // <- plug them here
}
//# sourceMappingURL=MevDetection.js.map