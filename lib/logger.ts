type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const MIN_LEVEL: LogLevel = __DEV__ ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatMessage(level: LogLevel, context: string, message: string, data?: any): void {
  if (!shouldLog(level)) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
  
  if (data !== undefined) {
    console[level](prefix, message, data);
  } else {
    console[level](prefix, message);
  }
}

export const logger = {
  debug: (context: string, message: string, data?: any) => formatMessage('debug', context, message, data),
  info: (context: string, message: string, data?: any) => formatMessage('info', context, message, data),
  warn: (context: string, message: string, data?: any) => formatMessage('warn', context, message, data),
  error: (context: string, message: string, data?: any) => formatMessage('error', context, message, data),
};
