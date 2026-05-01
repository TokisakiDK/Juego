import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let character, mixer, currentAction;
let idleAction, walkAction, walkBackAction, runAction, runBackAction;
const keys = { w: false, a: false, s: false, d: false, shift: false };
const rotationSpeed = 2.5; 
const camRaycaster = new THREE.Raycaster();
let portalCooldown = 0; 
let isAerialView = false; 

// Nuevo: Temporizador para los pasos
let stepTimer = 0;

export function initPlayer(scene, spawnPosition) {
    document.addEventListener('keydown', (e) => { 
        const k = e.key.toLowerCase(); 
        if(keys.hasOwnProperty(k)) keys[k] = true; 
        if(e.key === 'Shift') keys.shift = true; 
        if(k === 'm') isAerialView = !isAerialView; 
    });
    
    document.addEventListener('keyup', (e) => { 
        const k = e.key.toLowerCase(); 
        if(keys.hasOwnProperty(k)) keys[k] = false; 
        if(e.key === 'Shift') keys.shift = false; 
    });

    const loader = new FBXLoader();
    loader.load('player/Idle.fbx', (fbx) => {
        character = fbx; 
        character.scale.set(1, 1, 1); 
        character.position.copy(spawnPosition);
        character.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        
        mixer = new THREE.AnimationMixer(character);
        idleAction = mixer.clipAction(character.animations[0]);
        
        loader.load('player/Walking.fbx', (f) => walkAction = mixer.clipAction(f.animations[0]));
        loader.load('player/Walking Backwards.fbx', (f) => walkBackAction = mixer.clipAction(f.animations[0]));
        loader.load('player/Running.fbx', (f) => runAction = mixer.clipAction(f.animations[0]));
        loader.load('player/Run Backward.fbx', (f) => runBackAction = mixer.clipAction(f.animations[0]));

        currentAction = idleAction; 
        currentAction.play(); 
        scene.add(character);
    });
}

function crossFade(nextAction) {
    if (!currentAction || !nextAction || currentAction === nextAction) return;
    nextAction.reset().play();
    currentAction.crossFadeTo(nextAction, 0.25, true); 
    currentAction = nextAction;
}

export function updatePlayer(delta, camera, mapData) {
    if (!character || !currentAction) return;
    if (mixer) mixer.update(delta);

    if (keys.a) character.rotation.y += rotationSpeed * delta;
    if (keys.d) character.rotation.y -= rotationSpeed * delta;

    let targetAction = idleAction; let speed = 0;
    if (keys.w) { if (keys.shift) { targetAction = runAction; speed = 450; } else { targetAction = walkAction; speed = 180; } }
    else if (keys.s) { if (keys.shift) { targetAction = runBackAction; speed = -350; } else { targetAction = walkBackAction; speed = -120; } }

    if (targetAction !== currentAction) crossFade(targetAction);

    const mov = new THREE.Vector3(0, 0, speed * delta).applyQuaternion(character.quaternion);
    const orig = character.position.clone();
    
    character.position.x += mov.x;
    const pBoxX = new THREE.Box3().setFromCenterAndSize(character.position, new THREE.Vector3(70, 200, 70));
    for (let o of mapData.obstacles) {
        if (o.boundingBox && pBoxX.intersectsBox(o.boundingBox)) { character.position.x = orig.x; break; }
    }

    character.position.z += mov.z;
    const pBoxZ = new THREE.Box3().setFromCenterAndSize(character.position, new THREE.Vector3(70, 200, 70));
    for (let o of mapData.obstacles) {
        if (o.boundingBox && pBoxZ.intersectsBox(o.boundingBox)) { character.position.z = orig.z; break; }
    }

    // --- LÓGICA DE SONIDO DE PASOS (FOOTSTEPS) ---
    if (speed !== 0 && !isAerialView && portalCooldown <= 0) {
        stepTimer -= delta;
        if (stepTimer <= 0) {
            if (mapData.sfxStep && mapData.sfxStep.buffer) {
                if (mapData.sfxStep.isPlaying) mapData.sfxStep.stop();
                
                // Si está corriendo, el sonido se reproduce un poco más rápido
                mapData.sfxStep.setPlaybackRate(keys.shift ? 1.3 : 1.0);
                mapData.sfxStep.play();
            }
            // Resetear el temporizador (más corto si corre, más largo si camina)
            stepTimer = keys.shift ? 0.35 : 0.6;
        }
    } else {
        stepTimer = 0; // Para que suene apenas empiece a caminar de nuevo
    }

    // --- LÓGICAS DE PORTALES ---
    if (portalCooldown > 0) {
        portalCooldown -= delta;
    } else {
        // 1. Portales Conectados (Azules) - A -> B
        if (mapData.linkedPortals.length === 2) {
            const p1 = mapData.linkedPortals[0];
            const p2 = mapData.linkedPortals[1];
            
            let teleported = false;

            if (character.position.distanceTo(p1) < 120) {
                character.position.set(p2.x, 0, p2.z);
                teleported = true;
            } else if (character.position.distanceTo(p2) < 120) {
                character.position.set(p1.x, 0, p1.z);
                teleported = true;
            }

            if (teleported) {
                portalCooldown = 2.0;
                if (mapData.sfxPortalB && mapData.sfxPortalB.isPlaying) mapData.sfxPortalB.stop();
                if (mapData.sfxPortalB && mapData.sfxPortalB.buffer) mapData.sfxPortalB.play();
            }
        }

        // 2. Portales Aleatorios (Rosas)
        if (portalCooldown <= 0 && mapData.randomPortals.length > 0) {
            for (let i = 0; i < mapData.randomPortals.length; i++) {
                if (character.position.distanceTo(mapData.randomPortals[i]) < 120) {
                    
                    let randomSpot;
                    let isValid = false;
                    let attempts = 0;
                    
                    while (!isValid && attempts < 50) {
                        randomSpot = mapData.safeSpots[Math.floor(Math.random() * mapData.safeSpots.length)];
                        isValid = true;
                        
                        [...mapData.linkedPortals, ...mapData.randomPortals].forEach(p => {
                            if (randomSpot.distanceTo(p) < 300) isValid = false;
                        });
                        attempts++;
                    }

                    character.position.set(randomSpot.x, 0, randomSpot.z);
                    portalCooldown = 2.0;
                    
                    if (mapData.sfxPortalP && mapData.sfxPortalP.isPlaying) mapData.sfxPortalP.stop();
                    if (mapData.sfxPortalP && mapData.sfxPortalP.buffer) mapData.sfxPortalP.play();
                    
                    break; 
                }
            }
        }
    }

    mapData.portalsArray.forEach(p => p.lookAt(camera.position));
    
    // --- LÓGICA DE CÁMARA ---
    if (isAerialView) {
        const aerialPos = new THREE.Vector3(character.position.x, 2000, character.position.z);
        camera.position.lerp(aerialPos, 0.1); 
        camera.lookAt(character.position.x, 0, character.position.z); 
        return; 
    }

    const playerHead = character.position.clone().add(new THREE.Vector3(0, 150, 0));
    const zIdeal = keys.s ? -120 : -320; 
    const yIdeal = keys.s ? 160 : 180;
    
    const idealCamOffset = new THREE.Vector3(0, yIdeal, zIdeal).applyQuaternion(character.quaternion);
    const idealCamPos = character.position.clone().add(idealCamOffset);

    const rayDir = idealCamPos.clone().sub(playerHead).normalize();
    const rayDist = playerHead.distanceTo(idealCamPos);

    camRaycaster.set(playerHead, rayDir);
    const wallIntersects = camRaycaster.intersectObjects(mapData.obstacles, true);

    let finalCamPos = idealCamPos.clone();
    let isColliding = false;

    if (wallIntersects.length > 0) {
        const wallHit = wallIntersects[0];
        if (wallHit.distance < rayDist) {
            const safeDistance = Math.max(0, wallHit.distance - 30);
            finalCamPos = playerHead.clone().add(rayDir.multiplyScalar(safeDistance));
            isColliding = true;
        }
    }

    if (isColliding) camera.position.lerp(finalCamPos, 0.4);
    else camera.position.lerp(finalCamPos, 0.2);

    camera.lookAt(character.position.clone().add(new THREE.Vector3(0, 120, 0)));
}