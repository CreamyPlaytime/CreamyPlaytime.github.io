let scene, camera, renderer, controls;
const blocks = new Map();
const allBlocks = [];
const blockSize = 1;
const playerHeight = 1.8;
const playerRadius = 0.4;
const moveSpeed = 5.0; // Units per second
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
let heldBlock;
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
init();
animate();
function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
}
// --- NEW HELPER FUNCTION FOR UI TEXTURES ---
function getSlotBackgroundStyle(blockId) {
    // Check if there is a pre-rendered canvas for this block
    const canvas = blockCanvases[blockId];
    if (canvas) {
        return { backgroundImage: `url(${canvas.toDataURL()})` };
    }
    // Fallback to solid colors for non-textured blocks
    const materialKey = blockId.replace('_dirt', ''); // Handle grass_dirt case
    const material = materials[materialKey] || materials[blockId];
    if (material && material.color) {
        return { backgroundColor: material.color.getStyle(), opacity: material.opacity || 1 };
    }
    return {}; // Default empty style
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
    const touchControlsElement = document.getElementById('touch-controls');
    const escBtnElement = document.getElementById('esc-btn');
    const hotbarElement = document.getElementById('hotbar');
    const inventoryGrid = document.getElementById('inventory-grid');

    // --- NEW CODE TO INITIALIZE HOTBAR ICONS ---
    hotbarSlots.forEach(slot => {
        const blockId = slot.dataset.blockId;
        const styles = getSlotBackgroundStyle(blockId);
        for (const style in styles) {
            slot.style[style] = styles[style];
        }
    });
    // --- END NEW CODE ---

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
        document.getElementById('mouse-info').style.display = 'none';
        document.getElementById('touch-info').style.display = 'block';
        touchControlsElement.style.display = 'none';
        escBtnElement.style.display = 'none';
        initTouchControls();
    } else {
        document.getElementById('mouse-info').style.display = 'block';
        document.getElementById('touch-info').style.display = 'none';
        controls = new THREE.PointerLockControls(camera, document.body);
        controls.addEventListener('lock', () => {
            infoElement.style.display = 'none';
            canJump = true;
            isPlaying = true;
        });
        controls.addEventListener('unlock', () => {
            infoElement.style.display = 'block';
            isPlaying = false;
        });
        document.addEventListener('click', () => { if (!controls.isLocked) controls.lock(); }, false);
    }
    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0, 10);
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
        if (!isPlaying) { infoElement.style.display = 'none'; isPlaying = true; }
    });
    window.addEventListener('gamepaddisconnected', (event) => {
        isControllerConnected = false;
        if (!controls || !controls.isLocked) { infoElement.style.display = 'block'; isPlaying = false; }
    });
    document.getElementById('save-world-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); saveWorld(); });
    document.getElementById('load-world-btn').addEventListener('touchstart', (event) => { event.stopPropagation(); loadWorld(); });
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('contextmenu', (event) => event.preventDefault(), false);
    
    // NEW: Stop touch events on the UI from propagating to the game container
    if (isTouchDevice) {
        document.getElementById('info').addEventListener('touchstart', function(e) {
            // Only if not playing
            if (!isPlaying) {
                e.preventDefault();
                isPlaying = true;
                document.getElementById('info').style.display = 'none';
                document.getElementById('touch-controls').style.display = 'flex';
                document.getElementById('hotbar').style.display = 'flex';
                document.getElementById('esc-btn').style.display = 'block';
            }
        });
        document.getElementById('inventory-grid').addEventListener('touchstart', function(e) {
            e.stopPropagation();
        });
    }
}
function addBlock(x, y, z, blockId) {
    const key = `${x},${y},${z}`;
    if (blocks.has(key)) return;
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
        // Player placed water has a spread limit of 4
        mesh.userData.fluidLevel = 4;
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
    if (!block) return;
    // --- Water Physics ---
    if (block.userData.blockId === 'water') {
        const keyBelow = `${x},${y - 1},${z}`;
        if (!blocks.has(keyBelow)) {
            const fluidLevel = block.userData.fluidLevel;
            removeBlock(x, y, z);
            addBlock(x, y - 1, z, 'water');
            const newWater = blocks.get(keyBelow);
            if(newWater) newWater.userData.fluidLevel = fluidLevel; // Preserve fluid level when falling
            return;
        }
        const fluidLevel = block.userData.fluidLevel;
        if (fluidLevel > 1) {
            const neighbors = [{x:x+1,y:y,z:z}, {x:x-1,y:y,z:z}, {x:x,y:y,z:z+1}, {x:x,y:y,z:z-1}];
            neighbors.forEach(n => {
                if (!blocks.has(`${n.x},${n.y},${n.z}`)) {
                    addBlock(n.x, n.y, n.z, 'water');
                    const newWater = blocks.get(`${n.x},${n.y},${n.z}`);
                    if (newWater) newWater.userData.fluidLevel = fluidLevel - 1;
                }
            });
        }
    }
    // --- Sponge Physics ---
    if (block.userData.blockId === 'sponge') {
        let waterAbsorbed = false;
        const toCheck = [{x,y,z}];
        const checked = new Set([key]);
        let limit = 65; // Max blocks to check/absorb
        while (toCheck.length > 0 && limit > 0) {
            const currentPos = toCheck.shift();
            limit--;
            const neighbors = [{x:currentPos.x+1,y:currentPos.y,z:currentPos.z}, {x:currentPos.x-1,y:currentPos.y,z:currentPos.z}, {x:currentPos.x,y:currentPos.y+1,z:currentPos.z}, {x:currentPos.x,y:currentPos.y-1,z:currentPos.z}, {x:currentPos.x,y:currentPos.y,z:currentPos.z+1}, {x:currentPos.x,y:currentPos.y,z:currentPos.z-1}];
            for (const n of neighbors) {
                const nKey = `${n.x},${n.y},${n.z}`;
                if (checked.has(nKey)) continue;
                checked.add(nKey);
                const neighborBlock = blocks.get(nKey);
                if (neighborBlock && neighborBlock.userData.blockId === 'water') {
                    removeBlock(n.x, n.y, n.z);
                    waterAbsorbed = true;
                    toCheck.push(n); // Check neighbors of absorbed water
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
    processBlockUpdates();
    if (isControllerConnected) { handleGamepadInput(); }
    const delta = clock.getDelta();
    if (isPlaying) {
        // --- MOVEMENT AND COLLISION (FIXED) ---
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
                const blockBox = new THREE.Box3().setFromObject(b);
                if (playerBoxX.intersectsBox(blockBox.expandByScalar(-0.01))) { canMoveX = false; break; } 
            }
            const playerBoxZ = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(camera.position.x, camera.position.y, potentialNewZ), new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2));
            for (const b of allBlocks) { 
                const blockBox = new THREE.Box3().setFromObject(b);
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
            const blockBox = new THREE.Box3().setFromObject(b).expandByScalar(-0.01);
            if (playerVerticalBox.intersectsBox(blockBox)) {
                verticalCollision = true;
                if (velocity.y < 0 && blockBox.max.y > lowestCollisionY) lowestCollisionY = blockBox.max.y;
                if (velocity.y > 0 && blockBox.min.y < highestCollisionY) highestCollisionY = blockBox.min.y;
            }
        }
        if (verticalCollision) {
            if (velocity.y < 0 && lowestCollisionY > -Infinity) { 
                const blockAtFeet = allBlocks.find(b => {
                    const blockBox = new THREE.Box3().setFromObject(b).expandByScalar(-0.01);
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
// --- REST OF FILE (UNCHANGED FUNCTIONS) ---
// This includes initDragAndDrop, handleGamepadInput, placeBlock, destroyBlock, all touch controls, etc.
// They are included here for completeness.
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
        const isTargetHotbar = target.closest('#hotbar');
        const isSourceHotbar = source.closest('#hotbar');
        if (isTargetHotbar) {
            const sourceBlockId = source.dataset.blockId;
            const targetBlockId = target.dataset.blockId;
            // Swap logic
            source.dataset.blockId = targetBlockId;
            let styles = getSlotBackgroundStyle(targetBlockId);
            for(const s in source.style) source.style[s] = ''; // Clear old styles
            for (const style in styles) source.style[style] = styles[style];
            target.dataset.blockId = sourceBlockId;
            styles = getSlotBackgroundStyle(sourceBlockId);
            for(const s in target.style) target.style[s] = ''; // Clear old styles
            for (const style in styles) target.style[style] = styles[style];
        }
        updateActiveHotbarBlock();
    };
    allSlots.forEach(slot => {
        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            handleDrop(draggedItem, e.target);
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
    moveRight = leftStickX > joystickDeadzone;
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

        // Check if the new block position would intersect with the player's bounding box
        const playerBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2));
        const potentialBlockBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(newBlockX, newBlockY, newBlockZ), new THREE.Vector3(blockSize, blockSize, blockSize));

        if (!playerBox.intersectsBox(potentialBlockBox)) {
            addBlock(newBlockX, newBlockY, newBlockZ, newBlockId);
        }
    }
}
function destroyBlock() {
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
function onEscTouch(event) {
    event.preventDefault();
    isPlaying = false;
    document.getElementById('info').style.display = 'block';
    document.getElementById('touch-controls').style.display = 'none';
    document.getElementById('hotbar').style.display = 'flex';
    document.getElementById('esc-btn').style.display = 'none';
}
function onMasterTouchStart(event) {
    if (!isPlaying) {
        // Only start the game if the touch target is the canvas itself.
        if (event.target === renderer.domElement) {
            event.preventDefault();
            isPlaying = true;
            document.getElementById('info').style.display = 'none';
            document.getElementById('touch-controls').style.display = 'flex';
            document.getElementById('hotbar').style.display = 'flex';
            document.getElementById('esc-btn').style.display = 'block';
        }
        return;
    }
    
    // If the game is already playing, handle the touch for movement/looking.
    const touch = event.changedTouches[0];
    const joystickContainerRect = document.getElementById('joystick-container').getBoundingClientRect();
    const dist = Math.hypot(touch.clientX - (joystickContainerRect.left + joystickContainerRect.width / 2), touch.clientY - (joystickContainerRect.top + joystickContainerRect.height / 2));
    if (dist < joystickRadius * 2) {
        isMovingJoystick = true;
        joystickX = touch.clientX;
        joystickY = touch.clientY;
    } else {
        isMovingJoystick = false; 
        touchCameraX = touch.clientX;
        touchCameraY = touch.clientY;
    }
}
function onTouchMove(event) {
    if (!isPlaying) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    if (isMovingJoystick) {
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
        moveForward = (dy < -threshold * joystickRadius);
        moveBackward = (dy > threshold * joystickRadius);
        moveLeft = (dx < -threshold * joystickRadius);
        moveRight = (dx > threshold * joystickRadius);
    } else {
        if (touch.clientX > touchLookZone.startX) {
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
    if (isMovingJoystick) {
        joystick.style.transform = 'translate(0, 0)';
        moveForward = moveBackward = moveLeft = moveRight = false;
        isMovingJoystick = false;
    }
}
function onJumpTouch(event) { if (canJump && isPlaying) { velocity.y = jumpPower; canJump = false; } }
function onBuildTouch(event) { if (isPlaying) { placeBlock(); } }
function onMouseDownTouch(event) { if (isPlaying) { destroyBlock(); } }
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
        savedBlocks.push({
            x: mesh.position.x / blockSize,
            y: mesh.position.y / blockSize,
            z: mesh.position.z / blockSize,
            blockId: mesh.userData.blockId
        });
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
        case 'escape': if (controls.isLocked) { controls.unlock(); } break;
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