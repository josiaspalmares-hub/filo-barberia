import { servicios, barberos, servicioPorId, barberoPorId, hora12, ahoraEnCaracas, fechaISO, turnosDe } from './datos.js';
import { SUPABASE_URL, SUPABASE_CLAVE } from './config.js';

// Panel del dueño. Modo real: Supabase Auth + RLS (solo dueños ven citas).
// Modo demostración: datos inventados en memoria, para quien llega desde el portafolio.

const entrar = document.querySelector('[data-entrar]');
const tablero = document.querySelector('[data-tablero]');
const formLogin = document.querySelector('[data-login]');
const avisoLogin = document.querySelector('[data-login-aviso]');
const agenda = document.querySelector('[data-agenda]');
const estado = document.querySelector('[data-estado]');
const filtroDia = document.querySelector('[data-filtro-dia]');
const filtroBarbero = document.querySelector('[data-filtro-barbero]');

let sesion = null; // { token } en modo real
let modoDemo = false;
let citasDemo = [];
let barberoElegido = 'todos';
let citas = [];

// ---- Entrada sin contraseña: enlace por correo ----
const VOLVER_A = `${location.origin}${location.pathname}`;

formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const correo = formLogin.elements.correo.value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 120) {
    avisoLogin.textContent = 'Escribe un correo válido.';
    return;
  }
  const boton = formLogin.querySelector('[type="submit"]');
  boton.disabled = true;
  avisoLogin.classList.remove('bien');
  const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(VOLVER_A)}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CLAVE, 'Content-Type': 'application/json' },
    // create_user en falso: desde aquí nadie puede crearse una cuenta nueva
    body: JSON.stringify({ email: correo, create_user: false }),
  }).catch(() => null);
  boton.disabled = false;
  if (!respuesta) {
    avisoLogin.textContent = 'Sin conexión. Inténtalo otra vez.';
    return;
  }
  if (respuesta.status === 429) {
    avisoLogin.textContent = 'Ya enviamos varios enlaces. Espera unos minutos.';
    return;
  }
  // mismo mensaje exista o no la cuenta: no se revela qué correos son de dueños
  avisoLogin.textContent = 'Si ese correo es de un dueño, te llegó un enlace para entrar. Revisa también el spam.';
  avisoLogin.classList.add('bien');
  formLogin.reset();
});

// Al volver desde el enlace del correo, el token llega en la dirección (#access_token=...).
async function entrarConEnlace() {
  const datos = new URLSearchParams(location.hash.slice(1));
  const token = datos.get('access_token');
  const error = datos.get('error_description');
  if (!token && !error) return;
  history.replaceState(null, '', VOLVER_A);
  if (error) {
    avisoLogin.textContent = 'El enlace venció o ya se usó. Pide uno nuevo.';
    return;
  }
  sesion = { token };
  const esDueno = await llamar('rpc/filo_es_dueno', { method: 'POST', body: '{}' }).catch(() => false);
  if (esDueno !== true) {
    sesion = null;
    avisoLogin.textContent = 'Esta cuenta no tiene acceso al panel de la barbería.';
    return;
  }
  abrirTablero(false);
}
entrarConEnlace();

document.querySelector('[data-demo]').addEventListener('click', () => {
  citasDemo = inventarCitas();
  abrirTablero(true);
});

document.querySelector('[data-salir]').addEventListener('click', () => {
  sesion = null;
  modoDemo = false;
  tablero.hidden = true;
  entrar.hidden = false;
});

async function llamar(ruta, opciones = {}) {
  const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: SUPABASE_CLAVE, Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json', ...opciones.headers },
  });
  if (respuesta.status === 401) {
    sesion = null;
    throw new Error('sesion_vencida');
  }
  if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
  return respuesta.status === 204 ? null : respuesta.json();
}

// ---- Tablero ----
function abrirTablero(demo) {
  modoDemo = demo;
  entrar.hidden = true;
  tablero.hidden = false;
  document.querySelector('[data-modo]').textContent = demo ? 'Demostración · datos de ejemplo' : 'Citas reales';
  const { fecha, minutos } = ahoraEnCaracas();
  filtroDia.value = fechaISO(fecha);
  const saludo = minutos < 12 * 60 ? 'Buenos días' : minutos < 19 * 60 ? 'Buenas tardes' : 'Buenas noches';
  document.querySelector('[data-saludo]').innerHTML = `${saludo}, <em>jefe</em>`;
  pintarFiltroBarberos();
  cargar();
}

function pintarFiltroBarberos() {
  const opciones = [{ id: 'todos', nombre: 'Todos' }, ...barberos];
  filtroBarbero.replaceChildren(...opciones.map((b) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'filtro';
    boton.textContent = b.nombre;
    boton.setAttribute('aria-pressed', String(b.id === barberoElegido));
    boton.addEventListener('click', () => {
      barberoElegido = b.id;
      pintarFiltroBarberos();
      pintarAgenda();
    });
    return boton;
  }));
}

filtroDia.addEventListener('change', cargar);

async function cargar() {
  const dia = filtroDia.value;
  const [a, m, d] = dia.split('-').map(Number);
  document.querySelector('[data-fecha-hoy]').textContent = new Intl.DateTimeFormat('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a, m - 1, d));
  if (modoDemo) {
    citas = citasDemo.filter((c) => c.fecha === dia);
    pintarAgenda();
    return;
  }
  estado.textContent = 'Cargando citas…';
  try {
    citas = await llamar(`filo_citas?select=id,codigo,servicio,barbero,fecha,hora,nombre,telefono,estado&fecha=eq.${dia}&order=hora.asc`);
    estado.textContent = '';
  } catch (error) {
    estado.textContent = error.message === 'sesion_vencida' ? 'Tu sesión venció. Sal y vuelve a entrar.' : 'No pudimos cargar las citas. Revisa tu conexión.';
    citas = [];
  }
  pintarAgenda();
}

function pintarAgenda() {
  const visibles = citas.filter((c) => barberoElegido === 'todos' || c.barbero === barberoElegido);
  const activas = visibles.filter((c) => c.estado !== 'cancelada');
  document.querySelector('[data-cifra="total"]').textContent = activas.length;
  document.querySelector('[data-cifra="pendientes"]').textContent = activas.filter((c) => c.estado === 'pendiente').length;
  document.querySelector('[data-cifra="hechas"]').textContent = activas.filter((c) => c.estado === 'hecha').length;
  document.querySelector('[data-cifra="ingreso"]').textContent = `$${activas.reduce((s, c) => s + (servicioPorId(c.servicio)?.precio ?? 0), 0)}`;
  if (!estado.textContent || estado.textContent.startsWith('No hay')) {
    estado.textContent = visibles.length ? '' : 'No hay citas para este día. Buen momento para un cafecito.';
  }
  agenda.replaceChildren(...visibles.map(crearRenglon));
}

function crearRenglon(cita) {
  const servicio = servicioPorId(cita.servicio);
  const barbero = barberoPorId(cita.barbero);
  const item = document.createElement('li');
  item.className = `cita cita--${cita.estado}`;
  item.innerHTML = `
    <p class="cita__hora"></p>
    <div class="cita__datos">
      <p class="cita__nombre"></p>
      <p class="cita__detalle"></p>
    </div>
    <a class="cita__telefono" target="_blank" rel="noopener"></a>
    <p class="cita__estado"></p>
    <div class="cita__acciones"></div>`;
  item.querySelector('.cita__hora').textContent = hora12(String(cita.hora).slice(0, 5));
  item.querySelector('.cita__nombre').textContent = cita.nombre;
  item.querySelector('.cita__detalle').textContent = `${servicio?.nombre ?? cita.servicio} · ${barbero?.nombre ?? cita.barbero} · ${cita.codigo}`;
  const telefono = item.querySelector('.cita__telefono');
  if (modoDemo) {
    // números inventados: se enmascaran y no se enlazan, por si coinciden con alguien real
    telefono.textContent = `${cita.telefono.slice(0, 4)}-•••-••${cita.telefono.slice(-2)}`;
    telefono.removeAttribute('href');
  } else {
    telefono.textContent = `${cita.telefono.slice(0, 4)}-${cita.telefono.slice(4)}`;
    telefono.href = `https://wa.me/58${cita.telefono.slice(1)}`;
    telefono.setAttribute('aria-label', `Escribir por WhatsApp a ${cita.nombre}`);
  }
  item.querySelector('.cita__estado').textContent = { pendiente: 'Pendiente', hecha: 'Atendida', cancelada: 'Cancelada' }[cita.estado];
  const acciones = item.querySelector('.cita__acciones');
  if (cita.estado === 'pendiente') {
    acciones.append(
      botonEstado('Atendida', 'hecha', cita, 'boton--cobre'),
      botonEstado('Cancelar', 'cancelada', cita, 'boton--borde'),
    );
  }
  return item;
}

function botonEstado(texto, nuevo, cita, clase) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = `boton boton--chico ${clase}`;
  boton.textContent = texto;
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    if (!modoDemo) {
      try {
        await llamar(`filo_citas?id=eq.${cita.id}`, { method: 'PATCH', body: JSON.stringify({ estado: nuevo }), headers: { Prefer: 'return=minimal' } });
      } catch (error) {
        estado.textContent = error.message === 'sesion_vencida' ? 'Tu sesión venció. Sal y vuelve a entrar.' : 'No se pudo guardar el cambio.';
        boton.disabled = false;
        return;
      }
    }
    cita.estado = nuevo;
    pintarAgenda();
  });
  return boton;
}

// ---- Datos de ejemplo (siempre los mismos para el mismo día) ----
function inventarCitas() {
  const nombres = ['Carlos M.', 'José L.', 'Daniel R.', 'Andrés P.', 'Luis G.', 'Miguel A.', 'Ricardo V.', 'Samuel T.', 'Gabriel F.', 'Diego C.', 'Jesús M.', 'Óscar B.', 'Sofía L.', 'Valentina P.'];
  const lista = [];
  const { fecha: hoy, minutos } = ahoraEnCaracas();
  let semilla = 7;
  const azar = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
  for (let i = -1; i <= 6; i++) {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() + i);
    const turnos = turnosDe(dia);
    barberos.forEach((barbero) => {
      turnos.forEach((turno) => {
        if (azar() > 0.32) return;
        const [h, m] = turno.split(':').map(Number);
        const paso = i < 0 || (i === 0 && h * 60 + m < minutos);
        const telefono = `04${['12', '14', '24', '16'][Math.floor(azar() * 4)]}${String(Math.floor(azar() * 1e7)).padStart(7, '0')}`;
        lista.push({
          id: lista.length + 1,
          codigo: `FILO-${Math.floor(azar() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`,
          servicio: servicios[Math.floor(azar() * servicios.length)].id,
          barbero: barbero.id,
          fecha: fechaISO(dia),
          hora: turno,
          nombre: nombres[Math.floor(azar() * nombres.length)],
          telefono,
          estado: paso ? (azar() > 0.12 ? 'hecha' : 'cancelada') : 'pendiente',
        });
      });
    });
  }
  return lista.sort((a, b) => a.hora.localeCompare(b.hora));
}
