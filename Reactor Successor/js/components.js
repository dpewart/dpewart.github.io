/*Component catalog
Values are on a per-second basis, code adjusts for tick rate.
Defines the cost and metadata for each placeable reactor component.
 * @typedef {Object} ComponentDefinition
    * @property {string} category - Grouping of components with the same purpose.
    * @property {string} glyph - Single-character symbol rendered on the tile
    * @property {string} id - Unique identifier matching registry key
    * @property {string} name - Display name for UI
    * @property {number} cost - Energy/resource cost to place
    * @property {number} energyOutput - Base energy production
    * @property {string} color - Hex color code string for rendering
    * @property {number} maxDurability - Total lifetime
    * @property {number} decayRate - Rate at which lifetime depletes (reactors: continuous; smelters: production-scaled)
    * @property {number} radiationOutput - Base radiation output
    * @property {number} requiredEnergy - Base energy consumption rate at 100% throttle (smelters)
    * @property {number} requiredRadiation - Base radiation siphon at 100% throttle (smelters)
    * @property {number} alloyOutput - Base alloy output rate at 100% throttle (smelters)
    * @typedef {Object} unlock
        * @property {Object} [cost] - Resources consumed upon unlocking (e.g. { energy: 250 })
        * @property {Object} [requires] - Conditions that must be met before unlock is possible, looks like it can target almost any variable.
        * @property {number} [requires.totalEnergy] - Lifetime energy milestone needed
        * @property {string[]} [requires.components] - Prerequisite component IDs needed
        * @property {string[]} [requires.upgrades] - Prerequisite upgrade IDs needed
    * @typedef {Object} effects
        * @property {string} type - Effect identifier (e.g., 'adjacencyEffect')
        * @property {string} target - Describes what property is being affected
        * @property {number} value - Numerical multiplier or additive factor applied to adjacent tiles
*/
// Reactors are the generators. They make power, and radiation.
export const COMPONENTS = {
    basic_reactor: {
        category: "reactor",
        glyph: "⚡",
        id: "basic_reactor",
        name: "Basic Reactor",
        cost: 10,
        energyOutput: 1,
        color: "#aff7b1",
        maxDurability: 15,
        decayRate: 1,
        radiationOutput: 3,
        effects: [{
                type: "adjacencyEffect",
                target: "radiationOutput",
                value: 0.2
            }],
    },
    better_reactor: {
        category: "reactor",
        glyph: "⚡",
        id: "better_reactor",
        name: "Better Reactor",
        cost: 1200,
        energyOutput: 18,
        color: "#50b954",
        maxDurability: 100,
        decayRate: 1,
        radiationOutput: 36,
        effects: [{
                type: "adjacencyEffect",
                target: "radiationOutput",
                value: 0.2
            }],
        unlock: {
            cost: { energy: 600 },
            requires: {
                totalEnergy: 1200,
                components: ["basic_reactor"]
            }
        }
    },
    best_reactor: {
        category: "reactor",
        glyph: "⚡",
        id: "best_reactor",
        name: "Best Reactor",
        cost: 120000,
        energyOutput: 300,
        color: "#136d16",
        maxDurability: 600,
        decayRate: 1,
        radiationOutput: 240,
        effects: [{
                type: "adjacencyEffect",
                target: "radiationOutput",
                value: 0.2
            }],
        unlock: {
            cost: { energy: 60000 },
            requires: {
                totalEnergy: 120000,
                components: ["better_reactor"]
            }
        }
    },
// Reflectors buff reactors. However, they disproportionately increase radiation.
    basic_reflector: {
        category: "reflector",
        glyph: "🪨",
        id: "basic_reflector",
        name: "Basic Reflector",
        cost: 50,
        color: "#61f7be ",
        unlock: {
            cost: { energy: 25 },
            requires: {
                totalEnergy: 100
            }
        },
        effects: [
            {
                type: "adjacencyEffect",
                target: "energyOutput",
                value: 0.35
            },
            {
                type: "adjacencyEffect",
                target: "radiationOutput",
                value: 0.5
            }
        ]
    },
        better_reflector: {
        category: "reflector",
        glyph: "🪨",
        id: "better_reflector",
        name: "Better Reflector",
        cost: 1000,
        color: "#61e5f7 ",
        unlock: {
            cost: { energy: 700 },
            requires: {
                totalEnergy: 1400
            }
        },
        effects: [
            {
                type: "adjacencyEffect",
                target: "energyOutput",
                value: 0.75
            },
            {
                type: "adjacencyEffect",
                target: "radiationOutput",
                value: 1.25
            }
        ]
    },
    best_reflector: {
        category: "reflector",
        glyph: "🪨",
        id: "best_reflector",
        name: "Best Reflector",
        cost: 25000,
        color: "#619cf7 ",
        unlock: {
            cost: { energy: 50000 },
            requires: {
                totalEnergy: 100000
            }
        },
        effects: [
            {
                type: "adjacencyEffect",
                target: "energyOutput",
                value: 1.5
            },
            {
                type: "adjacencyEffect",
                target: "radiationOutput",
                value: 3
            }
        ]
    },
// Sinks remove radiation to keep the reactor running efficiently.
    basic_sink: {
        category: "sink",
        glyph: "🧽",
        id: "basic_sink",
        name: "Basic Sink",
        cost: 20,
        color: "#ffdae0",
        radiationOutput: -3,
        unlock: {
            cost: { energy: 50 },
            requires: {
                totalEnergy: 60
            }
        },
    },
    better_sink: {
        category: "sink",
        glyph: "🧽",
        id: "better_sink",
        name: "Better Sink",
        cost: 200,
        color: "#ffa7b6",
        radiationOutput: -30,
        unlock: {
            cost: { energy: 500 },
            requires: {
                totalEnergy: 1000
            }
        },
    },
    best_sink: {
        category: "sink",
        glyph: "🧽",
        id: "best_sink",
        name: "Best Sink",
        cost: 30000,
        color: "#ff748c",
        radiationOutput: -200,
        unlock: {
            cost: { energy: 15000 },
            requires: {
                totalEnergy: 80000
            }
        },
    },
// Smelter - Converts siphoned energy and radiation into alloys
    smelter_1: {
        category: "smelter",
        glyph: "⚒",
        id: "smelter_1",
        name: "Arc Smelter",
        cost: { energy: 50000 },
        color: "#ead1c1",
        requiredEnergy: 200,       // 10 E/s needed at 100% capacity
        requiredRadiation: 200,    // 15 Rad/s siphoned needed at 100% capacity
        alloyOutput: 1,           // 1 Alloy/s produced at 100% capacity
        maxDurability: 120,       // 120 seconds of full-speed operation before crucible replacement
        decayRate: 1,             // 1 durability/s consumed at 100% throttle; 0 when idle
        unlock: {
            cost: { energy: 25000 },
            requires: {
                totalEnergy: 100000,
                components: ["better_reactor"]
            }
        }
    },
        smelter_2: {
        category: "smelter",
        glyph: "⚒",
        id: "smelter_2",
        name: "Radiant Smelter",
        cost: { energy: 500000 },
        color: "#d97736",          // Add 7a350d for the advanced one
        requiredEnergy: 2000,       // 2000 E/s and Rad/s needed at 100% capacity
        requiredRadiation: 3000,
        alloyOutput: 20,           // 20 Alloy/s produced at 100% capacity
        maxDurability: 200,       // 200 seconds of full-speed operation before crucible replacement
        decayRate: 1,             // 1 durability/s consumed at 100% throttle; 0 when idle
        unlock: {
            cost: { energy: 250000 },
            requires: {
                totalEnergy: 1000000,
                components: ["smelter_1", "best_reactor"]
            }
        }
    },
// Conduit - 1-hop passive bus extending smelter reach to reactors.
    conduit_1: {
        category: "conduit",
        glyph: "☵",
        id: "conduit_1",
        name: "Copper Duct",
        cost: { energy: 25000 },
        color: "#7dd3fc",
        transmissionEfficiency: 0.85,
        unlock: {
            cost: { energy: 12500 },
            requires: {
                totalEnergy: 50000,
                components: ["smelter_1"]
            }
        }
    },
    conduit_2: {
        category: "conduit",
        glyph: "☵",
        id: "conduit_2",
        name: "Cryo Bus",
        cost: { energy: 1000000, alloys: 10 },
        color: "#38bdf8",
        transmissionEfficiency: 1,
        unlock: {
            cost: { energy: 500000 },
            requires: {
                totalEnergy: 2000000,
                components: ["conduit_1"]
            }
        }
    },
    conduit_3: {
        category: "conduit",
        glyph: "☵",
        id: "conduit_3",
        name: "Inductive Bus",
        cost: { energy: 10000000, alloys: 500 },
        color: "#0284c7",           // Deep cobalt teal
        transmissionEfficiency: 1.15,
        unlock: {
            cost: { energy: 2500000, alloys: 250 },
            requires: { totalEnergy: 10000000, components: ["conduit_2"] }
        }
    },

};








