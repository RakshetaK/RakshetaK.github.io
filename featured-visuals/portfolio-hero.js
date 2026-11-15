import { mountMirrorModel } from './mirror-model.js';
import { mountFridge } from './fifo-model.js?v=matched-preview';

const motion = matchMedia('(prefers-reduced-motion: reduce)');

async function loadMirror(canvas) {
  const THREE = await import('./vendor/three.module.js');
  const model = mountMirrorModel(THREE, canvas, document.createElement('canvas'), () => false);
  model.display(false);
  let visible = false;
  const updateRotation = () => model.spin(visible && !motion.matches);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateRotation();
  });
  observer.observe(canvas);
  motion.addEventListener('change', updateRotation);
}

async function showModel(canvas, mount) {
  const status = canvas.parentElement.querySelector('.portfolio-model-status');
  try {
    await mount(canvas);
    canvas.hidden = false;
    status.hidden = true;
  } catch {
    canvas.hidden = true;
    status.textContent = '3D preview unavailable';
  }
}

const mirrorCanvas = document.querySelector('#portfolio-mirror');
const fifoCanvas = document.querySelector('#portfolio-fifo');
const projects = document.querySelector('#projects');
const previewObserver = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  previewObserver.disconnect();
  showModel(mirrorCanvas, loadMirror);
  showModel(fifoCanvas, canvas => mountFridge(motion, { previewCanvas: canvas }));
});
previewObserver.observe(projects);
