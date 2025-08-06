// This file defines all the materials and types for blocks in the game.

// --- Create Canvas Textures ---

// Helper function to create a randomized texture on a canvas
function createCanvasTexture(baseColor, shades) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    context.fillStyle = baseColor;
    context.fillRect(0, 0, 16, 16);
    // Add random lighter/darker patches for texture
    for (let i = 0; i < 80; i++) {
        const x = Math.floor(Math.random() * 16);
        const y = Math.floor(Math.random() * 16);
        const shade = shades[Math.floor(Math.random() * shades.length)];
        context.fillStyle = shade;
        context.fillRect(x, y, 2, 2);
    }
    return canvas;
}

// Create canvases for our textured blocks
const grassTopCanvas = createCanvasTexture('#38761d', ['#4a8e32', '#2e6315']);
const dirtCanvas = createCanvasTexture('#8b4513', ['#9c5726', '#6b3510']);
const spongeCanvas = createCanvasTexture('#FFEC8B', ['#FFD700', '#B8860B']);
const leavesCanvas = createCanvasTexture('#228b22', ['#1e781e', '#29a029']); // New leaves texture

// --- Define Materials ---

const materials = {
    // Original Blocks
    stone: new THREE.MeshLambertMaterial({ color: 0x777777 }),
    wood: new THREE.MeshLambertMaterial({ color: 0x5c4033 }),
    sand: new THREE.MeshLambertMaterial({ color: 0xf4a460 }),
    glass: new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.5 }),
    brick: new THREE.MeshLambertMaterial({ color: 0x8b0000 }),
    cobblestone: new THREE.MeshLambertMaterial({ color: 0xa9a9a9 }),
    obsidian: new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    water: new THREE.MeshBasicMaterial({ color: 0x4682b4, transparent: true, opacity: 0.7 }),

    // New Blocks from previous request
    log: new THREE.MeshLambertMaterial({ color: 0x6f4e37 }),
    leaves: new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(leavesCanvas), transparent: true, opacity: 0.8 }), // Leaves now use a texture
    planks: new THREE.MeshLambertMaterial({ color: 0xdeb887 }),
    sandstone: new THREE.MeshLambertMaterial({ color: 0xfade9e }),
    lapis_lazuli_block: new THREE.MeshLambertMaterial({ color: 0x0047ab }),
    gold_block: new THREE.MeshLambertMaterial({ color: 0xffd700 }),
    iron_block: new THREE.MeshLambertMaterial({ color: 0xd3d3d3 }),
    diamond_block: new THREE.MeshLambertMaterial({ color: 0x00ffff }),
    glowstone: new THREE.MeshBasicMaterial({ color: 0xfffacd, emissive: 0xffff00, emissiveIntensity: 1 }),
    bedrock: new THREE.MeshLambertMaterial({ color: 0x3b3b3b }),
    
    // NEW: Sponge materials
    sponge: new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(spongeCanvas) }),

    // --- Textured Materials ---
    dirt: new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(dirtCanvas) }),
    grass: new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(grassTopCanvas) }),

    // NEW: Solid green and textured green materials
    solid_green: new THREE.MeshLambertMaterial({ color: 0x008000 }),
    textured_green: new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(leavesCanvas), transparent: true, opacity: 0.8 }),
};


// Defines the full material set for blocks that have different sides
const multiMaterialBlocks = {
    grass_dirt: [
        materials.dirt, materials.dirt, materials.grass,
        materials.dirt, materials.dirt, materials.dirt
    ]
};

// Maps a block ID to its material or material array. This is the main object the game uses.
const blockTypes = {
    dirt: materials.dirt,
    stone: materials.stone,
    wood: materials.wood,
    sand: materials.sand,
    glass: materials.glass,
    brick: materials.brick,
    cobblestone: materials.cobblestone,
    obsidian: materials.obsidian,
    water: materials.water,
    grass_dirt: multiMaterialBlocks.grass_dirt,
    log: materials.log,
    leaves: materials.leaves,
    planks: materials.planks,
    sandstone: materials.sandstone,
    lapis_lazuli_block: materials.lapis_lazuli_block,
    gold_block: materials.gold_block,
    iron_block: materials.iron_block,
    diamond_block: materials.diamond_block,
    glowstone: materials.glowstone,
    bedrock: materials.bedrock,
    sponge: materials.sponge,

    // NEW: Solid green and textured green block types
    solid_green: materials.solid_green,
    leaves_all_sides: materials.leaves,
};

// Maps block IDs to their display canvases for the UI
const blockCanvases = {
    grass_dirt: grassTopCanvas,
    dirt: dirtCanvas,
    sponge: spongeCanvas,
    leaves_all_sides: leavesCanvas,
};