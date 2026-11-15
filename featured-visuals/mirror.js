import {mountMirrorModel} from './mirror-model.js';
import {createDenimTexture, createSleeveMesh, createTrouserMesh} from './mirror-clothing.js';

const video = document.querySelector('#camera');
const canvas = document.querySelector('#landmarks');
const avatarCanvas = document.querySelector('#avatar');
const context = canvas.getContext('2d');
const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const demoButton = document.querySelector('#demo-button');
const footage = document.querySelector('#real-system');
const recording = document.querySelector('#demo-video');
const status = document.querySelector('#camera-status');
const mirrorLabel = document.querySelector('#mirror-idle-label');
const modelCanvas = document.querySelector('#mirror-model');
const modelStatus = document.querySelector('#model-status');
const leftButton = document.querySelector('#mirror-left');
const rightButton = document.querySelector('#mirror-right');
const frontButton = document.querySelector('#mirror-front');
const playButton = document.querySelector('#mirror-play');
const pauseButton = document.querySelector('#mirror-pause');
const visionBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304';
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let stream;
let setup;
let animation;
let session = 0;
let model;
let rig;
let threeModule;
const loadThree = () => threeModule ??= import('./vendor/three.module.js');
const armJoints = [[11,13,15],[12,14,16]];

function hasFullBodyPose(indices, world, image) {
  return indices.every(index => {
    const point = image[index];
    return world[index]?.visibility >= .55 && point?.visibility >= .55 &&
      point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
  });
}

function createRig(THREE) {
  const scene = new THREE.Scene();
  const aspect = 480 / 1280;
  const halfHeight = .93;
  const halfWidth = halfHeight * aspect;
  const camera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, .1, 20);
  camera.position.set(0, -.34, 4);
  camera.zoom = .85;
  camera.updateProjectionMatrix();
  const renderer = new THREE.WebGLRenderer({canvas: avatarCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true});
  renderer.setSize(480, 1280, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  const light = new THREE.DirectionalLight(0xfff1ee, 1.5);
  const rim = new THREE.DirectionalLight(0xe4d7f5, 1.65);
  rim.position.set(2, 1, -3);
  scene.add(light, rim, new THREE.HemisphereLight(0xebe4ff, 0x494347, .67));
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x20202a);
  for (const [x,y,z,w,h,intensity] of [
    [-1.5,1.2,3,2.1,5,3.3], [2.1,.4,2,1.4,4,2.6], [.2,3.1,1.2,3,1.1,3],
  ]) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xfff4ff).multiplyScalar(intensity),
      toneMapped: false,
    }));
    card.position.set(x,y,z);
    card.lookAt(0,0,0);
    studio.add(card);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio,.03).texture;
  pmrem.dispose();
  for (const card of studio.children) {
    card.geometry.dispose();
    card.material.dispose();
  }
  const weave = document.createElement('canvas');
  weave.width = weave.height = 64;
  const woven = weave.getContext('2d');
  const texels = woven.createImageData(64,64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const warp = Math.sin((x + y * .5) * Math.PI / 2);
      const weft = Math.cos(y * Math.PI / 2);
      const gray = 128 + 17 * warp + 11 * weft + 6 * warp * weft;
      texels.data.set([gray,gray,gray,255],(y * 64 + x) * 4);
    }
  }
  woven.putImageData(texels,0,0);
  const fiber = new THREE.CanvasTexture(weave);
  fiber.wrapS = fiber.wrapT = THREE.RepeatWrapping;
  fiber.repeat.set(3,4);
  const satin = (color, sheenColor, roughness) => new THREE.MeshPhysicalMaterial({
    color, roughness, sheen: 1, sheenColor, sheenRoughness: .47, side: THREE.DoubleSide,
    bumpMap: fiber, bumpScale: .012, specularIntensity: .75,
    anisotropy: .78, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.21,
  });
  const shirt = satin(0x672c88, 0xb18abc, .57);
  const shirtRibbing = satin(0x48205f, 0x9776a2, .64);
  const trouserCloth = new THREE.MeshPhysicalMaterial({
    map: createDenimTexture(THREE), roughness: .71, sheen: .68, sheenColor: 0x8da5c0,
    sheenRoughness: .58, bumpMap: fiber, bumpScale: .006, side: THREE.DoubleSide,
  });
  const profile = [
    [.83,-.50], [.85,-.465], [.83,-.40], [.85,-.21], [.89,.06], [.95,.25],
    [1,.32], [.94,.395], [.70,.445], [.51,.46], [.485,.49], [.425,.49], [.412,.463],
  ].map(([radius,height]) => new THREE.Vector2(radius,height));
  const body = new THREE.LatheGeometry(profile, 48);
  const uv = body.getAttribute('uv');
  const surface = body.getAttribute('position');
  for (let vertex = 0; vertex < surface.count; vertex++) {
    const angle = uv.getX(vertex) * Math.PI * 2;
    const y = surface.getY(vertex);
    const drape = 1 + Math.cos(7 * angle + y * 5) * .017 * (1 - y) +
      Math.sin(angle * 5 - y * 8) * .014 * Math.max(0,.42 - y);
    const collarDrop = Math.max(0,Math.cos(angle)) ** 3 *
      THREE.MathUtils.smoothstep(y,.35,.49) * .13;
    surface.setXYZ(vertex,surface.getX(vertex) * drape,y-collarDrop,surface.getZ(vertex) * drape);
  }
  const jersey = [];
  const binding = [];
  const triangles = body.index.array;
  for (let index = 0; index < triangles.length; index += 6) {
    const band = (index / 6) % (profile.length - 1);
    const target = band === 0 || band >= profile.length - 4 ? binding : jersey;
    target.push(...triangles.subarray(index,index+6));
  }
  body.setIndex([...jersey,...binding]);
  body.clearGroups();
  body.addGroup(0,jersey.length,0);
  body.addGroup(jersey.length,binding.length,1);
  body.computeVertexNormals();
  const torso = new THREE.Mesh(body,[shirt,shirtRibbing]);
  scene.add(torso);
  const sleeves = armJoints.map(joints => ({
    joints,
    attachment: new THREE.Vector3(),
    upper: new THREE.Vector3(),
    forearm: new THREE.Vector3(),
    bend: new THREE.Vector3(),
    ...createSleeveMesh(THREE,shirt,shirtRibbing),
  }));
  const trousers = createTrouserMesh(THREE,trouserCloth);
  const pants = trousers.mesh;
  scene.add(pants,...sleeves.map(sleeve => sleeve.mesh));
  const y = new THREE.Vector3(0, 1, 0);
  const rotation = new THREE.Quaternion();
  const last = new Map();
  const midpoint = (a,b) => a.clone().add(b).multiplyScalar(.5);
  const basis = new THREE.Matrix4();
  const widthAxis = new THREE.Vector3();
  const heightAxis = new THREE.Vector3();
  const depthAxis = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const worldAnchor = new THREE.Vector3();
  const trouserWaist = new THREE.Vector3();
  const garmentWaist = new THREE.Vector3();
  const missingTime = new Map();
  const shirtWidth = .43;
  const shirtLength = .60;
  const lowerIndices = [23,24,25,26,27,28];
  let viewAngle;

  function lightFromAngle(angle) {
    if (viewAngle !== undefined && Math.abs(angle - viewAngle) < .006) return false;
    viewAngle = angle;
    light.position.set(-1.25 + Math.sin(angle) * 2.7, 1.4, 3.4);
    scene.environmentRotation.y = angle * .65;
    if (pants.visible) renderer.render(scene,camera);
    return pants.visible;
  }

  function jointAtDistance(root, measuredStart, measuredEnd, length) {
    return measuredEnd.clone().sub(measuredStart).setLength(length).add(root);
  }

  function inferElbow(inset, shoulder, wrist, observedElbow, bend, side) {
    const upperLength = .28;
    const forearmLength = .275;
    const direction = wrist.clone().sub(shoulder);
    const distance = THREE.MathUtils.clamp(direction.length(),.045,upperLength + forearmLength - .001);
    if (direction.lengthSq() < 1e-8) direction.copy(heightAxis).negate();
    direction.normalize();
    if (observedElbow) {
      const observedBend = observedElbow.clone().sub(shoulder);
      observedBend.addScaledVector(direction,-observedBend.dot(direction));
      if (observedBend.lengthSq() > .0025) bend.copy(observedBend).normalize();
    }
    const pole = bend.clone().addScaledVector(direction,-bend.dot(direction));
    if (pole.lengthSq() < .001) {
      pole.copy(widthAxis).multiplyScalar(side).addScaledVector(heightAxis,-.8).addScaledVector(depthAxis,.45);
      pole.addScaledVector(direction,-pole.dot(direction));
    }
    if (pole.lengthSq() < .001) pole.crossVectors(direction,Math.abs(direction.y) < .9 ? y : widthAxis);
    pole.normalize();
    const along = (upperLength ** 2 + distance ** 2 - forearmLength ** 2) / (2 * distance);
    const offset = Math.sqrt(Math.max(0,upperLength ** 2 - along ** 2));
    return {
      elbow: inset.clone().addScaledVector(direction,along).addScaledVector(pole,offset),
      wrist: inset.clone().addScaledVector(direction,distance),
    };
  }

  function smoothRotation(mesh, target, weight) {
    mesh.quaternion.slerp(target, mesh.visible ? weight : 1);
    mesh.visible = true;
  }

  function resetPants() {
    const neutral = new Map([
      [23,[-.115,-.32,0]], [24,[.115,-.32,0]],
      [25,[-.107,-.69,.015]], [26,[.107,-.69,.015]],
      [27,[-.12,-1.095,.018]], [28,[.12,-1.095,.018]],
    ].map(([index,point]) => [index,new THREE.Vector3(...point)]));
    trousers.fit(neutral);
    trouserWaist.set(0,-.32+.131,0);
  }

  function hide() {
    scene.children.forEach(node => { if (node.isMesh) node.visible = false; });
    pants.visible = false;
    last.clear();
    missingTime.clear();
    for (const sleeve of sleeves) sleeve.bend.set(0,0,0);
    renderer.clear();
  }
  resetPants();
  hide();
  lightFromAngle(0);

  return {
    hide,
    resetPants,
    lightFromAngle,
    centerPreview() {
      const bounds = new THREE.Box3().setFromObject(torso);
      bounds.expandByObject(pants);
      for (const {mesh} of sleeves) if (mesh.visible) bounds.expandByObject(mesh);
      camera.position.y = (bounds.min.y + bounds.max.y) / 2;
      renderer.render(scene,camera);
    },
    update(points, imagePoints, seconds, armModes = ['live','live']) {
      const weight = 1 - Math.exp(-seconds / .15);
      const imageLeft = imagePoints[11];
      const imageRight = imagePoints[12];
      anchor.set((1 - imageLeft.x - imageRight.x) * .5, .36, 0);
      worldAnchor.set(
        -(points[11].x + points[12].x) * .5,
        -(points[11].y + points[12].y) * .5,
        -(points[11].z + points[12].z) * .5,
      );
      const position = index => {
        const point = points[index];
        const previous = last.get(index);
        if (!point || point.visibility < .35) {
          const missing = (missingTime.get(index) ?? 0) + seconds;
          missingTime.set(index, missing);
          if (missing < .18) return previous;
          last.delete(index);
          return null;
        }
        missingTime.delete(index);
        const target = new THREE.Vector3(-point.x, -point.y, -point.z).sub(worldAnchor).add(anchor);
        if (previous) {
          const movement = previous.distanceTo(target);
          const response = THREE.MathUtils.lerp(.18,.075,THREE.MathUtils.smoothstep(movement,.025,.19));
          return previous.lerp(target,1 - Math.exp(-seconds / response));
        }
        last.set(index, target);
        return target;
      };
      const lowerPose = hasFullBodyPose(lowerIndices, points, imagePoints)
        ? new Map(lowerIndices.map(index => [index, position(index)]))
        : null;
      const leftShoulder = position(11);
      const rightShoulder = position(12);
      const shoulderWidth = leftShoulder.distanceTo(rightShoulder);
      torso.visible = torso.visible && shoulderWidth > .04;
      if (shoulderWidth > .04) {
        const shoulders = midpoint(leftShoulder, rightShoulder);
        widthAxis.subVectors(rightShoulder, leftShoulder).normalize();
        depthAxis.crossVectors(widthAxis, y).normalize();
        heightAxis.crossVectors(depthAxis, widthAxis).normalize();
        torso.position.copy(shoulders).addScaledVector(heightAxis,-shirtLength * .45);
        torso.scale.set(shirtWidth * .55,shirtLength,shirtWidth * .28);
        rotation.setFromRotationMatrix(basis.makeBasis(widthAxis, heightAxis, depthAxis));
        smoothRotation(torso, rotation, weight);
      }
      for (const [arm,{joints,attachment,upper,forearm,bend,mesh,fit}] of sleeves.entries()) {
        const side = arm === 0 ? -1 : 1;
        const inset = midpoint(leftShoulder,rightShoulder)
          .addScaledVector(widthAxis,side * shirtWidth * .38).addScaledVector(heightAxis,-.025);
        if (armModes[arm] === 'hold' && mesh.visible) {
          mesh.position.copy(inset).sub(attachment);
          continue;
        }
        const shoulder = arm === 0 ? leftShoulder : rightShoulder;
        const usesLandmarks = armModes[arm] === 'live' || armModes[arm] === 'authored';
        const elbow = usesLandmarks ? position(joints[1]) : null;
        const wrist = usesLandmarks ? position(joints[2]) : null;
        if (!wrist) {
          last.delete(joints[1]);
          last.delete(joints[2]);
        }
        const restingElbow = shoulder.clone().addScaledVector(heightAxis,-.275).addScaledVector(widthAxis,side * .048);
        const restingWrist = restingElbow.clone().addScaledVector(heightAxis,-.27).addScaledVector(depthAxis,-.03);
        const inferred = wrist && armModes[arm] === 'live' ? inferElbow(inset,shoulder,wrist,elbow,bend,side) : null;
        const elbowTarget = inferred?.elbow ?? elbow ?? restingElbow;
        const wristTarget = inferred?.wrist ?? (elbow ? wrist : null) ?? restingWrist;
        const upperTarget = elbowTarget.clone().sub(inferred ? inset : shoulder).normalize();
        const forearmTarget = wristTarget.clone().sub(elbowTarget).normalize();
        const blend = mesh.visible ? 1 - Math.exp(-seconds / .095) : 1;
        upper.lerp(upperTarget,blend).normalize();
        forearm.lerp(forearmTarget,blend).normalize();
        const fixedElbow = inset.clone().addScaledVector(upper,.28);
        const fixedWrist = fixedElbow.clone().addScaledVector(forearm,.275);
        mesh.visible = true;
        attachment.copy(inset);
        mesh.position.set(0,0,0);
        fit(inset,fixedElbow,fixedWrist);
      }
      pants.visible = true;
      if (lowerPose) {
        const hips = midpoint(lowerPose.get(23),lowerPose.get(24));
        const hipAxis = lowerPose.get(24).clone().sub(lowerPose.get(23)).normalize();
        const fixedLegs = new Map();
        for (const [hip,knee,ankle,side] of [[23,25,27,-1],[24,26,28,1]]) {
          const fixedHip = hips.clone().addScaledVector(hipAxis,side * .115);
          const fixedKnee = jointAtDistance(fixedHip,lowerPose.get(hip),lowerPose.get(knee),.37);
          const fixedAnkle = jointAtDistance(fixedKnee,lowerPose.get(knee),lowerPose.get(ankle),.405);
          fixedLegs.set(hip,fixedHip).set(knee,fixedKnee).set(ankle,fixedAnkle);
        }
        trousers.fit(fixedLegs);
        trouserWaist.copy(hips).addScaledVector(y,.131);
      }
      garmentWaist.set(0,-shirtLength * .48,0).applyQuaternion(torso.quaternion).add(torso.position);
      pants.position.copy(garmentWaist).sub(trouserWaist);
      renderer.render(scene, camera);
    },
  };
}

function drawLandmarks(points, connections) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!points) return;
  const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  const x = point => (canvas.width - width) / 2 + (1 - point.x) * width;
  const y = point => (canvas.height - height) / 2 + point.y * height;
  const visible = point => point && point.visibility >= .5;
  context.strokeStyle = '#ad997f';
  context.lineWidth = 2;
  context.beginPath();
  for (const {start, end} of connections) {
    const a = points[start];
    const b = points[end];
    if (!visible(a) || !visible(b)) continue;
    context.moveTo(x(a), y(a));
    context.lineTo(x(b), y(b));
  }
  context.stroke();
  context.fillStyle = '#e5d4bb';
  for (const point of points.filter(visible)) {
    context.beginPath();
    context.arc(x(point), y(point), 3.1, 0, Math.PI * 2);
    context.fill();
  }
}

function showGarmentPreview() {
  rig?.hide();
  if (!rig) return;
  rig.resetPants();
  const shoulders = Array.from({length: 17}, () => ({x: .5, y: .34}));
  const pose = [];
  const joints = [
    [.215,-.21,0], [-.215,-.21,0],
    [.262,.064,.01], [-.253,.065,.02],
    [.271,.338,.025], [-.246,.327,.045],
  ];
  joints.forEach(([x,y,z], index) => { pose[11 + index] = {x,y,z,visibility:1}; });
  rig.update(pose, shoulders, 1, ['authored','authored']);
  rig.centerPreview();
  model?.display(true);
}

async function loadTracker() {
  const [{FilesetResolver, PoseLandmarker}, THREE] = await Promise.all([
    import(visionBase + '/vision_bundle.mjs'),
    loadThree(),
  ]);
  const fileset = await FilesetResolver.forVisionTasks(visionBase + '/wasm');
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {modelAssetPath: modelUrl},
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  try {
    rig ??= createRig(THREE);
    return {landmarker, connections: PoseLandmarker.POSE_CONNECTIONS, rig};
  } catch (error) {
    landmarker.close();
    throw error;
  }
}

function stop(message = '') {
  session++;
  cancelAnimationFrame(animation);
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
  video.srcObject = null;
  video.hidden = true;
  canvas.parentElement.dataset.active = 'false';
  avatarCanvas.parentElement.dataset.active = 'false';
  avatarCanvas.parentElement.dataset.camera = 'false';
  mirrorLabel.textContent = 'Garment preview';
  showGarmentPreview();
  drawLandmarks();
  startButton.disabled = false;
  stopButton.disabled = true;
  status.textContent = message;
}

function openDemo(message) {
  stop(message);
  footage.open = true;
}

startButton.addEventListener('click', async () => {
  const id = ++session;
  startButton.disabled = true;
  stopButton.disabled = false;
  recording.pause();
  status.textContent = 'Requesting camera access…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');
    const input = await navigator.mediaDevices.getUserMedia({video: {width: {ideal: 640}, height: {ideal: 480}, facingMode: 'user'}, audio: false});
    if (id !== session) {
      input.getTracks().forEach(track => track.stop());
      return;
    }
    stream = input;
    showFront();
    rig?.hide();
    model?.display(false);
    avatarCanvas.parentElement.dataset.camera = 'true';
    mirrorLabel.textContent = 'Waiting for pose';
    input.getVideoTracks()[0].addEventListener('ended', () => {
      if (id === session) openDemo('The camera stopped. Prerecorded demo is available below.');
    });
    video.hidden = false;
    video.srcObject = input;
    await video.play();
    if (id !== session) return;
    status.textContent = 'Loading on-device pose tracking…';
    setup ??= loadTracker().catch(error => {
      setup = undefined;
      throw error;
    });
    const tracker = await setup;
    if (id !== session) return;
    let lastVideoTime = -1;
    let lastPoseTime = 0;
    const lastSeen = [-Infinity,-Infinity];
    let lastTrackedFrame;
    let poseVisible;
    function update(now) {
      if (id !== session) return;
      try {
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastPoseTime >= 33) {
          const result = tracker.landmarker.detectForVideo(video, now);
          const points = result.landmarks[0];
          const world = result.worldLandmarks[0];
          drawLandmarks(points, tracker.connections);
          function inFrame(index, tracking) {
            const minConfidence = tracking ? .35 : .5;
            const frameMargin = tracking ? .06 : 0;
            const point = points?.[index];
            return world?.[index]?.visibility >= minConfidence && point?.visibility >= minConfidence &&
              point.x >= -frameMargin && point.x <= 1 + frameMargin &&
              point.y >= -frameMargin && point.y <= 1 + frameMargin;
          }
          const torsoDetected = [11,12].every(index => inFrame(index,poseVisible));
          const armModes = armJoints.map((joints,arm) => {
            const recentlySeen = now - lastSeen[arm] < 550;
            if (torsoDetected && [joints[0],joints[2]].every(index => inFrame(index,recentlySeen))) {
              lastSeen[arm] = now;
              return 'live';
            }
            return now - lastSeen[arm] < 180 ? 'hold' : 'preview';
          });
          const detected = torsoDetected && armModes.includes('live');
          const visible = lastSeen.some(time => now - time < 550);
          canvas.parentElement.dataset.active = String(Boolean(points));
          if (detected) lastTrackedFrame = {world,points};
          if (visible && lastTrackedFrame) {
            if (poseVisible === false) tracker.rig.hide();
            const frame = torsoDetected ? {world,points} : lastTrackedFrame;
            tracker.rig.update(frame.world, frame.points, Math.min(.2, (now - lastPoseTime) / 1000),armModes);
            model?.display(true);
          } else if (!visible && poseVisible !== false) {
            showGarmentPreview();
          }
          avatarCanvas.parentElement.dataset.active = 'true';
          if (visible !== poseVisible) {
            status.textContent = visible ? 'Arm tracking live' : 'Showing the preview pose. Bring an arm into frame to resume tracking.';
            poseVisible = visible;
          }
          lastVideoTime = video.currentTime;
          lastPoseTime = now;
        }
        animation = requestAnimationFrame(update);
      } catch {
        openDemo('Live pose tracking stopped. Prerecorded demo is available below.');
      }
    }
    animation = requestAnimationFrame(update);
  } catch (error) {
    if (id === session) openDemo(error.name === 'NotAllowedError'
      ? 'Camera access was denied. Prerecorded demo is available below.'
      : 'Camera or pose tracking is unavailable. Prerecorded demo is available below.');
  }
});
stopButton.addEventListener('click', () => stop());
demoButton.addEventListener('click', () => {
  openDemo('Prerecorded demo mode.');
  footage.scrollIntoView({block: 'nearest'});
  recording.play().catch(() => {});
});
window.addEventListener('pagehide', () => stop());
stop();

function setSpin(enabled) {
  model?.spin(enabled);
}

function showFront() {
  setSpin(false);
  model?.front();
}

async function startModel() {
  try {
    const THREE = await loadThree();
    rig ??= createRig(THREE);
    model = mountMirrorModel(THREE, modelCanvas, avatarCanvas, angle => rig.lightFromAngle(angle));
    modelCanvas.hidden = false;
    avatarCanvas.parentElement.classList.add('avatar-source');
    if (stream) {
      showFront();
      model.display(avatarCanvas.parentElement.dataset.active === 'true');
    } else {
      showGarmentPreview();
      setSpin(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    for (const button of [leftButton,rightButton,frontButton,playButton,pauseButton]) button.disabled = false;
    modelStatus.textContent = 'Drag to turn';
  } catch (error) {
    modelCanvas.hidden = true;
    avatarCanvas.parentElement.classList.remove('avatar-source');
    model = undefined;
    modelStatus.textContent = 'Couldn’t load the 3D mirror. Reload the page to try again.';
    console.error('Could not load the 3D mirror',error);
  }
}

leftButton.addEventListener('click', () => { setSpin(false); model.turn(-Math.PI / 4); });
rightButton.addEventListener('click', () => { setSpin(false); model.turn(Math.PI / 4); });
frontButton.addEventListener('click', showFront);
playButton.addEventListener('click', () => setSpin(true));
pauseButton.addEventListener('click', () => setSpin(false));
let drag;
modelCanvas.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  setSpin(false);
  drag = {id: event.pointerId, x: event.clientX};
  modelCanvas.setPointerCapture(event.pointerId);
});
modelCanvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  model.turn((event.clientX - drag.x) * .012);
  drag.x = event.clientX;
});
modelCanvas.addEventListener('lostpointercapture', () => { drag = undefined; });
startModel();
