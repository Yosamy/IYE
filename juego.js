// =====================================================================
//  LÓGICA DEL PROTOTIPO
//  Los valores que cambian entre versiones están en config.js, no aquí.
// =====================================================================

// Estado de la sesión de juego.
const Juego = {
  prendas: 0,
  rechazos: 0,
  sostenido: null,   // { el, obj, mano } — el objeto que el jugador tiene tomado
  volando: [],       // objetos que van entrando a la ranura
};

function objetoPorId(id) {
  return CONFIG.objetos.find(o => o.id === id);
}

// Devuelve el % de descuento que corresponde a una cantidad de prendas.
function cuponPara(prendas) {
  const tramo = CONFIG.tramos.find(t => prendas >= t.desde && prendas <= t.hasta);
  return tramo ? tramo.descuento : 0;
}

// ---------------------------------------------------------------------
//  Panel de texto: se dibuja en un canvas para que salgan bien las
//  tildes y la ñ, y para controlar tamaño y contraste en VR.
// ---------------------------------------------------------------------
AFRAME.registerComponent('panel', {
  schema: {
    ancho: { default: 1 },
    alto: { default: 0.5 },
    fondo: { default: '#0b1f1a' },
  },

  init() {
    const px = 1024;
    this.canvas = document.createElement('canvas');
    this.canvas.width = px;
    this.canvas.height = Math.round(px * this.data.alto / this.data.ancho);
    this.ctx = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.textura) this.textura.colorSpace = THREE.SRGBColorSpace;
    this.textura.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({ map: this.textura, transparent: true });
    this.el.setObject3D('mesh', new THREE.Mesh(new THREE.PlaneGeometry(this.data.ancho, this.data.alto), material));
    if (this.el.lineasPendientes) this.dibujar(this.el.lineasPendientes, this.el.fondoPendiente);
  },

  // lineas: [{ texto, tam, color, negrita, resalte }]. "tam" en píxeles sobre 1024 de ancho.
  // fondo (opcional) cambia el color del panel solo para este dibujo.
  dibujar(lineas, fondo) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const escala = CONFIG.tamanoLetra;
    const margen = 40;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = fondo || this.data.fondo;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 36);
    ctx.fill();

    // Corta cada línea para que quepa en el ancho del panel.
    const filas = [];
    for (const l of lineas) {
      const tam = (l.tam || 48) * escala;
      ctx.font = `${l.negrita ? 'bold ' : ''}${tam}px system-ui, Arial, sans-serif`;
      const palabras = String(l.texto).split(' ');
      let actual = '';
      for (const p of palabras) {
        const prueba = actual ? actual + ' ' + p : p;
        if (ctx.measureText(prueba).width > W - margen * 2 && actual) {
          filas.push({ ...l, texto: actual, tam });
          actual = p;
        } else {
          actual = prueba;
        }
      }
      filas.push({ ...l, texto: actual, tam });
    }

    const altoTotal = filas.reduce((s, f) => s + f.tam * 1.35, 0);
    let y = (H - altoTotal) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of filas) {
      const alto = f.tam * 1.35;
      if (f.resalte) {
        ctx.fillStyle = f.resalte;
        ctx.beginPath();
        ctx.roundRect(margen / 2, y + 4, W - margen, alto - 8, 18);
        ctx.fill();
      }
      ctx.font = `${f.negrita ? 'bold ' : ''}${f.tam}px system-ui, Arial, sans-serif`;
      ctx.fillStyle = f.color || '#ffffff';
      ctx.fillText(f.texto, W / 2, y + alto / 2);
      y += alto;
    }
    this.textura.needsUpdate = true;
  },
});

// Crea una entidad con un panel y devuelve el componente para dibujar en él.
function crearPanel(padre, { ancho, alto, fondo, posicion = '0 0 0', rotacion = '0 0 0' }) {
  const el = document.createElement('a-entity');
  el.setAttribute('position', posicion);
  el.setAttribute('rotation', rotacion);
  el.setAttribute('panel', { ancho, alto, fondo: fondo || '#0b1f1a' });
  padre.appendChild(el);
  // Si el panel aún no está en la escena, guarda el texto y lo dibuja al iniciar.
  return {
    el,
    dibujar(lineas, fondo) {
      el.lineasPendientes = lineas;
      el.fondoPendiente = fondo;
      const panel = el.components && el.components.panel;
      if (panel && panel.canvas) panel.dibujar(lineas, fondo);
    },
  };
}

// ---------------------------------------------------------------------
//  Pantalla de la máquina: prendas, cupón y escala.
// ---------------------------------------------------------------------
function dibujarPantalla() {
  const t = CONFIG.textos;
  const descuento = cuponPara(Juego.prendas);
  const lineas = [
    { texto: t.tituloPantalla, tam: 52, negrita: true, color: '#2fe0a6' },
    { texto: `${t.prendas}: ${Juego.prendas} / ${CONFIG.topePrendas}`, tam: 90, negrita: true },
    { texto: `${t.cupon}: ${descuento ? descuento + ' %' : t.sinCupon}`, tam: 70, negrita: true, color: '#ffd84d' },
  ];
  if (CONFIG.mostrarEscalaAntes || Juego.prendas > 0) {
    lineas.push({ texto: t.escalaTitulo, tam: 44, color: '#cfe9e1' });
    for (const tr of CONFIG.tramos) {
      const activo = Juego.prendas >= tr.desde && Juego.prendas <= tr.hasta;
      lineas.push({
        texto: `${tr.desde} a ${tr.hasta} prendas  →  ${tr.descuento} %`,
        tam: 56,
        negrita: activo,
        color: activo ? '#0b1f1a' : '#ffffff',
        resalte: activo ? '#2fe0a6' : null,
      });
    }
  }
  Juego.pantalla.dibujar(lineas);
}

// ---------------------------------------------------------------------
//  Objetos del canasto (formas simples para que el Quest ande fluido).
// ---------------------------------------------------------------------
function crearForma(obj) {
  const g = document.createElement('a-entity');
  const agregar = (tag, attrs) => {
    const e = document.createElement(tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    g.appendChild(e);
  };
  switch (obj.forma) {
    case 'prenda':
      agregar('a-box', { width: 0.19, height: 0.05, depth: 0.16, color: obj.color, position: '0 0.025 0' });
      agregar('a-box', { width: 0.19, height: 0.012, depth: 0.04, color: '#ffffff', opacity: 0.35, position: '0 0.056 -0.05' });
      break;
    case 'pantalon':
      agregar('a-box', { width: 0.11, height: 0.05, depth: 0.2, color: obj.color, position: '0 0.025 0' });
      break;
    case 'botella':
      agregar('a-cylinder', { radius: 0.035, height: 0.2, color: obj.color, opacity: 0.75, position: '0 0.1 0' });
      agregar('a-cylinder', { radius: 0.016, height: 0.035, color: '#1e5fbf', position: '0 0.215 0' });
      break;
    case 'lata':
      agregar('a-cylinder', { radius: 0.035, height: 0.12, color: obj.color, metalness: 0.6, roughness: 0.3, position: '0 0.06 0' });
      agregar('a-cylinder', { radius: 0.036, height: 0.05, color: '#d6332f', position: '0 0.06 0' });
      break;
    case 'cargador':
      agregar('a-box', { width: 0.06, height: 0.045, depth: 0.06, color: obj.color, position: '0 0.023 0' });
      agregar('a-box', { width: 0.008, height: 0.006, depth: 0.025, color: '#999999', position: '-0.012 0.02 0.04' });
      agregar('a-box', { width: 0.008, height: 0.006, depth: 0.025, color: '#999999', position: '0.012 0.02 0.04' });
      agregar('a-torus', { radius: 0.035, 'radius-tubular': 0.004, color: '#eeeeee', rotation: '90 0 0', position: '0.07 0.005 0' });
      break;
  }
  return g;
}

function crearCanasto() {
  const canasto = document.querySelector('#canasto');

  // Canasto: base y bordes bajos.
  const base = { ancho: 1.56, fondo: 0.5 };
  const pared = (pos, w, d) => {
    const b = document.createElement('a-box');
    b.setAttribute('position', pos);
    b.setAttribute('width', w);
    b.setAttribute('depth', d);
    b.setAttribute('height', 0.08);
    b.setAttribute('color', '#c9a46a');
    canasto.appendChild(b);
  };
  pared('0 0.005 0', base.ancho, base.fondo);
  pared(`0 0.04 ${base.fondo / 2}`, base.ancho, 0.02);
  pared(`0 0.04 ${-base.fondo / 2}`, base.ancho, 0.02);
  pared(`${base.ancho / 2} 0.04 0`, 0.02, base.fondo);
  pared(`${-base.ancho / 2} 0.04 0`, 0.02, base.fondo);

  // 2 filas de 6 objetos. La fila de atrás va un poco más alta para que se vea.
  const porFila = 6;
  CONFIG.objetos.forEach((obj, i) => {
    const fila = Math.floor(i / porFila);
    const col = i % porFila;
    const x = (col - (porFila - 1) / 2) * 0.25;
    const z = fila === 0 ? -0.11 : 0.12;

    const el = document.createElement('a-entity');
    el.classList.add('objeto');
    el.dataset.id = obj.id;
    el.setAttribute('position', `${x} 0.01 ${z}`);
    el.appendChild(crearForma(obj));

    // Zona invisible más grande para que sea fácil apuntarle. Es lo que detecta el láser;
    // sus clics suben hasta el objeto.
    const zona = document.createElement('a-box');
    zona.classList.add('clickable');
    el.zona = zona;
    zona.setAttribute('width', 0.22);
    zona.setAttribute('height', 0.24);
    zona.setAttribute('depth', 0.2);
    zona.setAttribute('position', '0 0.1 0');
    zona.setAttribute('material', 'opacity: 0; transparent: true; depthWrite: false');
    el.appendChild(zona);

    const etiqueta = crearPanel(el, {
      ancho: 0.23, alto: 0.07, fondo: '#ffffffee',
      posicion: '0 0.28 0', rotacion: '-35 0 0',
    });
    etiqueta.dibujar([{ texto: obj.nombre, tam: 190, negrita: true, color: '#111111' }]);

    el.addEventListener('click', e => tomar(el, e.detail && e.detail.cursorEl));
    el.addEventListener('mouseenter', () => { if (Juego.sostenido?.el !== el) el.object3D.scale.setScalar(1.15); });
    el.addEventListener('mouseleave', () => { if (Juego.sostenido?.el !== el) el.object3D.scale.setScalar(1); });

    canasto.appendChild(el);
    el.inicio = new THREE.Vector3(x, 0.01, z);
  });
}

// ---------------------------------------------------------------------
//  Tomar y depositar
// ---------------------------------------------------------------------

// Después de cambiar qué objetos son "clickable", los láser tienen que enterarse.
function refrescarRayos() {
  document.querySelectorAll('[raycaster]').forEach(e => e.components.raycaster && e.components.raycaster.refreshObjects());
}

// Vibración corta del control (solo en el Quest).
function vibrar(mano, fuerza, ms) {
  const gamepad = mano && mano.components && mano.components['tracked-controls']?.controller?.gamepad;
  const motor = gamepad && gamepad.hapticActuators && gamepad.hapticActuators[0];
  if (motor) motor.pulse(fuerza, ms);
}

function tomar(el, cursorEl) {
  if (Juego.sostenido) devolverAlCanasto();
  // Con mouse el cursor es la escena; con el Quest es el control que apuntó.
  const mano = cursorEl && cursorEl.hasAttribute('laser-controls') ? cursorEl : null;
  el.zona.classList.remove('clickable');
  el.object3D.scale.setScalar(1);
  refrescarRayos();
  Juego.sostenido = { el, obj: objetoPorId(el.dataset.id), mano };
  vibrar(mano, 0.3, 40);
  mostrarInstruccion();
}

function devolverAlCanasto() {
  const { el } = Juego.sostenido;
  el.object3D.position.copy(el.inicio);
  el.zona.classList.add('clickable');
  Juego.sostenido = null;
  refrescarRayos();
  mostrarInstruccion();
}

function depositar() {
  const t = CONFIG.textos;
  if (!Juego.sostenido) {
    mostrarMensaje([{ texto: t.sinObjeto, tam: 70, negrita: true, color: '#0b1f1a' }], '#ffd84d');
    return;
  }
  const { el, obj, mano } = Juego.sostenido;

  if (obj.tipo !== 'textil') {
    Juego.rechazos++;
    mostrarMensaje([
      { texto: t.rechazo, tam: 100, negrita: true },
      { texto: t.rechazoDetalle.replace('{objeto}', obj.nombre), tam: 74 },
    ], '#c62f35');
    vibrar(mano, 1, 250);
    devolverAlCanasto();
    return;
  }

  Juego.prendas++;
  Juego.sostenido = null;
  Juego.volando.push({ el, desde: el.object3D.position.clone(), t: 0 });
  dibujarPantalla();
  mostrarMensaje([
    { texto: t.recibida, tam: 110, negrita: true, color: '#0b1f1a' },
    { texto: t.recibidaDetalle.replace('{objeto}', obj.nombre), tam: 74, color: '#0b1f1a' },
  ], '#2fe0a6');
  vibrar(mano, 0.5, 80);
  mostrarInstruccion();
}

// Mensaje grande al lado derecho de la máquina; se borra solo.
function mostrarMensaje(lineas, fondo) {
  const el = Juego.mensaje.el;
  Juego.mensaje.dibujar(lineas, fondo);
  el.setAttribute('visible', true);
  clearTimeout(Juego.timerMensaje);
  Juego.timerMensaje = setTimeout(() => el.setAttribute('visible', false), 2800);
}

// Instrucción al lado izquierdo: cambia según si tiene algo tomado.
function mostrarInstruccion() {
  const t = CONFIG.textos;
  const texto = Juego.sostenido ? t.instruccionDepositar : t.instruccionTomar;
  Juego.instruccion.dibujar([{ texto, tam: 88, negrita: true }]);
}

// Cada cuadro: el objeto tomado sigue a la mano (o a la cámara con mouse),
// y los objetos depositados se deslizan hacia la ranura.
AFRAME.registerComponent('mover-objetos', {
  init() {
    this.v = new THREE.Vector3();
    this.canasto = document.querySelector('#canasto').object3D;
    this.camara = document.querySelector('#camara').object3D;
    this.ranura = document.querySelector('#ranura').object3D;
  },
  tick(_, dt) {
    const s = Juego.sostenido;
    if (s) {
      if (s.mano && this.el.is('vr-mode')) s.mano.object3D.localToWorld(this.v.set(0, -0.03, -0.22));
      else this.camara.localToWorld(this.v.set(0.32, -0.3, -0.6));
      this.canasto.worldToLocal(this.v);
      s.el.object3D.position.copy(this.v);
    }
    for (const f of Juego.volando) {
      f.t = Math.min(1, f.t + dt / 450);
      this.ranura.getWorldPosition(this.v);
      this.canasto.worldToLocal(this.v);
      f.el.object3D.position.lerpVectors(f.desde, this.v, f.t);
      f.el.object3D.scale.setScalar(1 - f.t * 0.7);
      if (f.t === 1) f.el.setAttribute('visible', false);
    }
    Juego.volando = Juego.volando.filter(f => f.t < 1);
  },
});

// Percheros de fondo para que parezca tienda.
function crearPercheros() {
  const cont = document.querySelector('#percheros');
  const colores = ['#e24b4b', '#3b5fa8', '#f0b429', '#2f9e8f', '#c45ab3', '#7d7d85', '#ffffff', '#6b4a2b'];
  for (const lado of [-1, 1]) {
    const rack = document.createElement('a-entity');
    rack.setAttribute('position', `${lado * 2.6} 0 -1.6`);
    rack.setAttribute('rotation', `0 ${lado * -15} 0`);
    rack.innerHTML = `
      <a-cylinder radius="0.02" height="1.6" color="#555" position="0 0.8 -1"></a-cylinder>
      <a-cylinder radius="0.02" height="1.6" color="#555" position="0 0.8 1"></a-cylinder>
      <a-cylinder radius="0.015" height="2" color="#777" rotation="90 0 0" position="0 1.55 0"></a-cylinder>`;
    for (let i = 0; i < 8; i++) {
      const prenda = document.createElement('a-box');
      prenda.setAttribute('width', 0.04);
      prenda.setAttribute('height', 0.7);
      prenda.setAttribute('depth', 0.45);
      prenda.setAttribute('color', colores[(i + (lado > 0 ? 3 : 0)) % colores.length]);
      prenda.setAttribute('position', `0 1.17 ${-0.85 + i * 0.24}`);
      prenda.setAttribute('rotation', '0 90 0');
      rack.appendChild(prenda);
    }
    cont.appendChild(rack);
  }
}

// ---------------------------------------------------------------------
//  Arranque
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const escena = document.querySelector('a-scene');
  const iniciar = () => {
    const maquina = document.querySelector('#maquina');

    crearPanel(document.querySelector('#letrero'), { ancho: 1.6, alto: 0.26, fondo: '#2fe0a6' })
      .dibujar([{ texto: CONFIG.textos.letrero, tam: 68, negrita: true, color: '#0b1f1a' }]);

    Juego.pantalla = crearPanel(document.querySelector('#pantalla'), { ancho: 1.12, alto: 0.72 });
    dibujarPantalla();

    crearPanel(document.querySelector('#ranura-texto'), { ancho: 0.8, alto: 0.12, fondo: '#0b1f1a' })
      .dibujar([{ texto: `▼  ${CONFIG.textos.ranura}  ▼`, tam: 100, negrita: true, color: '#2fe0a6' }]);

    Juego.mensaje = crearPanel(document.querySelector('#mensaje'), { ancho: 0.62, alto: 0.42 });
    Juego.mensaje.el.setAttribute('visible', false);
    Juego.instruccion = crearPanel(document.querySelector('#instruccion'), { ancho: 0.62, alto: 0.42, fondo: '#1d3c78' });
    mostrarInstruccion();

    const ranura = document.querySelector('#ranura');
    ranura.addEventListener('click', depositar);
    ranura.addEventListener('mouseenter', () => ranura.setAttribute('color', '#1f6b55'));
    ranura.addEventListener('mouseleave', () => ranura.setAttribute('color', '#0b1f1a'));

    crearCanasto();
    crearPercheros();
    escena.setAttribute('mover-objetos', '');
    setTimeout(refrescarRayos, 0);

    // En computador la vista parte mirando un poco hacia abajo, para ver el canasto.
    const mirada = document.querySelector('#camara').components['look-controls'];
    if (mirada && mirada.pitchObject) mirada.pitchObject.rotation.x = -0.25;
  };
  if (escena.hasLoaded) iniciar();
  else escena.addEventListener('loaded', iniciar);
});
