import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

function crearTexturaDeVideo(ruta) {
    const video = document.createElement('video');
    video.src = ruta; video.loop = true; video.muted = true; video.playsInline = true;
    video.play().catch(e => console.warn("Video pausado:", e));
    return new THREE.VideoTexture(video);
}

function crearTexturaGlifo(numero, posicionIndex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(0, 0, 0, 0)'; context.fillRect(0, 0, 256, 256);
    
    context.font = 'bold 130px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillStyle = '#0dcaf0'; context.shadowColor = '#000000'; context.shadowBlur = 15;
    context.fillText(numero, 128, 100);

    let puntos = ""; for(let i = 0; i <= posicionIndex; i++) { puntos += "• "; }
    context.font = 'bold 40px Arial'; context.fillText(puntos.trim(), 128, 200);

    const textura = new THREE.CanvasTexture(canvas); textura.colorSpace = THREE.SRGBColorSpace;
    return textura;
}

export function construirMundo(scene) {
    const texLoader = new THREE.TextureLoader(); 
    const fbxLoader = new FBXLoader();
    
    const mapState = {
        obstacles: [],
        portalsArray: [], 
        linkedPortals: [], 
        randomPortals: [], 
        safeSpots: [],     
        spawnPosition: new THREE.Vector3(),
        escapeDoor: null,
        doorPos: new THREE.Vector3(),
        doorBarrier: null,
        pinpadObj: null,
        codigoSecreto: []
    };

    const glifosPosibles = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for(let i = 0; i < 4; i++) { 
        mapState.codigoSecreto.push(glifosPosibles.splice(Math.floor(Math.random() * glifosPosibles.length), 1)[0]); 
    }
    console.log("🔑 PIN DE ESTA PARTIDA:", mapState.codigoSecreto.join(""));

    const floorTex = texLoader.load('assets/Alfombra.jpg'); 
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(40, 40); 
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true; scene.add(floorMesh);

    const tileSize = 250; const geomMuro = new THREE.BoxGeometry(tileSize, 350, tileSize);

    // --- 4 MAPAS DISTINTOS (AHORA CON MUCHOS MÁS PORTALES 9) ---
    const mapa1 = [ 
        [1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1, 1],
        [1, 8, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 9, 0, 1],
        [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 9, 0, 0, 1], // Nuevo portal aleatorio
        [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
        [1, 0, 1, 9, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1], // Nuevo portal aleatorio
        [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
        [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 8, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1]
    ];

    const mapa2 = [ 
        [1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 8, 0, 0, 1],
        [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
        [1, 9, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1, 0, 1, 9, 0, 0, 1, 0, 0, 0, 1], // Nuevo portal aleatorio
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1],
        [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 8, 1],
        [1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
        [1, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 1], // Nuevos portales aleatorios
        [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
        [1, 9, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1]
    ];

    const mapa3 = [ 
        [1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1, 1],
        [1, 8, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 9, 1],
        [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1],
        [1, 9, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1], // Nuevo portal aleatorio
        [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 1], // Nuevo portal aleatorio
        [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 9, 1], // Nuevo portal aleatorio
        [1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
        [1, 9, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 8, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1]
    ];

    const mapa4 = [ 
        [1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 1],
        [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
        [1, 9, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 1, 0, 0, 9, 0, 0, 1, 0, 0, 0, 1], // Nuevo portal aleatorio
        [1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1],
        [1, 9, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 9, 1], // Nuevos portales aleatorios
        [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 9, 1],
        [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
        [1, 8, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1]
    ];

    const catalogoMapas = [
        { grid: mapa1, texture: 'tapiz.webp' },
        { grid: mapa2, texture: 'tapiz.webp' },
        { grid: mapa3, texture: 'Fun.png' },
        { grid: mapa4, texture: 'Fun.png' }
    ]; 
    const mapSelection = catalogoMapas[Math.floor(Math.random() * catalogoMapas.length)];
    const mapa = mapSelection.grid;

    const texMuro = texLoader.load('assets/' + mapSelection.texture);
    texMuro.wrapS = texMuro.wrapT = THREE.RepeatWrapping; texMuro.repeat.set(1, 1); 
    const matMuroTapiz = new THREE.MeshStandardMaterial({ map: texMuro, roughness: 0.8 });

    const matPortalB = new THREE.MeshBasicMaterial({ map: crearTexturaDeVideo('assets/portal_b.webm'), transparent: true, side: THREE.DoubleSide });
    const matPortalP = new THREE.MeshBasicMaterial({ map: crearTexturaDeVideo('assets/portal_p.webm'), transparent: true, side: THREE.DoubleSide });
    
    const geomPortal = new THREE.PlaneGeometry(200, 200);

    const offset = (mapa.length * tileSize) / 2;
    let spawnPositionSet = false;
    const paredesDisponibles = [];

    const cargarPropEscena = (ruta, config) => {
        fbxLoader.load(ruta, (modelo) => {
            modelo.scale.set(config.escala, config.escala, config.escala);
            modelo.position.set(config.x, config.y || 0, config.z);
            if (config.rotY) modelo.rotation.y = config.rotY;

            modelo.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true; child.receiveShadow = true;
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(mat => {
                            if (mat.normalMap) { mat.normalMap.dispose(); mat.normalMap = null; }
                            if (mat.specularMap) { mat.specularMap.dispose(); mat.specularMap = null; }
                            if (mat.aoMap) { mat.aoMap.dispose(); mat.aoMap = null; }
                            if (mat.map) { mat.color.set(0xffffff); }
                            mat.roughness = 0.8; mat.metalness = 0.1; mat.needsUpdate = true;
                        });
                    }
                }
            });

            scene.add(modelo);
            modelo.updateMatrixWorld(true);
            modelo.boundingBox = new THREE.Box3().setFromObject(modelo);
            
            if (config.alignGround) {
                modelo.position.y += (-modelo.boundingBox.min.y);
                modelo.updateMatrixWorld(true);
                modelo.boundingBox.setFromObject(modelo);
            }

            if(config.isObstacle !== false) mapState.obstacles.push(modelo);
            if(config.onLoad) config.onLoad(modelo);
        });
    };

    for (let f = 0; f < mapa.length; f++) {
        for (let c = 0; c < mapa[f].length; c++) {
            const posX = c * tileSize - offset;
            const posZ = f * tileSize - offset;
            const valor = mapa[f][c];

            if (valor === 1 || valor === 5) {
                const muro = new THREE.Mesh(geomMuro, matMuroTapiz);
                muro.position.set(posX, 175, posZ);
                muro.castShadow = true; muro.receiveShadow = true;
                muro.geometry.computeBoundingBox(); muro.boundingBox = new THREE.Box3();
                muro.updateMatrixWorld(); muro.boundingBox.copy(muro.geometry.boundingBox).applyMatrix4(muro.matrixWorld);
                scene.add(muro); mapState.obstacles.push(muro);

                if (valor === 5) { 
                    let pRotY = 0, pOffsetZ = 0, pOffsetX = 0;
                    if (mapa[f+1] && mapa[f+1][c] === 0) { pRotY = 0; pOffsetZ = 126; } 
                    else if (mapa[f-1] && mapa[f-1][c] === 0) { pRotY = Math.PI; pOffsetZ = -126; } 
                    else if (mapa[f][c+1] === 0) { pRotY = Math.PI/2; pOffsetX = 126; } 
                    else if (mapa[f][c-1] === 0) { pRotY = -Math.PI/2; pOffsetX = -126; } 

                    cargarPropEscena('models/PinPad.fbx', {
                        escala: 3.5, 
                        x: posX + pOffsetX, y: 150, z: posZ + pOffsetZ, rotY: pRotY,
                        onLoad: (mesh) => { mapState.pinpadObj = mesh; }, 
                        isObstacle: false 
                    });
                } else {
                    if (mapa[f+1] && (mapa[f+1][c] === 0)) paredesDisponibles.push({x: posX, z: posZ + 126, rotY: 0, isFloor: false});
                    if (mapa[f-1] && (mapa[f-1][c] === 0)) paredesDisponibles.push({x: posX, z: posZ - 126, rotY: Math.PI, isFloor: false});
                    if (mapa[f][c+1] === 0) paredesDisponibles.push({x: posX + 126, z: posZ, rotY: -Math.PI / 2, isFloor: false});
                    if (mapa[f][c-1] === 0) paredesDisponibles.push({x: posX - 126, z: posZ, rotY: Math.PI / 2, isFloor: false});
                }
            } 
            else if (valor === 2) {
                mapState.doorPos.set(posX, 0, posZ);
                let dRotY = 0;
                if (mapa[f-1] && mapa[f-1][c] === 0) { dRotY = Math.PI; } 
                else if (mapa[f+1] && mapa[f+1][c] === 0) { dRotY = 0; } 
                else if (mapa[f][c-1] === 0) { dRotY = -Math.PI/2; } 
                else if (mapa[f][c+1] === 0) { dRotY = Math.PI/2; }

                cargarPropEscena('models/Door.fbx', {
                    escala: 2.2, x: posX, y: 0, z: posZ, rotY: dRotY, alignGround: true,
                    onLoad: (mesh) => { mapState.escapeDoor = mesh; }, 
                    isObstacle: false
                });

                const doorBarrier = new THREE.Mesh(geomMuro, new THREE.MeshBasicMaterial({visible:false}));
                doorBarrier.position.set(posX, 175, posZ);
                doorBarrier.geometry.computeBoundingBox(); doorBarrier.boundingBox = new THREE.Box3();
                doorBarrier.updateMatrixWorld(); doorBarrier.boundingBox.copy(doorBarrier.geometry.boundingBox).applyMatrix4(doorBarrier.matrixWorld);
                mapState.obstacles.push(doorBarrier);
                mapState.doorBarrier = doorBarrier; 
            }
            else if (valor === 8) { 
                mapState.linkedPortals.push(new THREE.Vector3(posX, 0, posZ)); 
                const p = new THREE.Mesh(geomPortal, matPortalB); p.position.set(posX, 100, posZ); scene.add(p); mapState.portalsArray.push(p); 
            }
            else if (valor === 9) { 
                mapState.randomPortals.push(new THREE.Vector3(posX, 0, posZ)); 
                const p = new THREE.Mesh(geomPortal, matPortalP); p.position.set(posX, 100, posZ); scene.add(p); mapState.portalsArray.push(p); 
            }
            else if (valor === 0) {
                if (!spawnPositionSet) { mapState.spawnPosition.set(posX, 0, posZ); spawnPositionSet = true; } 
                
                mapState.safeSpots.push(new THREE.Vector3(posX, 0, posZ));
                paredesDisponibles.push({x: posX, z: posZ, rotY: 0, isFloor: true});
            }
        }
    }

    paredesDisponibles.sort(() => Math.random() - 0.5);
    const lugaresParaCodigo = paredesDisponibles.splice(0, 4);
    
    for(let i = 0; i < 4; i++) {
        const data = lugaresParaCodigo[i];
        const meshSimbolo = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: crearTexturaGlifo(mapState.codigoSecreto[i], i), transparent: true }));
        if (data.isFloor) { meshSimbolo.position.set(data.x, 2, data.z); meshSimbolo.rotation.x = -Math.PI / 2; } 
        else { meshSimbolo.position.set(data.x, 150, data.z); meshSimbolo.rotation.y = data.rotY; }
        scene.add(meshSimbolo);
    }

    let cuadrosGenerados = 0;
    for(let i = 0; i < paredesDisponibles.length; i++) {
        const data = paredesDisponibles[i];
        if (!data.isFloor && Math.random() > 0.80 && cuadrosGenerados < 15) { 
            cargarPropEscena('models/Cuadro.fbx', { escala: 1.4, x: data.x, y: 180, z: data.z, rotY: data.rotY, isObstacle: false });
            cuadrosGenerados++;
        }
    }

    return mapState;
}