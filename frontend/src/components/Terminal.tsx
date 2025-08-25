import { useEffect, useRef } from "react"
import { Socket } from "socket.io-client";
import { Terminal } from "xterm";
import { FitAddon } from 'xterm-addon-fit';
const fitAddon = new FitAddon();

function ab2str(buf: ArrayBuffer | string) {
    if (typeof buf === 'string') return buf;
    return new TextDecoder().decode(new Uint8Array(buf));
}

const OPTIONS_TERM = {
    useStyle: true,
    screenKeys: true,
    cursorBlink: true,
    cols: 200,
    theme: {
        background: "black"
    }
};
export const TerminalComponent = ({ socket }: { socket: Socket }) => {
    const terminalRef = useRef<HTMLDivElement | null>(null);
    const termRef = useRef<Terminal | null>(null);

    useEffect(() => {
        if (!terminalRef || !terminalRef.current || !socket) {
            return;
        }

        const term = new Terminal(OPTIONS_TERM);
        termRef.current = term;
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();
        term.focus();

        function terminalHandler({ data }: { data: ArrayBuffer }) {
            term.write(ab2str(data));
        }

        socket.emit("requestTerminal");
        socket.on("terminal", terminalHandler);

        const onDataDispose = term.onData((data) => {
            socket.emit('terminalData', {
                data
            });
        });

        socket.emit('terminalData', {
            data: '\n'
        });

        return () => {
            socket.off("terminal", terminalHandler);
            onDataDispose.dispose();
            term.dispose();
            termRef.current = null;
        }
    }, [terminalRef, socket]);

    // re-request terminal when socket reconnects
    useEffect(() => {
        if (!socket) return;
        const onReconnect = () => {
            socket.emit('requestTerminal');
        };
        socket.on('connect', onReconnect);
        return () => {
            socket.off('connect', onReconnect);
        }
    }, [socket]);

    return <div style={{width: "40vw", height: "400px", textAlign: "left"}} ref={terminalRef} tabIndex={0}>
        
    </div>
}