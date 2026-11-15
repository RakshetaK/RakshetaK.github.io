export function mountMirrorModel(THREE, sceneCanvas, avatar, lightOutfit) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({canvas: sceneCanvas, antialias: true, alpha: true});
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 25);
  camera.position.set(2.7, 1.95, 4.75);
  camera.lookAt(0, 1.3, 0);
  const frontAngle = Math.atan2(camera.position.x,camera.position.z);

  const key = new THREE.DirectionalLight(0xffead5, 3.3);
  key.position.set(-3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.normalBias = .025;
  const rim = new THREE.DirectionalLight(0xd5dfef, 1.7);
  rim.position.set(2, 3, -4);
  scene.add(key, rim, new THREE.HemisphereLight(0xffefe0, 0x4a3d3a, 1.7));

  // Reflection cards exist only in the glass environment, outside the visible scene.
  const reflections = new THREE.Scene();
  reflections.background = new THREE.Color(0x27292c);
  const cards = [
    [-2.7,2,3.4,1.05,5.2,0xf6e6cf],
    [1.35,1.4,3.1,.36,4.5,0xb8c1cd],
    [2.9,2.5,2.5,.82,5.0,0xc9ddf2],
    [0,4.8,.7,4.6,1.5,0xffffff],
  ];
  for (const [x,y,z,width,height,color] of cards) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(width,height), new THREE.MeshBasicMaterial({color, toneMapped: false}));
    card.position.set(x,y,z);
    card.lookAt(0,1.3,0);
    reflections.add(card);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const reflectionMap = pmrem.fromScene(reflections, .025);
  pmrem.dispose();
  for (const card of reflections.children) {
    card.geometry.dispose();
    card.material.dispose();
  }

  const turntable = new THREE.Group();
  turntable.rotation.y = -.48;
  scene.add(turntable);
  function woodMaterial(base, across) {
    const grain = document.createElement('canvas');
    grain.width = grain.height = 384;
    const context = grain.getContext('2d');
    const image = context.createImageData(grain.width, grain.height);
    for (let y = 0; y < grain.height; y++) {
      for (let x = 0; x < grain.width; x++) {
        const u = across ? y : x;
        const v = across ? x : y;
        const knotX = (u - 237) / 18;
        const knotY = (v - 160) / 58;
        const knot = Math.exp(-.5 * (knotX * knotX + knotY * knotY));
        const warped = u + 8 * Math.sin(v / 102 + u / 57) + 4 * Math.sin(v / 29 + u / 31)
          + 11 * Math.tanh(knotX) * knot;
        const bands = Math.sin(warped * .21 + .9 * Math.sin(warped * .067));
        const pore = Math.pow(Math.max(0, Math.sin(warped * 1.1 + v * .026)), 8);
        const grainDetail = 5 * bands - 5 * pore - 8 * knot + ((x * 19 ^ y * 31) % 7) - 3;
        image.data.set([...base.map(channel => channel + grainDetail),255], (y * grain.width + x) * 4);
      }
    }
    context.putImageData(image,0,0);
    const map = new THREE.CanvasTexture(grain);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return new THREE.MeshPhysicalMaterial({map, bumpMap: map, bumpScale: .009, roughness: .64, clearcoat: .22, clearcoatRoughness: .54});
  }
  const blackStain = [37,36,35];
  const wood = woodMaterial(blackStain, false);
  const railWood = woodMaterial(blackStain, true);
  const edge = new THREE.MeshStandardMaterial({color: 0x33302f, roughness: .66});
  const metal = new THREE.MeshStandardMaterial({color: 0x28282a, metalness: .45, roughness: .42});
  const lens = new THREE.MeshPhysicalMaterial({color: 0x202630, roughness: .16, metalness: .1, clearcoat: 1});

  function mesh(parent, geometry, material, x, y, z) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.castShadow = part.receiveShadow = true;
    parent.add(part);
    return part;
  }
  function box(w,h,d,x,y,z,material = wood) {
    if (material !== wood && material !== railWood) {
      return mesh(turntable, new THREE.BoxGeometry(w,h,d), material,x,y,z);
    }
    const bevel = Math.min(.008, w / 6, h / 6, d / 6);
    const halfWidth = w / 2 - bevel;
    const halfHeight = h / 2 - bevel;
    const outline = new THREE.Shape();
    outline.moveTo(-halfWidth,-halfHeight);
    outline.lineTo(halfWidth,-halfHeight);
    outline.lineTo(halfWidth,halfHeight);
    outline.lineTo(-halfWidth,halfHeight);
    outline.closePath();
    const board = new THREE.ExtrudeGeometry(outline, {
      depth: d - 2 * bevel,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      UVGenerator: {
        generateTopUV(_geometry, vertices, ...indices) {
          return indices.map(i => new THREE.Vector2(vertices[i * 3] / w + .5, vertices[i * 3 + 1] / h + .5));
        },
        generateSideWallUV(_geometry, vertices, a,b,c,e) {
          const horizontal = Math.abs(vertices[a * 3] - vertices[b * 3]) > Math.abs(vertices[a * 3 + 1] - vertices[b * 3 + 1]);
          return [a,b,c,e].map(i => {
            const run = vertices[i * 3 + (horizontal ? 0 : 1)] / (horizontal ? w : h) + .5;
            const depth = (vertices[i * 3 + 2] + bevel) / d;
            return horizontal ? new THREE.Vector2(run,depth) : new THREE.Vector2(depth,run);
          });
        },
      },
    });
    board.translate(0,0,-(d - 2 * bevel) / 2);
    return mesh(turntable,board,material,x,y,z);
  }
  function wire(points, radius = .012, material = metal) {
    for (let index = 1; index < points.length; index++) {
      const from = new THREE.Vector3(...points[index - 1]);
      const to = new THREE.Vector3(...points[index]);
      const center = from.clone().lerp(to, .5);
      const rod = mesh(turntable, new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 10), material, center.x, center.y, center.z);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), to.sub(from).normalize());
    }
  }

  mesh(scene, new THREE.CylinderGeometry(.83,.84,.06,96), edge, 0,.033,0);
  mesh(turntable, new THREE.CylinderGeometry(.88,.858,.11,96), [railWood,wood,wood], 0,.126,0);
  mesh(turntable, new THREE.CylinderGeometry(.851,.88,.029,96), [railWood,wood,wood], 0,.1955,0);

  // The photo shows a thick rectangular mirror housing and an open clothes rack behind it.
  box(.88,2.19,.145,0,1.43,.245);
  box(.10,2.28,.22,-.46,1.43,.29);
  box(.10,2.28,.22,.46,1.43,.29);
  box(.88,.105,.22,0,2.518,.29,railWood);
  box(.88,.105,.22,0,.34,.29,railWood);
  box(.78,2.075,.024,0,1.428,.374,edge);
  const backing = new THREE.MeshStandardMaterial({color: 0x101217, roughness: .8});
  box(.75,2.045,.016,0,1.428,.389,backing);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x838992,
    envMap: reflectionMap.texture,
    envMapIntensity: 1.2,
    metalness: 1,
    roughness: .105,
    clearcoat: 1,
    clearcoatRoughness: .06,
    transparent: true,
    opacity: .40,
    depthWrite: false,
  });
  const live = new THREE.CanvasTexture(avatar);
  live.colorSpace = THREE.SRGBColorSpace;
  const surface = new THREE.MeshBasicMaterial({map: live, transparent: true, toneMapped: false, depthWrite: false});
  const glassSize = new THREE.PlaneGeometry(.746,2.032);
  const screen = mesh(turntable,glassSize,surface,0,1.428,.400);
  screen.renderOrder = 1;
  screen.castShadow = screen.receiveShadow = false;
  // The garment display is behind the reflective face so highlights cross the outfit.
  const reflection = mesh(turntable,glassSize,glass,0,1.428,.402);
  reflection.renderOrder = 2;
  reflection.castShadow = reflection.receiveShadow = false;

  for (const x of [-.41,.41]) {
    box(.088,2.12,.088,x,1.29,-.55);
    box(.082,.08,.76,x,2.29,-.16);
  }
  box(.91,.077,.78,0,.38,-.17,railWood);
  box(.91,.086,.085,0,2.29,-.55,railWood);
  wire([[0,2.251,-.57],[0,2.251,.22]], .031, wood);

  const weave = document.createElement('canvas');
  weave.width = weave.height = 128;
  const weaveContext = weave.getContext('2d');
  const fibers = weaveContext.createImageData(128,128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const thread = 138 + ((x + y) % 4 < 2 ? 37 : -23) + ((x * 17 ^ y * 29) % 31);
      fibers.data.set([thread,thread,thread,255], (y * 128 + x) * 4);
    }
  }
  weaveContext.putImageData(fibers,0,0);
  const fiberMap = new THREE.CanvasTexture(weave);
  fiberMap.wrapS = fiberMap.wrapT = THREE.RepeatWrapping;
  fiberMap.repeat.set(3,4);
  const clothMaterials = [
    new THREE.MeshPhysicalMaterial({color: 0xbcb8ae, bumpMap: fiberMap, bumpScale: .004, roughness: .92, sheen: 1, sheenColor: 0x827b6f, side: THREE.DoubleSide}),
    new THREE.MeshPhysicalMaterial({color: 0x314151, bumpMap: fiberMap, bumpScale: .005, roughness: .95, sheen: .5, sheenColor: 0x716e68, side: THREE.DoubleSide}),
    new THREE.MeshPhysicalMaterial({color: 0x827f72, bumpMap: fiberMap, bumpScale: .003, roughness: .95, side: THREE.DoubleSide}),
  ];

  const lace = document.createElement('canvas');
  lace.width = 256;
  lace.height = 48;
  const laceContext = lace.getContext('2d');
  laceContext.strokeStyle = '#f0e6d7';
  laceContext.lineWidth = 1.5;
  laceContext.beginPath();
  laceContext.moveTo(0,2);
  laceContext.lineTo(256,2);
  laceContext.stroke();
  for (let x = 0; x < 256; x += 32) {
    laceContext.beginPath();
    laceContext.moveTo(x,4);
    laceContext.quadraticCurveTo(x + 16,63,x + 32,4);
    laceContext.stroke();
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5;
      laceContext.beginPath();
      laceContext.ellipse(x + 16 + Math.cos(angle) * 5, 18 + Math.sin(angle) * 5, 5, 2.5, angle, 0, Math.PI * 2);
      laceContext.stroke();
    }
  }
  const laceMap = new THREE.CanvasTexture(lace);
  laceMap.colorSpace = THREE.SRGBColorSpace;
  const laceMaterial = new THREE.MeshStandardMaterial({map: laceMap, alphaTest: .35, side: THREE.DoubleSide, roughness: 1});

  function fabricPanel(x, y, z, width, length, material, profile, seed, cut = {}) {
    function point(u, t, back = false) {
      const segment = Math.min(profile.length - 2, Math.floor(t * (profile.length - 1)));
      const blend = t * (profile.length - 1) - segment;
      const span = THREE.MathUtils.lerp(profile[segment], profile[segment + 1], THREE.MathUtils.smoothstep(blend,0,1));
      const fold = Math.sin(u * 13 - t * 4 + seed) * .018 +
        Math.sin(u * 22 + seed + t * 3) * .009 + Math.sin(u * 7 + t * 2) * .013;
      const thickness = Math.cos(u * Math.PI) * (.02 + .015 * Math.sin(t * 3));
      const scoop = (cut.neck ?? 0) * Math.exp(-u * u * 85) * (1 - t) ** 5 * (back ? .35 : 1);
      return [x + u * width * span + (cut.lean ?? .022) * t + .019 * Math.sin(t * 3 + seed) * t,
        y - length * t - scoop - .026 * Math.sin(u * 10 + seed) * t - .05 * Math.abs(u) * (1 - t),
        z + fold * (.35 + t * .85) + (back ? -thickness : thickness) - .034 * t];
    }
    for (const back of [false,true]) {
      const geometry = new THREE.PlaneGeometry(1,1,34,30);
      const vertices = geometry.getAttribute('position');
      for (let index = 0; index < vertices.count; index++) {
        vertices.setXYZ(index, ...point(vertices.getX(index), .5 - vertices.getY(index), back));
      }
      geometry.computeVertexNormals();
      mesh(turntable, geometry, material,0,0,0);
    }
    return point;
  }

  const stitch = new THREE.MeshStandardMaterial({color: 0x817566, roughness: 1});
  const ivoryEdge = new THREE.MeshStandardMaterial({color: 0xb0a79a, roughness: 1});
  const garments = [
    {z:-.43, width:.43, length:1.01, shape:[.92,.99,.85,.8,.88,.94]},
    {z:-.21, width:.45, length:.95, shape:[.57,.64,.78,.83,.99,1.09]},
    {z:.015, width:.39, length:1.14, shape:[.86,1.03,.81,.86,.96,1.11]},
  ];
  for (const [index, garment] of garments.entries()) {
    const {z, width, length, shape} = garment;
    const material = clothMaterials[index];
    wire([[.043,2.24,z],[.033,2.278,z],[0,2.295,z],[-.035,2.276,z],[-.037,2.247,z],
      [0,2.195,z],[0,2.153,z],[-.225,2.071,z],[.222,2.071,z],[0,2.153,z]], .0085);
    const denim = index === 1;
    const body = fabricPanel(0, denim ? 1.86 : 2.091, z, width,length,material,shape,index * 2.4,
      {neck: denim ? 0 : .095, lean: index === 2 ? -.035 : .018});
    if (denim) {
      for (const x of [-.115,.115]) {
        fabricPanel(x,2.08,z,.048,.32,material,[1,.97,.98,1],x);
      }
      const pocket = [[-.19,.33],[.19,.33],[.18,.5],[.03,.55],[-.15,.51],[-.19,.33]];
      wire(pocket.map(([u,t]) => {
        const [x,y,depth] = body(u,t);
        return [x,y,depth+.003];
      }), .0018, stitch);
    } else {
      wire(Array.from({length:18}, (_,i) => body(i / 17 * .43 - .215,.012)), .0022, ivoryEdge);
      for (const side of [-1,1]) {
        const sleeve = fabricPanel(side * .19,2.065,z-.02,.144,index === 0 ? .59 + side * .055 : .41 + side * .035,
          material,[.84,1.12,.86,.69,.72],side * 2,{lean:side * .065});
        wire(Array.from({length:13}, (_,i) => sleeve(i / 12 - .5,.975)), .0015, ivoryEdge);
      }
    }
    if (index === 0) {
      for (const back of [false,true]) {
        const trim = new THREE.PlaneGeometry(1,1,34,4);
        const vertices = trim.getAttribute('position');
        for (let vertex = 0; vertex < vertices.count; vertex++) {
          const u = vertices.getX(vertex);
          const v = .5 - vertices.getY(vertex);
          const [x,y,depth] = body(u,1,back);
          vertices.setXYZ(vertex,x,y+.012-v*.105,depth+(back ? -.003 : .003));
        }
        trim.computeVertexNormals();
        mesh(turntable,trim,laceMaterial,0,0,0);
      }
    } else {
      wire(Array.from({length:23}, (_,i) => body(i/22 - .5,.985)), .0018, denim ? stitch : ivoryEdge);
    }
  }

  box(.14,.045,.08,0,2.587,.308,metal);
  const webcam = mesh(turntable,new THREE.SphereGeometry(.07,28,18),metal,0,2.658,.319);
  webcam.scale.set(1,.76,.76);
  const bezel = mesh(turntable,new THREE.CylinderGeometry(.035,.039,.018,24),edge,0,2.66,.369);
  bezel.rotation.x = Math.PI / 2;
  mesh(turntable,new THREE.SphereGeometry(.026,20,16),lens,0,2.66,.374).scale.z = .37;
  wire([[0,2.61,.28],[.09,2.56,.22],[.1,2.36,.20]], .006);

  let animation;
  let last = 0;
  let spinning = false;
  let destination = turntable.rotation.y;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function render(now) {
    animation = undefined;
    const elapsed = Math.min(.05, (now - last) / 1000);
    last = now;
    if (spinning) destination += elapsed * .67;
    turntable.rotation.y += (destination - turntable.rotation.y) * (motion.matches ? 1 : .24);
    if (screen.visible && lightOutfit(turntable.rotation.y - frontAngle)) live.needsUpdate = true;
    renderer.render(scene, camera);
    if (spinning || Math.abs(destination - turntable.rotation.y) > .001) invalidate();
  }
  function invalidate() {
    animation ??= requestAnimationFrame(render);
  }
  function resize() {
    const {width,height} = sceneCanvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width,height,false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  new ResizeObserver(resize).observe(sceneCanvas);
  resize();
  return {
    turn(radians) { destination += radians; invalidate(); },
    front() {
      destination = frontAngle + Math.round((destination - frontAngle) / (2 * Math.PI)) * 2 * Math.PI;
      invalidate();
    },
    spin(enabled) { spinning = enabled; last = performance.now(); invalidate(); },
    display(visible) {
      if (!visible && !screen.visible) return;
      screen.visible = visible;
      if (visible) live.needsUpdate = true;
      invalidate();
    },
  };
}
