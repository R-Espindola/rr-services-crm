import 'server-only'

export type BookingNotificationEvent =
  | 'confirmed'
  | 'reminder_24h'
  | 'en_route'
  | 'completed'

export type BookingNotification = {
  event: BookingNotificationEvent
  bookingId: string
  clientId: string
  title: string
  body: string
}

const eventCopy: Record<BookingNotificationEvent, Pick<BookingNotification, 'title' | 'body'>> = {
  confirmed: {
    title: 'Marcação confirmada',
    body: 'A sua próxima limpeza foi confirmada pela R&R Services.',
  },
  reminder_24h: {
    title: 'Lembrete da sua limpeza',
    body: 'A sua limpeza está agendada para amanhã. Consulte a área de cliente para ver os detalhes.',
  },
  en_route: {
    title: 'A equipa está a caminho',
    body: 'A equipa R&R Services iniciou o percurso até à sua morada.',
  },
  completed: {
    title: 'Serviço concluído',
    body: 'A sua limpeza foi concluída. Pode consultar os detalhes e deixar uma avaliação no portal.',
  },
}

export function buildBookingNotification(
  event: BookingNotificationEvent,
  bookingId: string,
  clientId: string,
): BookingNotification {
  return { event, bookingId, clientId, ...eventCopy[event] }
}

export async function dispatchBookingNotification(notification: BookingNotification) {
  // Ponto de integração para Resend, WhatsApp e SMS.
  // A entrega deve ser feita por um worker/queue para não bloquear a mutação da marcação.
  console.info('Booking notification queued', {
    event: notification.event,
    bookingId: notification.bookingId,
    clientId: notification.clientId,
  })
  return { queued: true as const, channels: ['email', 'whatsapp', 'sms'] as const }
}

