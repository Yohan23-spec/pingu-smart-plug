// ============================================================
// THREE.JS SETUP - PINGU 3D MODEL
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls;
let model = null;
let mixer = null;
let clock = new THREE.Clock();
let animationId = null;
let isRelayOn = false;
let isModelLoaded = false;
let container = null;

// Ambient light untuk kondisi OFF
let ambientLight, mainLight, fillLight, rimLight;
let modelGlowIntensity = 0;

// ============================================================
// INISIALISASI
// ============================================================
export async function initThree(containerElement) {
    container = containerElement;
    const rect = container.getBoundingClientRect();
    const width = rect.width || container.clientWidth || 600;
    const height = rect.height || container.clientHeight || 400;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);

    // Camera
    camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 0.5, 4.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.0;
    controls.maxDistance = 8.0;
    controls.target.set(0, 0.1, 0);
    controls.update();

    // Lighting
    setupLighting();

    // Environment
    setupEnvironment();

    // Load Model
    await loadModel();

    // Handle resize
    window.addEventListener('resize', onResize);

    // Start animation loop
    animate();

    return { scene, camera, renderer, controls };
}

// ============================================================
// LIGHTING SETUP
// ============================================================
function setupLighting() {
    // Ambient
    ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambientLight);

    // Main Light (Key)
    mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
    mainLight.position.set(2, 3, 4);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    // Fill Light
    fillLight = new THREE.DirectionalLight(0x4488ff, 0.6);
    fillLight.position.set(-2, 0.5, 1);
    scene.add(fillLight);

    // Rim Light
    rimLight = new THREE.DirectionalLight(0x88ccff, 0.4);
    rimLight.position.set(0, -1, -3);
    scene.add(rimLight);

    // Bottom bounce
    const bounceLight = new THREE.DirectionalLight(0x2266aa, 0.3);
    bounceLight.position.set(0, -1, 2);
    scene.add(bounceLight);
}

// ============================================================
// ENVIRONMENT
// ============================================================
function setupEnvironment() {
    // Ground shadow plane
    const groundGeometry = new THREE.PlaneGeometry(6, 6);
    const groundMaterial = new THREE.ShadowMaterial({
        opacity: 0.3,
        color: 0x000000,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.8;
    ground.receiveShadow = true;
    scene.add(ground);

    // Subtle rim light ring
    const ringGeometry = new THREE.RingGeometry(0.7, 0.9, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.75;
    scene.add(ring);
}

// ============================================================
// LOAD MODEL
// ============================================================
function loadModel() {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        
        // Coba load model
        loader.load(
            './assets/models/pingu.glb',
            (gltf) => {
                model = gltf.scene;
                
                // Scale dan posisi
                model.scale.set(1.2, 1.2, 1.2);
                model.position.y = -0.1;
                
                // Setup material
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Enhance material
                        if (child.material) {
                            child.material.roughness = 0.3;
                            child.material.metalness = 0.1;
                            child.material.envMapIntensity = 0.8;
                            
                            // Store for later manipulation
                            child.userData.originalEmissive = child.material.emissive ? child.material.emissive.clone() : null;
                            child.userData.originalEmissiveIntensity = child.material.emissiveIntensity || 0;
                        }
                    }
                });
                
                // Animasi
                if (gltf.animations && gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(model);
                    gltf.animations.forEach((clip) => {
                        const action = mixer.clipAction(clip);
                        action.play();
                    });
                }
                
                scene.add(model);
                isModelLoaded = true;
                
                console.log('✅ Model Pingu berhasil dimuat');
                resolve();
            },
            (progress) => {
                // Progress
                const percent = (progress.loaded / progress.total * 100).toFixed(0);
                if (percent % 10 === 0) {
                    console.log(`📦 Loading model: ${percent}%`);
                }
            },
            (error) => {
                console.warn('⚠️ Gagal memuat model pingu.glb, membuat model alternatif...');
                createFallbackModel();
                resolve();
            }
        );
    });
}

// ============================================================
// FALLBACK MODEL (Jika GLB tidak ditemukan)
// ============================================================
function createFallbackModel() {
    const group = new THREE.Group();
    
    // Body - Egg shape
    const bodyGeo = new THREE.SphereGeometry(0.6, 32, 32);
    bodyGeo.scale(1, 1.1, 0.9);
    const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a2634,
        roughness: 0.2,
        metalness: 0.1,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.1;
    body.castShadow = true;
    group.add(body);
    
    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const headMat = new THREE.MeshPhysicalMaterial({
        color: 0x2a3a4a,
        roughness: 0.2,
        metalness: 0.05,
        clearcoat: 0.4,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.55, 0.05);
    head.castShadow = true;
    group.add(head);
    
    // Eyes
    const eyeMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0,
        metalness: 0,
        emissive: 0x88ccff,
        emissiveIntensity: 0.2,
    });
    const pupilMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a2634,
        roughness: 0,
        metalness: 0,
    });
    
    const eyePositions = [[-0.18, 0.58, 0.32], [0.18, 0.58, 0.32]];
    eyePositions.forEach((pos) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), eyeMat);
        eye.position.set(pos[0], pos[1], pos[2]);
        group.add(eye);
        
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), pupilMat);
        pupil.position.set(pos[0], pos[1] - 0.01, pos[2] + 0.07);
        group.add(pupil);
    });
    
    // Beak
    const beakMat = new THREE.MeshPhysicalMaterial({
        color: 0xf59e0b,
        roughness: 0.6,
        metalness: 0,
    });
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), beakMat);
    beak.position.set(0, 0.52, 0.38);
    beak.rotation.x = 0.3;
    group.add(beak);
    
    // Wings
    const wingMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a2a3a,
        roughness: 0.3,
        metalness: 0.05,
    });
    const wingPositions = [[-0.45, 0.2, 0], [0.45, 0.2, 0]];
    wingPositions.forEach((pos) => {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), wingMat);
        wing.scale.set(0.5, 0.8, 0.3);
        wing.position.set(pos[0], pos[1], pos[2]);
        wing.castShadow = true;
        group.add(wing);
    });
    
    // Store for animation
    model = group;
    scene.add(group);
    isModelLoaded = true;
    
    console.log('✅ Fallback model Pingu dibuat');
}

// ============================================================
// UPDATE RELAY STATUS
// ============================================================
export function updateModelRelayStatus(status) {
    isRelayOn = status === true;
    modelGlowIntensity = isRelayOn ? 1 : 0;
    
    // Update model materials
    if (model) {
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                if (isRelayOn) {
                    // ON - Add glow
                    if (child.material.emissive) {
                        child.material.emissive.setHex(0x22dd88);
                        child.material.emissiveIntensity = 0.2;
                    }
                    // Make slightly brighter
                    child.material.color.multiplyScalar(1.05);
                } else {
                    // OFF - Remove glow
                    if (child.material.emissive) {
                        child.material.emissive.setHex(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                    // Reset color
                    if (child.userData.originalColor) {
                        child.material.color.copy(child.userData.originalColor);
                    }
                }
                child.material.needsUpdate = true;
            }
        });
    }
}

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate() {
    animationId = requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    
    // Update mixer
    if (mixer) {
        mixer.update(delta);
    }
    
    // Idle animation - gentle floating
    if (model && isModelLoaded) {
        const floatOffset = Math.sin(elapsed * 0.8) * 0.04;
        model.position.y = -0.1 + floatOffset;
        
        // Gentle rotation
        model.rotation.y = Math.sin(elapsed * 0.15) * 0.05;
        
        // Slight body sway
        model.rotation.z = Math.sin(elapsed * 0.2) * 0.008;
        
        // Glow intensity lerp
        if (isRelayOn) {
            const pulse = 0.8 + Math.sin(elapsed * 2) * 0.2;
            model.traverse((child) => {
                if (child.isMesh && child.material && child.material.emissive) {
                    child.material.emissiveIntensity = 0.15 * pulse;
                }
            });
        }
    }
    
    // Update controls
    controls.update();
    
    // Render
    renderer.render(scene, camera);
}

// ============================================================
// RESIZE HANDLER
// ============================================================
function onResize() {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const width = rect.width || container.clientWidth || 600;
    const height = rect.height || container.clientHeight || 400;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// ============================================================
// CLEANUP
// ============================================================
export function disposeThree() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }
    
    if (controls) {
        controls.dispose();
    }
    
    scene = null;
    camera = null;
    renderer = null;
    controls = null;
    model = null;
    mixer = null;
}