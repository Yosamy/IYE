// =====================================================================
//  CONFIGURACIÓN DEL PROTOTIPO
//  Para pasar de la versión 1 a la versión 2, se cambia SOLO este archivo.
//  Cada cambio que hagan aquí, anótenlo en CHANGELOG.md con su fundamento.
// =====================================================================

window.CONFIG = {
  // Nombre de la versión. Queda guardado en cada sesión del CSV.
  version: "V1",

  // Tramos del cupón (Unidad 1). "desde" y "hasta" son cantidad de prendas.
  tramos: [
    { desde: 1, hasta: 3, descuento: 5 },
    { desde: 4, hasta: 6, descuento: 10 },
    { desde: 7, hasta: 10, descuento: 15 },
  ],

  // Máximo de prendas por visita.
  topePrendas: 10,

  // true = la pantalla muestra la escala completa antes del primer depósito.
  mostrarEscalaAntes: true,

  // Multiplicador del tamaño de letra en VR. 1 = normal, 1.3 = 30 % más grande.
  tamanoLetra: 1.0,

  // Kilos promedio por prenda (para el pasaporte: kilos que no van a vertedero).
  kgPorPrenda: 0.4,

  // Textos que ve el jugador.
  textos: {
    letrero: "Punto de recepción textil",
    tituloPantalla: "Cambia tu ropa usada por un cupón",
    escalaTitulo: "Tu descuento según prendas:",
    prendas: "Prendas",
    cupon: "Tu cupón",
    sinCupon: "Aún sin cupón",
    ranura: "Deposita aquí",
  },

  // Objetos del canasto. tipo: "textil" se acepta, "no-apto" se rechaza.
  // forma: prenda | pantalon | botella | lata | cargador
  objetos: [
    { id: "polera",     nombre: "Polera",     tipo: "textil",  forma: "prenda",   color: "#e24b4b" },
    { id: "jeans",      nombre: "Jeans",      tipo: "textil",  forma: "pantalon", color: "#3b5fa8" },
    { id: "chaqueta",   nombre: "Chaqueta",   tipo: "textil",  forma: "prenda",   color: "#6b4a2b" },
    { id: "botella",    nombre: "Botella",    tipo: "no-apto", forma: "botella",  color: "#7fc8f8" },
    { id: "poleron",    nombre: "Polerón",    tipo: "textil",  forma: "prenda",   color: "#7d7d85" },
    { id: "camisa",     nombre: "Camisa",     tipo: "textil",  forma: "prenda",   color: "#f2f2f2" },
    { id: "falda",      nombre: "Falda",      tipo: "textil",  forma: "prenda",   color: "#c45ab3" },
    { id: "lata",       nombre: "Lata",       tipo: "no-apto", forma: "lata",     color: "#b0b4ba" },
    { id: "vestido",    nombre: "Vestido",    tipo: "textil",  forma: "prenda",   color: "#f0b429" },
    { id: "bufanda",    nombre: "Bufanda",    tipo: "textil",  forma: "pantalon", color: "#2f9e8f" },
    { id: "cargador",   nombre: "Cargador",   tipo: "no-apto", forma: "cargador", color: "#fafafa" },
    { id: "calcetines", nombre: "Calcetines", tipo: "textil",  forma: "prenda",   color: "#222222" },
  ],
};
