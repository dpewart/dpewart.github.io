/*
 * Help & Operations Codex catalog and renderer.
 * Progressively reveals game mechanics as milestones are unlocked.
 */
import { state } from "./state.js";

export const HELP_TOPICS = [
    {
        id: "basics",
        title: "Reactor Basics & Controls",
        tag: "Core",
        isVisible: () => true,
        isUnlocked: () => true,
        content: `
            <p>Welcome to reactor engineering. Your primary goal is generating Energy to expand your installation:</p>
            <ul>
                <li><strong>Placement:</strong> Select a component from the left palette, then left-click (or click-and-drag) on the grid to place it.</li>
                <li><strong>Selling:</strong> Right-click on any occupied tile to instantly sell the component for an energy refund based on remaining durability.</li>
            </ul>
        `
    },
{
        id: "radiation",
        title: "Radiation & Choking",
        tag: "Core",
        isVisible: () => true,
        isUnlocked: () => true,
        content: `
            <p>Operating reactors emit radiation into their tile (shown on the blue bar from 0 to 100):</p>
            <ul>
                <li><strong>Efficiency Penalty:</strong> Accumulated radiation chokes reactor output, reducing energy generation by up to <strong>${(state.maxRadiationPenalty * 100).toFixed(0)}%</strong> at 100 radiation.</li>
                <li><strong>Tile Selling:</strong> Manually selling an occupied tile purges its accumulated radiation.</li>
            </ul>
        `
    },
    {
        id: "radiation_sinks",
        title: "Radiation Control",
        tag: "Decontamination",
        isVisible: () => (state.stats?.totalEnergyProduced || 0) >= 30,
        isUnlocked: () => state.unlockedComponents.includes("basic_sink") || (state.stats?.totalEnergyProduced || 0) >= 60,
        lockedHint: "Unlocked by generating 60 total Energy or unlocking the Basic Sink.",
        content: `
            <p>Manage radiation buildup to keep reactors operating at peak efficiency:</p>
            <ul>
                <li><strong>Diffusion:</strong> Radiation naturally diffuses to adjacent occupied tiles at 20% per second. Empty tiles do not conduct radiation.</li>
                <li><strong>Active Sinks:</strong> Sinks consume no energy; they actively scrub radiation from all adjacent tiles every second.</li>
            </ul>
        `
    },
    {
        id: "auto_replace",
        title: "Auto-Replace Automation",
        tag: "Automation",
        // Hidden until player hits 2000 lifetime energy; teaser shown until 20,000 or purchased
        isVisible: () => (state.stats?.totalEnergyProduced || 0) >= 2000 || Object.values(state.autoReplaceUnlocked || {}).some(Boolean),
        isUnlocked: () => Object.values(state.autoReplaceUnlocked || {}).some(Boolean) || (state.stats?.totalEnergyProduced || 0) >= 20000,
        lockedHint: "Unlocked by purchasing an Auto-Replace upgrade or generating 20,000 total Energy.",
        content: `
            <p>Automated maintenance keeps reactors running, but has trade-offs:</p>
            <ul>
                <li><strong>Surcharge:</strong> Depleted cells auto-replace at +50% energy cost.</li>
                <li><strong>Radiation Retention:</strong> Auto-replace does <em>not</em> clear tile radiation.</li>
            </ul>
        `
    },
    {
        id: "alloys",
        title: "Industrial Metallurgy & Smelting",
        tag: "ALLOYS",
        // Teaser at 25,000 lifetime energy; unlocks when smelter is unlocked or first alloy is made
        isVisible: () => (state.stats?.totalEnergyProduced || 0) >= 25000,
        isUnlocked: () => state.unlockedComponents.includes("smelter_1") || (state.stats?.totalAlloysProduced || 0) >= 1,
        lockedHint: "Classified Research — Requires unlocking the Arc Smelter.",
        content: `
            <p>Harness intense power and radiation to synthesize Exotic Alloys for advanced technology:</p>
            <ul>
                <li><strong>Direct Siphoning:</strong> Smelters draw Energy and Radiation directly from orthogonally adjacent Reactors.</li>
                <li><strong>Radiation Intake:</strong> Smelters draw full radiation and as much energy as available. If throttled by energy, excess radiation accumulates on the smelter's tile and diffuses outward.</li>
                <li><strong>Operating Speed:</strong> Smelter alloy production throttles to whichever input is the limiting bottleneck.</li>
                <li><strong>Crucible Wear:</strong> Smelter durability depletes as alloys are produced.</li>
                <li><strong>Conduits:</strong> Transfer energy and radiation between reactors and smelters. Do not transfer to other conduits.</li>
            </ul>
        `
    },
    {
        id: "flux",
        title: "Quantum Flux & Blueprints",
        tag: "Phase 6.0",
        // Hidden completely until player is deep in Tier 2 (500,000 total energy); unlocks at 2,500,000
        isVisible: () => (state.stats?.totalEnergyProduced || 0) >= 500000,
        isUnlocked: () => (state.stats?.totalEnergyProduced || 0) >= 2500000,
        lockedHint: "Classified Physics — Requires endgame reactor stabilization.",
        content: `
            <p>Channel sustained output through Flux Condensers to trigger prestige resets, retaining permanent meta-upgrades and Blueprint memory banks.</p>
        `
    }
];

export function renderHelpView() {
    const container = document.getElementById("helpList");
    if (!container) return;

    let html = "";
    HELP_TOPICS.forEach(topic => {
        // Step 1: Check visibility (defaults to true if omitted)
        const visible = topic.isVisible ? topic.isVisible() : true;
        if (!visible) return;

        // Step 2: Check unlocked vs locked teaser
        const unlocked = topic.isUnlocked ? topic.isUnlocked() : true;

        if (unlocked) {
            html += `
                <div class="help-card">
                    <div class="help-card-header">
                        <h3 class="help-card-title">${topic.title}</h3>
                        <span class="help-tag">${topic.tag}</span>
                    </div>
                    ${topic.content}
                </div>
            `;
        } else {
            html += `
                <div class="help-card help-card-locked">
                    <div class="help-card-header">
                        <h3 class="help-card-title">${topic.title}</h3>
                        <span class="help-tag">Locked</span>
                    </div>
                    <p>${topic.lockedHint || "Requirements not yet met."}</p>
                </div>
            `;
        }
    });

    container.innerHTML = html;
}