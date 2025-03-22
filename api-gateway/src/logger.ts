import pino from 'pino';

export const logger = pino({
    transport: {
        target: 'pino-pretty', // makes it human readable
        options: {
            colorize: true,
        },
    },
});
