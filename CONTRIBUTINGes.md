Lea esto en otros idiomas: [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md)


# Bienvenido(a) a la guía de contribución de Return YouTube Dislikes

¡Gracias por invertir tiempo en contribuir al proyecto! Todos sus cambios serán mostrados en la siguiente versión de la extensión (o en la [pagina web](https://www.returnyoutubedislike.com/))

## Empecemos

Por favor, utiliza Prettier con la configuración predeterminada para el formateo

#### Requisitos previos

Necesita tener instalados node y npm para crear la versión empaquetada del código fuente

Versiones utilizadas durante la configuración:

- node: 12.18.4
- npm: 6.14.6

Para crear el archivo `bundled-content-script.js` que contiene la mayor parte de la lógica de negocio de esta extensión, primero debe instalar todas las dependencias

1. Ve a la raíz del repositorio y ejecute:

```
npm install
```

2. Ejecuta el siguiente comando para crear `bundled-content-script.js`, el cual se utiliza en `manifest.json`

```
npm start // para crear el/los archivo(s) de compilación y comenzar un observador de archivos que se recargue automáticamente al guardar cambios

// o

npm run build // para crear el/los archivo(s) de compilación una vez
```

¡Felicitaciones! ¡Ahora estás listo(a) para desarrollar!

Si eres nuevo/a en el desarrollo de extensiones de Chrome o necesitas ayuda adicional, por favor consulta [este tutorial en YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### Problemas

#### Abrir un nuevo problema

Si tiene algún problema con la extensión, por favor verifique si el problema ya ha sido reportado. Si no lo ha sido, abre un problema. Se recomienda encarecidamente utilizar el formulario de problema, pero no es obligatorio.

#### Resolver un problema

Si encontró un problema que crea que pueda resolver, no dude en hacerlo. Abra una solicitud de extracción (PR) con la solución y asegúrese de mencionar el problema que está solucionando

### Solicitud de función

#### Abrir una nueva solicitud de función

If you have an idea for the extension, feel free to open a feature request, but please search it before to make sure the feature isn't already suggested. Using the feature form is highly recommended but not mandatory

#### Implementando una solicitud de funcionalidad

Si encontró una función que pueda implementar, no dude en hacerlo. Abra una solicitud de extracción (PR) con la solución y asegúrese de mencionar la función que está implementando

### ¿Qué PRs aceptamos?

- Corrección de problemas.
- Implementación de funciones.
- Corrección de errores tipográficos o uso de palabras mejores y más sencillas.
- Contribuciones al sitio web.
