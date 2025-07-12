import { spawn, IPty } from 'node-pty';
import path from "path";

const SHELL = "bash";

export class TerminalManager {
    private sessions: { [id: string]: {terminal: IPty, execId: string;} } = {};

    constructor() {
        this.sessions = {};
    }
    
    createPty(id: string, execId: string, onData: (data: string, id: number) => void) {
        let term = spawn(SHELL, [], {
            cols: 100,
            name: 'xterm',
            cwd: `/workspace`
        });
    
        term.onData((data: string) => onData(data, term.pid));
        this.sessions[id] = {
            terminal: term,
            execId
        };
        term.onExit(() => {
            delete this.sessions[term.pid];
        });
        return term;
    }

    write(terminalId: string, data: string) {
        this.sessions[terminalId]?.terminal.write(data);
    }

    clear(terminalId: string) {
        this.sessions[terminalId].terminal.kill();
        delete this.sessions[terminalId];
    }
}