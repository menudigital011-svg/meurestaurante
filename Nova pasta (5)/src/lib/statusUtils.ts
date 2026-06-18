export interface TimeStatus {
  isOpen: boolean;
  message: string;
  nextChangeMinutes: number | null;
  statusText: string;
}

export const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function getRestaurantStatus(openingHours: Record<string, { open: string; close: string; active: boolean }> | undefined): TimeStatus {
  if (!openingHours) {
    return { isOpen: true, message: 'Aberto', nextChangeMinutes: null, statusText: 'Aberto' };
  }

  const now = new Date();
  const dayIndex = now.getDay();
  const today = days[dayIndex];
  const config = openingHours[today];
  
  const currentTime = now.getHours() * 60 + now.getMinutes();

  if (config?.active) {
    const openH = config.open && typeof config.open === 'string' && config.open.includes(':') 
      ? Number(config.open.split(':')[0]) || 0 
      : 0;
    const openM = config.open && typeof config.open === 'string' && config.open.includes(':') 
      ? Number(config.open.split(':')[1]) || 0 
      : 0;
    
    const closeH = config.close && typeof config.close === 'string' && config.close.includes(':') 
      ? Number(config.close.split(':')[0]) || 0 
      : 0;
    const closeM = config.close && typeof config.close === 'string' && config.close.includes(':') 
      ? Number(config.close.split(':')[1]) || 0 
      : 0;
      
    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;

    if (currentTime >= openTime && currentTime < closeTime) {
      const minutesLeft = closeTime - currentTime;
      if (minutesLeft <= 60) {
        return { 
          isOpen: true, 
          message: `Fecha em ${minutesLeft} minutos`, 
          nextChangeMinutes: minutesLeft,
          statusText: `Aberto • Fecha às ${config.close}`
        };
      }
      return { 
        isOpen: true, 
        message: 'Aberto agora', 
        nextChangeMinutes: null,
        statusText: `Aberto • Fecha às ${config.close}`
      };
    }

    if (currentTime < openTime) {
      const minutesToOpen = openTime - currentTime;
      if (minutesToOpen <= 60) {
        return { 
          isOpen: false, 
          message: `Abre em ${minutesToOpen} minutos`, 
          nextChangeMinutes: minutesToOpen,
          statusText: `Fechado • Abre às ${config.open}`
        };
      }
      return { 
        isOpen: false, 
        message: 'Fechado', 
        nextChangeMinutes: null,
        statusText: `Fechado • Abre às ${config.open}`
      };
    }
  }

  // Not active today or already closed for today, find next opening day
  let nextDayIndex = (dayIndex + 1) % 7;
  let daysToWait = 1;
  
  while (daysToWait <= 7) {
    const nextDayName = days[nextDayIndex];
    const nextConfig = openingHours[nextDayName];
    
    if (nextConfig?.active) {
      return { 
        isOpen: false, 
        message: 'Fechado', 
        nextChangeMinutes: null,
        statusText: daysToWait === 1 ? `Fechado • Abre amanhã às ${nextConfig.open}` : `Fechado • Abre ${nextDayName} às ${nextConfig.open}`
      };
    }
    
    nextDayIndex = (nextDayIndex + 1) % 7;
    daysToWait++;
  }

  return { isOpen: false, message: 'Fechado', nextChangeMinutes: null, statusText: 'Fechado temporarymente' };
}
