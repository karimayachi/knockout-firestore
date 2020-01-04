export declare class Logger {
    logLevel: number;
    constructor(logLevel?: number);
    debug: (...args: any[]) => void;
    error: (...args: any[]) => void;
}
