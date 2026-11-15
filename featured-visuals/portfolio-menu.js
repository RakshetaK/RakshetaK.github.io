const menu = document.querySelector('.portfolio-menu');
const tabs = [...menu.querySelectorAll('[role="tab"]')];
const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
let selected = 0;

function selectSection(index) {
  selected = (index + tabs.length) % tabs.length;
  tabs.forEach((tab, position) => {
    const active = position === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    panels[position].hidden = !active;
  });
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectSection(index));
});

menu.addEventListener('keydown', event => {
  const destinations = {
    ArrowUp: selected - 1,
    ArrowDown: selected + 1,
    Home: 0,
    End: tabs.length - 1,
  };
  const destination = destinations[event.key];
  if (typeof destination !== 'number') return;
  event.preventDefault();
  selectSection(destination);
  tabs[selected].focus();
});

for (const button of document.querySelectorAll('[data-section-step]')) {
  button.addEventListener('click', () => selectSection(selected + Number(button.dataset.sectionStep)));
}

const wheel = document.querySelector('.portfolio-wheel');
const centerButton = document.querySelector('#portfolio-open');
const radiansPerSection = Math.PI / 6;
let gesture;
let wheelAngle = 0;

function angleAt(event) {
  const bounds = wheel.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  // Ignore the center so crossing it does not jump half a turn.
  return Math.hypot(x, y) < 0.2 ? null : Math.atan2(y, x);
}

wheel.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || centerButton.contains(event.target)) return;
  const angle = angleAt(event);
  if (angle === null) return;
  gesture = { pointer: event.pointerId, angle, pending: 0, turning: false };
});

wheel.addEventListener('pointermove', event => {
  if (gesture?.pointer !== event.pointerId) return;
  const angle = angleAt(event);
  const previousAngle = gesture.angle;
  gesture.angle = angle;
  if (angle === null || previousAngle === null) return;

  const delta = angle - previousAngle;
  const turn = Math.atan2(Math.sin(delta), Math.cos(delta));
  gesture.pending += turn;
  if (!gesture.turning) {
    if (Math.abs(gesture.pending) < 0.12) return;
    gesture.turning = true;
    wheel.setPointerCapture(event.pointerId);
    wheel.classList.add('is-turning');
    wheelAngle += gesture.pending;
  } else {
    wheelAngle += turn;
  }
  wheel.style.setProperty('--wheel-angle', `${wheelAngle}rad`);

  const steps = Math.trunc(gesture.pending / radiansPerSection);
  if (steps) {
    selectSection(selected + steps);
    gesture.pending -= steps * radiansPerSection;
  }
});

function endTurn(event) {
  if (gesture?.pointer !== event.pointerId) return;
  gesture = undefined;
  wheel.classList.remove('is-turning');
}

window.addEventListener('pointerup', endTurn);
window.addEventListener('pointercancel', endTurn);
wheel.addEventListener('lostpointercapture', endTurn);
wheel.addEventListener('pointerleave', event => {
  if (!gesture?.turning) endTurn(event);
});

centerButton.addEventListener('click', () => panels[selected].focus());
selectSection(selected);
