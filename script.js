// script.js
// Calculadora: soporta teclado, click en botones, paréntesis, decimales, y validación básica
const display = document.getElementById('display');
const keys = document.querySelector('.keys');

let current = ''; // la expresión actual

function updateDisplay(){
  display.textContent = current === '' ? '0' : current;
}

// Añadir valor (número, operador o paréntesis)
function appendValue(v){
  // evitar múltiples puntos seguidos en la misma parte de número
  if (v === '.') {
    // buscar la última parte numérica
    const parts = current.split(/[\+\-\*\/\(\)]/);
    const last = parts[parts.length - 1];
    if (last.includes('.')) return;
    if (last === '' ) {
      // si comienza con '.' anteponer '0'
      v = '0.';
    }
  }
  current += v;
  updateDisplay();
}

// Borrar todo
function clearAll(){
  current = '';
  updateDisplay();
}

// Backspace
function backspace(){
  if (current.length > 0) {
    current = current.slice(0, -1);
    updateDisplay();
  }
}

// Evaluar con validación
function evaluateExpression(){
  if (current.trim() === '') return;
  // Validar: permitir solo dígitos, operadores + - * / ( ) . y espacios
  const valid = /^[0-9+\-*/().\s]+$/.test(current);
  if (!valid) {
    display.textContent = 'Error';
    return;
  }
  try {
    // Reemplazar símbolo × ÷ − si existen (aunque usamos * / - internamente)
    const expr = current.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    // Evaluar de forma relativamente segura usando Function
    const result = Function('"use strict"; return (' + expr + ')')();
    // Mostrar resultado (formatear si es float largo)
    if (typeof result === 'number' && !Number.isFinite(result)) {
      display.textContent = 'Error';
      return;
    }
    current = (Math.round((result + Number.EPSILON) * 1e12) / 1e12).toString();
    updateDisplay();
  } catch (e) {
    display.textContent = 'Error';
  }
}

// Manejo de clicks en botones
keys.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const val = btn.dataset.value;
  const action = btn.dataset.action;

  if (action === 'clear') {
    clearAll();
    return;
  }
  if (action === 'back') {
    backspace();
    return;
  }
  if (action === 'equals') {
    evaluateExpression();
    return;
  }
  if (typeof val !== 'undefined') {
    appendValue(val);
  }
});

// Manejo de teclado
window.addEventListener('keydown', (e) => {
  // Permitir números, operadores, Enter, Backspace, Escape, paréntesis y coma/punto
  const allowedKeys = '0123456789+-*/().';
  if (allowedKeys.includes(e.key)) {
    // Prevenir que la tecla "." en teclado numérico use coma en algunos locales
    appendValue(e.key);
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter' || e.key === '=') {
    evaluateExpression();
    e.preventDefault();
    return;
  }
  if (e.key === 'Backspace') {
    backspace();
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    clearAll();
    e.preventDefault();
    return;
  }
});

// Guardar última expresión en localStorage (opcional)
window.addEventListener('beforeunload', () => {
  try {
    localStorage.setItem('calc-last', current);
  } catch (e) {}
});
window.addEventListener('load', () => {
  try {
    const last = localStorage.getItem('calc-last');
    if (last) {
      current = last;
      updateDisplay();
    }
  } catch (e) {}
});
