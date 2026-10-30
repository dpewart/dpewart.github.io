/*
Controls and updates the user interface based on user interaction. Tried to organize code in reading order, so GUI elements rendered at the top left should be coded first, and code continues from there in reading order.
*/
import { COMPONENTS } from "./components.js";
import { state } from "./state.js";
import {
    placeComponent,
    sellComponent,
    canAffordCost,
    getOrthogonalNeighbors,
    } from "./reactor.js";
import { 
    isComponentVisible, 
    canUnlockComponent, 
    unlockComponent, 
    meetsRequirements, 
    UPGRADES,
    isUpgradeVisible,
    getUpgradeLevel,
    getUpgradeCost,
    canPurchaseUpgrade,
    purchaseUpgrade
} from "./upgrades.js";
import {
    getTileMultiplier,
    getEffectiveComponentStat,
    getComponentUpgradeMultiplier,
} from "./effects.js";
import {
    saveGame,
    resetGame,
} from "./save.js";
import {
    renderHelpView
} from "./help.js";

//Turns off context menu from browser right-click menu default. Needed for right-click selling.
document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});
// Tracks currently hovered element for dynamic description pane
let hoveredTile = null;             // { x, y }
let hoveredPaletteComponent = null; // componentId string (e.g. "basic_reactor")
//Beginning of code for left-and-right-click selling, painting, and control.
//Meant to check if right or left click is being held down.
let leftMouseDown = false;
let rightMouseDown = false;

document.addEventListener("mousedown", (e) => {
    if (e.button === 0){leftMouseDown = true;}

    if (e.button === 2){rightMouseDown = true;}
});

document.addEventListener("mouseup", (e) => {
    if (e.button === 0){leftMouseDown = false;}

    if (e.button === 2){rightMouseDown = false;}
});
//Adding and removing components triggers grid/UI refresh.
function handleTileAction(x, y, isSelling) {
    if (isSelling) {
        sellComponent(x, y);
    } else {
        placeComponent(x, y);
    }
    renderGrid();
    updateUI();
}
//Helper function for formatComponentStatsHTML below: effect text helper. Converts the basic effect data into more human-friendly format in the description pane.
const TARGET_LABELS = {
    energyOutput: "Adjacent Energy",
    radiationOutput: "Adjacent Radiation",
    decayRate: "Adjacent Decay",
    maxDurability: "Adjacent Durability"
};

function formatEffect(effect, componentId = null) {
    const label = TARGET_LABELS[effect.target] || effect.target || effect.type;
    const mult = componentId ? getComponentUpgradeMultiplier(componentId, "adjacency_" + effect.target) : 1;
    const effectiveVal = effect.value * mult;
    const sign = effectiveVal > 0 ? `+${(effectiveVal * 100).toFixed(0)}%` : `${(effectiveVal * 100).toFixed(0)}%`;
    const baseSign = effect.value > 0 ? `+${(effect.value * 100).toFixed(0)}%` : `${(effect.value * 100).toFixed(0)}%`;
    const baseNote = (mult !== 1) ? ` <small>(Base: ${baseSign})</small>` : "";
    return `${label}: ${sign}${baseNote}`;
}
// Helper function for formatComponentStatsHTML below: helps format the cost to shorten that big block of code.
function formatCost(cost) {
    if (!cost) return "Free";
    if (typeof cost === "number") return `${cost} Energy`;

    const parts = [];
    if (cost.energy !== undefined) {
        parts.push(`${cost.energy} Energy`);
    }
    // Only reveal alloy portion once player has produced at least 1 alloy
    if (cost.alloys !== undefined && (state.stats?.totalAlloysProduced || 0) >= 1) {
        parts.push(`${cost.alloys} Alloys`);
    }
    return parts.join(", ") || "Free";
}
/**
 * Generates stat readout HTML for a component.
 * If tileData and coords are provided, renders live/runtime stats (decay, live output, tile radiation).
 * Otherwise, renders catalog specs (placement cost, upgraded base stats).
 */
function formatComponentStatsHTML(component, tileData = null, coords = null) {
    let html = "";
    const isLiveTile = tileData !== null && coords !== null;

    // 1. Placement Cost (Catalog only)
    if (!isLiveTile && component.cost !== undefined) {
        html += `<p>Cost: ${formatCost(component.cost)}</p>`;
    }
    // Quick helper: returns "(Base: X)" only if the stat was upgraded
    const baseNote = (effective, base, unit = "") => 
        effective !== base ? ` <small>(Base: ${base}${unit})</small>` : "";
    // 2. Energy Output
    if (component.energyOutput) {
        if (isLiveTile) {
            const effective = tileData.lastEnergyProduced ?? component.energyOutput;
            const enMult = tileData.enMultiplier ?? 1;
            const radPenalty = 1 - ((tileData.radiation || 0) / 100 * state.maxRadiationPenalty);
            const mods = (enMult !== 1 || radPenalty !== 1)
                ? ` <small>(Adj: ${(enMult * 100).toFixed(0)}%, Rad Eff: ${(radPenalty * 100).toFixed(0)}%)</small>`
                : "";
            html += `<p>Energy Output: <strong>${effective.toFixed(2)}/s</strong>${mods}</p>`;
        } else {
            const effective = getEffectiveComponentStat(component.id, "energyOutput") ?? component.energyOutput;
            html += `<p>Base Energy: ${effective.toFixed(2)}/s${baseNote(effective, component.energyOutput, "/s")}</p>`;
        }
    }
    // 3. Production: Alloys (Smelters / Refineries)
    if (component.alloyOutput) {
        if (isLiveTile) {
            const effectiveAlloys = tileData.lastAlloyProduced ?? 0;
            const throttlePct = ((tileData.throttleFactor ?? 0) * 100).toFixed(0);
            html += `<p>Alloy Production: <strong>${effectiveAlloys.toFixed(2)}/s</strong> <small>(Max: ${(component.alloyOutput).toFixed(1)}/s, ${throttlePct}%)</small></p>`;
        } else {
            const effective = getEffectiveComponentStat(component.id, "alloyOutput") ?? component.alloyOutput;
            html += `<p>Alloy Output: <strong>${effective.toFixed(2)}/s</strong>${baseNote(effective, component.alloyOutput, "/s")}</p>`;
        }
    }

    // 4. Requirements / Input Feeds (Energy & Radiation Demands)
    if (component.requiredEnergy) {
        if (isLiveTile) {
            const ePct = ((tileData.energyRatio ?? 0) * 100).toFixed(0);
            const drawn = (component.requiredEnergy * (tileData.energyRatio ?? 0)).toFixed(1);
            html += `<p>Energy Feed: <strong>${ePct}%</strong> <small>(${drawn} / ${component.requiredEnergy}/s)</small></p>`;
        } else {
            html += `<p>Required Energy: <strong>${component.requiredEnergy}/s</strong></p>`;
        }
    }

    if (component.requiredRadiation) {
        if (isLiveTile) {
            const rPct = ((tileData.radRatio ?? 0) * 100).toFixed(0);
            const drawn = (component.requiredRadiation * (tileData.radRatio ?? 0)).toFixed(1);
            html += `<p>Radiation Feed: <strong>${rPct}%</strong> <small>(${drawn} / ${component.requiredRadiation}/s)</small></p>`;
        } else {
            html += `<p>Required Radiation: <strong>${component.requiredRadiation}/s</strong></p>`;
        }
    }
    // 4A. Smelter-Specific Notes
    if (component.category === "smelter") {
        html += `<p class="hint" style="margin-top:6px; font-size:0.85em; color:#94a3b8;">
            Draws full radiation and as much energy as available. If throttled by energy, excess radiation accumulates on the smelter's tile.
        </p>`;
    }
    // 5. Operating Bottleneck / Status Indicator (Live Tile with throttling)
    if (isLiveTile && tileData.limitingReagent !== undefined) {
        let statusText = `<span style="color:#81c784;">Optimal (100%)</span>`;
        const throttlePct = ((tileData.throttleFactor ?? 0) * 100).toFixed(0);
        if ((tileData.throttleFactor ?? 0) <= 0) {
            statusText = `<span style="color:#e57373;">Idle (Starved)</span>`;
        } else if (tileData.limitingReagent === "energy") {
            statusText = `<span style="color:#ffd54f;">Bottleneck: Energy</span>`;
        } else if (tileData.limitingReagent === "radiation") {
            statusText = `<span style="color:#61e5f7;">Bottleneck: Radiation</span>`;
        } else if (tileData.limitingReagent === "balanced" && tileData.throttleFactor < 1.0) {
            statusText = `<span style="color:#81c784;">Balanced (${throttlePct}%)</span>`;
        }
        html += `<p>Status: ${statusText}</p>`;
    }

    // 6. Durability & Remaining Life
    const effectiveMaxDur = getEffectiveComponentStat(component.id, "maxDurability") ?? component.maxDurability;
    if (effectiveMaxDur) {
        if (isLiveTile && tileData.durability !== null) {
            html += `<p>Durability: ${tileData.durability.toFixed(1)} / ${effectiveMaxDur}</p>`;
            // If the component consumes durability continuously or via decayRate:
            if (component.decayRate) {
                // If it's production-decay (like smelter wear per alloy produced):
                if (component.alloyOutput && tileData.lastAlloyProduced !== undefined) {
                    const alloysRem = (tileData.durability / component.decayRate);
                    html += `<p>Remaining Life: <strong>${Math.max(0, Math.floor(alloysRem))} alloys</strong></p>`;
                } else {
                    const remSec = (tileData.durability / component.decayRate).toFixed(1) + "s";
                    html += `<p>Remaining Life: ${remSec}</p>`;
                }
            }
        } else {
            html += `<p>Max Durability: ${effectiveMaxDur}${baseNote(effectiveMaxDur, component.maxDurability)}</p>`;
        }
    }
    // 7. Accumulated Tile Radiation (Live Tile only)
    if (isLiveTile && tileData.radiation !== undefined) {
        html += `<p>Radiation: ${(tileData.radiation).toFixed(1)} / 100</p>`;
    }

    // 8. Radiation Rate (Generation or Drain)
    if (component.radiationOutput) {
        const isDrain = component.radiationOutput < 0;
        const label = isDrain ? "Radiation Drain" : "Radiation Output";

        if (isLiveTile) {
            const mult = getTileMultiplier(coords.x, coords.y, "radiationOutput");
            const val = Math.abs(component.radiationOutput * mult);
            html += `<p>${label}: <strong>${val.toFixed(2)}/s</strong></p>`;
        } else {
            const effective = getEffectiveComponentStat(component.id, "radiationOutput") ?? component.radiationOutput;
            const note = baseNote(effective, component.radiationOutput, "/s");
            html += `<p>${label}: ${Math.abs(effective).toFixed(2)}/s${note}</p>`;
        }
    }
    // 9. Conduit Bus Telemetry - Shows connected/adjacent power production and consumption
    if (component.category === "conduit") {
        //Prepares the conduit efficiency percentage.
        const eff = component.transmissionEfficiency ?? 1.0;
        const effPct = Math.round(eff * 100);
        let effLabel = `${effPct}%`;
        if (eff < 1.0) effLabel += ` <small style="color:#e57373;">(-${100 - effPct}% Loss)</small>`;
        else if (eff > 1.0) effLabel += ` <small style="color:#81c784;">(+${effPct - 100}% Boost)</small>`;
        else effLabel += ` <small>(Lossless)</small>`;

        if (isLiveTile) {

            
            const neighbors = getOrthogonalNeighbors(coords.x, coords.y);
            let connectedReactors = 0;
            let connectedSmelters = 0;
            let busGrossEnergy = 0;

            for (const n of neighbors) {
                const nTile = state.grid[n.y]?.[n.x];
                if (!nTile || !nTile.component || nTile.ghost) continue;
                const nComp = COMPONENTS[nTile.component];
                if (nComp.category === "reactor") {
                    connectedReactors++;
                    busGrossEnergy += (nTile.lastEnergyProduced ?? (nComp.energyOutput || 0));
                } else if (nComp.category === "smelter") {
                    connectedSmelters++;
                }
            }

            html += `<p>Type: <strong>Passive Bus</strong></p>`;
            html += `<p>Transmission: <strong>${effLabel}</strong></p>`;
            html += `<p>Connected Reactors: <strong>${connectedReactors}</strong> <small>(${busGrossEnergy.toFixed(1)} E/s bus)</small></p>`;
            html += `<p>Connected Smelters: <strong>${connectedSmelters}</strong></p>`;
        } else {
            html += `<p>Type: <strong>Passive Bus</strong></p>`;
            html += `<p>Transmission: <strong>${effLabel}</strong></p>`;
            html += `<p>Bus Reach: <strong>1 hop</strong> <small>(non-chaining)</small></p>`;
        }
    }
    // 10. Adjacency Effects
    if (component.effects?.length) {
        const heading = isLiveTile ? "Adjacency Bonuses Provided" : "Adjacency Effects";
        html += `<h3>${heading}</h3><ul>`;
        component.effects.forEach(effect => {
            html += `<li>${formatEffect(effect, component.id)}</li>`;
        });
        html += `</ul>`;
    }
    return html;
}
//Codes what component properties to render in the Desciption Pane
export function updateDescriptionPane() {
    const pane = document.getElementById("descriptionPane");
    if (!pane) return;
// Upgrade View case 1: Hovering over an upgrade card
    if (hoveredUpgrade) {
        const upgrade = UPGRADES[hoveredUpgrade];
        if (upgrade) {
            const currentLevel = getUpgradeLevel(upgrade.id);
            const isMax = upgrade.maxLevel !== undefined && currentLevel >= upgrade.maxLevel;
            const cost = getUpgradeCost(upgrade.id);

            let html = `<h2>${upgrade.name} ${isMax ? '<span style="color:#ffd54f;">[MAX]</span>' : ''}</h2>`;
            html += `<p>${upgrade.description}</p>`;
            html += `<p>Current Level: <strong>${currentLevel}${upgrade.maxLevel ? ` / ${upgrade.maxLevel}` : ''}</strong></p>`;
            
            if (!isMax && cost?.energy !== undefined) {
                const costClass = state.energy >= cost.energy ? "req-met" : "req-unmet";
                html += `<p>Next Level Cost: <span class="${costClass}">${cost.energy} Energy</span></p>`;
            }
            if (upgrade.requires) {
                html += `<div class="unlock-info-box"><h3>Requirements</h3>`;
                if (upgrade.requires.energy !== undefined) {
                    const met = state.energy >= upgrade.requires.energy;
                    html += `<p>Required Energy: <span class="${met ? 'req-met' : 'req-unmet'}">${state.energy.toFixed(1)} / ${upgrade.requires.energy}</span></p>`;
                }
            }
            if (upgrade.requires) {
                html += `<div class="unlock-info-box"><h3>Requirements</h3>`;
                if (upgrade.requires.totalEnergy !== undefined) {
                    const met = (state.stats.totalEnergyProduced || 0) >= upgrade.requires.totalEnergy;
                    html += `<p>Lifetime Energy: <span class="${met ? 'req-met' : 'req-unmet'}">${(state.stats.totalEnergyProduced || 0).toFixed(1)} / ${upgrade.requires.totalEnergy}</span></p>`;
                }
                html += `</div>`;
            }
            pane.innerHTML = html;
            return;
        }
    }
    // Reactor View case 1: Hovering over an active reactor grid tile
    if (hoveredTile) {
        const { x, y } = hoveredTile;
        const tileData = state.grid[y]?.[x];

        if (!tileData || !tileData.component) {
            pane.innerHTML = `
                <h2>Empty Tile</h2>
                <p>Position: (${x}, ${y})</p>
                <p class="hint">Left-click to place selected component.</p>
            `;
            return;
        }

        const component = COMPONENTS[tileData.component];
        //Ghost tile inspector branch
        if (tileData.ghost) {
            const canAfford = canAffordCost(component.cost);
            const costClass = canAfford ? "req-met" : "req-unmet";

            let html = `<h2>${component.name} <span class="ghost-badge">[Ghost / Pending]</span></h2>`;
            html += `<p>Position: (${x}, ${y})</p>`;
            html += `<p>Build Cost: <span class="${costClass}">${formatCost(component.cost)}</span></p>`;
            html += `<p class="hint ghost-hint">Will auto-construct when sufficient energy is available.</p>`;
            html += `<p class="hint cancel-hint">Right-click to cancel order (0 refund).</p>`;
            html += `<hr class="pane-divider">`;
            html += formatComponentStatsHTML(component);
            pane.innerHTML = html;
            return;
        }
        // Active live tile
        let html = `<h2>${component.name} <span style="font-size:0.8em; opacity:0.8;">(${x}, ${y})</span></h2>`;
        html += formatComponentStatsHTML(component, tileData, { x, y });
        pane.innerHTML = html;
        return;
    }
    // Reactor View Case 2 & 3: Component preview (Hovered in palette OR currently selected)
        const targetCompId = hoveredPaletteComponent || state.selectedComponent;
    if (!targetCompId) {
        pane.innerHTML = `
            <h2>No Tool Selected</h2>
            <p class="hint">Select a component to begin placing.</p>
        `;
        return;
    }

    const component = COMPONENTS[targetCompId];
    if (!component) return;

    const isUnlocked = state.unlockedComponents.includes(component.id) || !component.unlock;
    let html = `<h2>${component.name} ${!isUnlocked ? '<span class="status-locked">[Locked]</span>' : ''}</h2>`;

    if (!isUnlocked && component.unlock) {
        const { cost, requires } = component.unlock;
        const affordable = canAffordCost(cost);
        const reqsMet = meetsRequirements(requires);

        html += `<div class="unlock-info-box">`;
        html += `<h3>Unlock Requirements</h3>`;

        if (cost && cost.energy !== undefined) {
            const costClass = state.energy >= cost.energy ? "req-met" : "req-unmet";
            html += `<p>Cost: <span class="${costClass}">${cost.energy} Energy</span> (Have: ${state.energy.toFixed(1)})</p>`;
        }

        if (requires) {
            if (requires.energy !== undefined) {
                const met = state.energy >= requires.energy;
                const reqClass = met ? "req-met" : "req-unmet";
                html += `<p>Required Energy: <span class="${reqClass}">${state.energy.toFixed(1)} / ${requires.energy}</span></p>`;
            }
            if (requires.totalEnergy !== undefined) {
                const met = (state.stats.totalEnergyProduced || 0) >= requires.totalEnergy;
                const reqClass = met ? "req-met" : "req-unmet";
                html += `<p>Lifetime Energy: <span class="${reqClass}">${(state.stats.totalEnergyProduced || 0).toFixed(1)} / ${requires.totalEnergy}</span></p>`;
            }
            if (requires.components) {
                requires.components.forEach(reqId => {
                    const reqComp = COMPONENTS[reqId];
                    const unlocked = state.unlockedComponents.includes(reqId);
                    const reqClass = unlocked ? "req-met" : "req-unmet";
                    html += `<p>Prerequisite: <span class="${reqClass}">${reqComp?.name || reqId} (${unlocked ? 'Unlocked' : 'Locked'})</span></p>`;
                });
            }
        }

        if (!reqsMet) {
            html += `<p class="hint-locked">Milestone requirements not yet satisfied.</p>`;
        } else if (!affordable) {
            html += `<p class="hint-locked">Insufficient energy to purchase unlock.</p>`;
        }
        html += `</div><hr style="border-color:#555; margin: 6px 0;">`;
    }

    html += formatComponentStatsHTML(component);
    pane.innerHTML = html;
}

// Tracks visible palette buttons to prevent redundant DOM rebuilding each tick
let lastVisibleComponentsSignature = "";
// Code to render the component selector grid. Builds its buttons, basically.
// Code to render the component selector grid. Builds its buttons grouped by category into rows.
export function renderComponentSelector() {
    const selector = document.getElementById("componentSelector");
    if (!selector) return;

    selector.innerHTML = "";

    // 1. Group visible components by category in catalog order
    const categories = {};
    Object.values(COMPONENTS).forEach(component => {
        if (!isComponentVisible(component.id)) return;

        const cat = component.category || "other";
        if (!categories[cat]) {
            categories[cat] = [];
        }
        categories[cat].push(component);
    });

    // 2. Render each category as its own horizontal row
    Object.values(categories).forEach(categoryComponents => {
        const row = document.createElement("div");
        row.classList.add("component-palette-row");

        categoryComponents.forEach(component => {
            const isUnlocked = state.unlockedComponents.includes(component.id) || !component.unlock;
            const isSelected = component.id === state.selectedComponent;
            const canUnlock = !isUnlocked && canUnlockComponent(component.id);

            const button = document.createElement("button");

            if (isUnlocked) {
                // Unicode glyph centered on top of component background color
                button.textContent = component.glyph || "";
                button.style.backgroundColor = component.color;

                if (isSelected) {
                    button.classList.add("selected-component");
                }

                button.addEventListener("click", () => {
                    state.selectedComponent = isSelected ? null : component.id;
                    renderComponentSelector();
                    updateDescriptionPane();
                });
            } else {
                // Locked compact icon
                button.textContent = "🔒";
                button.classList.add("locked-component");

                if (canUnlock) {
                    button.classList.add("unlockable-component");
                    button.textContent = "🔓";
                }

                button.addEventListener("click", () => {
                    if (canUnlock && unlockComponent(component.id)) {
                        state.selectedComponent = component.id;
                        renderComponentSelector();
                        updateUI();
                    }
                });
            }

            button.addEventListener("mouseenter", () => {
                hoveredPaletteComponent = component.id;
                updateDescriptionPane();
            });

            button.addEventListener("mouseleave", () => {
                hoveredPaletteComponent = null;
                updateDescriptionPane();
            });

            row.appendChild(button);
        });

        selector.appendChild(row);
    });
}
// Checks if any component became visible or unlockable and refreshes the palette DOM if needed
export function updateComponentSelectorIfNeeded() {
    const signature = Object.values(COMPONENTS)
        .filter(c => isComponentVisible(c.id))
        .map(c => `${c.id}:${state.unlockedComponents.includes(c.id)}:${canUnlockComponent(c.id)}:${c.id === state.selectedComponent}`)
        .join("|");

    if (signature !== lastVisibleComponentsSignature) {
        lastVisibleComponentsSignature = signature;
        renderComponentSelector();
    }
}
// Checks if any upgrade became visible or unlockable and refreshes the upgrade view if needed
let lastUpgradesSignature = "";

export function updateUpgradesViewIfNeeded() {
    // Only process if the player is currently looking at the upgrades tab
    if (state.currentView !== "upgrades") return;

    // Track visibility, level, affordability, and purchase eligibility
    const signature = Object.values(UPGRADES)
        .filter(u => isUpgradeVisible(u.id))
        .map(u => `${u.id}:${getUpgradeLevel(u.id)}:${canPurchaseUpgrade(u.id)}:${canAffordCost(getUpgradeCost(u.id))}`)
        .join("|");

    if (signature !== lastUpgradesSignature) {
        lastUpgradesSignature = signature;
        renderUpgradesView();
    }
}
//Renders up the reactor grid from game data in state and components. Attaches mouse/paint event handlers.
export function renderGrid() {

    const gridElement = document.getElementById("grid");
    if (!gridElement) return;
    // Dynamically set column count based on state width
    gridElement.style.gridTemplateColumns = `repeat(${state.gridDimensions.width}, 30px)`;

    gridElement.innerHTML = "";

    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {

            const tileData = state.grid[y][x];

            const tile = document.createElement("div");

            tile.classList.add("tile");

            if (tileData.component) {const component = COMPONENTS[tileData.component];
                // For now loads components as colors, with their data bars. Hopefully not too hard to transition to images later.
                if (component) {
                    if (tileData.ghost) {
                        tile.classList.add("tile-ghost");
                        tile.style.backgroundColor = component.color;
                        tile.textContent = component.glyph || "";
                    } else {

                        tile.style.backgroundColor = component.color;
                        // Code for rendering of durability bar in grid. Checks for whether a tile actually has durability before rendering.
                        if (component.maxDurability) {

                            const barContainer = document.createElement("div");
                            barContainer.classList.add("durability-bar-container");

                            const bar = document.createElement("div");
                            bar.classList.add("durability-bar");

                            barContainer.appendChild(bar);
                            tile.appendChild(barContainer);
                        }
                    }
                }
            }

            tile.addEventListener("mousedown", (e) => {
                    if(e.button === 2) {
                        handleTileAction(x, y, true);
                    } else if (e.button === 0){
                        handleTileAction(x, y, false);
                    }
                }
            );

            tile.addEventListener("mouseenter", () => {
                    hoveredTile = {x, y};
                    if (leftMouseDown) {
                        handleTileAction(x, y, false);
                    }
                    if (rightMouseDown) {
                        handleTileAction(x, y, true);
                    }
                    updateDescriptionPane();
                }
            );

            tile.addEventListener("mouseleave", () => {
                    hoveredTile = null;
                    updateDescriptionPane();
                }
            );
            gridElement.appendChild(tile);
        }
    }
    updateUI();
}
//Fast-path update for tile parameter bars without rebuilding the DOM.
export function updateTileBars() {
    const gridElement = document.getElementById("grid");
    if (!gridElement) return;

    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {
            const tileData = state.grid[y][x];
            const tileIndex = y * state.grid[y].length + x;
            const tile = gridElement.children[tileIndex];
            if (!tile) continue;
            // 1. Durability bar update
            if (tileData.component) {
                const component = COMPONENTS[tileData.component];
                
                const maxDur = getEffectiveComponentStat(component.id, "maxDurability") ?? component?.maxDurability;
                if (component && maxDur && tileData.durability !== null && tileData.durability !== undefined) {
                    const durabilityPercent = Math.max(0, (tileData.durability / maxDur) * 100);

                    const bar = tile.querySelector(".durability-bar");

                    if (bar) {
                        bar.style.width = `${durabilityPercent}%`;
                        if (durabilityPercent < 25) {
                            bar.style.backgroundColor = "red";
                        } else if (durabilityPercent < 50) {
                            bar.style.backgroundColor = "orange";
                        } else {
                            bar.style.backgroundColor = "lime";
                        }
                    }
                }
            }
            // 2. Radiation bar update
            let radBar = tile.querySelector('.radiation-bar-container');

            if (tileData.component && tileData.radiation > 0) {
                if (!radBar) {
                    radBar = document.createElement('div');
                    radBar.className = 'radiation-bar-container';
                    const fill = document.createElement('div');
                    fill.className = 'radiation-bar';
                    radBar.appendChild(fill);
                    tile.appendChild(radBar);
                }
                
                const radFill = radBar.querySelector('.radiation-bar');
                const radPct = Math.min(100, Math.max(0, tileData.radiation));
                radFill.style.height = `${radPct}%`;
            } else if (radBar) {
                radBar.remove();
            }
        }
    }
}

// New tracking variable for upgrade inspector
let hoveredUpgrade = null; // upgradeId string (e.g. "expand_width")

// View Switcher logic
export function switchView(viewName) {
    state.currentView = viewName;

    const tabs = {
        reactor: document.getElementById("tabReactor"),
        upgrades: document.getElementById("tabUpgrades"),
        help: document.getElementById("tabHelp"),
        options: document.getElementById("tabOptions"),
    };

    const views = {
        reactor: document.getElementById("reactorView"),
        upgrades: document.getElementById("upgradesView"),
        help: document.getElementById("helpView"),
        options: document.getElementById("optionsView"),
    };
    // Toggle active class on tabs
    Object.entries(tabs).forEach(([name, el]) => {
        if (!el) return;
        if (name === viewName) {
            el.classList.add("active-tab");
        } else {
            el.classList.remove("active-tab");
        }
    });
    // Toggle display on view containers
    Object.entries(views).forEach(([name, el]) => {
        if (!el) return;
        el.style.display = (name === viewName) ? "block" : "none";
    });

    if (viewName === "upgrades") {
        renderUpgradesView();
    } else if (viewName === "help"){
        renderHelpView();
    }

    updateDescriptionPane();
}

export function initViewSwitcher() {
    document.getElementById("tabReactor")?.addEventListener("click", () => switchView("reactor"));
    document.getElementById("tabUpgrades")?.addEventListener("click", () => switchView("upgrades"));
    document.getElementById("tabHelp")?.addEventListener("click", () => switchView("help"));
    document.getElementById("tabOptions")?.addEventListener("click", () => switchView("options"));
    const container = document.getElementById("autoReplaceContainer");
    const toggle = document.getElementById("autoReplaceMasterToggle");
    // Unhide toggle on reload if player has unlocked any auto-replace upgrade
    const hasAnyAutoReplace = Object.values(state.autoReplaceUnlocked || {}).some(Boolean);
    if (container && hasAnyAutoReplace) {
        container.classList.remove("hidden");
    }
    if (toggle) {
        toggle.checked = state.autoReplaceEnabled;
        toggle.addEventListener("change", (e) => {
            state.autoReplaceEnabled = e.target.checked;
        });
    }
    // Manual Save button
    const btnManualSave = document.getElementById("btnManualSave");
    const saveStatus = document.getElementById("saveStatus");
    if (btnManualSave) {
        btnManualSave.addEventListener("click", () => {
            const res = saveGame();
            if (res.success && saveStatus) {
                const now = new Date(res.timestamp).toLocaleTimeString();
                saveStatus.textContent = `Saved at ${now}`;
                setTimeout(() => {
                    if (saveStatus.textContent.startsWith("Saved at")) {
                        saveStatus.textContent = "";
                    }
                }, 4000);
            }
        });
    }
    // Hard Reset button
    const btnHardReset = document.getElementById("btnHardReset");
    let resetArmTimeout = null;

    if (btnHardReset) {
        btnHardReset.addEventListener("click", () => {
            // Step 2: Already armed -> perform the reset
            if (btnHardReset.dataset.armed === "true") {
                clearTimeout(resetArmTimeout);
                btnHardReset.dataset.armed = "false";
                btnHardReset.textContent = "Hard Reset";

                resetGame();
                renderGrid();
                renderComponentSelector();
                renderUpgradesView();
                updateUI();
                switchView("reactor");
                container?.classList.add("hidden");
                return;
            }

            // Step 1: Arm the button and wait for a second confirmation click
            btnHardReset.dataset.armed = "true";
            btnHardReset.textContent = "Click again to confirm reset!";

            clearTimeout(resetArmTimeout);
            resetArmTimeout = setTimeout(() => {
                btnHardReset.dataset.armed = "false";
                btnHardReset.textContent = "Hard Reset";
            }, 4000);
        });
    }    
}
// Helper to get a subtle background tint from a component or category color
function getUpgradeTintColor(upgrade) {
    let hex = null;
    if (upgrade.targetComponent && COMPONENTS[upgrade.targetComponent]) {
        hex = COMPONENTS[upgrade.targetComponent].color;
    } else if (upgrade.targetCategory) {
        // Match base component category colors
        if (upgrade.targetCategory === "reflector") hex = "#61e5f7";
        else if (upgrade.targetCategory === "sink") hex = "#ffa7b6";
        else if (upgrade.targetCategory === "reactor") hex = "#aff7b1";
        else if (upgrade.targetCategory === "smelter") hex = "#d97736";
        else if (upgrade.targetCategory === "conduit") hex = "#38bdf8";
    }
    if (!hex) return null;

    // Return a translucent 25% alpha tint so level badges and glyphs remain readable
    // If hex is #rrggbb, appending "40" gives ~25% alpha in CSS hex notation
    const cleanHex = hex.slice(0, 7);
    return `${cleanHex}40`;
}
// Render dynamic upgrade cards
export function renderUpgradesView() {
    const container = document.getElementById("upgradesList");
    if (!container) return;
    container.innerHTML = "";

// 1. Discover all unique column keys from UPGRADES definition order
    const COLUMN_ORDER = [...new Set(
        Object.values(UPGRADES).map(u => u.targetComponent || u.targetCategory || u.type)
    )];

    // 2. Map visible upgrades into their respective columns
    const groups = {};
    COLUMN_ORDER.forEach(key => { groups[key] = []; });

    Object.values(UPGRADES).forEach(upgrade => {
        if (!isUpgradeVisible(upgrade.id)) return;
        const groupKey = upgrade.targetComponent || upgrade.targetCategory || upgrade.type;
        if (groups[groupKey]) {
            groups[groupKey].push(upgrade);
        }
    });

    // 3. Render each column in guaranteed order
    COLUMN_ORDER.forEach(groupKey => {
        const items = groups[groupKey];
        const column = document.createElement("div");
        column.classList.add("upgrade-column");

        if (items.length === 0) {
            // Choice A: Reserved placeholder so column position never shifts
            column.classList.add("upgrade-column-empty");
            const placeholder = document.createElement("div");
            placeholder.classList.add("upgrade-btn-placeholder");
            column.appendChild(placeholder);
        } else {

        items.forEach(upgrade => {
            const currentLevel = getUpgradeLevel(upgrade.id);
            const isMax = upgrade.maxLevel !== undefined && currentLevel >= upgrade.maxLevel;
            const canBuy = canPurchaseUpgrade(upgrade.id);
            const cost = getUpgradeCost(upgrade.id);
            const canAfford = canAffordCost(cost);

            const btn = document.createElement("button");
            btn.classList.add("upgrade-btn");

            if (isMax) {
                btn.classList.add("maxed");
            } else if (canAfford) {
                btn.classList.add("affordable");
            } else {
                btn.classList.add("unaffordable");
            }

            if (!canBuy && !isMax) {
                btn.disabled = true;
            }

            // Tint button background
            const tint = getUpgradeTintColor(upgrade);
            if (tint) {
                btn.style.backgroundColor = tint;
            }

            // Central icon/glyph
            const iconSpan = document.createElement("span");
            iconSpan.textContent = upgrade.icon || (upgrade.targetComponent ? "▲" : "⚡");
            btn.appendChild(iconSpan);

            // Level badge in corner
            const badge = document.createElement("span");
            badge.classList.add("upgrade-lvl-badge");
            if (isMax) badge.classList.add("maxed");
            badge.textContent = isMax ? "MAX" : currentLevel;
            btn.appendChild(badge);

            // Click to purchase
            btn.addEventListener("click", () => {
                if (purchaseUpgrade(upgrade.id)) {
                    renderGrid();
                    renderUpgradesView();
                    updateUI();
                }
            });

            // Hover inspection
            btn.addEventListener("mouseenter", () => {
                hoveredUpgrade = upgrade.id;
                updateDescriptionPane();
            });

            btn.addEventListener("mouseleave", () => {
                hoveredUpgrade = null;
                updateDescriptionPane();
            });

            column.appendChild(btn);
        });
        }
        container.appendChild(column);
    });
}
// Refreshes all UI counters, bars, and sidebar text. Global numbers.
export function updateUI() {
    document.getElementById("energy").textContent = `Energy: ${state.energy.toFixed(2)}`;

    const rateElem = document.getElementById("energyRate");
    if (rateElem) {
        const sign = state.energyRate > 0 ? "+" : "";
        rateElem.textContent = `(${sign}${state.energyRate.toFixed(2)}/s)`;
    }
    // Progressive reveal for Alloys header
    const alloysContainer = document.getElementById("alloysContainer");
    if (alloysContainer) {
        if ((state.stats?.totalAlloysProduced || 0) >= 1) {
            alloysContainer.classList.remove("hidden");
            const alloysElem = document.getElementById("alloys");
            if (alloysElem) {
                alloysElem.textContent = `Alloys: ${Math.floor(state.alloys || 0)}`;
            }
            const alloyRateElem = document.getElementById("alloyRate");
            if (alloyRateElem) {
                const alloySign = (state.alloyRate || 0) > 0 ? "+" : "";
                alloyRateElem.textContent = `(${alloySign}${(state.alloyRate || 0).toFixed(2)}/s)`;
            }
        } else {
            alloysContainer.classList.add("hidden");
        }
    }

    updateComponentSelectorIfNeeded();
    updateUpgradesViewIfNeeded();
    updateDescriptionPane();
    updateTileBars();
}










