export const scanPreviewDuration = 3500;
const scanStartDelay = 420;
const carriageTravelDuration = 2800;

export async function mountFridge(reducedMotion, { previewCanvas } = {}) {
  const THREE = await import('./vendor/three.module.js');
  const canvas = previewCanvas ?? document.querySelector('#fifo-model');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.75, 2.75, 1.74, -1.74, .1, 30);
  const scanCamera = new THREE.OrthographicCamera(-.46, .46, .2875, -.2875, .025, 4);
  const preview = previewCanvas ? null : document.querySelector('#fifo-scan-preview');
  const previewContext = preview?.getContext('2d');
  const bubble = preview?.parentElement;
  camera.position.set(0, 2.03, 8);
  camera.lookAt(0, 1.52, 0);
  scene.add(new THREE.HemisphereLight(0xfff3ee, 0x75636d, 2.1));
  const key = new THREE.DirectionalLight(0xfff0e6, 2.4);
  key.position.set(-4, 6, 5);
  const rim = new THREE.DirectionalLight(0xffe0ec, 2.7);
  rim.position.set(3, 4, -3);
  scene.add(key, rim);
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x353037);
  for (const [x, y, z, w, h, brightness] of [
    [-3.5, 1.9, 3.6, 1.8, 4.5, 13],
    [2.8, 2.1, 2.1, .8, 4.1, 10],
    [3, 2.6, -2.4, 1.4, 4, 11],
    [0, 5, 1, 4, 1.25, 3],
  ]) {
    const color = new THREE.Color(0xfff1e7).multiplyScalar(brightness);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    panel.position.set(x, y, z);
    panel.lookAt(0, 1.5, 0);
    studio.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, .06).texture;
  scene.environmentIntensity = .58;
  pmrem.dispose();
  for (const panel of studio.children) {
    panel.geometry.dispose();
    panel.material.dispose();
  }

  const fridge = new THREE.Group();
  scene.add(fridge);
  const pink = new THREE.MeshPhysicalMaterial({
    color: 0xc08094, roughness: .16, clearcoat: 1, clearcoatRoughness: .065,
    ior: 1.67, envMapIntensity: 2.1,
  });
  const liner = new THREE.MeshStandardMaterial({ color: 0xbcb7aa, roughness: .95, envMapIntensity: .2 });
  const freezer = new THREE.MeshStandardMaterial({
    color: 0xc2d3d3, roughness: .68, envMapIntensity: .2, transparent: true, opacity: .32, depthWrite: false,
  });
  const gasket = new THREE.MeshStandardMaterial({ color: 0xa6a497, roughness: .82 });
  const black = new THREE.MeshStandardMaterial({ color: 0x131116, roughness: .42 });
  const shelf = new THREE.MeshStandardMaterial({
    color: 0xd8e4dc, roughness: .75, envMapIntensity: .25, transparent: true, opacity: .57,
  });

  function box(parent, material, w, h, d, x, y, z, radius = 0) {
    let geometry = new THREE.BoxGeometry(w, h, d);
    if (radius) {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 + radius, -h / 2 + radius);
      shape.lineTo(w / 2 - radius, -h / 2 + radius);
      shape.lineTo(w / 2 - radius, h / 2 - radius);
      shape.lineTo(-w / 2 + radius, h / 2 - radius);
      shape.closePath();
      geometry.dispose();
      geometry = new THREE.ExtrudeGeometry(shape, {
        depth: d - 2 * radius, bevelThickness: radius, bevelSize: radius, bevelSegments: 3, steps: 1,
      });
      geometry.translate(0, 0, radius - d / 2);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // The shell is built around the cavity so it stays visible when the door swings open.
  for (const side of [-1, 1]) {
    box(fridge, pink, .115, 3.03, 1.26, side * .783, 1.52, -.06, .022);
    box(fridge, liner, .04, 2.82, 1.12, side * .707, 1.52, -.045);
  }
  for (const y of [.07, 2.97]) box(fridge, pink, 1.67, .14, 1.26, 0, y, -.06, .025);
  box(fridge, pink, 1.63, 2.93, .14, 0, 1.51, -.62, .024);
  box(fridge, liner, 1.42, 2.8, .07, 0, 1.52, -.519);
  for (const y of [.15, 2.87]) box(fridge, liner, 1.42, .08, 1.09, 0, y, -.03);

  for (const y of [2.36, 2.80]) box(fridge, liner, 1.37, .055, .96, 0, y, -.012, .012);
  for (const x of [-.65, .65]) box(fridge, liner, .065, .44, .96, x, 2.58, -.012, .014);
  box(fridge, freezer, 1.24, .34, .048, 0, 2.58, .482, .018);
  box(fridge, liner, .037, .20, .023, -.54, 2.58, .51, .007);
  for (const y of [.61, 1.18, 1.77]) {
    box(fridge, shelf, 1.39, .028, 1, 0, y, -.016);
    box(fridge, liner, 1.4, .045, .036, 0, y, .479);
  }
  box(fridge, shelf, 1.32, .32, .039, 0, .36, .48, .014);
  box(fridge, liner, .42, .045, .048, 0, .49, .505, .012);
  for (const y of [.29, .35, .41]) {
    box(fridge, new THREE.MeshStandardMaterial({ color: 0x8c4b64 }), .21, .018, .005, -.48, y, -.692);
  }
  const interiorLight = new THREE.PointLight(0xfff1cc, 1.1, 2.8);
  interiorLight.position.set(.13, 2.14, .29);
  fridge.add(interiorLight);

  const housing = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: .61 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x45494d, metalness: .58, roughness: .28 });
  const polishedSteel = new THREE.MeshStandardMaterial({
    color: 0xb8bec4, metalness: .95, roughness: .12, envMapIntensity: 1.65,
  });
  const scannerDepth = -.33;
  for (const x of [-.58, .58]) {
    box(fridge, housing, .24, .23, .27, x, 2.12, scannerDepth - .04, .019);
    for (const offset of [-.075, .075]) {
      box(fridge, steel, .018, .018, .005, x + offset, 2.19, scannerDepth + .097);
    }
  }
  for (const y of [2.08, 2.17]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1.13, 32), polishedSteel);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, y, scannerDepth - .023);
    fridge.add(rail);
  }
  const carriage = new THREE.Group();
  carriage.position.set(-.38, 2.12, scannerDepth);
  fridge.add(carriage);
  box(carriage, housing, .25, .35, .19, 0, 0, 0, .01);
  box(carriage, black, .088, .079, .015, 0, 0, .101, .005);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.023, .023, .014, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x152328, roughness: .14, clearcoat: 1 }));
  lens.rotation.x = Math.PI / 2 + .39;
  lens.position.set(0, 0, .114);
  carriage.add(lens);
  const scanIndicator = new THREE.MeshStandardMaterial({ color: 0xb5788d, emissive: 0xff99bf, emissiveIntensity: 0 });
  box(carriage, scanIndicator, .012, .012, .006, .059, -.047, .099);
  box(fridge, housing, .215, .24, .12, .46, 1.41, -.35, .011);
  box(fridge, liner, .208, .029, .118, .46, 1.51, -.35, .008);
  for (const [color, offset] of [[0xddd8cd, .04], [0xa7474e, -.033], [0x393337, 0]]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.57 + offset, 2.005, -.36),
      new THREE.Vector3(.51 + offset, 1.88, -.44),
      new THREE.Vector3(.60 + offset, 1.71, -.40),
      new THREE.Vector3(.48 + offset, 1.53, -.34),
    ]);
    fridge.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, .006, 6),
      new THREE.MeshStandardMaterial({ color })));
  }

  const carton = new THREE.MeshStandardMaterial({ color: 0x9dac91, roughness: .67 });
  const label = new THREE.MeshStandardMaterial({ color: 0xdce3cb, roughness: .75 });
  const cartonDepth = .19;
  box(fridge, carton, .21, .30, .19, -.48, 1.937, cartonDepth, .009);
  for (const side of [-1, 1]) {
    const flap = box(fridge, carton, .122, .011, .19, -.48 + side * .053, 2.116, cartonDepth);
    flap.rotation.z = -side * .51;
  }
  box(fridge, carton, .014, .025, .19, -.48, 2.153, cartonDepth);
  const sample = new THREE.Group();
  fridge.add(sample);
  box(sample, new THREE.MeshStandardMaterial({ color: 0xe0a289 }), .26, .16, .23, 0, 1.86, .25, .015);
  box(sample, label, .15, .06, .004, 0, 1.88, .367);
  for (let i = 0; i < 10; i++) box(sample, black, i % 3 ? .004 : .008, .036, .004, -.052 + i * .012, 1.88, .37);
  sample.visible = false;

  const door = new THREE.Group();
  door.position.set(.817, 0, .563);
  fridge.add(door);
  box(door, pink, 1.651, 3.015, .154, -.823, 1.52, .077, .037);
  box(door, gasket, 1.48, 2.86, .037, -.823, 1.52, -.005, .014);
  box(door, liner, 1.41, 2.79, .065, -.823, 1.52, -.025, .017);
  for (const y of [.5, 1.16, 1.78]) {
    box(door, liner, 1.28, .055, .24, -.823, y, -.15, .016);
    box(door, liner, 1.28, .14, .044, -.823, y + .075, -.268, .016);
  }

  function graphic(width, height, draw, transparent = false, parent = door) {
    const image = document.createElement('canvas');
    image.width = 512;
    image.height = Math.round(512 * height / width);
    const ctx = image.getContext('2d');
    ctx.scale(image.width / width, image.height / height);
    draw(ctx);
    const map = new THREE.CanvasTexture(image);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map, transparent, toneMapped: false }));
    parent.add(mesh);
    return mesh;
  }

  graphic(.189, .264, ctx => {
    ctx.fillStyle = '#efe9d1';
    ctx.fillRect(0, 0, .189, .264);
    ctx.fillStyle = '#37765f';
    ctx.fillRect(0, 0, .189, .083);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold .028px Arial';
    ctx.fillText('OAT', .025, .053);
    ctx.fillStyle = '#567746';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(.065 + i * .015, .153 + (i % 2) * .02, .019, .006, -.8, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.font = '.017px Arial';
    ctx.fillText('OAT DRINK', .025, .226);
  }, false, fridge).position.set(-.48, 1.937, cartonDepth + .096);

  const bottleProfile = [[0, 0], [.057, 0], [.069, .013], [.07, .046], [.064, .11],
    [.067, .19], [.065, .212], [.056, .233], [.036, .254], [.028, .267], [.028, .299], [0, .299]];
  const bottleGeometry = new THREE.LatheGeometry(bottleProfile.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  for (const [x, y, z, color, capColor] of [
    [.15, 1.785, .18, 0xe3c987, 0xf4ead7], [.37, 1.785, .24, 0xdfca92, 0xb19b65],
    [.48, 1.195, -.075, 0xae542f, 0x72352c], [-.38, 1.195, -.12, 0xc58954, 0x55543a],
  ]) {
    const liquid = new THREE.MeshPhysicalMaterial({ color, roughness: .25, clearcoat: .7 });
    const body = new THREE.Mesh(bottleGeometry, liquid);
    body.position.set(x, y, z);
    const capMaterial = new THREE.MeshStandardMaterial({ color: capColor, roughness: .41 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.032, .033, .037, 32), capMaterial);
    cap.position.set(x, y + .293, z);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.0684, .069, .084, 40, 1, true), label);
    wrap.position.set(x, y + .137, z);
    fridge.add(body, cap, wrap);
  }

  graphic(.19, .32, ctx => {
    ctx.fillStyle = '#df4380';
    ctx.textAlign = 'center';
    ctx.font = 'bold .086px Arial';
    ctx.fillText('F I', .095, .092);
    ctx.fillText('F O', .095, .289);
  }, true, carriage).position.set(0, 0, .097);

  const badgeSteel = new THREE.MeshStandardMaterial({
    color: 0xc8cbd0, metalness: .88, roughness: .27, envMapIntensity: 2,
  });
  const badgeOutline = (path, points) => {
    path.moveTo(...points[0]);
    for (const point of points.slice(1)) path.lineTo(...point);
    path.closePath();
    return path;
  };
  const f = badgeOutline(new THREE.Shape(), [
    [0, 0], [.032, 0], [.032, .042], [.094, .042],
    [.094, .067], [.032, .067], [.032, .093], [.108, .093], [.108, .12], [0, .12],
  ]);
  const i = badgeOutline(new THREE.Shape(), [[0, 0], [.035, 0], [.035, .12], [0, .12]]);
  const o = badgeOutline(new THREE.Shape(), [
    [.015, 0], [.108, 0], [.123, .015], [.123, .105],
    [.108, .12], [.015, .12], [0, .105], [0, .015],
  ]);
  o.holes.push(badgeOutline(new THREE.Path(), [[.032, .029], [.032, .091], [.091, .091], [.091, .029]]));
  for (const [outline, x] of [[f, -.242], [i, -.101], [f, -.033], [o, .109]]) {
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: .009, bevelThickness: .003, bevelSize: .0025, bevelSegments: 3,
    });
    const letter = new THREE.Mesh(geometry, badgeSteel);
    letter.scale.y = .68;
    letter.position.set(-.823 + x, 2.62, .156);
    door.add(letter);
  }

  box(door, black, .91, .62, .048, -.823, 1.86, .164, .017);
  let drawTablet;
  const screen = graphic(.85, .56, ctx => {
    drawTablet = ({ items, game, step }) => {
      ctx.fillStyle = game ? '#faefe9' : '#e2e2f0';
      ctx.fillRect(0, 0, .85, .56);
      ctx.fillStyle = game ? '#d9123b' : '#ed4ebd';
      ctx.fillRect(0, 0, .85, .11);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold .048px Arial';
      ctx.fillText(game ? 'Overview' : 'My Fridge', .039, .075);
      ctx.font = '.035px Arial';
      if (game) {
        ctx.fillStyle = '#fcf9e8';
        ctx.fillRect(.345, .125, .48, .352);
        ctx.fillStyle = '#d9123b';
        ctx.fillText('3 day streak!', .04, .2);
        ctx.fillText('Next up', .37, .2);
        items.filter(item => item.days).forEach((item, i) => {
          ctx.fillText(item.name, .37, .28 + i * .065, .33);
          ctx.fillText(`${item.days} days`, .706, .28 + i * .065, .12);
        });
      } else {
        const colors = { cola: '#be4651', package: '#c17951', chocolate: '#683a32', banana: '#ddb945', berries: '#b74a60', soda: '#d286a7' };
        items.forEach((item, i) => {
          const x = .033 + (i % 3) * .268;
          const y = .14 + Math.floor(i / 3) * .165;
          ctx.fillStyle = '#f1eff8';
          ctx.fillRect(x, y, .247, .148);
          ctx.fillStyle = colors[item.tone];
          ctx.fillRect(x + .101, y + .025, .044, .055);
          ctx.fillStyle = '#332842';
          ctx.fillText(item.name, x + .018, y + .118, .211);
        });
      }
      ctx.fillStyle = game ? '#b81a3a' : '#55324d';
      ctx.fillText(step === 'scan' ? 'Scanning…' : `${items.length} items in inventory`, .039, .519);
    };
    drawTablet({ items: [], game: false });
  });
  screen.position.set(-.823, 1.86, .189);

  const controls = document.querySelector('.fifo-model-controls');
  const spin = document.querySelector('#fifo-spin');
  const toggleDoor = document.querySelector('#fifo-door');
  let rotating = !reducedMotion.matches;
  let angle = -.39;
  let open = false;
  let pointer = null;
  const setRotation = enabled => {
    rotating = enabled;
    spin?.setAttribute('aria-pressed', enabled);
  };
  setRotation(rotating);
  spin?.addEventListener('click', () => setRotation(!rotating));
  reducedMotion.addEventListener('change', event => {
    if (event.matches || previewCanvas) setRotation(!event.matches);
  });
  function setDoor(next) {
    open = next;
    if (open && !rotating) angle = -.28 + Math.round((angle + .28) / (2 * Math.PI)) * 2 * Math.PI;
    toggleDoor.textContent = open ? 'Close door' : 'Open door';
    toggleDoor.setAttribute('aria-pressed', open);
  }
  if (!previewCanvas) {
    toggleDoor.addEventListener('click', () => setDoor(!open));
    for (const [selector, delta] of [['#fifo-turn-left', -.48], ['#fifo-turn-right', .48]]) {
      document.querySelector(selector).addEventListener('click', () => {
        setRotation(false);
        angle += delta;
      });
    }
    canvas.addEventListener('pointerdown', event => {
      if (pointer || !event.isPrimary || event.button !== 0) return;
      setRotation(false);
      pointer = { id: event.pointerId, x: event.clientX };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== pointer?.id) return;
      angle += (event.clientX - pointer.x) * .009;
      pointer.x = event.clientX;
    });
    canvas.addEventListener('lostpointercapture', () => { pointer = null; });
  }

  fridge.rotation.y = angle;
  const openAngle = 1.75;
  let aspect = 1.6;
  let scanning = false;
  const render = () => {
    const doorProgress = door.rotation.y / openAngle;
    const halfWidth = previewCanvas ? 1.55 : THREE.MathUtils.lerp(2.45, 2.75, doorProgress);
    const modelHalfHeight = previewCanvas ? 1.88 : THREE.MathUtils.lerp(1.66, 1.74, doorProgress);
    const halfHeight = Math.max(modelHalfHeight, halfWidth / aspect);
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.right = halfHeight * aspect;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
    if (scanning && previewContext) {
      // Stay inside the cabinet so the door and groceries cannot block the close-up.
      const focusX = carriage.position.x * .88;
      scanCamera.position.copy(fridge.localToWorld(new THREE.Vector3(focusX, 2.24, .04)));
      scanCamera.lookAt(fridge.localToWorld(new THREE.Vector3(focusX, 2.10, scannerDepth)));
      renderer.render(scene, scanCamera);
      previewContext.clearRect(0, 0, preview.width, preview.height);
      previewContext.drawImage(canvas, 0, 0, preview.width, preview.height);
    }
    if (bubble) bubble.hidden = !scanning;
    renderer.render(scene, camera);
  };
  canvas.hidden = false;
  const resize = () => {
    if (!canvas.clientWidth) return;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    aspect = canvas.clientWidth / canvas.clientHeight;
    render();
  };
  resize();
  if (!previewCanvas) {
    controls.hidden = false;
    document.querySelector('#fifo-model-status').textContent = 'Drag to rotate · Open the door to see inside';
  }
  new ResizeObserver(resize).observe(canvas);

  let step;
  let scanStarted = 0;
  let addingBatch = false;
  let scanFrom = -.38;
  let scanTo = -.38;
  let previous = performance.now();
  renderer.setAnimationLoop(now => {
    const elapsed = Math.min((now - previous) / 1000, .05);
    previous = now;
    if (previewCanvas && !canvas.clientWidth) return;
    if (rotating) angle += elapsed * .42;
    const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed * 12);
    const targetDoor = open ? openAngle : 0;
    if (!scanning && Math.abs(angle - fridge.rotation.y) < .0001 && Math.abs(targetDoor - door.rotation.y) < .0001) return;
    fridge.rotation.y += (angle - fridge.rotation.y) * blend;
    door.rotation.y += (targetDoor - door.rotation.y) * blend;
    const scanTime = now - scanStarted;
    if (scanning && scanTime >= scanPreviewDuration) scanning = false;
    if (scanning && !reducedMotion.matches) {
      const progress = THREE.MathUtils.clamp((scanTime - scanStartDelay) / carriageTravelDuration, 0, 1);
      carriage.position.x = THREE.MathUtils.lerp(scanFrom, scanTo, progress);
    }
    render();
  });

  return state => {
    const adding = state.busy && state.flow === 'add';
    if (adding && !addingBatch && !open) setDoor(true);
    addingBatch = adding;
    drawTablet(state);
    screen.material.map.needsUpdate = true;
    if (step !== state.step) {
      step = state.step;
      scanning = step === 'scan';
      scanStarted = performance.now();
      scanIndicator.emissiveIntensity = step === 'scan' ? 1.1 : 0;
      if ((step === 'trigger' || step === 'scan') && open) setDoor(false);
      if (step === 'scan') {
        scanFrom = carriage.position.x;
        scanTo = -scanTo;
      }
    }
    sample.visible = state.items.length > 3 && (!state.busy || state.flow === 'add');
    render();
  };
}
