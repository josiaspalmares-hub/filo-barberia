import { servicios, barberos } from './datos.js';
import { ponerPrecio } from './moneda.js';
import { elegirEnReserva } from './reserva.js';

const conCursor = matchMedia('(hover: hover) and (pointer: fine)').matches;
const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Carta de servicios ----
const carta = document.querySelector('[data-carta]');
const flotante = document.querySelector('[data-carta-foto]');

servicios.forEach((servicio) => {
  const plato = document.createElement('li');
  plato.className = 'plato';
  plato.innerHTML = `
    <h3 class="plato__nombre"></h3>
    <p class="plato__desc"></p>
    <p class="plato__min"></p>
    <div class="plato__lado">
      <p class="plato__precio"></p>
      <button class="plato__reservar" type="button">Reservar</button>
    </div>`;
  plato.querySelector('.plato__nombre').textContent = servicio.nombre;
  plato.querySelector('.plato__desc').textContent = servicio.desc;
  plato.querySelector('.plato__min').textContent = `${servicio.min} min`;
  ponerPrecio(plato.querySelector('.plato__precio'), servicio.precio);
  const boton = plato.querySelector('.plato__reservar');
  boton.setAttribute('aria-label', `Reservar ${servicio.nombre}`);
  boton.addEventListener('click', () => elegirEnReserva({ servicio: servicio.id }));
  if (conCursor) {
    plato.addEventListener('pointerenter', () => {
      flotante.src = `img/${servicio.foto}.webp`;
      flotante.classList.add('visible');
    });
    plato.addEventListener('pointerleave', () => flotante.classList.remove('visible'));
  }
  carta.append(plato);
});

// Retraso e inclinación para que la foto "cuelgue" del cursor
if (conCursor && !reducirMovimiento) {
  let x = 0;
  let y = 0;
  let destinoX = 0;
  let destinoY = 0;
  carta.addEventListener('pointermove', (evento) => {
    destinoX = evento.clientX + 24;
    destinoY = evento.clientY - 150;
  });
  const seguir = () => {
    const dx = destinoX - x;
    x += dx * 0.14;
    y += (destinoY - y) * 0.14;
    flotante.style.setProperty('--fx', `${x.toFixed(1)}px`);
    flotante.style.setProperty('--fy', `${y.toFixed(1)}px`);
    flotante.style.setProperty('--fr', `${Math.max(Math.min(dx * 0.05, 8), -8).toFixed(2)}deg`);
    requestAnimationFrame(seguir);
  };
  requestAnimationFrame(seguir);
}

// ---- Antes y después (input range: mouse, dedo y teclado) ----
const comparador = document.querySelector('[data-comparador]');
const rango = document.querySelector('[data-comparador-rango]');
rango.addEventListener('input', () => comparador.style.setProperty('--corte', `${rango.value}%`));

// ---- Equipo ----
const lista = document.querySelector('[data-barberos]');
barberos.forEach((barbero) => {
  const tarjeta = document.createElement('li');
  tarjeta.className = 'barbero';
  tarjeta.innerHTML = `
    <div class="barbero__foto"><img alt="" loading="lazy"><span class="barbero__anos"></span></div>
    <h3 class="barbero__nombre"></h3>
    <p class="barbero__apodo"></p>
    <p class="barbero__fuerte"></p>
    <button class="barbero__boton" type="button"></button>`;
  const foto = tarjeta.querySelector('img');
  foto.src = `img/${barbero.foto}.webp`;
  foto.alt = `${barbero.nombre}, barbero`;
  tarjeta.querySelector('.barbero__anos').textContent = `${barbero.anos} años`;
  tarjeta.querySelector('.barbero__nombre').textContent = barbero.nombre;
  tarjeta.querySelector('.barbero__apodo').textContent = barbero.apodo;
  tarjeta.querySelector('.barbero__fuerte').textContent = `Lo suyo: ${barbero.fuerte}`;
  const boton = tarjeta.querySelector('.barbero__boton');
  boton.textContent = `Reservar con ${barbero.nombre} →`;
  boton.addEventListener('click', () => elegirEnReserva({ barbero: barbero.id }));
  lista.append(tarjeta);
});

// ---- Galería arrastrable (en el teléfono, scroll normal) ----
const galeria = document.querySelector('[data-galeria]');
let agarre = null;
galeria.addEventListener('pointerdown', (evento) => {
  if (evento.pointerType !== 'mouse') return;
  agarre = { x: evento.clientX, scroll: galeria.scrollLeft };
  galeria.classList.add('agarrando');
  galeria.setPointerCapture(evento.pointerId);
});
galeria.addEventListener('pointermove', (evento) => {
  if (agarre) galeria.scrollLeft = agarre.scroll - (evento.clientX - agarre.x);
});
const soltar = () => {
  agarre = null;
  galeria.classList.remove('agarrando');
};
galeria.addEventListener('pointerup', soltar);
galeria.addEventListener('pointercancel', soltar);
galeria.addEventListener('keydown', (evento) => {
  const paso = galeria.clientWidth * 0.6;
  if (evento.key === 'ArrowRight') galeria.scrollBy({ left: paso, behavior: 'smooth' });
  else if (evento.key === 'ArrowLeft') galeria.scrollBy({ left: -paso, behavior: 'smooth' });
  else return;
  evento.preventDefault();
});

// ---- Tarjeta de sellos de ejemplo ----
const SELLOS = 5;
const tarjetaSellos = document.querySelector('[data-sellos]');
const fila = document.querySelector('[data-sellos-fila]');
const textoSellos = document.querySelector('[data-sellos-texto]');
let sellos = 0;
const huecos = Array.from({ length: SELLOS + 1 }, (_, i) => {
  const hueco = document.createElement('span');
  hueco.className = i === SELLOS ? 'sello gratis' : 'sello';
  hueco.textContent = i === SELLOS ? 'GRATIS' : 'F';
  fila.append(hueco);
  return hueco;
});
tarjetaSellos.addEventListener('click', () => {
  sellos = sellos >= SELLOS ? 0 : sellos + 1;
  huecos.slice(0, SELLOS).forEach((hueco, i) => hueco.classList.toggle('lleno', i < sellos));
  textoSellos.textContent = sellos === SELLOS ? '¡Completa! El próximo corte es gratis' : `${sellos} de ${SELLOS} sellos`;
});
