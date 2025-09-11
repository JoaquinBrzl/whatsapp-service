export function getTemplate(option, params = {}) {
  const {
    nombre = '',
    fecha = '',
    hora = ''
  } = params;

    return `✨ ¡Hola ${nombre}! ✨
Sabemos que aprender sobre lo digital es la clave para que tu proyecto sea único y llamativo 💡🌐.

En DigiMedia desarrollamos estrategias innovadoras y auténticas que conectan con jóvenes como tú 🙌🎯.

📱 Desde la gestión de tus redes hasta campañas que realmente venden 💰🔥, queremos llevar tu marca al siguiente nivel 🚀.

¿Quieres que te muestre cómo lograr que tus ideas brillen en internet? 🌟💻
 👉 Escríbeme y lo hacemos realidad juntos. 🤝✨`;

//   switch (option) {
//     case 'cita_gratis':
//       return `¡Hola 👋

// ✅ Tu primera cita GRATUITA ha sido confirmada:

// 📅 Fecha: ${fecha}
// 🕐 Hora: ${hora}
// 👨‍⚕️ Psicólogo: ${nombre}

// 🎉 ¡Recuerda que tu primera consulta es completamente GRATIS!

// Si tienes alguna consulta, no dudes en contactarnos.

// ¡Te esperamos! 🌟`;

//     default:
//       return 'Opción de plantilla no válida.';
//   }
}

// Template para mensaje de pago aceptado
export function getAcceptanceTemplate(comentario = '') {
  return `✅ COMPROBANTE APROBADO ✅

🎉 ¡Excelente! Tu comprobante de pago ha sido revisado y aprobado.

📋 Estado de la revisión:
   • ✅ APROBADO
   • 📅 Fecha de revisión: ${new Date().toLocaleDateString('es-ES')}
   • 🕐 Hora: ${new Date().toLocaleTimeString('es-ES')}

${comentario ? `💬 Comentario del administrador:
"${comentario}"

` : ''}🔒 Tu información está segura con nosotros.

Si tienes alguna pregunta sobre tu pago, no dudes en contactarnos.

¡Gracias por tu paciencia! 🌟`;
}

// Template para mensaje de pago rechazado
export function getRejectionTemplate(comentario = '') {
  return `❌ COMPROBANTE RECHAZADO ❌

⚠️ Tu comprobante de pago no pudo ser aprobado.

📋 Estado de la revisión:
   • ❌ RECHAZADO
   • 📅 Fecha de revisión: ${new Date().toLocaleDateString('es-ES')}
   • 🕐 Hora: ${new Date().toLocaleTimeString('es-ES')}

${comentario ? `💬 Comentario del administrador:
"${comentario}"

` : ''}🔄 Para resolver este problema:

1. 📸 Sube una nueva foto del comprobante
2. 🔍 Asegúrate de que se vea claramente:
   - Número de referencia
   - Monto pagado
   - Fecha del pago
   - Nombre del remitente
3. 📱 La imagen debe estar nítida y completa

📞 Si necesitas ayuda, contáctanos inmediatamente.

¡Estamos aquí para ayudarte a resolverlo! 🤝`;
}
