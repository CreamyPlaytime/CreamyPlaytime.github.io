let scene, camera, renderer, controls;
const blocks = new Map();
const allBlocks = [];
const blockSize = 1;
const playerHeight = 1.8;
const playerRadius = 0.4;
const moveSpeed = 5.0;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const jumpPower = 0.3;
const gravity = -0.01;
let canJump = true;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let blockUpdateQueue = [];
let hotbarSlots = Array.from(document.querySelectorAll('#hotbar .slot'));
let selectedBlockId = hotbarSlots[0].dataset.blockId;
const clock = new THREE.Clock();
let raycaster;
let playerArm;
let isInventoryOpen = false;
document.getElementById('save-world-btn').addEventListener('click', saveWorld);
document.getElementById('load-world-btn').addEventListener('click', loadWorld);
let isTouchDevice = false;
let joystick, joystickX, joystickY, touchCameraX, touchCameraY;
let isMovingJoystick = false;
const joystickRadius = 50;
const touchSensitivity = 0.005;
const touchLookZone = { startX: window.innerWidth / 2, startY: 0 };
let isPlaying = false;
let isControllerConnected = false;
let lastBumperPressTime = 0;
const bumperDelay = 200;
const controllerSensitivity = 0.04;
const joystickDeadzone = 0.1;
let ltPressedLastFrame = false;
let rtPressedLastFrame = false;
// --- NEW DEBOUNCE FUNCTION ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}
// --- NEW DEBOUNCED TOGGLE INVENTORY FUNCTION ---
const debouncedToggleInventory = debounce(toggleInventory, 200);
// --- UPDATE EVENT LISTENERS TO USE DEBOUNCE FUNCTION ---
document.getElementById('inventory-btn-menu').addEventListener('click', debouncedToggleInventory);
document.getElementById('inventory-btn-game').addEventListener('click', debouncedToggleInventory);
// NEW: Conditionally add touch listeners
if (isTouchDevice) {
    document.getElementById('inventory-btn-menu').addEventListener('touchstart', (event) => { event.stopPropagation(); debouncedToggleInventory(); });
    document.getElementById('inventory-btn-game').addEventListener('touchstart', (event) => { event.stopPropagation(); debouncedToggleInventory(); });
    document.getElementById('esc-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); onEscTouch(event); });
}
document.getElementById('esc-btn').addEventListener('click', () => { controls.unlock(); });
init();
animate();
function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
}
function getSlotBackgroundStyle(blockId) {
    const canvas = blockCanvases[blockId];
    if (canvas) {
        return { backgroundImage: `url(${canvas.toDataURL()})` };
    }
    const material = blockTypes[blockId];
    if (material && material.color) {
        return { backgroundColor: material.color.getStyle(), opacity: material.opacity || 1 };
    }
    return {};
}
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 750);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = playerHeight;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);
    isTouchDevice = isMobile();
    const infoElement = document.getElementById('info');
    const inGameUIElement = document.getElementById('in-game-ui');
    const touchControlsElement = document.getElementById('touch-controls');
    const hotbarElement = document.getElementById('hotbar');
    const inventoryGrid = document.getElementById('inventory-grid');
    hotbarSlots.forEach(slot => {
        const blockId = slot.dataset.blockId;
        const styles = getSlotBackgroundStyle(blockId);
        for (const style in styles) {
            slot.style[style] = styles[style];
        }
    });
    if (inventoryGrid) {
        Object.keys(blockTypes).forEach(blockId => {
            const slot = document.createElement('div');
            slot.classList.add('slot');
            slot.dataset.blockId = blockId;
            const styles = getSlotBackgroundStyle(blockId);
            for (const style in styles) {
                slot.style[style] = styles[style];
            }
            slot.draggable = true;
            inventoryGrid.appendChild(slot);
        });
    }
    initDragAndDrop();
    if (isTouchDevice) {
        infoElement.style.display = 'block';
        hotbarElement.style.display = 'flex';
        touchControlsElement.style.display = 'none';
        inGameUIElement.style.display = 'none';
        document.getElementById('mouse-info').style.display = 'none';
        document.getElementById('touch-info').style.display = 'block';
        initTouchControls();
    } else {
        document.getElementById('mouse-info').style.display = 'block';
        document.getElementById('touch-info').style.display = 'none';
        inGameUIElement.style.display = 'none';
        controls = new THREE.PointerLockControls(camera, document.body);
    controls.addEventListener('lock', () => {
        infoElement.style.display = 'none';
        if (isTouchDevice) inGameUIElement.style.display = 'flex';
        canJump = true;
        isPlaying = true;
    });
    controls.addEventListener('unlock', () => {
        infoElement.style.display = 'block';
        if (isTouchDevice) inGameUIElement.style.display = 'none';
        isPlaying = false;
    });
        document.addEventListener('click', () => { if (!controls.isLocked) controls.lock(); }, false);
    }
    raycaster = new THREE.Raycaster();
    const ambientLight = new THREE.AmbientLight(0xcccccc);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);
    createFloor();
    createPlayerArm();
    if (!isTouchDevice) {
        document.addEventListener('keydown', onKeyDown, false);
        document.addEventListener('keyup', onKeyUp, false);
        document.addEventListener('mousedown', onMouseDown, false);
    }
    window.addEventListener('gamepadconnected', (event) => {
        isControllerConnected = true;
        if (!isPlaying) {
            infoElement.style.display = 'none';
            isPlaying = true;
        }
    });
    window.addEventListener('gamepaddisconnected', (event) => {
        isControllerConnected = false;
        if (!controls || !controls.isLocked) {
            infoElement.style.display = 'block';
            inGameUIElement.style.display = 'none';
            isPlaying = false;
        }
    });
    document.getElementById('save-world-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); saveWorld(); });
    document.getElementById('load-world-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); loadWorld(); });
    document.getElementById('esc-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); onEscTouch(event); });
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('contextmenu', (event) => event.preventDefault(), false);
    if (isTouchDevice) {
        document.getElementById('game-container').addEventListener('touchstart', function(e) {
            const isTapOnUI = e.target.closest('#info') || e.target.closest('#hotbar') || e.target.closest('#touch-controls') || e.target.closest('#in-game-ui') || e.target.closest('#inventory-ui');
            if (!isPlaying && !isTapOnUI) {
                e.preventDefault();
                isPlaying = true;
                document.getElementById('info').style.display = 'none';
                document.getElementById('in-game-ui').style.display = 'flex';
                document.getElementById('touch-controls').style.display = 'flex';
                document.getElementById('hotbar').style.display = 'flex';
            }
        });
        document.getElementById('inventory-ui').addEventListener('touchstart', function(e) {
            e.stopPropagation();
        });
    }
}
// Function to toggle the inventory, now with better logic for mobile.
function toggleInventory() {
    isInventoryOpen = !isInventoryOpen;
    document.getElementById('inventory-ui').style.display = isInventoryOpen ? 'block' : 'none';
    if (isInventoryOpen) {
        isPlaying = false;
        if (controls && controls.isLocked) { controls.unlock(); }
        // Hide touch controls when inventory is open on mobile
        if (isTouchDevice) {
            document.getElementById('touch-controls').style.display = 'none';
        }
    } else {
        isPlaying = true;
        if (controls && !controls.isLocked) { controls.lock(); }
        // Show appropriate UI based on device when inventory is closed
        if (isTouchDevice) {
            document.getElementById('touch-controls').style.display = 'flex';
        }
    }
}
function createGrassBlock(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x * blockSize, y * blockSize, z * blockSize);
    const dirtGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const dirtMesh = new THREE.Mesh(dirtGeometry, materials.dirt);
    dirtMesh.userData.isCollisionBlock = true;
    group.add(dirtMesh);
    const grassTopGeometry = new THREE.BoxGeometry(blockSize + 0.01, blockSize * 0.1, blockSize + 0.01);
    const grassTopMesh = new THREE.Mesh(grassTopGeometry, materials.grass);
    grassTopMesh.position.y = blockSize * 0.505;
    grassTopMesh.userData.isCollisionBlock = false;
    group.add(grassTopMesh);
    group.userData.blockId = 'grass_dirt';
    scene.add(group);
    blocks.set(`${x},${y},${z}`, group);
    allBlocks.push(group);
}
function addBlock(x, y, z, blockId) {
    // NEW: Check if we are trying to add a block at or below bedrock level
    const bedrockLevel = -3;
    if (blockId === 'water' && y <= bedrockLevel) {
        console.log('Cannot place water at or below bedrock level.');
        return;
    }
    const key = `${x},${y},${z}`;
    const existingBlock = blocks.get(key);
    if (existingBlock && existingBlock.userData.blockId === 'water' && blockId === 'water') {
        if(existingBlock.userData.fluidVolume < 1.0) {
            existingBlock.userData.fluidVolume = 1.0;
            existingBlock.scale.y = existingBlock.userData.fluidVolume;
            existingBlock.position.y = (y * blockSize) + (blockSize * existingBlock.userData.fluidVolume) / 2 - blockSize * 0.5;
            existingBlock.material.opacity = 0.7 + existingBlock.userData.fluidVolume * 0.3;
            existingBlock.userData.isWaterSource = true;
            blockUpdateQueue.push({x, y, z});
        }
        return;
    }
    if (blocks.has(key)) {
        if (blockId !== 'water' && existingBlock.userData.blockId === 'water') {
            removeBlock(x, y, z);
            addBlock(x, y, z, blockId);
        }
        return;
    }
    if (blockId === 'grass_dirt') {
        createGrassBlock(x, y, z);
        return;
    }
    let materialToUse = blockTypes[blockId];
    if (!materialToUse) {
        console.warn(`Unknown block ID: ${blockId}`);
        return;
    }
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const mesh = new THREE.Mesh(geometry, materialToUse);
    mesh.position.set(x * blockSize, y * blockSize, z * blockSize);
    mesh.userData.blockId = blockId;
    if (blockId === 'water') {
        mesh.userData.fluidVolume = 1.0;
        mesh.userData.isWaterSource = true;
        mesh.userData.waterSpreadLimit = 1;
        mesh.material = new THREE.MeshBasicMaterial({ color: 0x4682b4, transparent: true, opacity: 0.8 });
        blockUpdateQueue.push({x, y, z});
    }
    if (blockId === 'sponge') {
        blockUpdateQueue.push({x, y, z});
    }
    scene.add(mesh);
    blocks.set(key, mesh);
    allBlocks.push(mesh);
}
function removeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    const block = blocks.get(key);
    if (block) {
        if (block.userData.blockId === 'bedrock') return;
        scene.remove(block);
        blocks.delete(key);
        const index = allBlocks.indexOf(block);
        if (index > -1) { allBlocks.splice(index, 1); }
        const neighbors = [{x:x+1,y:y,z:z}, {x:x-1,y:y,z:z}, {x:x,y:y+1,z:z}, {x:x,y:y-1,z:z}, {x:x,y:y,z:z+1}, {x:x,y:y,z:z-1}];
        neighbors.forEach(n => blockUpdateQueue.push(n));
    }
}
function processBlockUpdates() {
    if (blockUpdateQueue.length === 0) return;
    const {x, y, z} = blockUpdateQueue.shift();
    const key = `${x},${y},${z}`;
    const block = blocks.get(key);
    if (!block || (block.userData.blockId !== 'water' && block.userData.blockId !== 'sponge')) return;
    if (block.userData.blockId === 'water') {
        let fluidVolume = block.userData.fluidVolume;
        const isWaterSource = block.userData.isWaterSource;
        let waterSpreadLimit = block.userData.waterSpreadLimit;
        const keyBelow = `${x},${y-1},${z}`;
        const blockBelow = blocks.get(keyBelow);
        // NEW: Check for bedrock before water falls
        if (blockBelow && blockBelow.userData.blockId === 'bedrock') {
            return;
        }
        if (blockBelow && blockBelow.userData.blockId === 'water' && blockBelow.userData.fluidVolume < 1.0) {
            const combinedVolume = blockBelow.userData.fluidVolume + fluidVolume;
            blockBelow.userData.fluidVolume = Math.min(1.0, combinedVolume);
            if (blockBelow.userData.isWaterSource === false) {
                blockBelow.userData.isWaterSource = isWaterSource || blockBelow.userData.isWaterSource;
            }
            if (!isWaterSource) {
                removeBlock(x, y, z);
                blockUpdateQueue.push({x, y:y-1, z});
            }
            return;
        }
        if (!blockBelow) {
            if (isWaterSource) {
                addBlock(x, y-1, z, 'water');
                const newWater = blocks.get(keyBelow);
                if (newWater) {
                    newWater.userData.fluidVolume = 0.5;
                    newWater.userData.isWaterSource = false;
                    newWater.userData.waterSpreadLimit = waterSpreadLimit;
                    blockUpdateQueue.push({x, y:y-1, z});
                }
            } else {
                const nextVolume = fluidVolume;
                const nextSpread = waterSpreadLimit;
                removeBlock(x,y,z);
                addBlock(x, y-1, z, 'water');
                const newWater = blocks.get(keyBelow);
                if(newWater){
                    newWater.userData.fluidVolume = nextVolume;
                    newWater.userData.isWaterSource = false;
                    newWater.userData.waterSpreadLimit = nextSpread;
                    blockUpdateQueue.push({x, y:y-1, z});
                }
            }
        } else {
            const neighbors = [{x:x+1,y:y,z:z}, {x:x-1,y:y,z:z}, {x:x,y:y,z:z+1}, {x:x,y:y,z:z-1}];
            if (waterSpreadLimit > 0 && blockBelow.userData.blockId !== 'water') {
                neighbors.forEach(n => {
                    const neighborBlock = blocks.get(`${n.x},${n.y},${n.z}`);
                    if (!neighborBlock) {
                        addBlock(n.x, n.y, n.z, 'water');
                        const newWater = blocks.get(`${n.x},${n.y},${n.z}`);
                        if (newWater) {
                            // NEW: Set new water block spread limit to 0
                            newWater.userData.fluidVolume = 0.5;
                            newWater.userData.isWaterSource = false;
                            newWater.userData.waterSpreadLimit = 0;
                            blockUpdateQueue.push(n);
                        }
                    }
                });
            }
        }
        if (fluidVolume <= 0.1 && !isWaterSource) {
            removeBlock(x, y, z);
        } else {
            block.scale.y = fluidVolume;
            block.position.y = (y * blockSize) + (blockSize * fluidVolume) / 2 - blockSize * 0.5;
            block.material.opacity = 0.7 + fluidVolume * 0.3;
            if (isWaterSource) {
                blockUpdateQueue.push({x, y, z});
            }
        }
    }
    // Sponge logic
    if (block.userData.blockId === 'sponge') {
        const toCheck = [{x, y, z}];
        const checked = new Set([key]);
        const spongeLimit = 65;
        let waterAbsorbed = false;
        while(toCheck.length > 0 && checked.size < spongeLimit) {
            const currentPos = toCheck.shift();
            const neighbors = [
                {x: currentPos.x + 1, y: currentPos.y, z: currentPos.z},
                {x: currentPos.x - 1, y: currentPos.y, z: currentPos.z},
                {x: currentPos.x, y: currentPos.y + 1, z: currentPos.z},
                {x: currentPos.x, y: currentPos.y - 1, z: currentPos.z},
                {x: currentPos.x, y: currentPos.y, z: currentPos.z + 1},
                {x: currentPos.x, y: currentPos.y, z: currentPos.z - 1},
            ];
            for (const n of neighbors) {
                const nKey = `${n.x},${n.y},${n.z}`;
                if (checked.has(nKey)) continue;
                checked.add(nKey);
                const neighborBlock = blocks.get(nKey);
                if (neighborBlock && neighborBlock.userData.blockId === 'water') {
                    removeBlock(n.x, n.y, n.z);
                    waterAbsorbed = true;
                    blockUpdateQueue.push(n);
                    toCheck.push(n);
                }
            }
        }
    }
}
function createFloor() {
    const floorSize = 20;
    const bedrockLevel = -3;
    for (let x = -floorSize; x <= floorSize; x++) {
        for (let z = -floorSize; z <= floorSize; z++) {
            addBlock(x, 0, z, 'grass_dirt');
            addBlock(x, -1, z, 'dirt');
            addBlock(x, -2, z, 'stone');
            addBlock(x, bedrockLevel, z, 'bedrock');
        }
    }
}
function animate() {
    requestAnimationFrame(animate);
    if (!isInventoryOpen) {
      processBlockUpdates();
      if (isControllerConnected) { handleGamepadInput(); }
    }
    const delta = clock.getDelta();
    if (isPlaying) {
        const skyLimit = playerHeight + 50;
        if (camera.position.y > skyLimit) {
            camera.position.y = playerHeight;
            velocity.y = 0;
        }
        const horizontalMovement = new THREE.Vector3();
        if (moveForward) horizontalMovement.z -= 1;
        if (moveBackward) horizontalMovement.z += 1;
        if (moveLeft) horizontalMovement.x -= 1;
        if (moveRight) horizontalMovement.x += 1;
        if (horizontalMovement.length() > 0) {
            horizontalMovement.normalize().multiplyScalar(moveSpeed * delta);
            const zSpeed = -horizontalMovement.z;
            const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const potentialNewX = camera.position.x + (forwardVector.x * zSpeed + rightVector.x * horizontalMovement.x);
            const potentialNewZ = camera.position.z + (forwardVector.z * zSpeed + rightVector.z * horizontalMovement.x);
            let canMoveX = true, canMoveZ = true;
            const playerBoxX = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(potentialNewX, camera.position.y, camera.position.z), new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2));
            for (const b of allBlocks) {
                if (b.userData.blockId === 'water') continue;
                const collisionMesh = b instanceof THREE.Group ? b.children.find(c => c.userData.isCollisionBlock) : b;
                if (!collisionMesh) continue;
                const blockBox = new THREE.Box3().setFromObject(collisionMesh);
                if (playerBoxX.intersectsBox(blockBox.expandByScalar(-0.01))) { canMoveX = false; break; }
            }
            const playerBoxZ = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(camera.position.x, camera.position.y, potentialNewZ), new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2));
            for (const b of allBlocks) {
                if (b.userData.blockId === 'water') continue;
                const collisionMesh = b instanceof THREE.Group ? b.children.find(c => c.userData.isCollisionBlock) : b;
                if (!collisionMesh) continue;
                const blockBox = new THREE.Box3().setFromObject(collisionMesh);
                if (playerBoxZ.intersectsBox(blockBox.expandByScalar(-0.01))) { canMoveZ = false; break; }
            }
            if (canMoveX) camera.position.x = potentialNewX;
            if (canMoveZ) camera.position.z = potentialNewZ;
        }
        velocity.y += gravity;
        const futurePositionY = camera.position.y + velocity.y;
        let verticalCollision = false, lowestCollisionY = -Infinity, highestCollisionY = Infinity;
        const playerVerticalBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(camera.position.x, futurePositionY, camera.position.z), new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2));
        for (const b of allBlocks) {
            if (b.userData.blockId === 'water') continue;
            const collisionMesh = b instanceof THREE.Group ? b.children.find(c => c.userData.isCollisionBlock) : b;
            if (!collisionMesh) continue;
            const blockBox = new THREE.Box3().setFromObject(collisionMesh).expandByScalar(-0.01);
            if (playerVerticalBox.intersectsBox(blockBox)) {
                verticalCollision = true;
                if (velocity.y < 0 && blockBox.max.y > lowestCollisionY) lowestCollisionY = blockBox.max.y;
                if (velocity.y > 0 && blockBox.min.y < highestCollisionY) highestCollisionY = blockBox.min.y;
            }
        }
        if (verticalCollision) {
            if (velocity.y < 0 && lowestCollisionY > -Infinity) {
                const blockAtFeet = allBlocks.find(b => {
                    const collisionMesh = b instanceof THREE.Group ? b.children.find(c => c.userData.isCollisionBlock) : b;
                    if (!collisionMesh) return false;
                    const blockBox = new THREE.Box3().setFromObject(collisionMesh).expandByScalar(-0.01);
                    return playerVerticalBox.intersectsBox(blockBox) && Math.abs(blockBox.max.y - lowestCollisionY) < 0.01;
                });
                if (blockAtFeet && blockAtFeet.userData.blockId === 'sponge') {
                    velocity.y = jumpPower * 1.5;
                    canJump = false;
                } else {
                    camera.position.y = lowestCollisionY + playerHeight / 2;
                    velocity.y = 0;
                    canJump = true;
                }
            } else if (velocity.y > 0 && highestCollisionY < Infinity) {
                camera.position.y = highestCollisionY - playerHeight / 2;
                velocity.y = 0;
            }
        } else { camera.position.y = futurePositionY; canJump = false; }
        if (camera.position.y < playerHeight / 2) { camera.position.y = playerHeight / 2; velocity.y = 0; canJump = true; }
    }
    renderer.render(scene, camera);
}
function initDragAndDrop() {
    const allSlots = document.querySelectorAll('.slot');
    let draggedItem = null;
    let ghostSlot = null;
    let touchStartSlot = null;
    allSlots.forEach(slot => {
        slot.addEventListener('dragstart', (e) => {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        });
        slot.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });
        slot.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            if (e.touches.length === 1) {
                touchStartSlot = e.target.closest('.slot');
                if (!touchStartSlot) return;
                ghostSlot = document.createElement('div');
                ghostSlot.id = 'ghost-slot';
                const styles = getSlotBackgroundStyle(touchStartSlot.dataset.blockId);
                for (const style in styles) { ghostSlot.style[style] = styles[style]; }
                document.body.appendChild(ghostSlot);
                const touch = e.touches[0];
                ghostSlot.style.left = `${touch.clientX}px`;
                ghostSlot.style.top = `${touch.clientY}px`;
                touchStartSlot.classList.add('dragging');
            }
        }, { passive: true });
    });
    document.addEventListener('touchmove', (e) => {
        if (ghostSlot && e.touches.length === 1) {
            const touch = e.touches[0];
            ghostSlot.style.left = `${touch.clientX}px`;
            ghostSlot.style.top = `${touch.clientY}px`;
        }
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
        if (ghostSlot) {
            ghostSlot.style.display = 'none';
            const endTouch = e.changedTouches[0];
            const dropTarget = document.elementFromPoint(endTouch.clientX, endTouch.clientY);
            if (dropTarget && dropTarget.classList.contains('slot')) {
                handleDrop(touchStartSlot, dropTarget);
            }
            document.body.removeChild(ghostSlot);
            ghostSlot = null;
            if(touchStartSlot) touchStartSlot.classList.remove('dragging');
            touchStartSlot = null;
        }
    });
    const handleDrop = (source, target) => {
        if (!source || !target) return;
        const sourceBlockId = source.dataset.blockId;
        const targetBlockId = target.dataset.blockId;
        // Swap block IDs and update styles
        source.dataset.blockId = targetBlockId;
        let styles = getSlotBackgroundStyle(targetBlockId);
        for(const s in source.style) source.style[s] = '';
        for (const style in styles) source.style[style] = styles[style];
        target.dataset.blockId = sourceBlockId;
        styles = getSlotBackgroundStyle(sourceBlockId);
        for(const s in target.style) target.style[s] = '';
        for (const style in styles) target.style[style] = styles[style];
        updateActiveHotbarBlock();
    };
    allSlots.forEach(slot => {
        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            handleDrop(draggedItem, e.target.closest('.slot'));
            draggedItem = null;
        });
    });
}
function updateActiveHotbarBlock() {
    const activeSlot = document.querySelector('#hotbar .slot.active');
    if (activeSlot) { selectBlock(activeSlot); }
}
function handleGamepadInput() {
    if (!isControllerConnected || !isPlaying) return;
    const gamepad = navigator.getGamepads()[0];
    if (!gamepad) return;
    const rightStickX = gamepad.axes[2], rightStickY = gamepad.axes[3];
    if (Math.abs(rightStickX) > joystickDeadzone) {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= rightStickX * controllerSensitivity;
        camera.quaternion.setFromEuler(euler);
    }
    if (Math.abs(rightStickY) > joystickDeadzone) {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.x -= rightStickY * controllerSensitivity;
        const pi_half = Math.PI / 2 - 0.001;
        euler.x = Math.max(-pi_half, Math.min(pi_half, euler.x));
        camera.quaternion.setFromEuler(euler);
    }
    const leftStickX = gamepad.axes[0], leftStickY = gamepad.axes[1];
    moveForward = leftStickY < -joystickDeadzone;
    moveBackward = leftStickY > joystickDeadzone;
    moveLeft = leftStickX < -joystickDeadzone;
    moveRight = leftStickY > joystickDeadzone;
    if (gamepad.buttons[0].pressed && canJump) { velocity.y = jumpPower; canJump = false; }
    const now = Date.now();
    if (now - lastBumperPressTime > bumperDelay) {
        let currentIndex = hotbarSlots.findIndex(slot => slot.classList.contains('active'));
        if (gamepad.buttons[5].pressed) {
            currentIndex = (currentIndex + 1) % hotbarSlots.length;
            selectBlock(hotbarSlots[currentIndex]);
            lastBumperPressTime = now;
        } else if (gamepad.buttons[4].pressed) {
            currentIndex = (currentIndex - 1 + hotbarSlots.length) % hotbarSlots.length;
            selectBlock(hotbarSlots[currentIndex]);
            lastBumperPressTime = now;
        }
    }
    const rtPressed = gamepad.buttons[7].pressed;
    if (rtPressed && !rtPressedLastFrame) { destroyBlock(); }
    rtPressedLastFrame = rtPressed;
    const ltPressed = gamepad.buttons[6].pressed;
    if (ltPressed && !ltPressedLastFrame) { placeBlock(); }
    ltPressedLastFrame = ltPressed;
}
function placeBlock() {
    // For pointer lock, raycaster direction is based on camera's direction
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(allBlocks, true);
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const blockObject = intersection.object.parent instanceof THREE.Group ? intersection.object.parent : intersection.object;
        const blockPosition = blockObject.position;
        const normal = intersection.face.normal;
        let newBlockId = selectedBlockId;
        const newBlockX = blockPosition.x / blockSize + normal.x;
        const newBlockY = blockPosition.y / blockSize + normal.y;
        const newBlockZ = blockPosition.z / blockSize + normal.z;
        const playerBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2));
        const potentialBlockBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(newBlockX, newBlockY, newBlockZ), new THREE.Vector3(blockSize, blockSize, blockSize));
        if (!playerBox.intersectsBox(potentialBlockBox)) {
            addBlock(newBlockX, newBlockY, newBlockZ, newBlockId);
        }
    }
}
function destroyBlock() {
    // For pointer lock, raycaster direction is based on camera's direction
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(allBlocks, true);
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const blockObject = intersection.object.parent instanceof THREE.Group ? intersection.object.parent : intersection.object;
        const blockPosition = blockObject.position;
        removeBlock(blockPosition.x / blockSize, blockPosition.y / blockSize, blockPosition.z / blockSize);
    }
}
function initTouchControls() {
    const gameContainer = document.getElementById('game-container');
    joystick = document.getElementById('joystick');
    gameContainer.addEventListener('touchstart', onMasterTouchStart, { passive: false });
    gameContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    gameContainer.addEventListener('touchend', onTouchEnd, { passive: false });
    document.getElementById('jump-btn').addEventListener('touchstart', (e) => { e.stopPropagation(); onJumpTouch(e); });
    document.getElementById('destroy-btn').addEventListener('touchstart', (e) => { e.stopPropagation(); onMouseDownTouch(e); });
    document.getElementById('build-btn').addEventListener('touchstart', (e) => { e.stopPropagation(); onBuildTouch(e); });
    document.getElementById('esc-btn').addEventListener('touchstart', (e) => { e.stopPropagation(); onEscTouch(e); });
}
// New variables to track touch identifiers
let joystickTouchID = -1;
let cameraTouchID = -1;
function onMasterTouchStart(event) {
    const isTapOnUI = event.target.closest('#info') || event.target.closest('#hotbar') || event.target.closest('#touch-controls') || event.target.closest('#in-game-ui') || event.target.closest('#inventory-ui');
    if (!isPlaying && !isTapOnUI) {
        event.preventDefault();
        isPlaying = true;
        document.getElementById('info').style.display = 'none';
        document.getElementById('in-game-ui').style.display = 'flex';
        document.getElementById('touch-controls').style.display = 'flex';
        document.getElementById('hotbar').style.display = 'flex';
    }
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.clientX < window.innerWidth / 2 && joystickTouchID === -1) {
            // This touch is for the joystick
            joystickX = touch.clientX;
            joystickY = touch.clientY;
            joystickTouchID = touch.identifier;
        } else if (touch.clientX >= window.innerWidth / 2 && cameraTouchID === -1) {
            // This touch is for the camera
            touchCameraX = touch.clientX;
            touchCameraY = touch.clientY;
            cameraTouchID = touch.identifier;
        }
    }
}
function onTouchMove(event) {
    if (!isPlaying) return;
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === joystickTouchID) {
            const dx = touch.clientX - joystickX;
            const dy = touch.clientY - joystickY;
            const len = Math.hypot(dx, dy);
            if (len > joystickRadius) {
                const angle = Math.atan2(dy, dx);
                joystick.style.transform = `translate(${Math.cos(angle) * joystickRadius}px, ${Math.sin(angle) * joystickRadius}px)`;
            } else {
                joystick.style.transform = `translate(${dx}px, ${dy}px)`;
            }
            const threshold = 0.2;
            moveForward = dy < -threshold * joystickRadius;
            moveBackward = dy > threshold * joystickRadius;
            moveLeft = dx < -threshold * joystickRadius;
            moveRight = dx > threshold * joystickRadius;
        } else if (touch.identifier === cameraTouchID) {
            const dx = touch.clientX - touchCameraX;
            const dy = touch.clientY - touchCameraY;
            const yaw = dx * touchSensitivity;
            const pitch = dy * touchSensitivity;
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(camera.quaternion);
            euler.y -= yaw;
            euler.x -= pitch;
            const pi_half = Math.PI / 2 - 0.001;
            euler.x = Math.max(-pi_half, Math.min(pi_half, euler.x));
            camera.quaternion.setFromEuler(euler);
            touchCameraX = touch.clientX;
            touchCameraY = touch.clientY;
        }
    }
}
function onTouchEnd(event) {
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === joystickTouchID) {
            joystick.style.transform = 'translate(0, 0)';
            moveForward = moveBackward = moveLeft = moveRight = false;
            joystickTouchID = -1;
        } else if (touch.identifier === cameraTouchID) {
            cameraTouchID = -1;
        }
    }
}
function onJumpTouch(event) { if (canJump && isPlaying) { velocity.y = jumpPower; canJump = false; } }
function onBuildTouch(event) { if (isPlaying) { placeBlock(); } }
function onMouseDownTouch(event) { if (isPlaying) { destroyBlock(); } }
function onEscTouch(event) {
    // Only needed for mobile/touch
    document.getElementById('in-game-ui').style.display = 'none';
    document.getElementById('info').style.display = 'block';
    document.getElementById('touch-controls').style.display = 'none';
    document.getElementById('hotbar').style.display = 'none';
    isPlaying = false;
}
function createPlayerArm() {
    const armGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.6);
    const armMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    playerArm = new THREE.Mesh(armGeometry, armMaterial);
    playerArm.position.set(0.4, -0.6, -0.6);
    const heldBlockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const initialMaterial = materials[selectedBlockId.replace('_dirt', '')] || materials.dirt;
    heldBlock = new THREE.Mesh(heldBlockGeometry, initialMaterial);
    heldBlock.position.set(0, 0.4, -0.8);
    playerArm.add(heldBlock);
    camera.add(playerArm);
}
function removeAllBlocks() {
    for (const block of allBlocks) { scene.remove(block); }
    blocks.clear();
    allBlocks.length = 0;
}
function saveWorld() {
    const savedBlocks = [];
    for (const [key, mesh] of blocks.entries()) {
        const blockToSave = mesh instanceof THREE.Group ? mesh : mesh;
        if (blockToSave && blockToSave.userData.blockId) {
            const blockData = {
                x: blockToSave.position.x / blockSize,
                y: blockToSave.position.y / blockSize,
                z: blockToSave.position.z / blockSize,
                blockId: blockToSave.userData.blockId
            };
            if (blockToSave.userData.blockId === 'water') {
                blockData.fluidVolume = blockToSave.userData.fluidVolume;
                blockData.isWaterSource = blockToSave.userData.isWaterSource;
                blockData.waterSpreadLimit = blockToSave.userData.waterSpreadLimit;
            }
            savedBlocks.push(blockData);
        }
    }
    localStorage.setItem('savedWorld', JSON.stringify(savedBlocks));
    alert('World saved!');
}
function loadWorld() {
    const savedWorld = localStorage.getItem('savedWorld');
    if (savedWorld) {
        removeAllBlocks();
        const blocksToLoad = JSON.parse(savedWorld);
        for (const blockData of blocksToLoad) {
            addBlock(blockData.x, blockData.y, blockData.z, blockData.blockId);
            const loadedBlock = blocks.get(`${blockData.x},${blockData.y},${blockData.z}`);
            if (loadedBlock && blockData.blockId === 'water') {
                loadedBlock.userData.fluidVolume = blockData.fluidVolume;
                loadedBlock.userData.isWaterSource = blockData.isWaterSource;
                loadedBlock.userData.waterSpreadLimit = blockData.waterSpreadLimit;
                loadedBlock.scale.y = loadedBlock.userData.fluidVolume;
                loadedBlock.position.y = (blockData.y * blockSize) + (blockSize * loadedBlock.userData.fluidVolume) / 2 - blockSize * 0.5;
                loadedBlock.material.opacity = 0.7 + loadedBlock.userData.fluidVolume * 0.3;
            }
        }
        alert('World loaded!');
    } else {
        alert('No saved world found!');
    }
}
function onMouseDown(event) {
    if (controls.isLocked) {
        if (event.button === 0) { destroyBlock(); }
        else if (event.button === 2) { placeBlock(); }
    }
}
function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'escape':
          if(isInventoryOpen){
            toggleInventory();
          } else if (controls.isLocked) {
            controls.unlock();
          }
          break;
        case 'w': moveForward = true; break;
        case 's': moveBackward = true; break;
        case 'a': moveLeft = true; break;
        case 'd': moveRight = true; break;
        case ' ': if (canJump) { velocity.y = jumpPower; canJump = false; } break;
        case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': case '0':
            const index = event.key === '0' ? 9 : parseInt(event.key) - 1;
            if (hotbarSlots[index]) { selectBlock(hotbarSlots[index]); }
            break;
    }
}
function onKeyUp(event) {
    switch (event.key.toLowerCase()) {
        case 'w': moveForward = false; break;
        case 's': moveBackward = false; break;
        case 'a': moveLeft = false; break;
        case 'd': moveRight = false; break;
        case 'e': if (!isInventoryOpen) debouncedToggleInventory(); break;
    }
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        crosshair.style.left = `${window.innerWidth / 2}px`;
        crosshair.style.top = `${window.innerHeight / 2}px`;
    }
}
function selectBlock(slotElement) {
    document.querySelectorAll('#hotbar .slot').forEach(slot => slot.classList.remove('active'));
    slotElement.classList.add('active');
    selectedBlockId = slotElement.dataset.blockId;
    let previewMaterial = materials[selectedBlockId.replace('_dirt', '')] || materials.dirt;
    if (heldBlock) { heldBlock.material = previewMaterial; }
}
hotbarSlots.forEach(slot => {
    slot.addEventListener('click', () => { selectBlock(slot); });
});