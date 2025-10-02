// script.js
// Calculadora + registro del Service Worker (ruta absoluta en la raíz)

const display = document.getElementById('display');
const keys = document.querySelector('.keys');

let current = ''; // expresión actual

function updateDisplay(){
  display.textContent = current === '' ? '0' : current;
}

function appendValue(v){
  if (v === '.') {
    const parts = current.split(/[\+\-\*\/\(\)]/);
    const last = parts[parts.length - 1];
    if (last.includes('.')) return;
    if (last === '') v = '0.';
  }
  current += v;
  updateDisplay();
}

function clearAll(){
  current = '';
  updateDisplay();
}

function backspace(){
  if (current.length > 0) {
    current = current.slice(0, -1);
    updateDisplay();
  }
}

function evaluateExpression(){
  if (current.trim() === '') return;
  const valid = /^[0-9+\-*/().\s]+$/.test(current);
  if (!valid) {
    display.textContent = 'Error';
    return;
  }
  try {
    const expr = current.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      display.textContent = 'Error';
      return;
    }
    current = (Math.round((result + Number.EPSILON) * 1e12) / 1e12).toString();
    updateDisplay();
  } catch (e) {
    display.textContent = 'Error';
  }
}

// Eventos de botones
keys.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const val = btn.dataset.value;
  const action = btn.dataset.action;

  if (action === 'clear') { clearAll(); return; }
  if (action === 'back') { backspace(); return; }
  if (action === 'equals') { evaluateExpression(); return; }
  if (typeof val !== 'undefined') appendValue(val);
});

// Teclado
window.addEventListener('keydown', (e) => {
  const allowed = '0123456789+-*/().';
  if (allowed.includes(e.key)) { appendValue(e.key); e.preventDefault(); return; }
  if (e.key === 'Enter' || e.key === '=') { evaluateExpression(); e.preventDefault(); return; }
  if (e.key === 'Backspace') { backspace(); e.preventDefault(); return; }
  if (e.key === 'Escape') { clearAll(); e.preventDefault(); return; }
});

// Guardar/recuperar última expresión
window.addEventListener('beforeunload', () => {
  try { localStorage.setItem('calc-last', current); } catch (e) {}
});
window.addEventListener('load', () => {
  try {
    const last = localStorage.getItem('calc-last');
    if (last) { current = last; updateDisplay(); }
  } catch (e) {}
});

// Registro del Service Worker SIMPLE y ROBUSTO (ruta absoluta)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // console.log('Service Worker registrado');
    } catch (err) {
      console.warn('Registro SW falló', err);
    }
  });
}
