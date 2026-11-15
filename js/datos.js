// Datos de la barbería ficticia FILO (proyecto de portafolio).

export const servicios = [
  { id: 'corte', nombre: 'Corte clásico', desc: 'Tijera y máquina, lavado y peinado. El de toda la vida, bien hecho.', min: 40, precio: 8, foto: 'cortes/k07' },
  { id: 'fade', nombre: 'Fade', desc: 'Degradado bajo, medio o alto, terminado a navaja en el cuello.', min: 45, precio: 10, foto: 'cortes/k10' },
  { id: 'diseno', nombre: 'Fade con diseño', desc: 'Raya, figura o línea a mano alzada. Tráenos la foto.', min: 60, precio: 13, foto: 'cortes/k05' },
  { id: 'barba', nombre: 'Barba a navaja', desc: 'Toalla caliente, perfilado con navaja y aceite. Sales como nuevo.', min: 30, precio: 7, foto: 'cortes/barba' },
  { id: 'combo', nombre: 'Corte + barba', desc: 'El combo completo. Una hora y quince de silla y buena conversación.', min: 75, precio: 15, foto: 'cortes/barba2' },
  { id: 'navaja', nombre: 'Afeitado y cejas', desc: 'Afeitado clásico a navaja y perfilado de cejas.', min: 30, precio: 6, foto: 'cortes/navaja' },
  { id: 'ninos', nombre: 'Corte de niños', desc: 'Hasta 12 años. Con paciencia y sin llanto (casi siempre).', min: 30, precio: 6, foto: 'cortes/k11' },
  { id: 'peinado', nombre: 'Peinado y cera', desc: 'Para el evento de hoy: pompadour, raya al lado o textura.', min: 20, precio: 5, foto: 'cortes/pompadour' },
];

export const barberos = [
  { id: 'andres', nombre: 'Andrés', apodo: 'El de los fades', anos: 9, foto: 'equipo/b1', fuerte: 'Fades y taper' },
  { id: 'kevin', nombre: 'Kevin', apodo: 'Mano de seda', anos: 6, foto: 'equipo/b2', fuerte: 'Barba a navaja' },
  { id: 'luis', nombre: 'Luis', apodo: 'El artista', anos: 7, foto: 'equipo/b3', fuerte: 'Diseños y líneas' },
  { id: 'mateo', nombre: 'Mateo', apodo: 'El veterano', anos: 15, foto: 'equipo/b4', fuerte: 'Clásicos y niños' },
];

// Horario de la barbería (hora de Caracas). Turnos cada 30 minutos.
export const HORARIO = {
  semana: { abre: 9, cierra: 19 }, // lunes a sábado, 9:00 AM a 7:00 PM
  domingo: { abre: 10, cierra: 14 }, // domingo, 10:00 AM a 2:00 PM
};
export const DIAS_PARA_RESERVAR = 14;

export const servicioPorId = (id) => servicios.find((s) => s.id === id);
export const barberoPorId = (id) => barberos.find((b) => b.id === id);

export function horarioDe(fecha) {
  return fecha.getDay() === 0 ? HORARIO.domingo : HORARIO.semana;
}

// "14:30" → "2:30 PM"
export function hora12(texto) {
  const [h, m] = texto.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function turnosDe(fecha) {
  const { abre, cierra } = horarioDe(fecha);
  const turnos = [];
  for (let minutos = abre * 60; minutos < cierra * 60; minutos += 30) {
    turnos.push(`${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`);
  }
  return turnos;
}

// Fecha y hora "de Caracas" sin depender de la zona horaria de quien visita.
export function ahoraEnCaracas() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    fecha: new Date(Number(partes.year), Number(partes.month) - 1, Number(partes.day)),
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

export const fechaISO = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
