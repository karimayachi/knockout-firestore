export class Logger {
    logLevel: number;

    constructor(logLevel?: number) {
        this.logLevel = logLevel || 0;
    }

    debug = (...args: any[]): void => {
        if(this.logLevel == 2) {
            args.unshift('[KOFS]');
            console.debug(...args);
        }
    }
    
    error = (...args: any[]): void => {
        if(this.logLevel > 0) {
            args.unshift('[KOFS]');
            console.error(...args);
        }
    }
}