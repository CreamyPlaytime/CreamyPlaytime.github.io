let scene, camera, renderer, controls;
const blocks = new Map();
const allBlocks = []; 
const blockSize = 1;
const playerHeight = 1.8;
const playerRadius = 0.4;
const moveSpeed = 5.0; // Units per second
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const jumpPower = 0.3; // Reverted jump power to a lower value for more grounded feel
const gravity = -0.01; // Reverted gravity to a lower value
let canJump = true;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const blockTypes = {
    dirt: new THREE.MeshLambertMaterial({ color: 0x8b4513 }),
    stone: new THREE.MeshLambertMaterial({ color: 0x777777 }),
    wood: new THREE.MeshLambertMaterial({ color: 0x5c4033 }),
    grass: new THREE.MeshLambertMaterial({ color: 0x38761d }),
    sand: new THREE.MeshLambertMaterial({ color: 0xf4a460 }),
    glass: new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.5 }),
    brick: new THREE.MeshLambertMaterial({ color: 0x8b0000 }),
    cobblestone: new THREE.MeshLambertMaterial({ color: 0xa9a9a9 }),
    obsidian: new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    water: new THREE.MeshBasicMaterial({ color: 0x4682b4, transparent: true, opacity: 0.8 }),
};
const hotbarSlots = Array.from(document.querySelectorAll('.slot'));
let selectedBlockId = hotbarSlots[0].dataset.blockId;
const clock = new THREE.Clock();
let raycaster;
let playerArm;
let heldBlock;
document.getElementById('save-world-btn').addEventListener('click', saveWorld);
document.getElementById('load-world-btn').addEventListener('click', loadWorld);
// UI elements for settings and touch controls
const settingsBtn = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');
const closeSettingsBtn = document.getElementById('close-settings');
const touchControlsToggle = document.getElementById('touch-controls-toggle');
const touchControls = document.getElementById('touch-controls');
const joystickArea = document.getElementById('joystick-area');
const joystick = document.getElementById('joystick');
// Touch control state
let isMobile = false;
let touchX = 0, touchY = 0;
let touchMoving = false;
let touchLook = false;
let lastTouchPos = new THREE.Vector2();
const lookSpeed = 0.002;

init();
animate();

function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function init() {
    isMobile = isTouchDevice();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 0, 750);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = playerHeight;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    controls = new THREE.PointerLockControls(camera, document.body);
    const infoElement = document.getElementById('info');
    controls.addEventListener('lock', () => {
        infoElement.style.display = 'none';
        canJump = true;
    });
    controls.addEventListener('unlock', () => {
        infoElement.style.display = 'block';
    });
    document.addEventListener('click', () => {
        if (!controls.isLocked) {
            controls.lock();
        }
    }, false);
    // Add touchstart listener to act as a click to lock pointer
    document.addEventListener('touchstart', (e) => {
        // Prevent locking if the user is interacting with UI elements
        if (e.target.closest('#info, #hotbar, #settings-btn, #settings-menu, #touch-controls')) {
            return;
        }
        if (!controls.isLocked) {
            controls.lock();
        }
    }, false);
    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0, 10);
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);
    createFloor();
    createPlayerArm();
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    document.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('contextmenu', (event) => event.preventDefault(), false);
    // New UI Listeners
    settingsBtn.addEventListener('click', () => {
        settingsMenu.classList.toggle('hidden');
    });
    closeSettingsBtn.addEventListener('click', () => {
        settingsMenu.classList.add('hidden');
    });
    touchControlsToggle.addEventListener('change', (event) => {
        if (event.target.checked) {
            touchControls.classList.remove('hidden');
            touchControls.classList.add('active');
        } else {
            touchControls.classList.add('hidden');
            touchControls.classList.remove('active');
        }
    });
    if (isMobile) {
        touchControlsToggle.checked = true;
        touchControls.classList.remove('hidden');
        touchControls.classList.add('active');
        // On mobile, hide mouse-specific UI
        document.getElementById('crosshair').style.display = 'none';
    } else {
        touchControls.classList.add('hidden');
    }

    // Add touch and click listeners for hotbar slots
    hotbarSlots.forEach(slot => {
        slot.addEventListener('click', () => {
            selectBlock(slot);
        });
        slot.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent default browser behavior
            selectBlock(slot);
        });
    });

    // Touch control events (also support mouse for testing)
    const joystickRect = joystickArea.getBoundingClientRect();
    const touchButtonJump = document.getElementById('touch-jump-btn');
    const touchButtonDestroy = document.getElementById('touch-destroy-btn');
    const touchButtonBuild = document.getElementById('touch-build-btn');
    joystickArea.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickArea.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickArea.addEventListener('touchend', handleJoystickEnd);
    joystickArea.addEventListener('mousedown', handleJoystickStart, { passive: false });
    document.addEventListener('mousemove', handleJoystickMove, { passive: false });
    document.addEventListener('mouseup', handleJoystickEnd);
    touchButtonJump.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); if(canJump) velocity.y = jumpPower; canJump = false; });
    touchButtonDestroy.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); destroyBlockFromTouch(); });
    touchButtonBuild.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); buildBlockFromTouch(); });
    touchButtonJump.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); if(canJump) velocity.y = jumpPower; canJump = false; });
    touchButtonDestroy.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); destroyBlockFromTouch(); });
    touchButtonBuild.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); buildBlockFromTouch(); });
    // Touch look events (on the whole document)
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('#joystick-area, #touch-buttons, #hotbar')) return;
        touchLook = true;
        lastTouchPos.set(e.touches[0].clientX, e.touches[0].clientY);
    });
    document.addEventListener('touchmove', (e) => {
        if (!touchLook) return;
        const dx = e.touches[0].clientX - lastTouchPos.x;
        const dy = e.touches[0].clientY - lastTouchPos.y;
        controls.getObject().rotation.y -= dx * lookSpeed;
        camera.rotation.x -= dy * lookSpeed;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
        lastTouchPos.set(e.touches[0].clientX, e.touches[0].clientY);
    });
    document.addEventListener('touchend', () => {
        touchLook = false;
    });
}
function handleJoystickStart(event) {
    event.preventDefault();
    if (event.type === 'touchstart' && event.touches.length > 1) return;
    touchMoving = true;
    const touch = event.touches ? event.touches[0] : event;
    const rect = joystickArea.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    touchX = touch.clientX - centerX;
    touchY = touch.clientY - centerY;
}
function handleJoystickMove(event) {
    if (!touchMoving) return;
    event.preventDefault();
    const touch = event.touches ? event.touches[0] : event;
    const rect = joystickArea.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
    }
    joystick.style.transform = `translate(${dx}px, ${dy}px)`;
    moveForward = dy < -20;
    moveBackward = dy > 20;
    moveLeft = dx < -20;
    moveRight = dx > 20;
}
function handleJoystickEnd() {
    touchMoving = false;
    joystick.style.transform = `translate(0, 0)`;
    moveForward = moveBackward = moveLeft = moveRight = false;
}
function buildBlockFromTouch() {
    if (controls.isLocked) {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(allBlocks);
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const normal = intersection.face.normal;
            const blockPosition = intersection.object.position;
            const newBlockId = selectedBlockId;
            const newBlockMaterial = blockTypes[newBlockId];
            const newBlockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
            const newBlockX = blockPosition.x + normal.x * blockSize;
            const newBlockY = blockPosition.y + normal.y * blockSize;
            const newBlockZ = blockPosition.z + normal.z * blockSize;
            addBlock(newBlockX / blockSize, newBlockY / blockSize, newBlockZ / blockSize, newBlockGeometry, newBlockMaterial, newBlockId);
        }
    }
}
function destroyBlockFromTouch() {
    if (controls.isLocked) {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(allBlocks);
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const blockPosition = intersection.object.position;
            removeBlock(blockPosition.x / blockSize, blockPosition.y / blockSize, blockPosition.z / blockSize);
        }
    }
}
function createPlayerArm() {
    const armGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.6);
    const armMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    playerArm = new THREE.Mesh(armGeometry, armMaterial);
    playerArm.position.set(0.4, -0.6, -0.6);
    const heldBlockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    heldBlock = new THREE.Mesh(heldBlockGeometry, blockTypes[selectedBlockId]);
    heldBlock.position.set(0, 0.4, -0.8);
    playerArm.add(heldBlock);
    camera.add(playerArm);
}
function createFloor() {
    const floorSize = 10;
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const material = blockTypes['dirt'];
    for (let x = -floorSize; x <= floorSize; x++) {
        for (let z = -floorSize; z <= floorSize; z++) {
            addBlock(x, 0, z, geometry, material, 'dirt');
        }
    }
}
function addBlock(x, y, z, geometry, material, blockId) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x * blockSize, y * blockSize, z * blockSize);
    mesh.userData.blockId = blockId;
    scene.add(mesh);
    blocks.set(`${x},${y},${z}`, mesh);
    allBlocks.push(mesh);
}
function removeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    const block = blocks.get(key);
    if (block) {
        scene.remove(block);
        blocks.delete(key);
        const index = allBlocks.indexOf(block);
        if (index > -1) {
            allBlocks.splice(index, 1);
        }
    }
}
function removeAllBlocks() {
    for (const block of allBlocks) {
        scene.remove(block);
    }
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
        const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        for (const blockData of blocksToLoad) {
            const material = blockTypes[blockData.blockId];
            addBlock(blockData.x, blockData.y, blockData.z, geometry, material, blockData.blockId);
        }
        alert('World loaded!');
    } else {
        alert('No saved world found!');
    }
}
function onMouseDown(event) {
    if (controls.isLocked) {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(allBlocks);
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const normal = intersection.face.normal;
            const blockPosition = intersection.object.position;
            const newBlockId = selectedBlockId;
            const newBlockMaterial = blockTypes[newBlockId];
            const newBlockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
            if (event.button === 0) {
                removeBlock(blockPosition.x / blockSize, blockPosition.y / blockSize, blockPosition.z / blockSize);
            } else if (event.button === 2) {
                const newBlockX = blockPosition.x + normal.x * blockSize;
                const newBlockY = blockPosition.y + normal.y * blockSize;
                const newBlockZ = blockPosition.z + normal.z * blockSize;
                addBlock(newBlockX / blockSize, newBlockY / blockSize, newBlockZ / blockSize, newBlockGeometry, newBlockMaterial, newBlockId);
            }
        }
    }
}
function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'w':
            moveForward = true;
            break;
        case 's':
            moveBackward = true;
            break;
        case 'a':
            moveLeft = true;
            break;
        case 'd':
            moveRight = true;
            break;
        case ' ':
            if (canJump) {
                velocity.y = jumpPower;
                canJump = false;
            }
            break;
        case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': case '0':
            const index = event.key === '0' ? 9 : parseInt(event.key) - 1;
            if (hotbarSlots[index]) {
                selectBlock(hotbarSlots[index]);
            }
            break;
    }
}
function onKeyUp(event) {
    switch (event.key.toLowerCase()) {
        case 'w':
            moveForward = false;
            break;
        case 's':
            moveBackward = false;
            break;
        case 'a':
            moveLeft = false;
            break;
        case 'd':
            moveRight = false;
            break;
    }
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
function selectBlock(slotElement) {
    hotbarSlots.forEach(slot => slot.classList.remove('active'));
    slotElement.classList.add('active');
    selectedBlockId = slotElement.dataset.blockId;
    if (heldBlock) {
        heldBlock.material = blockTypes[selectedBlockId];
    }
}
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (controls.isLocked) {
        // --- HORIZONTAL MOVEMENT AND COLLISION CHECK ---
        const horizontalMovement = new THREE.Vector3();
        if (moveForward) horizontalMovement.z -= 1;
        if (moveBackward) horizontalMovement.z += 1;
        if (moveLeft) horizontalMovement.x -= 1;
        if (moveRight) horizontalMovement.x += 1;
        if (horizontalMovement.length() > 0) {
            horizontalMovement.normalize().multiplyScalar(moveSpeed * delta);
            const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const potentialNewX = camera.position.x + (forwardVector.x * -horizontalMovement.z + rightVector.x * horizontalMovement.x);
            const potentialNewZ = camera.position.z + (forwardVector.z * -horizontalMovement.z + rightVector.z * horizontalMovement.x);
            let canMoveX = true;
            let canMoveZ = true;
            // Check for X-axis movement collision
            const playerBoxX = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(potentialNewX, camera.position.y, camera.position.z),
                new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
            );
            for (const block of allBlocks) {
                const blockBox = new THREE.Box3().setFromObject(block);
                blockBox.expandByScalar(-0.01);
                if (playerBoxX.intersectsBox(blockBox)) {
                    canMoveX = false;
                    break;
                }
            }
            // Check for Z-axis movement collision
            const playerBoxZ = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(camera.position.x, camera.position.y, potentialNewZ),
                new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
            );
            for (const block of allBlocks) {
                const blockBox = new THREE.Box3().setFromObject(block);
                blockBox.expandByScalar(-0.01);
                if (playerBoxZ.intersectsBox(blockBox)) {
                    canMoveZ = false;
                    break;
                }
            }
            if (canMoveX) {
                camera.position.x = potentialNewX;
            }
            if (canMoveZ) {
                camera.position.z = potentialNewZ;
            }
        }
        // --- VERTICAL MOVEMENT AND COLLISION CHECK ---
        velocity.y += gravity;
        const futurePositionY = camera.position.y + velocity.y;
        let verticalCollision = false;
        let lowestCollisionY = -Infinity;
        let highestCollisionY = Infinity;
        const playerVerticalBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(camera.position.x, futurePositionY, camera.position.z),
            new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
        );
        for (const block of allBlocks) {
            const blockBox = new THREE.Box3().setFromObject(block);
            blockBox.expandByScalar(-0.01);
            if (playerVerticalBox.intersectsBox(blockBox)) {
                verticalCollision = true;
                if (velocity.y < 0) { // Player is falling
                    if (blockBox.max.y > lowestCollisionY) {
                        lowestCollisionY = blockBox.max.y;
                    }
                } else if (velocity.y > 0) { // Player is jumping
                    if (blockBox.min.y < highestCollisionY) {
                        highestCollisionY = blockBox.min.y;
                    }
                }
            }
        }
        if (verticalCollision) {
            if (velocity.y < 0 && lowestCollisionY > -Infinity) { // Landing on a block
                camera.position.y = lowestCollisionY + playerHeight / 2;
                velocity.y = 0;
                canJump = true;
            } else if (velocity.y > 0 && highestCollisionY < Infinity) { // Hitting head on a block
                camera.position.y = highestCollisionY - playerHeight / 2;
                velocity.y = 0;
            }
        } else {
            camera.position.y = futurePositionY;
            canJump = false;
        }
        // Keep player from falling through the initial floor
        if (camera.position.y < playerHeight / 2) {
             camera.position.y = playerHeight / 2;
             velocity.y = 0;
             canJump = true;
        }
    }
    renderer.render(scene, camera);
}