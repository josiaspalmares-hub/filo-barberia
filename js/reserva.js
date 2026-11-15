import { servicios, barberos, servicioPorId, barberoPorId, turnosDe, horarioDe, hora12, ahoraEnCaracas, fechaISO, DIAS_PARA_RESERVAR } from './datos.js';
import { ponerPrecio } from './moneda.js';
import { avisar } from './aviso.js';
import { SUPABASE_URL, SUPABASE_CLAVE } from './config.js';

// Reserva en 5 pasos (la base de datos vuelve a validar todo)
const TELEFONO_VE = /^04(12|14|16|24|26|22)\d{7}$/;
const ERRORES = {
  hora_ocupada: 'Alguien acaba de apartar esa hora. Elige otra, porfa.',
  muy_seguido: 'Espera un minuto antes de hacer otra reserva.',
  limite_diario: 'Ya hiciste varias reservas hoy. Si necesitas más, escríbenos por WhatsApp.',
  telefono_invalido: 'Revisa el teléfono: debe ser como 0414-1234567.',
  nombre_invalido: 'Escribe tu nombre (de 2 a 40 letras).',
  hora_invalida: 'Esa hora ya no está disponible. Elige otra.',
  fecha_invalida: 'Elige un día de las próximas dos semanas.',
};
const formatoDia = new Intl.DateTimeFormat('es-VE', { weekday: 'short' });
const formatoMes = new Intl.DateTimeFormat('es-VE', { month: 'short' });
const formatoLargo = new Intl.DateTimeFormat('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });

const seccion = document.querySelector('#reservar');
const formulario = document.querySelector('[data-reserva]');
const pasos = [...formulario.querySelectorAll('[data-paso]')];
const indicadores = [...formulario.querySelectorAll('[data-paso-indicador]')];
const cajas = {
  servicio: formulario.querySelector('[data-opciones-servicio]'),
  barbero: formulario.querySelector('[data-opciones-barbero]'),
  dia: formulario.querySelector('[data-opciones-dia]'),
  hora: formulario.querySelector('[data-opciones-hora]'),
};
const estadoHoras = formulario.querySelector('[data-horas-estado]');
const resumen = Object.fromEntries([...formulario.querySelectorAll('[data-resumen]')].map((el) => [el.dataset.resumen, el]));
const precio = formulario.querySelector('[data-resumen-precio]');
const aviso = formulario.querySelector('[data-reserva-aviso]');
const botones = {
  atras: formulario.querySelector('[data-atras]'),
  siguiente: formulario.querySelector('[data-siguiente]'),
  confirmar: formulario.querySelector('[data-confirmar]'),
};
const confirmada = document.querySelector('[data-confirmada]');

const eleccion = { servicio: null, barbero: null, dia: null, hora: null };
let pasoActual = 1;

// ---- Opciones ----
function crearOpcion(grupo, valor, contenido, alElegir) {
  const etiqueta = document.createElement('label');
  etiqueta.className = 'opcion';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = grupo;
  radio.value = valor;
  radio.addEventListener('change', () => alElegir(valor));
  const caja = document.createElement('span');
  caja.className = 'opcion__caja';
  caja.append(...contenido);
  etiqueta.append(radio, caja);
  return etiqueta;
}

const texto = (clase, valor) => {
  const span = document.createElement('span');
  span.className = clase;
  span.textContent = valor;
  return span;
};

cajas.servicio.append(...servicios.map((s) => crearOpcion('servicio', s.id, [
  texto('opcion__nombre', s.nombre),
  texto('opcion__sub', `${s.min} min · $${s.precio}`),
], (valor) => elegir('servicio', valor))));

cajas.barbero.append(...barberos.map((b) => {
  const foto = document.createElement('img');
  foto.className = 'opcion__foto';
  foto.src = `img/${b.foto}.webp`;
  foto.alt = '';
  foto.loading = 'lazy';
  return crearOpcion('barbero', b.id, [foto, texto('opcion__nombre', b.nombre), texto('opcion__sub', b.fuerte)], (valor) => elegir('barbero', valor));
}));

function diasDisponibles() {
  const { fecha: hoy, minutos } = ahoraEnCaracas();
  const dias = [];
  for (let i = 0; i < DIAS_PARA_RESERVAR; i++) {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() + i);
    // hoy solo si queda al menos un turno por delante
    if (i === 0 && minutos >= horarioDe(dia).cierra * 60 - 30) continue;
    dias.push(dia);
  }
  return dias;
}

function pintarDias() {
  const dias = diasDisponibles();
  cajas.dia.replaceChildren(...dias.map((dia, i) => crearOpcion('dia', fechaISO(dia), [
    texto('opcion__sub', i === 0 && fechaISO(dia) === fechaISO(ahoraEnCaracas().fecha) ? 'Hoy' : formatoDia.format(dia).replace('.', '')),
    texto('opcion__grande', String(dia.getDate())),
    texto('opcion__sub', formatoMes.format(dia).replace('.', '')),
  ], (valor) => elegir('dia', valor))));
}

// ---- Horas ocupadas ----
async function horasOcupadas(barbero, dia) {
  const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/filo_horas_ocupadas`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_barbero: barbero, p_fecha: dia }),
  });
  if (!respuesta.ok) throw new Error(`No se pudieron leer las horas (${respuesta.status})`);
  const lista = await respuesta.json();
  return new Set(lista.map((h) => String(h).slice(0, 5)));
}

async function pintarHoras() {
  const [a, m, d] = eleccion.dia.split('-').map(Number);
  const dia = new Date(a, m - 1, d);
  const turnos = turnosDe(dia);
  cajas.hora.replaceChildren();
  estadoHoras.textContent = 'Buscando horas libres…';
  let ocupadas;
  try {
    ocupadas = await horasOcupadas(eleccion.barbero, eleccion.dia);
  } catch (error) {
    console.error(error);
    estadoHoras.textContent = 'No pudimos ver las horas libres. Revisa tu conexión.';
    const reintentar = document.createElement('button');
    reintentar.type = 'button';
    reintentar.className = 'boton boton--borde-claro boton--chico';
    reintentar.textContent = 'Intentar otra vez';
    reintentar.addEventListener('click', pintarHoras);
    cajas.hora.append(reintentar);
    return;
  }
  const { fecha: hoy, minutos } = ahoraEnCaracas();
  const esHoy = eleccion.dia === fechaISO(hoy);
  let libres = 0;
  cajas.hora.replaceChildren(...turnos.map((turno) => {
    const [h, mi] = turno.split(':').map(Number);
    const paso = esHoy && h * 60 + mi <= minutos;
    const ocupada = ocupadas.has(turno);
    const opcion = crearOpcion('hora', turno, [texto('opcion__nombre', hora12(turno)), texto('opcion__sub', ocupada ? 'Ocupada' : paso ? 'Ya pasó' : 'Libre')], (valor) => elegir('hora', valor));
    if (ocupada || paso) opcion.querySelector('input').disabled = true;
    else libres += 1;
    return opcion;
  }));
  estadoHoras.textContent = libres ? `${libres} horas libres con ${barberoPorId(eleccion.barbero).nombre}.` : 'Ese día está lleno. Prueba otro día u otro barbero.';
}

// ---- Elegir y avanzar ----
function elegir(clave, valor) {
  eleccion[clave] = valor;
  // cambiar barbero o día invalida la hora elegida
  if (clave === 'barbero' || clave === 'dia') eleccion.hora = null;
  aviso.textContent = '';
  pintarResumen();
  const numero = { servicio: 1, barbero: 2, dia: 3, hora: 4 }[clave];
  if (numero === pasoActual) setTimeout(() => irAPaso(pasoActual + 1), 260);
}

// Reservar desde la carta o el equipo
export function elegirEnReserva(datos) {
  Object.entries(datos).forEach(([clave, valor]) => {
    eleccion[clave] = valor;
    const radio = cajas[clave].querySelector(`input[value="${valor}"]`);
    if (radio) radio.checked = true;
  });
  pintarResumen();
  confirmada.hidden = true;
  formulario.hidden = false;
  const pendiente = ['servicio', 'barbero', 'dia', 'hora'].findIndex((clave) => !eleccion[clave]) + 1;
  irAPaso(pendiente || 5);
  seccion.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function falta(numero) {
  if (numero === 1 && !eleccion.servicio) return 'Elige un servicio.';
  if (numero === 2 && !eleccion.barbero) return 'Elige un barbero.';
  if (numero === 3 && !eleccion.dia) return 'Elige un día.';
  if (numero === 4 && !eleccion.hora) return 'Elige una hora.';
  return '';
}

function irAPaso(numero) {
  pasoActual = Math.min(Math.max(numero, 1), pasos.length);
  pasos.forEach((paso) => { paso.hidden = Number(paso.dataset.paso) !== pasoActual; });
  indicadores.forEach((li) => {
    const n = Number(li.dataset.pasoIndicador);
    li.classList.toggle('activo', n === pasoActual);
    li.classList.toggle('hecho', n < pasoActual);
  });
  botones.atras.hidden = pasoActual === 1;
  botones.siguiente.hidden = pasoActual === pasos.length;
  botones.confirmar.hidden = pasoActual !== pasos.length;
  if (pasoActual === 3) pintarDias();
  if (pasoActual === 3 && eleccion.dia) {
    const radio = cajas.dia.querySelector(`input[value="${eleccion.dia}"]`);
    if (radio) radio.checked = true;
  }
  if (pasoActual === 4) pintarHoras();
  if (pasoActual === 5) formulario.elements.nombre.focus({ preventScroll: true });
}

botones.siguiente.addEventListener('click', () => {
  const mensaje = falta(pasoActual);
  if (mensaje) {
    aviso.textContent = mensaje;
    return;
  }
  irAPaso(pasoActual + 1);
});
botones.atras.addEventListener('click', () => irAPaso(pasoActual - 1));

function pintarResumen() {
  const servicio = servicioPorId(eleccion.servicio);
  resumen.servicio.textContent = servicio?.nombre ?? '—';
  resumen.barbero.textContent = barberoPorId(eleccion.barbero)?.nombre ?? '—';
  if (eleccion.dia) {
    const [a, m, d] = eleccion.dia.split('-').map(Number);
    resumen.dia.textContent = formatoLargo.format(new Date(a, m - 1, d));
  } else {
    resumen.dia.textContent = '—';
  }
  resumen.hora.textContent = eleccion.hora ? hora12(eleccion.hora) : '—';
  if (servicio) ponerPrecio(precio, servicio.precio);
  else precio.replaceChildren();
}

// ---- Confirmar ----
const limpiarNombre = (valor) => String(valor ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const soloDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

async function reservar(datos) {
  const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/filo_reservar`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_servicio: eleccion.servicio, p_barbero: eleccion.barbero, p_fecha: eleccion.dia, p_hora: eleccion.hora,
      p_nombre: datos.nombre, p_telefono: datos.telefono,
    }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) return { error: cuerpo.message };
  return { codigo: cuerpo };
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const pendiente = [1, 2, 3, 4].find((n) => falta(n));
  if (pendiente) {
    irAPaso(pendiente);
    aviso.textContent = falta(pendiente);
    return;
  }
  const nombre = limpiarNombre(formulario.elements.nombre.value);
  const telefono = soloDigitos(formulario.elements.telefono.value);
  if (nombre.length < 2 || nombre.length > 40) {
    aviso.textContent = ERRORES.nombre_invalido;
    formulario.elements.nombre.focus();
    return;
  }
  if (!TELEFONO_VE.test(telefono)) {
    aviso.textContent = ERRORES.telefono_invalido;
    formulario.elements.telefono.focus();
    return;
  }
  botones.confirmar.disabled = true;
  botones.confirmar.textContent = 'Apartando…';
  const resultado = await reservar({ nombre, telefono }).catch(() => ({ error: 'sin_conexion' }));
  botones.confirmar.disabled = false;
  botones.confirmar.textContent = 'Confirmar cita';

  if (resultado.error) {
    if (resultado.error === 'hora_ocupada' || resultado.error === 'hora_invalida') {
      eleccion.hora = null;
      pintarResumen();
      irAPaso(4);
    }
    aviso.textContent = ERRORES[resultado.error] ?? 'No pudimos apartar la cita. Revisa tu conexión e inténtalo otra vez.';
    return;
  }
  aviso.textContent = '';
  mostrarConfirmacion(nombre, resultado.codigo);
});

function mostrarConfirmacion(nombre, codigo) {
  const servicio = servicioPorId(eleccion.servicio);
  const barbero = barberoPorId(eleccion.barbero);
  const dia = resumen.dia.textContent;
  const hora = hora12(eleccion.hora);
  confirmada.querySelector('[data-conf-nombre]').textContent = nombre.split(' ')[0];
  confirmada.querySelector('[data-conf-codigo]').textContent = codigo;
  confirmada.querySelector('[data-conf-texto]').textContent = `${servicio.nombre} con ${barbero.nombre}, el ${dia} a las ${hora}. Llega 5 minutos antes.`;
  const mensaje = `Hola FILO, aparté una cita: ${servicio.nombre} con ${barbero.nombre}, el ${dia} a las ${hora}. Código ${codigo}.`;
  confirmada.querySelector('[data-conf-whatsapp]').href = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  const calendario = confirmada.querySelector('[data-conf-calendario]');
  if (calendario.href.startsWith('blob:')) URL.revokeObjectURL(calendario.href);
  calendario.href = URL.createObjectURL(new Blob([archivoCalendario(servicio, barbero, codigo)], { type: 'text/calendar' }));
  formulario.hidden = true;
  confirmada.hidden = false;
  confirmada.focus();
  avisar('¡Silla apartada!');
}

// Archivo .ics con aviso una hora antes. Caracas es UTC−4 todo el año.
function archivoCalendario(servicio, barbero, codigo) {
  const [a, m, d] = eleccion.dia.split('-').map(Number);
  const [h, mi] = eleccion.hora.split(':').map(Number);
  const inicio = new Date(Date.UTC(a, m - 1, d, h + 4, mi));
  const fin = new Date(inicio.getTime() + servicio.min * 60000);
  const utc = (fecha) => fecha.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FILO Barberia//Reservas//ES', 'BEGIN:VEVENT',
    `UID:${codigo}@filo-barberia`, `DTSTAMP:${utc(new Date())}`, `DTSTART:${utc(inicio)}`, `DTEND:${utc(fin)}`,
    `SUMMARY:${servicio.nombre} con ${barbero.nombre} (FILO)`,
    `DESCRIPTION:Código ${codigo}. Llega 5 minutos antes.`,
    'LOCATION:Los Palos Grandes\\, Caracas',
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Tu corte en FILO es en una hora', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

// ---- Cancelar con código y teléfono ----
const formCancelar = document.querySelector('[data-cancelar]');
const avisoCancelar = document.querySelector('[data-cancelar-aviso]');
const ERRORES_CANCELAR = {
  datos_invalidos: 'Revisa el código (FILO-…) y el teléfono.',
  muchos_intentos: 'Demasiados intentos. Espera una hora o escríbenos por WhatsApp.',
  no_encontrada: 'No encontramos una cita pendiente con ese código y ese teléfono.',
};

formCancelar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  avisoCancelar.classList.remove('bien');
  const codigo = formCancelar.elements.codigo.value.trim().toUpperCase();
  const telefono = soloDigitos(formCancelar.elements.telefono.value);
  if (!/^FILO-[0-9A-F]{6}$/.test(codigo) || !TELEFONO_VE.test(telefono)) {
    avisoCancelar.textContent = ERRORES_CANCELAR.datos_invalidos;
    return;
  }
  const boton = formCancelar.querySelector('[type="submit"]');
  boton.disabled = true;
  const resultado = await fetch(`${SUPABASE_URL}/rest/v1/rpc/filo_cancelar`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_codigo: codigo, p_telefono: telefono }),
  }).then(async (respuesta) => {
    const cuerpo = await respuesta.json();
    return respuesta.ok ? cuerpo : cuerpo.message;
  }).catch(() => 'sin_conexion');
  boton.disabled = false;
  if (resultado === 'cancelada') {
    avisoCancelar.textContent = `Cita ${codigo} cancelada. Esa hora ya quedó libre para otra persona.`;
    avisoCancelar.classList.add('bien');
    formCancelar.reset();
    if (pasoActual === 4 && eleccion.dia) pintarHoras();
    return;
  }
  avisoCancelar.textContent = ERRORES_CANCELAR[resultado] ?? 'No pudimos cancelar ahora. Revisa tu conexión e inténtalo otra vez.';
});

formCancelar.elements.telefono.addEventListener('input', (evento) => {
  const digitos = soloDigitos(evento.target.value).slice(0, 11);
  evento.target.value = digitos.length > 4 ? `${digitos.slice(0, 4)}-${digitos.slice(4)}` : digitos;
});

confirmada.querySelector('[data-otra]').addEventListener('click', () => {
  Object.keys(eleccion).forEach((clave) => { eleccion[clave] = null; });
  formulario.reset();
  pintarResumen();
  confirmada.hidden = true;
  formulario.hidden = false;
  irAPaso(1);
});

// Formato 0414-1234567
formulario.elements.telefono.addEventListener('input', (evento) => {
  aviso.textContent = '';
  const digitos = soloDigitos(evento.target.value).slice(0, 11);
  evento.target.value = digitos.length > 4 ? `${digitos.slice(0, 4)}-${digitos.slice(4)}` : digitos;
});

pintarResumen();
irAPaso(1);
