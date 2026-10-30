/*
 * Application entry point.
 * Bootstraps the grid, runs initial UI renders, and drives the primary game loop timer.
*/

import { state, } from "./state.js";
import { createGrid, } from "./reactor.js";
import { gameTick, } from "./tick.js";
import {
    loadGame,
    saveGame,
} from "./save.js";
import {
    renderGrid,
    updateUI,
    renderComponentSelector,
    initViewSwitcher,
} from "./ui.js";

// Create the initial 5x5 reactor grid & view switcher.
const loaded = loadGame();
if (!loaded) {
    createGrid(5, 5);
}
initViewSwitcher();
// Initial UI & palette render
renderGrid();
renderComponentSelector();
updateUI();

// Primary simulation loop (100ms)
setInterval(() => {

    gameTick();
    //Rebuild full grid DOM only when a tile changes (e.g. destruction or placement)
    if (state.gridChange) {
        renderGrid();
        state.gridChange = false;
    }
    // Refresh telemetry numbers, bars, and inspector panes
    updateUI();

}, state.tickLength);

// Autosave loop: silent save every 15 seconds (15,000 ms)
setInterval(() => {
    saveGame();
}, 15000);




