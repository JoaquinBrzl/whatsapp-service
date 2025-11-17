export const chatbotFlow = {
  start: {
    message: `✨ ¡Hola! Te saluda Digimedia. 💻🚀
Potencia tu presencia online con una página web profesional y personalizada para tu marca.
Te ayudamos con:
📌 Servicios especializados para hacer crecer tu marca
📞 Asesoría en Marketing
📊 Auditoría gratuita

👉 Todos estos servicios creados para hacer crecer tu negocio sin límites.

“Si tu negocio no está en Internet, tu negocio no existe.” - Bill Gates
Tu negocio no puede esperar más para crecer.
Hazlo digital con DigiMedia.

Elige una opción:
1️⃣ Ver servicios
2️⃣ Hablar con un asesor
3️⃣ Auditoría gratis`,
    next: {
      "1": "servicios",
      "2": "asesor",
      "3": "auditoria"
    }
  },

  servicios: {
    message: `En Digimedia Marketing ofrecemos:

✔️ Diseño y Desarrollo Web
Creamos sitios funcionales, estéticos y optimizados para escalar tu presencia digital.

✔️ Gestión de Redes Sociales
Activamos tu comunidad con contenido estratégico, diseño coherente y planificación efectiva.

✔️ Marketing y Gestión Digital
Planificamos y ejecutamos campañas que convierten tu contenido en resultados medibles.

✔️ Branding y Diseño
Construimos identidades visuales memorables que conectan con tu audiencia y diferencian tu marca.

¿Te enviamos un plan gratuito de mejora para tu negocio?

1️⃣ Sí, deseo el plan
2️⃣ Hablar con un asesor
3️⃣ Auditoría gratis
4️⃣ Cierre`,
    next: {
      "1": "cierre",
      "2": "asesor",
      "3": "auditoria",
      "4": "cierre"
    }
  },

  asesor: {
    message: `Perfecto 🙌 Para poder ayudarte mejor, cuéntame:

1️⃣ Nombre de tu negocio
2️⃣ Rubro en el que trabajas
3️⃣ Objetivos a lograr (Ej: más clientes, más ventas, mayor visibilidad, etc.)

(Escribe tus respuestas en un solo mensaje)`,
    next: {
      "*": "cierre"
    }
  },

  auditoria: {
    message: `Opciones para tu auditoría gratuita:

1️⃣ Sí, agendar reunión
2️⃣ Quiero más información primero`,
    next: {
      "1": "cierre",
      "2": "info_adicional"
    }
  },

  info_adicional: {
    message: `Perfecto, en breve un asesor te dará más información detallada.`,
    next: {
      "*": "cierre"
    }
  },

  cierre: {
    message: `✅ ¡Listo! Ya tenemos tu información.
En breve, uno de nuestros asesores se pondrá en contacto contigo 📲
Mientras tanto, te enviamos un ebook gratuito con 10 tips de marketing digital 👉 [link]`,
    next: {}
  },

  post_asesoria: {
    message: `👋 ¡Hola!  
Queremos darte las gracias por tu interés y confianza en nuestras asesorías.  
📊 Recuerda que juntos podemos impulsar tu negocio con estrategias claras y medibles.

¿Quieres agendar una reunión esta semana para dar el siguiente paso?
1️⃣ Sí, agendar
2️⃣ No por ahora`,
    next: {
      "1": "cierre"
    }
  }
};
