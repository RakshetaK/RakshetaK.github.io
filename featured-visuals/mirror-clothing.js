const rings = 36;
const sides = 32;
const stride = sides + 1;

export function createDenimTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width,canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const u = (x % 384) / 384;
      const t = y / 768;
      const fade = 19 * Math.exp(-((u - .055) ** 2) / .031 - ((t - .42) ** 2) / .13);
      const whiskers = 7 * Math.max(0,Math.cos(t * 190 - u * 17 + Math.sin(u * 21))) *
        Math.exp(-((t - .23) ** 2) / .012 - ((u - .08) ** 2) / .022);
      const twill = (x + y * 2) % 5 < 2 ? 4 : -2;
      const grain = ((x * 17 ^ y * 29) % 11) - 5;
      const shade = fade + whiskers + twill + grain;
      const pixel = (y * canvas.width + x) * 4;
      image.data.set([20+shade,32+shade,43+shade*.85,255],pixel);
    }
  }
  ctx.putImageData(image,0,0);
  ctx.fillStyle = '#17232d';
  ctx.fillRect(0,0,768,23);
  const stitch = '#806e52';
  const darkSeam = '#17222e';
  function line(draw, color, width) {
    ctx.beginPath();
    draw(ctx);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  for (const y of [5,22,758,764]) {
    line(path => {path.moveTo(0,y);path.lineTo(768,y);},stitch,1.2);
  }
  for (const base of [0,384]) {
    const pocket = path => {
      path.moveTo(base+59,25);
      path.bezierCurveTo(base+55,46,base+63,61,base+92,68);
    };
    line(pocket,darkSeam,4);
    line(pocket,stitch,2);
    const backPocket = path => {
      path.moveTo(base+138,64);
      path.lineTo(base+186,69);
      path.lineTo(base+181,125);
      path.lineTo(base+161,138);
      path.lineTo(base+142,124);
      path.closePath();
    };
    line(backPocket,darkSeam,4);
    line(backPocket,stitch,1.5);
    for (const x of [43,100,263]) {
      ctx.fillStyle = darkSeam;
      ctx.fillRect(base+x,2,8,27);
      ctx.fillStyle = '#34434c';
      ctx.fillRect(base+x+1,2,5,24);
    }
    for (const x of [94,99]) {
      line(path => {path.moveTo(base+x,65);path.lineTo(base+x,758);},darkSeam,1.5);
    }
    for (const x of [61,91]) {
      ctx.beginPath();
      ctx.arc(base+x,x===61 ? 26 : 66,2.8,0,Math.PI*2);
      ctx.fillStyle = '#aba393';
      ctx.fill();
    }
  }
  const coinPocket = path => {
    path.moveTo(71,25);
    path.lineTo(91,25);
    path.lineTo(91,46);
    path.quadraticCurveTo(80,51,71,45);
    path.closePath();
  };
  line(coinPocket,darkSeam,3);
  line(coinPocket,stitch,1.5);
  const fly = path => {
    path.moveTo(14,25);
    path.lineTo(15,91);
    path.quadraticCurveTo(14,118,3,122);
  };
  line(fly,darkSeam,4);
  line(fly,stitch,1.15);
  ctx.beginPath();
  ctx.arc(6,12,5.2,0,Math.PI*2);
  ctx.fillStyle = '#a29a89';
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function fabricSurface(THREE, material, count, useFace) {
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(count * (rings + 1) * stride * 3), 3);
  const uv = new Float32Array(positions.count * 2);
  const indices = [];
  for (let section = 0; section < count; section++) {
    for (let row = 0; row <= rings; row++) {
      for (let column = 0; column <= sides; column++) {
        const vertex = (section * (rings + 1) + row) * stride + column;
        uv[vertex * 2] = (section + column / sides) / count;
        uv[vertex * 2 + 1] = 1 - row / rings;
        if (row === rings || column === sides || !useFace(row,column)) continue;
        if (section === 1) indices.push(vertex,vertex+stride,vertex+1,vertex+1,vertex+stride,vertex+stride+1);
        else indices.push(vertex,vertex+1,vertex+stride,vertex+1,vertex+stride+1,vertex+stride);
      }
    }
  }
  geometry.setAttribute('position', positions);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv,2));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry,material);
  mesh.frustumCulled = false;
  return {
    mesh,
    vertex(section,row,column,point) {
      positions.setXYZ((section * (rings + 1) + row) * stride + column,point.x,point.y,point.z);
    },
    commit(repairNormals) {
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      const normals = geometry.getAttribute('normal');
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      for (let section = 0; section < count; section++) {
        for (let row = 0; row <= rings; row++) {
          const first = (section * (rings + 1) + row) * stride;
          a.fromBufferAttribute(normals,first);
          b.fromBufferAttribute(normals,first+sides);
          if (a.dot(b) > 0) {
            a.add(b).normalize();
            normals.setXYZ(first,a.x,a.y,a.z);
            normals.setXYZ(first+sides,a.x,a.y,a.z);
          }
        }
      }
      repairNormals?.(normals);
      normals.needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    },
  };
}

export function createTrouserMesh(THREE, material) {
  const fork = 10;
  const fabric = fabricSurface(THREE, material, 2, (row,column) => row >= fork || column < sides / 2);
  const up = new THREE.Vector3(0,1,0);
  const across = new THREE.Vector3();
  const front = new THREE.Vector3();
  const center = new THREE.Vector3();
  const tube = new THREE.Vector3();
  const rise = new THREE.Vector3();
  const point = new THREE.Vector3();
  return {
    mesh:fabric.mesh,
    fit(points) {
      const left = points.get(23);
      const right = points.get(24);
      across.subVectors(right,left).normalize();
      front.crossVectors(across,up).normalize();
      const hipWidth = Math.max(.2,left.distanceTo(right));
      center.copy(left).lerp(right,.5);
      for (const [section,[hip,knee,ankle]] of [[23,25,27],[24,26,28]].entries()) {
        const side = section === 0 ? -1 : 1;
        const curve = new THREE.CatmullRomCurve3([points.get(hip),points.get(knee),points.get(ankle)]);
        for (let row = 0; row <= rings; row++) {
          const t = row / rings;
          const leg = Math.max(0,(t - .12) / .88);
          const blend = THREE.MathUtils.smoothstep(t,fork / rings,.42);
          const width = hipWidth * THREE.MathUtils.lerp(.91,.96,Math.min(1,t / .27));
          const legRadius = THREE.MathUtils.lerp(.49,.455,Math.min(1,leg / .55)) * hipWidth;
          const flare = THREE.MathUtils.smoothstep(leg,.57,1);
          const riseShape = THREE.MathUtils.smoothstep(t,.06,.19) *
            (1 - THREE.MathUtils.smoothstep(t,.29,.46));
          const pleat = .0014 * Math.exp(-((t - .61) ** 2) / .012) * Math.sin(t * 67);
          const legCenter = curve.getPoint(leg);
          for (let column = 0; column <= sides; column++) {
            const angle = column / sides * 2 * Math.PI;
            const sine = Math.sin(angle);
            const cosine = Math.cos(angle);
            const flatFront = Math.sign(cosine) * Math.abs(cosine) ** (.54 + .29 * riseShape);
            const riseDepth = hipWidth * .071 * riseShape * Math.max(0,cosine) ** 2;
            const hem = THREE.MathUtils.smoothstep(t,.94,1);
            const outerFlare = Math.max(0,sine) * hipWidth * .13 * flare;
            rise.copy(center).addScaledVector(up,.131 - t * .86)
              .addScaledVector(across,side * width * Math.max(0,sine))
              .addScaledVector(front,flatFront * hipWidth * .35 + riseDepth);
            tube.copy(legCenter)
              .addScaledVector(across,side * (sine * (legRadius + pleat) + outerFlare))
              .addScaledVector(front,flatFront * (legRadius * .69 + pleat + flare * .007) + riseDepth)
              .addScaledVector(up,hem * (.012 * flatFront + .008 * Math.cos(angle * 3 + section)));
            point.copy(rise).lerp(tube,blend);
            fabric.vertex(section,row,column,point);
          }
        }
      }
      fabric.commit(normals => {
        const joined = new THREE.Vector3();
        const other = new THREE.Vector3();
        for (let row = 0; row <= fork; row++) {
          for (const column of [0,sides/2]) {
            const a = row * stride + column;
            const b = a + (rings + 1) * stride;
            joined.fromBufferAttribute(normals,a).add(other.fromBufferAttribute(normals,b)).normalize();
            normals.setXYZ(a,joined.x,joined.y,joined.z);
            normals.setXYZ(b,joined.x,joined.y,joined.z);
            if (column === 0 && row < fork) {
              normals.setXYZ(a+sides,joined.x,joined.y,joined.z);
              normals.setXYZ(b+sides,joined.x,joined.y,joined.z);
            }
          }
        }
      });
    },
  };
}

export function createSleeveMesh(THREE, material, ribbing) {
  const fabric = fabricSurface(THREE,[material,ribbing],1,() => true);
  fabric.mesh.geometry.addGroup(0,(rings - 2) * sides * 6,0);
  fabric.mesh.geometry.addGroup((rings - 2) * sides * 6,2 * sides * 6,1);
  const facing = new THREE.Vector3(0,0,1);
  const up = new THREE.Vector3(0,1,0);
  const across = new THREE.Vector3();
  const depth = new THREE.Vector3();
  const point = new THREE.Vector3();
  return {
    mesh:fabric.mesh,
    fit(shoulder,elbow,wrist) {
      const curve = new THREE.CatmullRomCurve3([shoulder,elbow,wrist]);
      for (let row = 0; row <= rings; row++) {
        const t = row / rings;
        const center = curve.getPoint(t);
        const axis = curve.getTangent(t);
        across.crossVectors(axis,facing);
        if (across.lengthSq() < .001) across.crossVectors(axis,up);
        across.normalize();
        depth.crossVectors(across,axis).normalize();
        const elbowWrinkle = Math.sin(t * 74) * .004 * Math.exp(-((t - .52) ** 2) / .011);
        const cuff = t > .95 ? .002 : 0;
        const radius = THREE.MathUtils.lerp(.071,.046,t) * (.78 + .22 * THREE.MathUtils.smoothstep(t,0,.19)) + elbowWrinkle + cuff;
        for (let column = 0; column <= sides; column++) {
          const angle = column / sides * Math.PI * 2;
          point.copy(center).addScaledVector(across,Math.sin(angle) * radius)
            .addScaledVector(depth,Math.cos(angle) * radius * .83);
          fabric.vertex(0,row,column,point);
        }
      }
      fabric.commit();
    },
  };
}
