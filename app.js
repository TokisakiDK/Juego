import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer, character, mixer;

// --- SISTEMA DE ANIMACIONES (CAPA NORMAL ÚNICAMENTE) ---
let idleAction, walkAction, walkBackAction, runAction, runBackAction;
let currentAction;

const clock = new THREE.Clock();
const keys = { w: false, a: false, s: false, d: false, shift: false };

const rotationSpeed = 2.5; 
const obstacles = []; 
let spawnPosition = new THREE.Vector3(0, 0, 0);

// Variables de Portales
let portalBPos = new THREE.Vector3(0, 0, 0);
let portalPPos = new THREE.Vector3(0, 0, 0);
let portalCooldown = 0; 
const portalsArray = []; 

// Raycaster para la cámara inteligente
const camRaycaster = new THREE.Raycaster();

// --- SISTEMA DE AUDIO ---
let bgMusic;
let audioStarted = false;

init();

function init() {
    // 1. ESCENA Y NIEBLA (Configuración de día)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xccddff); // Azul cielo claro
    scene.fog = new THREE.Fog(0xccddff, 200, 2000); // Niebla clara y distante

    // 2. CÁMARA
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);

    // --- AUDIO LISTENER ---
    const listener = new THREE.AudioListener();
    camera.add(listener);

    bgMusic = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();
    
    audioLoader.load('assets/dreamcore.wav', function(buffer) {
        bgMusic.setBuffer(buffer);
        bgMusic.setLoop(true); // Para que se repita infinitamente
        bgMusic.setVolume(0.4); // Volumen de 0.0 a 1.0 (ajusta según necesites)
    }, undefined, function(error) {
        console.error("Error al cargar la pista de audio:", error);
    });

    // 3. ILUMINACIÓN DE DÍA (Restaurada)
    // Luz ambiental fuerte para iluminar todo de forma pareja
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); 
    scene.add(ambientLight);

    // Luz direccional (Sol) intensa para proyectar sombras nítidas
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(500, 1000, 250); // Sol alto
    sunLight.castShadow = true;
    
    // Configuración de sombras de alta calidad para el sol
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 2500;
    sunLight.shadow.camera.left = -1500;
    sunLight.shadow.camera.right = 1500;
    sunLight.shadow.camera.top = 1500;
    sunLight.shadow.camera.bottom = -1500;
    scene.add(sunLight);

    const texLoader = new THREE.TextureLoader();
    const gltfLoader = new GLTFLoader();

    // 4. PISO (Alfombra)
    const floorTex = texLoader.load('assets/Alfombra.jpg');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(40, 40); 
    
    const floorMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(10000, 10000), 
        new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true; // Recibe sombras del sol y los muros
    scene.add(floorMesh);

    // El Techo (Sin Techo) permanece eliminado para que sea al aire libre.

    // 5. CONSTRUIR LABERINTO Y PROPS
    crearLaberintoCompleto(texLoader, gltfLoader);

    // 6. CARGAR PERSONAJE (Sólo animaciones normales, sin antorcha)
    cargarPersonaje();

    // 7. RENDERIZADOR
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Eventos
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    renderer.setAnimationLoop(animate);
}

// Función para cargar videos WEBM con transparencia
function crearTexturaDeVideo(ruta) {
    const video = document.createElement('video');
    video.src = ruta;
    video.loop = true;
    video.muted = true; 
    video.playsInline = true;
    video.play().catch(e => console.warn("Video pausado:", e));
    return new THREE.VideoTexture(video);
}

function crearLaberintoCompleto(texLoader, gltfLoader) {
    const tileSize = 250; 
    const geomMuro = new THREE.BoxGeometry(tileSize, 350, tileSize);
    
    // Textura de Tapiz para los muros
    const texTapiz = texLoader.load('assets/tapiz.webp');
    texTapiz.wrapS = texTapiz.wrapT = THREE.RepeatWrapping;
    texTapiz.repeat.set(1, 1); 
    const matMuroTapiz = new THREE.MeshStandardMaterial({ map: texTapiz, roughness: 0.8 });

    // Portales WEBM Animados
    const texPortalB = crearTexturaDeVideo('assets/portal_b.webm');
    const texPortalP = crearTexturaDeVideo('assets/portal_p.webm');

    const matPortalB = new THREE.MeshBasicMaterial({ map: texPortalB, transparent: true, side: THREE.DoubleSide });
    const matPortalP = new THREE.MeshBasicMaterial({ map: texPortalP, transparent: true, side: THREE.DoubleSide });
    const geomPortal = new THREE.PlaneGeometry(200, 200);

    // --- CORRECCIÓN: DOBLE GUIÓN BAJO EN LOS NOMBRES DE ARCHIVO ---
    const texMaceta25 = texLoader.load('models/maceta_01/textures/Material__25_diffuse.png');
    const texMaceta26 = texLoader.load('models/maceta_01/textures/Material__26_diffuse.png');
    const texMaceta27 = texLoader.load('models/maceta_01/textures/Material__27_diffuse.png');
    
    texMaceta25.colorSpace = THREE.SRGBColorSpace;
    texMaceta26.colorSpace = THREE.SRGBColorSpace;
    texMaceta27.colorSpace = THREE.SRGBColorSpace;

    const mapa = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
        [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
        [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
        [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 9, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ];

    const offset = (mapa.length * tileSize) / 2;
    let spawnPositionSet = false;
    
    // Contadores para los assets GLTF
    let cuadrosCount = 0;
    let macetasCount = 0;

    for (let f = 0; f < mapa.length; f++) {
        for (let c = 0; c < mapa[f].length; c++) {
            const posX = c * tileSize - offset;
            const posZ = f * tileSize - offset;
            const valor = mapa[f][c];

            if (valor === 1) {
                // Crear Muro
                const muro = new THREE.Mesh(geomMuro, matMuroTapiz);
                muro.position.set(posX, 175, posZ);
                muro.castShadow = true; 
                muro.receiveShadow = true;

                muro.geometry.computeBoundingBox();
                muro.boundingBox = new THREE.Box3();
                muro.updateMatrixWorld();
                muro.boundingBox.copy(muro.geometry.boundingBox).applyMatrix4(muro.matrixWorld);

                scene.add(muro);
                obstacles.push(muro);

                // SISTEMA DE GENERACIÓN DE CUADROS (Marcos) - Mantenido
                if (cuadrosCount < 7 && Math.random() > 0.85) {
                    gltfLoader.load('models/Cuadro/scene.gltf', (gltf) => {
                        const cuadro = gltf.scene;
                        cuadro.scale.set(150, 150, 150); 
                        
                        if (mapa[f+1] && mapa[f+1][c] === 0) { 
                            cuadro.position.set(posX, 180, posZ + 126); 
                        } else if (mapa[f-1] && mapa[f-1][c] === 0) { 
                            cuadro.position.set(posX, 180, posZ - 126);
                            cuadro.rotation.y = Math.PI;
                        } else if (mapa[f][c+1] === 0) { 
                            cuadro.position.set(posX + 126, 180, posZ);
                            cuadro.rotation.y = -Math.PI / 2;
                        } else if (mapa[f][c-1] === 0) { 
                            cuadro.position.set(posX - 126, 180, posZ);
                            cuadro.rotation.y = Math.PI / 2;
                        } else { 
                            cuadrosCount--; 
                            return;
                        }
                        
                        scene.add(cuadro);
                    });
                    cuadrosCount++;
                }
            } 
            else if (valor === 8) {
                portalBPos.set(posX, 100, posZ);
                const portal = new THREE.Mesh(geomPortal, matPortalB);
                portal.position.copy(portalBPos);
                scene.add(portal);
                portalsArray.push(portal); 
            }
            else if (valor === 9) {
                portalPPos.set(posX, 100, posZ);
                const portal = new THREE.Mesh(geomPortal, matPortalP);
                portal.position.copy(portalPPos);
                scene.add(portal);
                portalsArray.push(portal);
            }
            else if (valor === 0) {
                // Punto de Spawn Seguro
                if (!spawnPositionSet) {
                    spawnPosition.set(posX, 0, posZ);
                    spawnPositionSet = true;
                } 

                // SISTEMA DE GENERACIÓN DE MACETAS EN ESQUINAS - Mantenido
                let offsetX = 0;
                let offsetZ = 0;
                let formsL = false;
                const pushAmount = 65; 

                const N = mapa[f-1] ? mapa[f-1][c] : 1;
                const S = mapa[f+1] ? mapa[f+1][c] : 1;
                const W = mapa[f][c-1] !== undefined ? mapa[f][c-1] : 1;
                const E = mapa[f][c+1] !== undefined ? mapa[f][c+1] : 1;
                
                if (N === 1 && W === 1 && S === 0 && E === 0) { formsL = true; offsetZ = -pushAmount; offsetX = -pushAmount; } 
                else if (N === 1 && E === 1 && S === 0 && W === 0) { formsL = true; offsetZ = -pushAmount; offsetX = pushAmount; }  
                else if (S === 1 && W === 1 && N === 0 && E === 0) { formsL = true; offsetZ = pushAmount; offsetX = -pushAmount; }  
                else if (S === 1 && E === 1 && N === 0 && W === 0) { formsL = true; offsetZ = pushAmount; offsetX = pushAmount; }   

                const isSpawn = Math.abs(posX - spawnPosition.x) < 10 && Math.abs(posZ - spawnPosition.z) < 10;

                if (formsL && macetasCount < 8 && Math.random() > 0.5 && !isSpawn) {
                    gltfLoader.load('models/maceta_01/scene.gltf', (gltf) => {
                        const maceta = gltf.scene;
                        maceta.scale.set(2, 2, 2); 
                        maceta.position.set(posX + offsetX, 0, posZ + offsetZ); 

                        // --- CORRECCIÓN DEL BYPASS ---
                        maceta.traverse((child) => {
                            if (child.isMesh && child.material) {
                                let mapToUse = texMaceta25; // Default
                                if (child.material.name.includes('26')) mapToUse = texMaceta26;
                                else if (child.material.name.includes('27')) mapToUse = texMaceta27;

                                child.material = new THREE.MeshStandardMaterial({
                                    map: mapToUse,
                                    roughness: 0.8,
                                    transparent: true,
                                    alphaTest: 0.3,
                                    side: THREE.DoubleSide
                                });
                                
                                child.castShadow = true; 
                                child.receiveShadow = true;
                            }
                        });

                        scene.add(maceta);

                        maceta.updateMatrixWorld(true);
                        const macetaBbox = new THREE.Box3().setFromObject(maceta);
                        maceta.position.y += (-macetaBbox.min.y); 
                    });
                    macetasCount++;
                }
            }
        }
    }
}

// --- CARGA DE PERSONAJE Y ANIMACIONES EN CASCADA (SÓLO NORMALES) ---
function cargarPersonaje() {
    const loader = new FBXLoader();

    // 1. Cargar el Personaje Base (Idle normal)
    loader.load('character/Mike/Idle.fbx', (fbxIdle) => {
        character = fbxIdle;
        character.scale.set(1, 1, 1);
        character.position.copy(spawnPosition); 
        
        character.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

        mixer = new THREE.AnimationMixer(character);
        idleAction = mixer.clipAction(character.animations[0]);
        
        // 2. Cargar el resto de animaciones normales
        loader.load('character/Mike/Walking.fbx', (fbxWalk) => {
            walkAction = mixer.clipAction(fbxWalk.animations[0]);

            loader.load('character/Mike/Walking Backwards.fbx', (fbxWalkBack) => {
                walkBackAction = mixer.clipAction(fbxWalkBack.animations[0]);

                loader.load('character/Mike/Running.fbx', (fbxRun) => {
                    runAction = mixer.clipAction(fbxRun.animations[0]);

                    loader.load('character/Mike/Run Backward.fbx', (fbxRunBack) => {
                        runBackAction = mixer.clipAction(fbxRunBack.animations[0]);

                        currentAction = idleAction;
                        currentAction.play();
                        scene.add(character);
                    });
                });
            });
        });
    });
}

function crossFade(nextAction) {
    if (!currentAction || !nextAction || currentAction === nextAction) return;
    nextAction.reset().play();
    currentAction.crossFadeTo(nextAction, 0.25, true); 
    currentAction = nextAction;
}

// --- CONTROLES ---
function onKeyDown(event) {
    // Desbloqueo de audio al interactuar por primera vez
    if (!audioStarted && bgMusic && bgMusic.buffer) {
        bgMusic.play();
        audioStarted = true;
    }

    const k = event.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = true;
    if (event.key === 'Shift') keys.shift = true;
}

function onKeyUp(event) {
    const k = event.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = false;
    if (event.key === 'Shift') keys.shift = false;
}

// --- BUCLE FÍSICO Y MOTOR LÓGICO ---
function update(delta) {
    if (!character || !currentAction) return;

    // 1. Rotación
    if (keys.a) character.rotation.y += rotationSpeed * delta;
    if (keys.d) character.rotation.y -= rotationSpeed * delta;

    // 2. Máquina de Estados (SÓLO NORMALES)
    let targetAction = idleAction;
    let actualSpeed = 0;

    if (keys.w) {
        if (keys.shift) { targetAction = runAction; actualSpeed = 450; }
        else { targetAction = walkAction; actualSpeed = 180; }
    } else if (keys.s) {
        if (keys.shift) { targetAction = runBackAction; actualSpeed = -350; }
        else { targetAction = walkBackAction; actualSpeed = -120; }
    }

    if (targetAction !== currentAction) crossFade(targetAction);

    // 3. Velocidad y Colisiones Axiales
    const movimiento = new THREE.Vector3(0, 0, 0);
    if (keys.w || keys.s) {
        movimiento.z = actualSpeed * delta;
        movimiento.applyQuaternion(character.quaternion);
    }

    const origX = character.position.x;
    const origZ = character.position.z;
    const radioPersonaje = 35; 
    const playerBox = new THREE.Box3();

    // Colisión Eje X
    let nextX = origX + movimiento.x;
    playerBox.min.set(nextX - radioPersonaje, 0, origZ - radioPersonaje);
    playerBox.max.set(nextX + radioPersonaje, 200, origZ + radioPersonaje);
    for (let wall of obstacles) { if (playerBox.intersectsBox(wall.boundingBox)) { nextX = origX; break; } }

    // Colisión Eje Z
    let nextZ = origZ + movimiento.z;
    playerBox.min.set(nextX - radioPersonaje, 0, nextZ - radioPersonaje);
    playerBox.max.set(nextX + radioPersonaje, 200, nextZ + radioPersonaje);
    for (let wall of obstacles) { if (playerBox.intersectsBox(wall.boundingBox)) { nextZ = origZ; break; } }

    character.position.x = nextX;
    character.position.z = nextZ;

    // 4. Lógica de Portales
    if (portalCooldown > 0) {
        portalCooldown -= delta;
    } else {
        const distB = Math.hypot(character.position.x - portalBPos.x, character.position.z - portalBPos.z);
        const distP = Math.hypot(character.position.x - portalPPos.x, character.position.z - portalPPos.z);

        if (distB < 120) {
            character.position.set(portalPPos.x, 0, portalPPos.z);
            portalCooldown = 2.0; 
        } else if (distP < 120) {
            character.position.set(portalBPos.x, 0, portalBPos.z);
            portalCooldown = 2.0;
        }
    }

    // 5. Billboarding: Portales miran a la cámara
    portalsArray.forEach(portal => {
        portal.lookAt(camera.position);
    });

    // 6. Cámara Inteligente con Raycaster
    const playerHead = character.position.clone().add(new THREE.Vector3(0, 150, 0));
    const zIdeal = keys.s ? -180 : -320; 
    const yIdeal = keys.s ? 120 : 180;
    
    const idealCamOffset = new THREE.Vector3(0, yIdeal, zIdeal).applyQuaternion(character.quaternion);
    const idealCamPos = character.position.clone().add(idealCamOffset);

    const rayDir = idealCamPos.clone().sub(playerHead).normalize();
    const rayDist = playerHead.distanceTo(idealCamPos);

    camRaycaster.set(playerHead, rayDir);
    const wallIntersects = camRaycaster.intersectObjects(obstacles);

    let finalCamPos = idealCamPos.clone();

    if (wallIntersects.length > 0) {
        const wallHit = wallIntersects[0];
        if (wallHit.distance < rayDist) {
            finalCamPos = playerHead.clone().add(rayDir.multiplyScalar(wallHit.distance * 0.8));
        }
    }

    camera.position.lerp(finalCamPos, 0.1);
    camera.lookAt(character.position.clone().add(new THREE.Vector3(0, 120, 0)));
}

function animate() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    update(delta);
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}