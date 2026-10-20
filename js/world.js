import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { createWorldModel } from './world-model.js';

export function createWorld({ container, onSelect = () => {}, onZone = () => {}, onInteract = () => {}, onAvailability = () => {} }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch { throw new Error('Paparan 3D tidak disokong. Gunakan senarai murid dan zon di bawah.'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor('#e5f1ea', 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.className = 'world-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Dunia 3D. Seret untuk putar, cubit atau gunakan roda tetikus untuk zum. Pilih murid melalui avatar atau senarai di sebelah.');
  container.prepend(canvas);
  const labelLayer = document.createElement('div');
  labelLayer.className = 'world-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  container.append(labelLayer);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-40, 40, 20, -20, .1, 400);
  camera.position.set(5, 39, 55);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .09;
  controls.enablePan = false;
  controls.minPolarAngle = .35;
  controls.maxPolarAngle = 1.25;
  controls.maxZoom = 7;
  controls.rotateSpeed = .55;
  controls.update();
  scene.add(new THREE.HemisphereLight('#f5fcff', '#b8cba9', 1.8));
  const sun = new THREE.DirectionalLight('#fff4d9', 2.2);
  sun.position.set(-25, 50, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = .08;
  sun.shadow.bias = -.0003;
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 180;
  scene.add(sun);
  const model = createWorldModel();
  scene.add(model.group);
  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55, depthWrite: false });
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 24);
  scene.add(clouds);
  const haloGeometry = new THREE.RingGeometry(.75, .91, 32);
  const haloMaterial = new THREE.MeshBasicMaterial({ color: '#e8b63f', side: THREE.DoubleSide });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  scene.add(halo);
  const labels = new Map();
  const zoneLabels = new Map();
  const vector = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let active = false, disposed = false, contextLost = false, frameId = 0, lastFrame = 0;
  let width = 1, height = 1, overviewZoom = 1, selectedId = null;
  let autoCamera = false, autoStart = 0, autoAngle = 0;
  let focus = { type: 'overview' }, tween = null;
  let drawFrames = 0, startedAt = 0, lastLabelUpdate = 0;
  const pointerStarts = new Map();
  let multiTouch = false;

  function fit(bounds, target, animate = true) {
    const center = new THREE.Vector3(...target);
    const direction = camera.position.clone().sub(controls.target).normalize();
    const nextPosition = center.clone().addScaledVector(direction, 80);
    const view = new THREE.Matrix4().lookAt(nextPosition, center, new THREE.Vector3(0, 1, 0)).invert();
    let maxX = 0, maxY = 0;
    for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
      const point = new THREE.Vector3(x, y, z).sub(center).applyMatrix4(view);
      maxX = Math.max(maxX, Math.abs(point.x)); maxY = Math.max(maxY, Math.abs(point.y));
    }
    const zoom = Math.min(7, (camera.right - camera.left) / (maxX * 2.3), (camera.top - camera.bottom) / (maxY * 2.3));
    if (focus.type === 'overview') { overviewZoom = zoom; controls.minZoom = zoom * .65; }
    if (animate && !motionPreference.matches && active) {
      tween = { start: performance.now(), from: camera.position.clone(), to: nextPosition, fromTarget: controls.target.clone(), target: center, fromZoom: camera.zoom, zoom };
    } else {
      tween = null; camera.position.copy(nextPosition); controls.target.copy(center); camera.zoom = zoom; camera.updateProjectionMatrix(); controls.update();
    }
  }

  function frameFocus(animate = true) {
    if (!model.layout) return;
    if (focus.type === 'student') {
      const avatar = model.avatars.get(focus.id);
      if (!avatar) { focus = { type: 'overview' }; frameFocus(animate); return; }
      const p = avatar.target;
      fit({ min: [p.x - 3, -1, p.z - 3], max: [p.x + 3, 4.8, p.z + 3] }, [p.x, 1.4, p.z], animate);
    } else if (focus.type === 'zone') {
      const zone = model.layout.zones.find(zone => zone.name === focus.name);
      const r = zone.radius;
      fit({ min: [zone.x - r - 1, -3, zone.z - r - 1], max: [zone.x + r + 1, 4.5, zone.z + r + 1] }, [zone.x, .7, zone.z], animate);
    } else fit(model.layout.bounds, [0, .5, 0], animate);
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height || disposed) return;
    width = rect.width; height = rect.height;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.left = -20 * aspect; camera.right = 20 * aspect;
    camera.top = 20; camera.bottom = -20;
    camera.updateProjectionMatrix();
    frameFocus(false);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  function makeLabel(className, text) {
    const node = document.createElement('div');
    node.className = className;
    node.textContent = text;
    labelLayer.append(node);
    return node;
  }
  function project(position) {
    vector.copy(position).project(camera);
    return { x: (vector.x + 1) * width / 2, y: (1 - vector.y) * height / 2, inView: vector.z > -1 && vector.z < 1 && Math.abs(vector.x) < 1.05 && Math.abs(vector.y) < 1.05 };
  }
  function updateLabels() {
    const close = camera.zoom > overviewZoom * 1.45;
    container.classList.toggle('world-close-view', close);
    const occupied = [];
    const ordered = [...model.avatars].sort(([a], [b]) => a === selectedId ? -1 : b === selectedId ? 1 : 0);
    let visibleCount = 0;
    for (const [id, avatar] of ordered) {
      const label = labels.get(id);
      const p = project(avatar.root.position.clone().add(new THREE.Vector3(0, avatar.crown.visible ? 3.35 : 2.85, 0)));
      const selected = id === selectedId;
      const name = avatar.student.name;
      const shortName = name.split(/\s+/).find(word => !['Muhammad', 'Mohd', 'Nur', 'Ahmad', 'Siti', 'Abdul'].includes(word)) || name;
      const shownName = avatar.student.nickname || (close || selected ? name : shortName);
      if (label.firstElementChild.textContent !== shownName) label.firstElementChild.textContent = shownName;
      const labelWidth = close || selected ? 150 : Math.min(110, shownName.length * 7 + 14);
      const box = { left: p.x - labelWidth / 2, right: p.x + labelWidth / 2, top: p.y - 38, bottom: p.y };
      const collides = occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
      const visible = p.inView && (selected || !collides) && p.y > 32 && p.y < height - 45;
      label.hidden = !visible;
      label.classList.toggle('is-selected', selected);
      if (visible) {
        occupied.push(box); visibleCount++;
        label.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-100%)`;
      }
    }
    for (const zone of model.layout.zones) {
      const p = project(new THREE.Vector3(zone.x, .4, zone.z + zone.radius * .77));
      const label = zoneLabels.get(zone.name);
      const box = { left: p.x - 55, right: p.x + 55, top: p.y, bottom: p.y + 26 };
      const collides = occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
      label.hidden = !p.inView || collides || p.y > height - 28 || p.y < 18;
      label.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,0)`;
    }
    container.dataset.visibleLabels = visibleCount;
  }
  function updateClouds() {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 24; i++) {
      const cluster = Math.floor(i / 3), bubble = i % 3;
      const angle = cluster * Math.PI / 4;
      dummy.position.set(Math.cos(angle) * model.layout.width * .53 + bubble * 1.1, -5.5 - cluster % 3, Math.sin(angle) * model.layout.depth * .7);
      dummy.scale.set(1.5 + bubble * .2, .45 + bubble * .15, 1);
      dummy.updateMatrix(); clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true; clouds.computeBoundingSphere();
  }

  function render(now) {
    if (!active || disposed || contextLost) return;
    frameId = requestAnimationFrame(render);
    if (now - lastFrame < 1000 / 30) return;
    const delta = Math.min(.06, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    model.step(delta, now / 1000, motionPreference.matches);
    if (tween) {
      const t = Math.min(1, (now - tween.start) / 750);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(tween.from, tween.to, ease);
      controls.target.lerpVectors(tween.fromTarget, tween.target, ease);
      camera.zoom = THREE.MathUtils.lerp(tween.fromZoom, tween.zoom, ease);
      camera.updateProjectionMatrix();
      if (t === 1) tween = null;
    } else if (autoCamera && !motionPreference.matches) {
      const offset = camera.position.clone().sub(controls.target);
      const radius = Math.hypot(offset.x, offset.z);
      const angle = autoAngle + Math.sin((now - autoStart) / 9000) * .1;
      camera.position.x = controls.target.x + Math.sin(angle) * radius;
      camera.position.z = controls.target.z + Math.cos(angle) * radius;
    }
    controls.update();
    const selected = model.avatars.get(selectedId);
    halo.visible = Boolean(selected);
    if (selected) halo.position.copy(selected.root.position).add(new THREE.Vector3(0, .04, 0));
    renderer.render(scene, camera);
    drawFrames++;
    if (!startedAt) startedAt = now;
    if (model.layout && now - lastLabelUpdate >= 50) { updateLabels(); lastLabelUpdate = now; }
    container.dataset.renderFrames = String(drawFrames);
  }
  function setActive(value) {
    active = Boolean(value) && !document.hidden;
    cancelAnimationFrame(frameId);
    if (active && !contextLost && !disposed) { resize(); lastFrame = 0; frameId = requestAnimationFrame(render); }
  }
  function interact() { tween = null; autoCamera = false; onInteract(); }
  controls.addEventListener('start', interact);
  function pointerDown(event) {
    if (!pointerStarts.size) multiTouch = false;
    pointerStarts.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointerStarts.size > 1) multiTouch = true;
  }
  function pointerUp(event) {
    const start = pointerStarts.get(event.pointerId);
    pointerStarts.delete(event.pointerId);
    if (!start || multiTouch || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...model.avatars.values()].map(avatar => avatar.root), true)[0];
    if (hit) {
      let object = hit.object;
      while (object && !object.userData.studentId) object = object.parent;
      if (object) { selectStudent(object.userData.studentId, false); onSelect(object.userData.studentId); }
    } else {
      const islandHit = raycaster.intersectObjects([...model.islands.values()].map(island => island.turf))[0];
      if (islandHit) onZone(islandHit.object.parent.userData.zone);
    }
  }
  function pointerCancel(event) { pointerStarts.delete(event.pointerId); }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);
  function keyDown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault(); interact();
    if (event.key === 'Home') overview();
    else if (['+', '=', '-'].includes(event.key)) zoom(event.key === '-' ? .8 : 1.25);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') controls.rotateLeft(event.key === 'ArrowLeft' ? .18 : -.18);
    else controls.rotateUp(event.key === 'ArrowUp' ? .1 : -.1);
    controls.update();
  }
  canvas.addEventListener('keydown', keyDown);
  function lost(event) { event.preventDefault(); contextLost = true; cancelAnimationFrame(frameId); onAvailability(false, 'Paparan 3D terhenti. Senarai murid masih boleh digunakan.'); }
  function restored() { contextLost = false; onAvailability(true); setActive(active); }
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  function overview() { interact(); focus = { type: 'overview' }; frameFocus(); }
  function zoom(factor) { interact(); camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); }
  function selectStudent(id, moveCamera = true) {
    if (!model.avatars.has(id)) return;
    selectedId = id;
    if (moveCamera) { interact(); focus = { type: 'student', id }; frameFocus(); }
  }
  resize();
  return {
    setStudents(students) {
      const result = model.reconcile(students);
      for (const id of result.removed) { labels.get(id)?.remove(); labels.delete(id); }
      if (selectedId && !model.avatars.has(selectedId)) selectedId = null;
      for (const [id, avatar] of model.avatars) {
        let label = labels.get(id);
        if (!label) {
          label = makeLabel('world-student-label', '');
          const name = document.createElement('strong');
          const progress = document.createElement('small');
          label.append(name, progress); labels.set(id, label);
        }
        label.firstElementChild.textContent = avatar.student.nickname || avatar.student.name;
        label.lastElementChild.textContent = `ms. ${avatar.student.page}`;
        label.title = `${avatar.student.nickname ? `${avatar.student.nickname} · ` : ''}${avatar.student.name} · ${avatar.student.status} · Muka surat ${avatar.student.page}`;
      }
      for (const zone of model.layout.zones) {
        if (!zoneLabels.has(zone.name)) zoneLabels.set(zone.name, makeLabel('world-zone-label', ''));
        const label = zoneLabels.get(zone.name);
        label.textContent = `${zone.name} · ${zone.members.length}`;
        label.style.setProperty('--zone-color', zone.color);
        label.style.setProperty('--zone-dark', zone.dark);
      }
      if (result.layoutChanged) {
        updateClouds();
        const extent = Math.max(model.layout.width, model.layout.depth) * .65;
        Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent });
        sun.shadow.camera.updateProjectionMatrix();
        frameFocus(false);
      }
      container.dataset.students = students.length;
      container.dataset.zones = model.islands.size;
      return result;
    },
    setActive,
    setPresentation(value) {
      const next = Boolean(value) && !motionPreference.matches;
      if (next && !autoCamera) { autoStart = performance.now(); autoAngle = controls.getAzimuthalAngle(); }
      autoCamera = next;
      container.dataset.autoCamera = String(autoCamera);
    },
    selectStudent,
    clearSelection() { selectedId = null; },
    focusZone(name) {
      if (!model.islands.has(name)) return;
      interact(); focus = { type: 'zone', name }; frameFocus();
    },
    overview, zoom,
    rotate(direction) { interact(); controls.rotateLeft(direction * .22); controls.update(); },
    diagnostics() {
      return { ...model.stats(), active, autoCamera, contextLost, selectedId, zoom: camera.zoom, drawFrames, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, gpuGeometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, elapsedSeconds: startedAt ? (performance.now() - startedAt) / 1000 : 0, visibleLabels: Number(container.dataset.visibleLabels || 0) };
    },
    // Used by the local browser verification page, never attached to the production UI.
    simulateContextLoss() { const extension = renderer.getContext().getExtension('WEBGL_lose_context'); extension?.loseContext(); return () => extension?.restoreContext(); },
    dispose() {
      if (disposed) return;
      disposed = true; active = false; cancelAnimationFrame(frameId);
      resizeObserver.disconnect(); controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerCancel); canvas.removeEventListener('keydown', keyDown);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      model.dispose(); cloudGeometry.dispose(); cloudMaterial.dispose(); clouds.dispose(); haloGeometry.dispose(); haloMaterial.dispose();
      sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); labelLayer.remove(); labels.clear(); zoneLabels.clear(); scene.clear();
    },
  };
}
