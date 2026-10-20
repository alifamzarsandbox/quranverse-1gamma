import * as THREE from '../vendor/three/three.module.min.js';
import { createAvatarFactory } from './avatar.js';

// One small reusable renderer; cards display ordinary images, never extra canvases.
export function createAvatarThumbnailRenderer() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(144, 158); renderer.setPixelRatio(1); renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#bad2b8', 2.5));
  const light = new THREE.DirectionalLight('#fff6e3', 2.5); light.position.set(-3, 5, 5); scene.add(light);
  const camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.65, -1.65, .1, 30);
  camera.position.set(3, 2.7, 8); camera.lookAt(0, 1.4, 0);
  const factory = createAvatarFactory();
  let avatar, disposed = false;
  return {
    render(student) {
      if (disposed) throw new Error('Paparan avatar telah ditutup.');
      // ID contributes to skin tone, so a new root is needed for each pupil.
      if (avatar) scene.remove(avatar.root);
      avatar = factory.create(student); scene.add(avatar.root);
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    dispose() { if (disposed) return; disposed = true; factory.dispose(); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); },
  };
}
