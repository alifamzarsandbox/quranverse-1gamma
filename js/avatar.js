import * as THREE from '../vendor/three/three.module.min.js';
import { mergeGeometries } from '../vendor/three/BufferGeometryUtils.js';
import { avatarColors } from './config.js';

const skinColors = ['#dca16f', '#efba8b', '#bd8055', '#e8ad7e'];

export function avatarAppearanceKey(student) {
  return `${student.gender}|${student.outfit}|${student.color}`;
}

// The factory owns all shared assets. Removing one avatar must never dispose them.
export function createAvatarFactory() {
  const geometries = new Map();
  const materials = new Map();
  let disposed = false;
  function box(w, h, d, x, y, z) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
  function geometry(key, build) {
    if (!geometries.has(key)) {
      const pieces = build();
      const merged = mergeGeometries(pieces, false);
      pieces.forEach(piece => piece.dispose());
      geometries.set(key, merged);
    }
    return geometries.get(key);
  }
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true }));
    return materials.get(color);
  }
  function mesh(parent, key, build, color) {
    const part = new THREE.Mesh(geometry(key, build), material(color));
    part.castShadow = true;
    parent.add(part);
    return part;
  }
  function buildVisual(student) {
    const visual = new THREE.Group();
    const girl = student.gender === 'Perempuan';
    const traditional = student.outfit === 'tradisional';
    const sports = student.outfit === 'sukan';
    const shirt = (avatarColors[student.color] || avatarColors.hijau).hex;
    let hash = 0;
    for (const char of student.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    const skin = skinColors[hash % skinColors.length];
    mesh(visual, 'skin', () => [box(.66, .65, .56, 0, 1.94, .03), box(.21, .25, .23, -.55, .99, .01), box(.21, .25, .23, .55, .99, .01)], skin);
    mesh(visual, 'shirt', () => [box(.76, .83, .45, 0, 1.18, 0), box(.25, .66, .34, -.5, 1.33, 0), box(.25, .66, .34, .5, 1.33, 0)], shirt);
    mesh(visual, girl && !sports ? 'skirt' : 'legs', () => girl && !sports
      ? [new THREE.CylinderGeometry(.45, .57, .78, 6).translate(0, .46, 0)]
      : [box(.29, .64, .32, -.23, .43, 0), box(.29, .64, .32, .23, .43, 0)], traditional ? shirt : '#314f62');
    mesh(visual, 'shoes', () => [box(.34, .17, .47, -.23, .085, .08), box(.34, .17, .47, .23, .085, .08)], '#334452');
    mesh(visual, 'eyes', () => [box(.075, .09, .025, -.16, 1.98, .321), box(.075, .09, .025, .16, 1.98, .321), box(.1, .025, .025, 0, 1.8, .321)], '#383b3c');
    mesh(visual, 'cheeks', () => [box(.11, .04, .025, -.23, 1.86, .322), box(.11, .04, .025, .23, 1.86, .322)], '#dd8b7b');
    if (girl) {
      mesh(visual, 'hijab', () => [
        box(.83, .18, .72, 0, 2.32, -.025), box(.13, .67, .71, -.39, 1.97, -.025), box(.13, .67, .71, .39, 1.97, -.025),
        box(.67, .72, .13, 0, 1.98, -.31), new THREE.CylinderGeometry(.34, .57, .35, 6).translate(0, 1.6, -.05),
      ], sports ? '#e8f2ee' : traditional ? new THREE.Color(shirt).lerp(new THREE.Color('#ffffff'), .62).getStyle() : '#fff6df');
    } else {
      mesh(visual, traditional ? 'songkok' : 'hair', () => traditional
        ? [box(.74, .28, .65, 0, 2.34, -.015)]
        : [box(.72, .17, .63, 0, 2.28, -.01), box(.13, .25, .57, -.32, 2.12, -.025), box(.13, .22, .57, .32, 2.14, -.025)], '#343434');
    }
    if (traditional && !girl) mesh(visual, 'samping', () => [box(.79, .34, .48, 0, .85, 0)], '#ead49e');
    if (sports) mesh(visual, 'sports-stripe', () => [box(.12, .64, .02, -.21, 1.23, .236), box(.12, .64, .02, .21, 1.23, .236)], '#f6f5e5');
    return visual;
  }
  function create(student) {
    if (disposed) throw new Error('Penjana avatar telah ditutup.');
    const root = new THREE.Group();
    root.userData.studentId = student.id;
    const visual = buildVisual(student);
    root.add(visual);
    const crown = mesh(root, 'crown', () => [
      new THREE.CylinderGeometry(.43, .4, .14, 8).translate(0, 2.63, 0),
      ...[-.29, 0, .29].map(x => new THREE.ConeGeometry(.12, .3, 4).translate(x, 2.83, .2)),
    ], '#f5c84b');
    crown.name = 'crown';
    crown.visible = student.status === 'Khatam';
    return { root, visual, crown, appearanceKey: avatarAppearanceKey(student) };
  }
  return {
    create,
    update(avatar, student) {
      const nextKey = avatarAppearanceKey(student);
      if (avatar.appearanceKey !== nextKey) {
        avatar.root.remove(avatar.visual);
        avatar.visual = buildVisual(student);
        avatar.root.add(avatar.visual);
        avatar.appearanceKey = nextKey;
      }
      avatar.crown.visible = student.status === 'Khatam';
    },
    stats() { return { geometries: geometries.size, materials: materials.size, disposed }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      geometries.clear(); materials.clear();
    },
  };
}
