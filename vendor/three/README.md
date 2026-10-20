# Three.js r184 / 0.184.0

Vendored from the official [r184 tag](https://github.com/mrdoob/three.js/tree/r184) on 20 October 2026. MIT license is retained in LICENSE. No runtime CDN request or npm install is needed.

- build/three.module.min.js and build/three.core.min.js: unchanged.
- examples/jsm/controls/OrbitControls.js and examples/jsm/utils/BufferGeometryUtils.js: only `from 'three'` is replaced with `from './three.module.min.js'` so browsers and Node tests use the same local ES module without a build/import-map step.
- LICENSE: unchanged.

Update all files together from one release; preserve this import adjustment and the upstream license.
