/*
Updates the game state for what's expected to happen on each simulation tick.
Means it should run through each tile in the grid, check what it's supposed
to be doing, read the multipliers from other grids, and apply it all.
*/

import { state } from "./state.js";
import { COMPONENTS } from "./components.js";
import { 
    getTileMultiplier,
    getEffectiveComponentStat,
} from "./effects.js";
import {
    clearTile, 
    getOrthogonalNeighbors,
    getReachableReactors,
    canAffordCost,
    deductCost,
    scaleCost,
} from './reactor.js';
import { getUpgradeLevel } from "./upgrades.js"

export function gameTick() {
    if (state.isPaused) return; //Probably works to add a pause function, when that's added.

    if (!state.grid || state.grid.length === 0) return;

    let energyProduced = 0;
    let alloysProduced = 0;
    //Component processing (Decay, Energy, & Radiation)
    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {

            const tile = state.grid[y][x];
            //Makes sure the tile has a component before doing anything.
            if (!tile.component || tile.ghost) {
                continue;
            }
            
            const component = COMPONENTS[tile.component];
            // Primary reactors decay continuously; smelters wear during Stage 1 smelting only
            //Checks the durability for the component, decrement the durability.
            if (component.category === "reactor" && component.decayRate && tile.durability !== null) {
                tile.durability -= component.decayRate / state.tickRate;
            }
            //Resets the tile if durability falls below 0.001. Unless, of course, auto-replace is enabled, as seen in the if statement. Then it auto-replaces the tile at 50% additional cost.
            if (tile.durability !== null && tile.durability <= 0.001) {
            const isUnlocked = state.autoReplaceUnlocked[component.id];
            const replaceCost = scaleCost(component.cost, 1.5);

            if (state.autoReplaceEnabled && isUnlocked && canAffordCost(replaceCost)) {
                deductCost(replaceCost);
                // Reset durability respecting any active upgrades
                tile.durability = getEffectiveComponentStat(component.id, "maxDurability");
            } else {
                clearTile(tile);
                continue;
                }
            }
        }
    }

    // --- STAGE 1A: Compute Gross Reactor Generation ---
    // reactorGen map stores gross energy and radiation available before smelter interception
    const reactorGen = new Map(); // key: "x,y" => { remainingEnergy: number, grossEnergy: number }

    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {
            const tile = state.grid[y][x];
            if (!tile.component || tile.ghost) continue;

            const component = COMPONENTS[tile.component];
            if (component.category === "reactor") {
                const enMultiplier = getTileMultiplier(x, y, "energyOutput");
                const energyOutput = component.energyOutput ?? 0;
                const radPenalty = 1 - ((tile.radiation || 0) / 100 * state.maxRadiationPenalty);
                const grossEnergy = (energyOutput * enMultiplier * radPenalty) / state.tickRate;

                reactorGen.set(`${x},${y}`, {
                    remainingEnergy: grossEnergy,
                    grossEnergy: grossEnergy,
                    enMultiplier: enMultiplier
                });
                // Emit reactor radiation
                const radMultiplier = getTileMultiplier(x, y, "radiationOutput");
                const radOutput = component.radiationOutput ?? 0;
                tile.radiation = Math.max(0, (tile.radiation || 0) + (radOutput * radMultiplier) / state.tickRate);
            }
        }
    }

    // --- STAGE 1B: Smelter Pass 1 - Reach Resolution & Reactor Demand Registration ---
    const smelterTasks = [];
    // Track total requested draw on each reactor { energyDemand: 0, radDemand: 0 }
    const reactorDemands = new Map();

    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {
            const tile = state.grid[y][x];
            if (!tile.component || tile.ghost) continue;

            const component = COMPONENTS[tile.component];
            if (component.category !== "smelter") continue;

            const reqEnergy = (component.requiredEnergy ?? 0) / state.tickRate;
            const reqRad = (component.requiredRadiation ?? 0) / state.tickRate;
            const sources = getReachableReactors(x, y);

            let availEnergy = 0;
            let availRad = 0;

            for (const src of sources) {
                const eff = src.efficiency ?? 1.0;
                const rData = reactorGen.get(`${src.x},${src.y}`);
                if (rData) availEnergy += rData.remainingEnergy * eff;
                availRad += (src.tile.radiation || 0) * eff;
            }

            // Ideal unconstrained throttle
            const energyRatio = reqEnergy > 0 ? Math.min(1.0, availEnergy / reqEnergy) : 1.0;
            const radRatio = reqRad > 0 ? Math.min(1.0, availRad / reqRad) : 1.0;
            const targetThrottle = Math.min(energyRatio, radRatio);

            const targetEnergyDelivered = reqEnergy * targetThrottle;
            const targetRadDelivered = Math.min(availRad, reqRad); // Draw full capacity

            // Register demand on each source
            const requestedDraws = [];
            for (const src of sources) {
                const key = `${src.x},${src.y}`;
                if (!reactorDemands.has(key)) {
                    reactorDemands.set(key, { energyDemand: 0, radDemand: 0 });
                }
                const demand = reactorDemands.get(key);

                const rData = reactorGen.get(key);
                const rEnergy = rData ? rData.remainingEnergy : 0;
                const rRad = src.tile.radiation || 0;

                // Demand at reactor tiles before transmission efficiency
                const eDraw = availEnergy > 0 ? (rEnergy / availEnergy) * targetEnergyDelivered : 0;
                const rDraw = availRad > 0 ? (rRad / availRad) * targetRadDelivered : 0;

                demand.energyDemand += eDraw;
                demand.radDemand += rDraw;

                requestedDraws.push({ src, key, eDraw, rDraw, eff: src.efficiency ?? 1.0 });
            }

            smelterTasks.push({
                tile, component, x, y,
                reqEnergy, reqRad,
                energyRatio, radRatio,
                targetThrottle,
                requestedDraws
            });
        }
    }

    // --- STAGE 1C: Smelter Pass 2 - Proportional Fulfillment & Execution ---
    for (const task of smelterTasks) {
        const { tile, component, reqEnergy, reqRad, requestedDraws } = task;

        let deliveredEnergy = 0;
        let deliveredRad = 0;

        // 1. Calculate actual delivered energy & radiation scaled by source capacity
        for (const item of requestedDraws) {
            const demand = reactorDemands.get(item.key);
            const rData = reactorGen.get(item.key);
            const srcTile = item.src.tile;

            // Scale factor: if total demand exceeds supply, scale down proportionally
            const eScale = demand.energyDemand > 0 ? Math.min(1.0, (rData ? rData.remainingEnergy : 0) / demand.energyDemand) : 1.0;
            const rScale = demand.radDemand > 0 ? Math.min(1.0, (srcTile.radiation || 0) / demand.radDemand) : 1.0;

            const actualEDraw = item.eDraw * eScale;
            const actualRDraw = item.rDraw * rScale;

            // Deduct at source terminals
            if (rData) rData.remainingEnergy = Math.max(0, rData.remainingEnergy - actualEDraw);
            if (srcTile.radiation) srcTile.radiation = Math.max(0, srcTile.radiation - actualRDraw);

            deliveredEnergy += actualEDraw * item.eff;
            deliveredRad += actualRDraw * item.eff;
        }

        // 2. Compute final actual throttle from delivered feeds
        const actualERatio = reqEnergy > 0 ? Math.min(1.0, deliveredEnergy / reqEnergy) : 1.0;
        const actualRRatio = reqRad > 0 ? Math.min(1.0, deliveredRad / reqRad) : 1.0;
        const throttle = Math.min(actualERatio, actualRRatio);

        // Store telemetry for UI inspector
        tile.throttleFactor = throttle;
        tile.energyRatio = actualERatio;
        tile.radRatio = actualRRatio;
        // Bottleneck check using raw unthrottled supply with 2% deadband
        const supplyDiff = task.energyRatio - task.radRatio;
        if (throttle >= 1.0) {
            tile.limitingReagent = "optimal";
        } else if (Math.abs(supplyDiff) < 0.02) {
            tile.limitingReagent = "balanced";
        } else if (supplyDiff < 0) {
            tile.limitingReagent = "energy";
        } else {
            tile.limitingReagent = "radiation";
        }

        if (throttle > 0) {
            const radConsumed = reqRad * throttle;

            // 3. Radiation Byproduct: unconsumed drawn radiation vents onto Smelter tile
            const byproduct = Math.max(0, deliveredRad - radConsumed);
            if (byproduct > 0) {
                tile.radiation = Math.min(100, (tile.radiation || 0) + byproduct);
            }

            // 4. Alloy Production
            const produced = ((component.alloyOutput ?? 0) * throttle) / state.tickRate;
            alloysProduced += produced;
            tile.lastAlloyProduced = produced * state.tickRate;

            // 5. Smelter Wear (proportional to production, 0 when idle)
            const wear = ((component.decayRate ?? 1) * throttle) / state.tickRate;
            if (tile.durability !== null) {
                tile.durability = Math.max(0, tile.durability - wear);

                if (tile.durability <= 0.001) {
                    const isUnlocked = state.autoReplaceUnlocked[component.id];
                    const replaceCost = scaleCost(component.cost, 1.5);
                    if (state.autoReplaceEnabled && isUnlocked && canAffordCost(replaceCost)) {
                        deductCost(replaceCost);
                        tile.durability = getEffectiveComponentStat(component.id, "maxDurability");
                    } else {
                        clearTile(tile);
                    }
                }
            }
        } else {
            tile.lastAlloyProduced = 0;
        }
    }

    // --- STAGE 1D: Surplus Energy, Reactor Radiation Output & Sinks ---
    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {
            const tile = state.grid[y][x];
            if (!tile.component || tile.ghost) continue;

            const component = COMPONENTS[tile.component];


            if (component.category === "reactor") {
                const rData = reactorGen.get(`${x},${y}`);
                const surplus = rData ? rData.remainingEnergy : 0;
                energyProduced += surplus;
                tile.lastEnergyProduced = (rData ? rData.grossEnergy : 0) * state.tickRate;
                tile.enMultiplier = rData ? rData.enMultiplier : 1;
            }

            // Active Sink Siphoning
            if (component.radiationOutput < 0) {
                const effectiveRadOutput = getEffectiveComponentStat(component.id, "radiationOutput") ?? component.radiationOutput;
                const drainCapacity = Math.abs(effectiveRadOutput) / state.tickRate;
                const radNeighbors = getOrthogonalNeighbors(x, y)
                    .map(n => state.grid[n.y][n.x])
                    .filter(nTile => nTile && nTile.radiation > 0);

                if (radNeighbors.length > 0) {
                    const hasInducedDraw = getUpgradeLevel("induced_draw") > 0;
                    const conversionLevel = getUpgradeLevel("radiolytic_conversion");
                    radNeighbors.forEach(nTile => {
                        let limit = drainCapacity;
                        // Upgrade 1: Linear gradient from +5% at 0 rad to +50% at 100 rad
                        if (hasInducedDraw) {
                            limit *= 1.05 + 0.45 * (nTile.radiation / 100);
                        }
                        const actualDrain = Math.min(nTile.radiation, limit);
                        nTile.radiation -= actualDrain;

                        if (conversionLevel > 0) {
                            energyProduced += actualDrain * (0.05 * conversionLevel);
                        }
                    });
                }
            }
        }
    }

    //Stage 2: Radiation diffusion between adjacent occupied tiles.
    const diffusionRate = 0.20; //20% per second spread rate.
    const gridHeight = state.grid.length;
    const gridWidth = state.grid[0].length;
    const diffusionBuffer = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));

    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {
            const tile = state.grid[y][x];
            if (!tile || tile.radiation <= 0) continue;
            //DIffuse only to occupied neighbor tiles, not ghosts..
            const validNeighbors = getOrthogonalNeighbors(x, y).filter(n => state.grid[n.y][n.x].component !== null && !state.grid[n.y][n.x].ghost);
            
            if (validNeighbors.length > 0) {
                const amountToDiffuse = (tile.radiation * diffusionRate) / state.tickRate;
                const perNeighbor = amountToDiffuse / validNeighbors.length;

                validNeighbors.forEach(n => {
                    diffusionBuffer[n.y][n.x] += perNeighbor;
                    diffusionBuffer[y][x] -= perNeighbor;
                });
            }
        }
    }
        // Apply diffusion and clamp tile radiation between 0 and 100
        for (let y = 0; y < state.grid.length; y++) {
            for (let x = 0; x < state.grid[y].length; x++) {
                const tile = state.grid[y][x];
                if (tile) {
                    tile.radiation += diffusionBuffer[y][x];
                    tile.radiation = Math.max(0, Math.min(100, tile.radiation));
            }
        }
    }
        
    //Update global energy value & lifetime stats.
    state.energy += energyProduced;
    state.alloys = (state.alloys || 0) + alloysProduced;

    let currentRate = energyProduced * state.tickRate;
    // If player cannot afford a basic reactor and has zero active power generation (softlock prevention)
    if (state.energy < COMPONENTS.basic_reactor.cost && energyProduced === 0) {
        // Trickle in minimal auxiliary power (e.g. 0.5 or 1 energy/sec)
        state.energy += (1 / state.tickRate);
        currentRate = 1.0; // Reflects active auxiliary trickle
    }

    state.energyRate = currentRate;
    state.alloyRate = alloysProduced * state.tickRate;

    if (state.stats) { //More intended for lifetime, whole-game stats rather than instantaneous numbers.
        state.stats.totalEnergyProduced += energyProduced;
        state.stats.totalAlloysProduced = (state.stats.totalAlloysProduced || 0) + alloysProduced;
        state.stats.ticks++;
    }
    //Check for ghosts to auto-build,
    for (let y = 0; y < state.grid.length; y++) {
        for (let x = 0; x < state.grid[y].length; x++) {
            const tile = state.grid[y][x];
            if (tile && tile.ghost && tile.component) {
                const comp = COMPONENTS[tile.component];
                if (comp && canAffordCost(comp.cost)) {
                    deductCost(comp.cost);
                    tile.ghost = false;
                    tile.durability = getEffectiveComponentStat(comp.id, "maxDurability");
                    state.gridChange = true;
                }
            }
        }
    }

    
}










