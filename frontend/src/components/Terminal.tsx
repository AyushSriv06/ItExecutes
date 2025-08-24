import { useEffect, useRef } from "react"
import { Socket } from "socket.io-client";
import { Terminal } from "xterm";
import { FitAddon } from 'xterm-addon-fit';
const fitAddon = new FitAddon();

function ab2str(buf: ArrayBuffer) {
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
export const TerminalComponent = ({ socket }: {socket: Socket}) => {
    const terminalRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!terminalRef || !terminalRef.current || !socket) {
            return;
        }

        socket.emit("requestTerminal");
        socket.on("terminal", terminalHandler)
        const term = new Terminal(OPTIONS_TERM)
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();
        function terminalHandler({ data }: { data: ArrayBuffer }) {
            term.write(ab2str(data));
          }
        term.onData((data) => {
            socket.emit('terminalData', {
                data
            });
        });

        socket.emit('terminalData', {
            data: '\n'
        });

        return () => {
            socket.off("terminal")
        }
    }, [terminalRef]);

    return <div style={{width: "40vw", height: "400px", textAlign: "left"}} ref={terminalRef}>
        
    </div>
}