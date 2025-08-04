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
init();
animate();
function init() {
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
        // Apply gravity to vertical velocity
        velocity.y += gravity;

        // Calculate potential new position
        const newPosition = camera.position.clone();
        if (moveForward) direction.z -= 1;
        if (moveBackward) direction.z += 1;
        if (moveLeft) direction.x -= 1;
        if (moveRight) direction.x += 1;
        if (direction.length() > 0) {
            direction.normalize().multiplyScalar(moveSpeed * delta);
            const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            newPosition.x += forwardVector.x * -direction.z + rightVector.x * direction.x;
            newPosition.z += forwardVector.z * -direction.z + rightVector.z * direction.x;
        }
        newPosition.y += velocity.y;
        
        // Reset direction vector
        direction.set(0, 0, 0);

        // Collision detection
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(newPosition.x, newPosition.y, newPosition.z),
            new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
        );

        let collision = false;
        let lowestCollisionY = -Infinity;
        for (const block of allBlocks) {
            const blockBox = new THREE.Box3().setFromObject(block);
            blockBox.expandByScalar(-0.01);
            if (playerBox.intersectsBox(blockBox)) {
                collision = true;
                // Vertical collision handling
                if (newPosition.y - playerHeight/2 < blockBox.max.y && newPosition.y + playerHeight/2 > blockBox.min.y) {
                    if (velocity.y < 0) { // Landing on a block
                        newPosition.y = blockBox.max.y + playerHeight/2;
                        velocity.y = 0;
                        canJump = true;
                    } else if (velocity.y > 0) { // Hitting head on a block
                        newPosition.y = blockBox.min.y - playerHeight/2;
                        velocity.y = 0;
                    }
                }
                
                // Horizontal collision handling
                const deltaX = newPosition.x - camera.position.x;
                const deltaZ = newPosition.z - camera.position.z;
                if (deltaX !== 0 || deltaZ !== 0) {
                    const tempBoxX = new THREE.Box3().setFromCenterAndSize(
                        new THREE.Vector3(newPosition.x, camera.position.y, camera.position.z),
                        new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
                    );
                    const tempBoxZ = new THREE.Box3().setFromCenterAndSize(
                        new THREE.Vector3(camera.position.x, camera.position.y, newPosition.z),
                        new THREE.Vector3(playerRadius * 2, playerHeight, playerRadius * 2)
                    );

                    if (tempBoxX.intersectsBox(blockBox)) {
                        newPosition.x = camera.position.x;
                    }
                    if (tempBoxZ.intersectsBox(blockBox)) {
                        newPosition.z = camera.position.z;
                    }
                }
            }
        }

        // Update player position
        camera.position.copy(newPosition);

        // Keep player from falling through the initial floor
        if (camera.position.y < playerHeight / 2) {
             camera.position.y = playerHeight / 2;
             velocity.y = 0;
             canJump = true;
        }
    }
    renderer.render(scene, camera);
}