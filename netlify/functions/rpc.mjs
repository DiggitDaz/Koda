const RPCS = [
    'https://rpc.testnet.arc.network',
    'https://rpc.blockdaemon.testnet.arc.network',
    'https://rpc.drpc.testnet.arc.network',
];

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    for (const rpc of RPCS) {
        try {
            const res = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: event.body,
            });

            if (!res.ok) continue;

            const data = await res.json();

            // Rate limited — try the next RPC
            if (data.error?.code === -32005 || data.error?.data?.httpStatus === 429) continue;

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify(data),
            };
        } catch { continue; }
    }

    // All RPCs failed — return a proper JSON-RPC error so callers can handle it
    let id = null;
    try { id = JSON.parse(event.body ?? '{}').id ?? null; } catch {}

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32005, message: 'All Arc RPCs are currently rate limited. Please try again.' },
        }),
    };
};
