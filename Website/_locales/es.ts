import { es } from "vuetify/src/locale";
// By Alejandro Gayol
export default {
  ...es,
  home: {
    name: "Inicio",
    title: "Return YouTube Dislike",
    subtitle:
      "Una extensión de navegador y una API que muestra el número de «dislikes» («No me gusta») en YouTube",
    ukraine: "Apoya a Ucrania",
    sponsors: "Patrocinadores",
  },
  install: {
    name: "Instalación",
    title: "Elige tu plataforma",
    subtitle: "Disponible para Firefox y todos los navegadores Chromium",
    title2: "Otras plataformas",
    subtitle2: "Si tu navegador aún no es compatible, usa este UserScript",
    title3: "Implementaciones de terceros",
    subtitle3: "No nos hacemos responsables, úsalas bajo tu cuenta y riesgo",
  },
  api: {
    name: "API",
    title: "¡Te damos la bienvenida a la documentación oficial de RYD!",
    subtitle: "Para empezar, elige una sección del menú.",
    rights: {
      title: "Derechos de uso",
      subtitle:
        "Se permite el uso de terceros de esta API abierta bajo las siguientes restricciones: ",
      bullet1: "Atribución: ",
      bullet1text:
        "El proyecto debe estar claramente atribuido con un enlace a este repositorio o a returnyoutubedislike.com",
      bullet2: "Límites de velocidad: ",
      bullet2text:
        "Hay límites de velocidad por cliente de 100 solicitudes por minuto y 10.000 al día. Al excederlos se mostrará un código de estado *429*, indicando que tu aplicación debe bajar la velocidad.",
    },
    url: {
      title: "Información de URL",
      subtitle: "Esta API es accesible a través de la siguiente URL base: ",
    },
    endpoints: {
      title: "«Endpoints» disponibles",
      subtitle:
        "La lista de los endpoints disponibles se puede consultar aquí: ",
    },
    fetching: {
      title: "Tutorial de consulta básica",
      subtitle:
        "Ejemplo para obtener los votos del ID de un vídeo de YouTube: ",
      title2: "Consulta de ejemplo: ",
      url: "URL de la consulta: ",
      method: "Método de la consulta: ",
      headers: "Encabezados: ",
      response: "Respuesta: ",
      error1:
        'Un ID de YouTube no existente mostrará el código de estado 404 "Not Found" (no encontrado).',
      error2:
        'Un ID de YouTube mal estructurado mostrará el código 400 "Bad Request" (solicitud incorrecta).',
    },
  },
  help: {
    name: "Ayuda",
    title: "Solución de problemas",
    bullet1:
      "Asegúrate de que tienes instalada la última versión de la extensión, ",
    bullet11: "",
    bullet2:
      "Prueba a eliminar la extensión e instalarla de nuevo, después reinicia el navegador (todas las ventanas activas, no solo una pestaña)",
    bullet3: "Comprueba que puedes abrir este enlace: ",
    bullet31: "deberías ver este texto: ",
    bullet4:
      "Si nada de esto surte efecto, informa de tu problema (en inglés) en el canal",
    bullet41: "de nuestro",
    bullet4a:
      "Dinos cuáles son tu sistema operativo, el nombre y la versión de tu navegador",
    bullet4b:
      "Haz una captura de pantalla de la página que contenga el problema (como una página de un vídeo de YouTube) con la consola abierta (pulsa ",
    bullet4b1: "). Aquí puedes ver una captura de pantalla de ejemplo:",
    bullet4c:
      "Haz una captura de la página de extensiones de tu navegador con la extensión instalada.",
    bullet4c1:
      "Para ver las extensiones, escribe el siguiente texto en la barra de dirección: ",
    firefox: "para Firefox",
    chrome: "para Chrome, Edge, Brave, Opera, Vivaldi",
  },
  faq: {
    name: "Preguntas",
    title: "Preguntas más frecuentes",
    subtitle:
      "¿Sigues teniendo problemas? ¡Pásate por nuestro servidor de Discord (en inglés)!",
    bullet1: "¿De dónde obtiene sus datos la extensión?",
    bullet1text:
      "De una combinación de datos archivados antes de que la API oficial de «dislikes» de YouTube se apagase, extrapolada con las acciones realizadas por los usuarios de la extensión.",
    bullet2: "¿Por qué no se actualiza el contador de «dislikes»?",
    bullet2text:
      "En la actualidad, las cuentas de «dislikes» se almacenan en una caché y no se actualizan con frecuencia. Esta frecuencia varía dependiendo de la popularidad de un vídeo, pero puede tardar entre unas pocas horas y unos pocos días en actualizarse.",
    bullet3: "¿Cómo funciona la extensión?",
    bullet3text:
      "La extensión lee el ID del vídeo que estés viendo y carga la cifra de «dislikes» (y otras estadísticas, como visitas, «likes», etc.) a través de nuestra API. Después la extensión muestra el número de «dislikes» y la proporción de «likes»/«dislikes» en la página. Si utilizas los botones de «Me gusta» o «No me gusta» de un vídeo, esa información se guardará y enviará a la base de datos con la que se podrá extrapolar una cuenta de «dislikes» más precisa.",
    bullet4: "¿Puedo compartir mi contador de «dislikes» con vosotros?",
    bullet4text:
      "Próximamente. Estamos investigando en usar Oauth u otra API de solo lectura con alcance limitado para que los creadores puedan compartir sus contadores de «dislikes» verificablemente.",
    bullet5: "¿Qué datos almacenáis y cómo son guardados?",
    bullet5text:
      'La extensión almacena únicamente aquellos datos estrictamente necesarios para su buen funcionamiento, cómo la dirección IP o el ID del vídeo que estés viendo. Tus datos nunca serán vendidos a terceros. Si quieres saber más sobre nuestras políticas de seguridad y privacidad, consulta nuestro <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">documento de preguntas frecuentes sobre seguridad</a>.',
    bullet6: "¿Cómo funciona la API y el «backend»?",
    bullet6text:
      "El «backend» utiliza datos archivados de cuando la API de YouTube seguía proporcionando el contador de «dislikes», los votos de usuarios de la extensión y su extrapolación. En un futuro cercano permitiremos que los creadores de contenido puedan proporcionar sus cifras de «dislikes» de forma fácil y segura, e incorporaremos los datos archivados de ArchiveTeam (4.560 millones de vídeos) en nuestra base de datos. También puedes ver un vídeo al respecto.",
    bullet7: "¿Porque el contador de «dislikes» dice «DISLIKES DESACTIVADOS»?",
    bullet7text:
      "En ocasiones, un vídeo subido recientemente puede mostrar «DISLIKES DESACTIVADOS» aunque su creador no los haya desactivado, esto se debe a la forma en que detectamos si los «dislikes» están desactivados. El mensaje debería desaparecer en unas horas o al darle «like» o «dislike» al vídeo y actualizar la página (con suerte).",
  },
  donate: {
    name: "Donar",
    subtitle:
      "¡Puedes apoyar nuestros esfuerzos para que Internet siga siendo con un donativo!",
  },
  links: {
    name: "Enlaces",
    title: "Enlaces del proyecto",
    subtitle: "Enlaces del proyecto y sus desarrolladores",
    contact: "Contacto",
    translators: "Traductores",
    coolProjects: "Proyectos interesantes",
    sponsorBlockDescription: "Omite los anuncios integrados en vídeos",
    filmotDescription: "Busca vídeos de YouTube a través de sus subtítulos",
  },
};
