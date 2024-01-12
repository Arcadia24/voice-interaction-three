import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// import { GUI } from 'three/addons/libs/dat.gui.module.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const params = {
    red: 1.0,
    green: 1.0,
    blue: 1.0,
    treshold: 0.7,
    strenght: 0.4,
    radius: 0.4
};

// Create a scene
const scene = new THREE.Scene();

// Create a camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);

// Import the canvas element
const canvas = document.getElementById('canvas');

// Create a WebGLRenderer and set its width and height
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    // Antialiasing is used to smooth the edges of what is rendered
    antialias: true,
    // Activate the support of transparency
    // alpha: true
});

renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.outputColorSpace = THREE.SRGBColorSpace;

const composer = new EffectComposer( renderer );
const renderPass = new RenderPass( scene, camera );

const ambientlight = new THREE.AmbientLight( 0xffffff, 2 );
scene.add( ambientlight );

const pointLight = new THREE.PointLight( 0xff8800, 1, 100, 0.005 );
pointLight.position.set( 10, 10, 10 );
scene.add( pointLight );

const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ));
bloomPass.threshold = params.treshold;
bloomPass.strength = params.strenght;
bloomPass.radius = params.radius;
composer.addPass( renderPass );
composer.addPass( bloomPass );

const outputPass = new OutputPass();
composer.addPass( outputPass );

// Create the controls
const controls = new OrbitControls(camera, canvas);

// Handle the window resize event
window.addEventListener('resize', () => {
    // Update the camera
    camera.aspect =  window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Update the renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// Create the sphere
const geometry = new THREE.IcosahedronGeometry(4, 30);
const loader = new THREE.TextureLoader();
const sphereMaterial = new THREE.MeshPhongMaterial( {
    // map: loader.load("./earthmap1k.jpg") ,
    displacementMap: loader.load("./earthbump1k.jpg"),
    displacementScale: 1.0,
    // normalMap: loader.load("./earthnormal1k.png"),
    // normalScale: new THREE.Vector2(1, 1),
    // specularMap: loader.load("./earthspec1k.jpg"),
    // specular: 0xffffff
} );
const mesh = new THREE.Mesh(geometry, sphereMaterial);
scene.add(mesh);
mesh.material.wireframe = true;

const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const analyser = new THREE.AudioAnalyser(sound, 32);

const handleSuccess = function (stream) {
    const audioContext = listener.context; // Use the listener's audio context
    const mediaStreamSource = audioContext.createMediaStreamSource(stream);
    sound.setNodeSource(mediaStreamSource);
};

navigator.mediaDevices
    .getUserMedia({audio: true, video: false})
    .then(handleSuccess)
    .catch(e => console.error(e));

// Function to resume audio context after user interaction
function resumeAudioContext() {
    if (listener.context.state === "suspended") {
        listener.context.resume().then(() => {
            console.log("AudioContext resumed!");
        }).catch(e => console.error(e));
    }
    // Remove the event listener after it has been called
    document.removeEventListener('click', resumeAudioContext);
}

mesh.add( sound );

// Add the event listener for user interaction
document.addEventListener('click', resumeAudioContext);
// Outside of your animate function, declare a buffer to hold frequency data
const frequencyData = new Uint8Array(analyser.frequencyBinCount);

// Assuming your geometry is a BufferGeometry
const positionAttribute = geometry.getAttribute('position');
const originalPosition = positionAttribute.clone(); // Store the original positions
const vertex = new THREE.Vector3();

const animate = () => {
    // Get the frequency data
    analyser.getFrequencyData(frequencyData);

    // Apply the frequency data to your mesh
    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(originalPosition, i);

        let displacement = mapFrequencyToDisplacement(frequencyData[i % frequencyData.length]);
        displacement = THREE.MathUtils.clamp(displacement, -1, 1); // Clamp displacement

        vertex.multiplyScalar(1 + displacement);

        if (isNaN(vertex.x) || isNaN(vertex.y) || isNaN(vertex.z)) {
            console.error('Invalid vertex position detected', vertex);
            continue;
        }

        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    // Update the controls
    controls.update();

    // Update the composer
    composer.render();

    // Call animate recursively
    requestAnimationFrame(animate);
}
// Call animate for the first time
animate();
function mapFrequencyToDisplacement(frequency) {
    // This function maps the frequency data to a displacement value
    // Adjust this mapping as needed for your visual effect
    return frequency / 256; // Example: simple linear mapping
}