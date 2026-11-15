# FILO · Barbería (proyecto de portafolio)

Web de una barbería **ficticia** en Los Palos Grandes, Caracas. Las reservas funcionan de verdad (se guardan en una base de datos de prueba), pero nadie te va a cortar el pelo. HTML, CSS y JavaScript en módulos, sin librerías.

## Qué tiene

- **Portada con video** y el nombre que una navaja "corta" en dos al cargar; poste de barbero girando.
- **Capítulos con frases gigantes** sobre fotos que cambian al bajar.
- **Carta de servicios** con precios en dólares y bolívares (tasa BCV del día) y una foto que sigue al cursor.
- **Antes y después** que se arrastra (también con teclado).
- **Equipo** de 4 barberos con botón para reservar con cada uno.
- **Reserva en 5 pasos**: servicio → barbero → día → hora → datos. Solo muestra horas libres de verdad.
- **Confirmación** con código, mensaje de WhatsApp y archivo de calendario (.ics) que avisa una hora antes.
- **Cancelar con código y teléfono**: la hora queda libre para otro.
- Tarjeta de sellos, opiniones, mapa, preguntas frecuentes.
- **Panel del dueño** (`panel.html`): entra con Supabase Auth y ve las citas del día por barbero, las marca como atendidas o canceladas. Tiene **modo demostración** con datos inventados.

## Seguridad (Supabase)

- La tabla `filo_citas` tiene RLS y **no se puede leer desde la web**: el público solo ve horas ocupadas con `filo_horas_ocupadas()`, sin nombres ni teléfonos.
- Solo se reserva con `filo_reservar()`, que valida todo en el servidor (servicio, barbero, fecha hasta 21 días, horario, teléfono venezolano) y limita a 1 reserva por minuto y 3 por día por IP (guardada como hash).
- `filo_cancelar()` pide código + teléfono y permite 5 intentos por hora por IP, contando también los fallidos.
- Solo las cuentas que están en `privado.filo_duenos` ven y cambian citas en el panel.
- La clave de `js/config.js` es la **publicable**, pensada para el navegador. El SQL completo está en [`supabase/citas.sql`](supabase/citas.sql).

## Verla en tu PC

```bash
npx http-server . -p 4600
```

## Créditos

Fotos y video de [Pexels](https://www.pexels.com) (licencia libre). Mapa de [OpenStreetMap](https://www.openstreetmap.org/copyright). Tasa del BCV vía [DolarApi](https://ve.dolarapi.com).
