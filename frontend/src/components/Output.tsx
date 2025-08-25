import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const Output = () => {
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';

    const src = useMemo(() => {
        const protocol = window.location.protocol; // honor current page protocol to avoid mixed content
        const baseUrl = (import.meta as any).env?.VITE_OUTPUT_BASE_URL as string | undefined; // e.g. "https://{replId}.example.com"
        const domain = (import.meta as any).env?.VITE_OUTPUT_BASE_DOMAIN || (import.meta as any).env?.VITE_WS_BASE_DOMAIN || 'itexecutes.me';
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const localPort = (import.meta as any).env?.VITE_OUTPUT_PORT || (import.meta as any).env?.VITE_RUNNER_PORT || '3005';
        const forceRemote = ((import.meta as any).env?.VITE_FORCE_REMOTE || '').toString() === '1' || ((import.meta as any).env?.VITE_FORCE_REMOTE || '').toString().toLowerCase() === 'true';

        if (baseUrl) {
            return baseUrl.replace('{replId}', replId);
        }
        if (!forceRemote && isLocalhost) {
            return `${protocol}//localhost:${localPort}`;
        }
        return `${protocol}//${replId}.${domain}`;
    }, [replId]);

    return <div style={{height: "40vh", background: "white"}}>
        <iframe width={"100%"} height={"100%"} src={src} />
    </div>
}