import './moneda.js';
import './reserva.js';
import './secciones.js';
import { HORARIO, ahoraEnCaracas, hora12 } from './datos.js';

const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Carga: el poste gira mientras llegan las fotos ----
const carga = document.querySelector('.carga');
addEventListener('load', () => setTimeout(() => carga.classList.add('oculta'), 400));

// Con movimiento reducido el video de la portada no corre: queda el cartel.
const video = document.querySelector('[data-video-portada]');
if (reducirMovimiento) video.pause();

// ---- Encabezado con fondo al bajar ----
const encabezado = document.querySelector('.encabezado');
const ajustarEncabezado = () => encabezado.classList.toggle('con-fondo', scrollY > 60);
addEventListener('scroll', ajustarEncabezado, { passive: true });
ajustarEncabezado();

// ---- ¿Abierto ahora? y fila estimada, con la hora de Caracas ----
function pintarEstado() {
  const { fecha, minutos } = ahoraEnCaracas();
  const { abre, cierra } = fecha.getDay() === 0 ? HORARIO.domingo : HORARIO.semana;
  const abierta = minutos >= abre * 60 && minutos < cierra * 60;
  const punto = document.querySelector('[data-abierto-punto]');
  punto.classList.toggle('cerrado', !abierta);
  const manana = new Date(fecha);
  manana.setDate(fecha.getDate() + 1);
  const abreManana = manana.getDay() === 0 ? HORARIO.domingo.abre : HORARIO.semana.abre;
  document.querySelector('[data-abierto]').textContent = abierta
    ? `Abierto hasta las ${hora12(`${cierra}:00`)}`
    : minutos < abre * 60 ? `Cerrado · abre hoy a las ${hora12(`${abre}:00`)}` : `Cerrado · abre mañana a las ${hora12(`${abreManana}:00`)}`;
  // Fila de ejemplo según la hora del día (más gente a mediodía y al salir del trabajo).
  const hora = minutos / 60;
  const gente = abierta ? Math.round(1 + 2 * Math.exp(-((hora - 12.5) ** 2) / 2) + 3 * Math.exp(-((hora - 17.5) ** 2) / 2)) : 0;
  document.querySelector('[data-fila]').textContent = abierta
    ? `En la fila: ${gente} ${gente === 1 ? 'persona' : 'personas'} · unos ${gente * 15} min sin cita`
    : 'Sin fila: reserva y llegas directo';
}
pintarEstado();
setInterval(pintarEstado, 60000);

// ---- Capítulos: según cuánto se bajó dentro de la sección, cambia foto y frase ----
const capitulos = document.querySelector('[data-capitulos]');
const fotos = [...capitulos.querySelectorAll('.capitulos__foto')];
const frases = [...capitulos.querySelectorAll('.capitulos__frases li')];
const avance = capitulos.querySelector('[data-capitulos-avance]');
let capituloActual = 0;
function pintarCapitulos() {
  const caja = capitulos.getBoundingClientRect();
  const recorrido = caja.height - innerHeight;
  const progreso = Math.min(Math.max(-caja.top / recorrido, 0), 0.999);
  avance.parentElement.style.setProperty('--avance', progreso.toFixed(3));
  const indice = Math.floor(progreso * frases.length);
  if (indice === capituloActual) return;
  capituloActual = indice;
  fotos.forEach((foto, i) => foto.classList.toggle('activa', i === indice));
  frases.forEach((frase, i) => frase.classList.toggle('activa', i === indice));
}
addEventListener('scroll', pintarCapitulos, { passive: true });
pintarCapitulos();

// ---- Frase en tres golpes: cada línea se enciende al pasar por el centro de la pantalla ----
const lineas = document.querySelectorAll('.golpes__linea');
const observadorGolpes = new IntersectionObserver((entradas) => {
  entradas.forEach((entrada) => entrada.target.classList.toggle('encendida', entrada.isIntersecting));
}, { rootMargin: '-35% 0px -35% 0px' });
lineas.forEach((linea) => observadorGolpes.observe(linea));

// ---- Aparecer al bajar ----
const observador = new IntersectionObserver((entradas) => {
  entradas.forEach((entrada) => {
    if (!entrada.isIntersecting) return;
    entrada.target.classList.add('visible');
    observador.unobserve(entrada.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll('[data-revelar]').forEach((elemento) => observador.observe(elemento));
