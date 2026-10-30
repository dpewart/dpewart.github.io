/*
Tracks current state of game. Don't know exactly what that means yet, but it relates to
tick definitions and currently selected components. Apparently also
defines the tick length.
*/

export const state = {
    // Current active view tab ("reactor" | "upgrades")
    currentView: "reactor",    
    //Starting resources. Expected start is 30 energy, higher values useful for fast-start testing.
    energy: 30,
    energyRate: 0, //Instantaneous energy produced per second.
    alloys: 0,
    alloyRate: 0, //Instantaneous alloy produced per second.
    maxRadiationPenalty: 0.9, // Up to 90% power penalty at 100 radiation
    //Timing parameters (10 ticks/sec = 100ms per tick)
    tickRate: 10,
    tickLength: 100,
    //Active tool / placement
    selectedComponent: "basic_reactor",
    //2D grid matrix of tile objects. Initializes gridChange rendering flag as false.
    grid: [],
    gridChange: false,
    gridDimensions: {
        width: 5,
        height: 5,
    },
    //Progression & Unlocks
    unlockedComponents: ["basic_reactor"],
    purchasedUpgrades: { auto_replace_decay: 0 }, // Stores upgradeId: level, e.g. { expand_width: 1 }
    // Master toggle for auto-replace
    autoReplaceEnabled: false,
    // Tracks component IDs unlocked for auto-replacement (e.g., { basic_reactor: true })
    autoReplaceUnlocked: {},
    //Lifetime tracking
    stats: {
        ticks: 0,
        totalEnergyProduced: 0,
        totalAlloysProduced: 0,
    }
};








