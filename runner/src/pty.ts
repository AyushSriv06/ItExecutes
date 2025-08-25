//@ts-ignore => someone fix this
import { fork, IPty } from 'node-pty';

const SHELL = "bash";

export class TerminalManager {
    private sessions: { [id: string]: {terminal: IPty, replId: string;} } = {};

    constructor() {
        this.sessions = {};
    }
    
    createPty(id: string, replId: string, onData: (data: string, id: number) => void) {
        let term = fork(SHELL, [], {
            cols: 100,
            name: 'xterm',
            cwd: `/workspace`
        });
    
        term.on('data', (data: string) => onData(data, term.pid));
        this.sessions[id] = {
            terminal: term,
            replId
        };
        term.on('exit', () => {
            delete this.sessions[id];
        });
        return term;
    }

    write(terminalId: string, data: string) {
        this.sessions[terminalId]?.terminal.write(data);
    }

    clear(terminalId: string) {
        if (this.sessions[terminalId]) {
            this.sessions[terminalId].terminal.kill();
            delete this.sessions[terminalId];
        }
    }
}