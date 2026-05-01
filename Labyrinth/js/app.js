import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { construirMundo } from './Labyrinth.js';
import { initPlayer, updatePlayer } from './Player.js';

let camera, scene, renderer, mapData, bgMusic;
let gameStarted = false; 
let isUIOpen = false;
let doorOpened = false;
let successTriggered = false;
let alertTimeout; 
const clock = new THREE.Clock();

let currentPin = "";
let sfxPin, sfxError; // Variables globales para los sonidos de la UI

init();

function init() {
    THREE.DefaultLoadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
        const progress = (itemsLoaded / itemsTotal) * 100;
        document.getElementById('progress-bar').style.width = progress + '%';
        document.getElementById('loading-text').innerText = Math.floor(progress) + '%';
    };

    THREE.DefaultLoadingManager.onLoad = function () {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
    };

    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        if (bgMusic && bgMusic.buffer) bgMusic.play();
        gameStarted = true; 
    });

    document.addEventListener('keydown', (event) => {
        if (!gameStarted || doorOpened) return;
        
        if (event.key.toLowerCase() === 'e' && !isUIOpen) {
            if (mapData.pinpadObj && camera.position.distanceTo(mapData.pinpadObj.position) < 250) {
                abrirPinpad();
            }
            else if (mapData.escapeDoor && camera.position.distanceTo(mapData.escapeDoor.position) < 250) {
                mostrarAlertaPuerta();
            }
        }
        
        if (event.key === 'Escape' && isUIOpen) {
            cerrarPinpad();
        }
    });

    document.getElementById('pinpad-close').addEventListener('click', cerrarPinpad);

    const botones = document.querySelectorAll('.pinpad-btn:not(.action-btn)');
    botones.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const numero = e.target.innerText;
            if (numero !== 'C' && numero !== 'E' && currentPin.length < 4) {
                currentPin += numero;
                actualizarPantallaPinpad();
                reproducirSonido(sfxPin); // Sonido al teclear
            }
        });
    });

    document.getElementById('pinpad-clear').addEventListener('click', () => {
        currentPin = "";
        actualizarPantallaPinpad();
        reproducirSonido(sfxPin); // Sonido al borrar
        const msg = document.getElementById('pinpad-msg');
        msg.innerText = "INTRODUCE EL PIN";
        msg.style.color = "#a0a0b0";
    });

    document.getElementById('pinpad-enter').addEventListener('click', () => {
        const correcta = mapData.codigoSecreto.join('');
        const msg = document.getElementById('pinpad-msg');

        if (currentPin === correcta) {
            msg.innerText = "CÓDIGO ACEPTADO";
            msg.style.color = "#4ade80"; 
            reproducirSonido(sfxPin);
            
            setTimeout(() => {
                cerrarPinpad();
                if (mapData.escapeDoor) mapData.escapeDoor.visible = false;
                if (mapData.doorBarrier) {
                    const index = mapData.obstacles.indexOf(mapData.doorBarrier);
                    if (index > -1) mapData.obstacles.splice(index, 1);
                }
                doorOpened = true;
            }, 1000); 

        } else {
            msg.innerText = "ERROR CAPA 8"; 
            msg.style.color = "#ff2a5f"; 
            currentPin = ""; 
            actualizarPantallaPinpad();
            reproducirSonido(sfxError); // ¡Sonido de error de capa 8!
        }
    });

    scene = new THREE.Scene(); 
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // --- NUEVAS RUTAS DE CIELOS ---
    const catalogoCielos = [
        'assets/sky/sky_1.exr',
        'assets/sky/sky_2.exr',
        'assets/sky/sky_3.exr',
        'assets/sky/sky_4.exr'
    ];
    const cieloElegido = catalogoCielos[Math.floor(Math.random() * catalogoCielos.length)];

    const exrLoader = new EXRLoader(THREE.DefaultLoadingManager);
    exrLoader.load(cieloElegido, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture; 
    });

    const ambient = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); 
    sun.position.set(500, 1000, 250); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); scene.add(sun);

    // --- NUEVAS RUTAS DE AUDIO ---
    const listener = new THREE.AudioListener(); 
    camera.add(listener);

    const catalogoAudio = [
        'assets/bgm/dreamcore.wav',
        'assets/bgm/dreamcore_2.wav',
        'assets/bgm/dreamcore_3.wav',
        'assets/bgm/dreamcore_4.wav'
    ];
    const pistaElegida = catalogoAudio[Math.floor(Math.random() * catalogoAudio.length)];
    
    bgMusic = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load(pistaElegida, (b) => { 
        bgMusic.setBuffer(b); 
        bgMusic.setLoop(true); 
        bgMusic.setVolume(0.4); 
    });

    // Cargar SFX
    const portalSoundB = new THREE.Audio(listener);
    const portalSoundP = new THREE.Audio(listener);
    sfxPin = new THREE.Audio(listener);
    sfxError = new THREE.Audio(listener);
    const sfxStep = new THREE.Audio(listener);

    audioLoader.load('assets/affects/portal_b.wav', (b) => { portalSoundB.setBuffer(b); portalSoundB.setVolume(0.8); });
    audioLoader.load('assets/affects/portal_p.wav', (b) => { portalSoundP.setBuffer(b); portalSoundP.setVolume(0.8); });
    audioLoader.load('assets/affects/pin.wav', (b) => { sfxPin.setBuffer(b); sfxPin.setVolume(1.0); });
    audioLoader.load('assets/affects/error.wav', (b) => { sfxError.setBuffer(b); sfxError.setVolume(1.0); });
    
    // El sonido de los pasos suele ser repetitivo, bajamos un poco el volumen
    audioLoader.load('assets/affects/step.wav', (b) => { sfxStep.setBuffer(b); sfxStep.setVolume(0.5); });

    mapData = construirMundo(scene);
    
    mapData.sfxPortalB = portalSoundB;
    mapData.sfxPortalP = portalSoundP;
    mapData.sfxStep = sfxStep; // Lo inyectamos para que Player.js lo use

    initPlayer(scene, mapData.spawnPosition);

    window.addEventListener('resize', () => { 
        camera.aspect = window.innerWidth / window.innerHeight; 
        camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); 
    });
    
    renderer.setAnimationLoop(animate);
}

function reproducirSonido(audioObject) {
    if (audioObject && audioObject.buffer) {
        if (audioObject.isPlaying) audioObject.stop();
        audioObject.play();
    }
}

function abrirPinpad() {
    isUIOpen = true;
    currentPin = "";
    actualizarPantallaPinpad();
    document.getElementById('pinpad-msg').innerText = "INTRODUCE EL PIN";
    document.getElementById('pinpad-msg').style.color = "#a0a0b0";
    document.getElementById('interact-prompt').style.display = 'none';
    document.getElementById('pinpad-ui').style.display = 'flex';
}

function cerrarPinpad() {
    isUIOpen = false;
    document.getElementById('pinpad-ui').style.display = 'none';
}

function actualizarPantallaPinpad() {
    const displayStr = currentPin.padEnd(4, '-');
    document.getElementById('pinpad-screen').innerText = displayStr;
}

function mostrarAlertaPuerta() {
    const alerta = document.getElementById('door-alert');
    if (alerta) {
        alerta.style.display = 'block';
        clearTimeout(alertTimeout);
        alertTimeout = setTimeout(() => {
            alerta.style.display = 'none';
        }, 3000);
    }
}

function animate() {
    const delta = clock.getDelta();
    
    if (mapData && gameStarted) {
        if (!isUIOpen && !successTriggered) updatePlayer(delta, camera, mapData);

        if (!isUIOpen && !doorOpened) {
            let cercaDePinpad = mapData.pinpadObj && camera.position.distanceTo(mapData.pinpadObj.position) < 250;
            let cercaDePuerta = mapData.escapeDoor && camera.position.distanceTo(mapData.escapeDoor.position) < 250;
            
            const prompt = document.getElementById('interact-prompt');
            if (prompt) {
                prompt.style.display = (cercaDePinpad || cercaDePuerta) ? 'block' : 'none';
            }
        } else {
            const prompt = document.getElementById('interact-prompt');
            if(prompt) prompt.style.display = 'none';
        }

        if (doorOpened && !successTriggered) {
            const distToExit = Math.hypot(camera.position.x - mapData.doorPos.x, camera.position.z - mapData.doorPos.z);
            if (distToExit < 150) {
                successTriggered = true;
                document.getElementById('success-screen').style.display = 'flex';
            }
        }
    }
    
    renderer.render(scene, camera);
}