import * as THREE from '../vendor/three/three.module.min.js';
import { createAvatarFactory } from './avatar.js';
import { bridgeConnections, createWorldLayout } from './world-layout.js';
import { statuses } from './config.js';

export function createWorldModel() {
  const group = new THREE.Group();
  const avatars = new Map();
  const islands = new Map();
  const factory = createAvatarFactory();
  const geometry = {
    turf: new THREE.CylinderGeometry(1, 1, .38, 10),
    rim: new THREE.CylinderGeometry(1, .94, .22, 10),
    rock: new THREE.CylinderGeometry(.96, .25, 3.6, 7),
    trunk: new THREE.CylinderGeometry(.1, .15, 1.1, 5),
    tree: new THREE.ConeGeometry(.75, 1.7, 5),
    crystal: new THREE.OctahedronGeometry(.48, 0),
    step: new THREE.CylinderGeometry(.28, .21, .16, 6),
  };
  const materials = new Map();
  let layout;
  let disposed = false;
  let signature = '';
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: true }));
    return materials.get(color);
  }
  function mesh(parent, geo, color, y = 0) {
    const result = new THREE.Mesh(geo, material(color));
    result.position.y = y;
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  for (const status of statuses) {
    const root = new THREE.Group();
    root.userData.zone = status.name;
    const turf = mesh(root, geometry.turf, status.pale, .02);
    const rim = mesh(root, geometry.rim, status.color, -.28);
    const rock = mesh(root, geometry.rock, new THREE.Color(status.color).lerp(new THREE.Color('#667967'), .38).getStyle(), -2.19);
    const decor = new THREE.Group();
    root.add(decor);
    for (let i = 0; i < 2; i++) {
      const tree = new THREE.Group();
      mesh(tree, geometry.trunk, '#9b805c', .65);
      mesh(tree, geometry.tree, i ? '#6b9e83' : status.color, 1.55);
      mesh(tree, geometry.tree, i ? '#8eb99b' : status.color, 2.2).scale.setScalar(.72);
      decor.add(tree);
    }
    const crystal = mesh(decor, geometry.crystal, status.color, .65);
    crystal.scale.set(.8, 1.5, .8);
    group.add(root);
    islands.set(status.name, { root, turf, rim, rock, decor });
  }
  const paths = new THREE.InstancedMesh(geometry.step, material('#d1bf82'), bridgeConnections.length * 6);
  paths.castShadow = false;
  group.add(paths);
  function updatePaths() {
    const zonesByName = new Map(layout.zones.map(zone => [zone.name, zone]));
    const dummy = new THREE.Object3D();
    let index = 0;
    for (const [fromStage, toStage] of bridgeConnections) {
      const a = zonesByName.get(fromStage), b = zonesByName.get(toStage);
      const direction = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
      // Adjacent stages align on X/Z; meet the actual ten-sided turf edge with a small overlap.
      const edgeFactor = Math.abs(direction.x) > .5 ? Math.cos(Math.PI / 10) : 1;
      const from = new THREE.Vector3(a.x, -.45, a.z).addScaledVector(direction, a.radius * edgeFactor - .1);
      const to = new THREE.Vector3(b.x, -.45, b.z).addScaledVector(direction, -b.radius * edgeFactor + .1);
      for (let step = 0; step < 6; step++) {
        dummy.position.copy(from).lerp(to, step / 5);
        dummy.position.y -= Math.sin(step / 5 * Math.PI) * .5;
        dummy.rotation.y = step * .4;
        dummy.updateMatrix();
        paths.setMatrixAt(index++, dummy.matrix);
      }
    }
    paths.instanceMatrix.needsUpdate = true;
    paths.computeBoundingSphere();
  }
  return {
    group, avatars, islands,
    get layout() { return layout; },
    reconcile(students) {
      if (disposed) throw new Error('Dunia telah ditutup.');
      const nextLayout = createWorldLayout(students); // Validate before changing any live object.
      const nextSignature = nextLayout.zones.map(zone => `${zone.name}:${zone.members.map(student => student.id).join(',')}`).join('|');
      const layoutChanged = signature !== nextSignature;
      signature = nextSignature;
      layout = nextLayout;
      const incoming = new Set(students.map(student => student.id));
      const removed = [], added = [];
      for (const [id, avatar] of avatars) if (!incoming.has(id)) {
        group.remove(avatar.root); avatars.delete(id); removed.push(id);
      }
      for (const zone of layout.zones) {
        const island = islands.get(zone.name);
        island.root.position.set(zone.x, 0, zone.z);
        island.turf.scale.set(zone.radius, 1, zone.radius);
        island.rim.scale.set(zone.radius, 1, zone.radius);
        island.rock.scale.set(zone.radius, 1, zone.radius);
        island.decor.children[0].position.set(-zone.radius * .67, .2, -zone.radius * .55);
        island.decor.children[1].position.set(zone.radius * .65, .2, -zone.radius * .56);
        island.decor.children[2].position.set(zone.radius * .7, .65, zone.radius * .4);
        zone.members.forEach((student, index) => {
          const slot = zone.slots[index];
          let avatar = avatars.get(student.id);
          if (!avatar) {
            avatar = factory.create(student);
            avatar.root.position.set(slot.x, slot.y, slot.z);
            avatar.phase = avatars.size * 1.47;
            avatars.set(student.id, avatar); group.add(avatar.root); added.push(student.id);
          } else factory.update(avatar, student);
          avatar.student = { ...student };
          avatar.target = new THREE.Vector3(slot.x, slot.y, slot.z);
        });
      }
      if (layoutChanged) updatePaths();
      return { added, removed, layoutChanged };
    },
    step(delta, time, reducedMotion = false) {
      const blend = 1 - Math.exp(-delta * 6);
      for (const avatar of avatars.values()) {
        if (reducedMotion) avatar.root.position.copy(avatar.target);
        else avatar.root.position.lerp(avatar.target, blend);
        avatar.visual.position.y = reducedMotion ? 0 : Math.sin(time * 1.8 + avatar.phase) * .045;
        avatar.visual.rotation.z = reducedMotion ? 0 : Math.sin(time + avatar.phase) * .015;
        avatar.crown.position.y = avatar.visual.position.y;
      }
    },
    stats() { return { students: avatars.size, zones: islands.size, shared: factory.stats(), disposed }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.clear(); avatars.clear(); islands.clear();
      factory.dispose();
      Object.values(geometry).forEach(value => value.dispose());
      materials.forEach(value => value.dispose()); materials.clear();
      paths.dispose();
    },
  };
}
