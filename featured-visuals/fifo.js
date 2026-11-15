import { mountFridge, scanPreviewDuration } from './fifo-model.js?v=local-3d';

const stages = {
  entry: ['Barcode or manual entry', 'Scan an item’s barcode or enter the item manually.'],
  missing: ['Fill in missing details', 'The user supplies any missing item information before it is saved.'],
  save: ['Save to inventory', 'The completed item record is saved in the inventory database.'],
  trigger: ['Door close → MQTT', 'Closing the door triggers the ultrasonic sensor, which causes a message to be published over MQTT.'],
  scan: ['Linear scan', 'The MQTT message starts the stepper motor and the Raspberry Pi camera. The camera records video as the carriage travels along the shelf.'],
  panorama: ['Stitch panorama', 'Frames from the scan video are stitched into one panoramic image of the shelf.'],
  detection: ['Detectron2 and crops', 'Detectron2, trained to detect containers, predicts bounding boxes in the panorama. Each box is cropped into a separate image.'],
  product: ['PaLI-Gemma and OCR', 'PaLI-Gemma processes each crop, reads visible package text with OCR, and identifies the product.'],
  lookup: ['Parse and match', 'The VLM output is parsed into fields such as product name and category. Those fields are used as keywords to look up the matching inventory record for removal.'],
  output: ['FIFO tablet interface', 'The inventory grid and the game overview read from the same updated inventory.'],
};
const flows = {
  add: ['entry', 'missing', 'save', 'output'],
  remove: ['trigger', 'scan', 'panorama', 'detection', 'product', 'lookup', 'output'],
};
const flowButtons = document.querySelectorAll('[data-flow]');
const navigation = document.querySelector('.steps');
const title = document.querySelector('#step-title');
const detail = document.querySelector('#step-detail');
const tablet = document.querySelector('.fifo-tablet');
const bag = document.querySelector('#grocery-batch');
const batchLabel = bag.querySelector('strong');
const batchHint = bag.querySelector('small');
const batchMark = bag.querySelector('.fifo-add-mark');
const status = document.querySelector('#fifo-status');
const inventoryView = document.querySelector('#inventory-view');
const gameView = document.querySelector('#game-view');
const inventoryList = document.querySelector('#inventory-items');
const upcomingList = document.querySelector('#upcoming-items');
const examples = [
  {name: 'Cola', tone: 'cola'},
  {name: 'Packaged item', tone: 'package'},
  {name: 'Chocolate syrup', tone: 'chocolate'},
];
const batch = [
  {name: 'Banana', tone: 'banana', days: 199},
  {name: 'Strawberries', tone: 'berries', days: 201},
  {name: 'Pink Grapefruit Soda', tone: 'soda', days: 611},
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let updateFridge;
function updateModel() {
  try {
    updateFridge?.({
      flow,
      busy,
      step: current,
      game: !gameView.hidden,
      items: batchAdded ? [...examples, ...batch] : examples,
    });
  } catch (error) {
    updateFridge = undefined;
    showModelError(error);
  }
}
function showModelError(error) {
  console.error('FIFO 3D preview failed', error);
  document.querySelector('#fifo-model-status').textContent = '3D preview unavailable. The original walkthrough is in “See the real system.”';
}
mountFridge(reducedMotion).then(update => {
  updateFridge = update;
  updateModel();
}).catch(showModelError);
let flow = 'add';
let current = 'entry';
let timer;
let batchAdded = false;
let busy = false;

function select(key) {
  current = key;
  [title.textContent, detail.textContent] = stages[key];
  for (const button of navigation.children) button.setAttribute('aria-pressed', button.dataset.step === key);
  updateModel();
}

function setFlow(next) {
  clearTimeout(timer);
  flow = next;
  for (const button of flowButtons) button.setAttribute('aria-pressed', button.dataset.flow === flow);
  navigation.replaceChildren(...flows[flow].map(key => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.step = key;
    button.textContent = stages[key][0];
    button.addEventListener('click', () => { if (!busy) select(key); });
    return button;
  }));
  select(flows[flow][0]);
}

function renderInventory() {
  const items = batchAdded ? [...examples, ...batch] : examples;
  inventoryList.replaceChildren(...items.map(item => {
    const card = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'fifo-product ' + item.tone;
    icon.setAttribute('aria-hidden', 'true');
    const name = document.createElement('strong');
    name.textContent = item.name;
    card.append(icon, name);
    return card;
  }));
  upcomingList.replaceChildren(...items.filter(item => item.days).map(item => {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = item.name;
    const days = document.createElement('span');
    days.textContent = item.days + ' days left';
    row.append(name, days);
    return row;
  }));
  if (!batchAdded) {
    const empty = document.createElement('li');
    empty.textContent = 'Add a batch to see expiration dates.';
    upcomingList.append(empty);
  }
}

function play(index) {
  const key = flows[flow][index];
  select(key);
  if (key === 'output') {
    batchAdded = flow === 'add';
    busy = false;
    tablet.classList.remove('scanning');
    bag.disabled = false;
    bag.draggable = !batchAdded;
    batchLabel.textContent = batchAdded ? 'Remove sample groceries' : 'Add sample groceries';
    batchHint.textContent = batchAdded ? 'Close the door and run a shelf scan' : 'Click or drag onto the fridge or tablet';
    batchMark.textContent = batchAdded ? '−' : '+';
    for (const button of navigation.children) button.disabled = false;
    for (const button of flowButtons) button.disabled = false;
    renderInventory();
    updateModel();
    status.textContent = batchAdded ? '3 demo items added. Both tablet views are updated.' : 'Demo groceries removed from both views.';
    return;
  }
  status.textContent = key === 'scan' ? 'Running the linear scan inside the fridge…' : stages[key][0] + '…';
  timer = setTimeout(() => play(index + 1), key === 'scan' ? scanPreviewDuration + 350 : 600);
}

function start(next) {
  if (busy || (next === 'add') === batchAdded) return;
  busy = true;
  setFlow(next);
  tablet.classList.add('scanning');
  bag.disabled = true;
  bag.draggable = false;
  for (const button of navigation.children) button.disabled = true;
  for (const button of flowButtons) button.disabled = true;
  play(0);
}

for (const button of flowButtons) {
  button.addEventListener('click', () => {
    if (!busy && button.dataset.flow !== flow) setFlow(button.dataset.flow);
  });
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  inventoryView.hidden = button.dataset.view !== 'inventory';
  gameView.hidden = button.dataset.view !== 'game';
  document.querySelectorAll('[data-view]').forEach(view => view.setAttribute('aria-pressed', view === button));
  updateModel();
}));
bag.addEventListener('click', () => start(batchAdded ? 'remove' : 'add'));
bag.addEventListener('dragstart', event => {
  event.dataTransfer.setData('application/x-fifo-groceries', 'sample-batch');
  event.dataTransfer.effectAllowed = 'copy';
});
for (const target of [tablet, document.querySelector('#fifo-model')]) {
  bag.addEventListener('dragend', () => target.classList.remove('dragging'));
  target.addEventListener('dragover', event => {
    if (busy || batchAdded || !event.dataTransfer.types.includes('application/x-fifo-groceries')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    target.classList.add('dragging');
  });
  target.addEventListener('dragleave', event => {
    if (!target.contains(event.relatedTarget)) target.classList.remove('dragging');
  });
  target.addEventListener('drop', event => {
    event.preventDefault();
    target.classList.remove('dragging');
    if (event.dataTransfer.getData('application/x-fifo-groceries') === 'sample-batch') start('add');
  });
}
setFlow('add');
renderInventory();
