import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { createAvatarFactory } from './avatar.js';

// Render only on changes: an interactive preview needs no permanent animation loop.
export function createAvatarPreview(container, onAvailability) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'avatar-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Pratonton avatar 3D. Anak panah untuk memutar, tambah atau tolak untuk zum, Home untuk menetapkan semula.');
  container.append(canvas);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#92b9a4', 2.5));
  const light = new THREE.DirectionalLight('#fff4dd', 3);
  light.position.set(-3, 6, 5); scene.add(light);
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 30);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.35, 0);
  controls.enablePan = false;
  controls.enableZoom = false; // Zoom buttons leave the mouse wheel available for page scrolling.
  controls.minPolarAngle = .45; controls.maxPolarAngle = 1.75;
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, .18, 40), new THREE.MeshStandardMaterial({ color: '#ebdcb4', roughness: .9 }));
  pedestal.position.y = -.12; scene.add(pedestal);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, .025, 6, 48), new THREE.MeshStandardMaterial({ color: '#b29a56' }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -.025; scene.add(ring);
  const factory = createAvatarFactory();
  let avatar = null, active = false, disposed = false, lost = false;
  function render() {
    if (active && !disposed && !lost && container.clientWidth && container.clientHeight) renderer.render(scene, camera);
  }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height || disposed) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix(); render();
  }
  function reset() { camera.position.set(3.2, 2.6, 7.4); controls.target.set(0, 1.35, 0); controls.update(); render(); }
  function rotate(direction) {
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 6);
    camera.position.copy(controls.target).add(offset); controls.update(); render();
  }
  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() / factor, 5.8, 11));
    camera.position.copy(controls.target).add(offset); controls.update(); render();
  }
  function keydown(event) {
    if (!['ArrowLeft', 'ArrowRight', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') reset();
    else if (event.key.startsWith('Arrow')) rotate(event.key === 'ArrowLeft' ? 1 : -1);
    else zoom(event.key === '-' ? .85 : 1.18);
  }
  function contextLost(event) { event.preventDefault(); lost = true; controls.enabled = false; onAvailability(false); }
  function contextRestored() { lost = false; controls.enabled = active; onAvailability(true); resize(); }
  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  controls.addEventListener('change', render);
  const observer = new ResizeObserver(resize); observer.observe(container);
  reset();
  return {
    setStudent(student) {
      if (disposed) return;
      if (!student || avatar?.root.userData.studentId !== student.id) {
        if (avatar) scene.remove(avatar.root);
        avatar = student ? factory.create(student) : null;
        if (avatar) scene.add(avatar.root);
      } else factory.update(avatar, student);
      canvas.dataset.appearance = student ? `${student.id}|${student.gender}|${student.outfit}|${student.color}` : '';
      pedestal.visible = ring.visible = Boolean(student);
      render();
    },
    setActive(value) { active = value; controls.enabled = active && !lost; if (active) resize(); },
    rotate, zoom, reset,
    dispose() {
      if (disposed) return;
      disposed = true; observer.disconnect(); controls.dispose();
      canvas.removeEventListener('keydown', keydown);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      factory.dispose();
      for (const item of [pedestal, ring]) { item.geometry.dispose(); item.material.dispose(); }
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
