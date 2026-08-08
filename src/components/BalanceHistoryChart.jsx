import { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

const HISTORY_KEY = 'koda_balance_history';
const MIN_GAP_MS  = 5 * 60 * 1000;

export function recordBalanceSnapshot(tapusdc, usdc, tapeurc = 0, eurc = 0) {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
        const last = history[history.length - 1];
        if (last && Date.now() - last.ts < MIN_GAP_MS) return;
        const tap    = parseFloat(tapusdc) || 0;
        const usd    = parseFloat(usdc)    || 0;
        const tapeur = parseFloat(tapeurc) || 0;
        const eur    = parseFloat(eurc)    || 0;
        if (tap === 0 && usd === 0 && tapeur === 0 && eur === 0) return;
        history.push({ ts: Date.now(), tap, usd, tapeur, eur });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-8640)));
    } catch {}
}

// Chart geometry

const SVG_H = 200;
const PAD   = { t: 20, r: 20, b: 34, l: 52 };

function makePath(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        const p0 = pts[Math.max(0, i - 2)];
        const p1 = pts[i - 1];
        const p2 = pts[i];
        const p3 = pts[Math.min(pts.length - 1, i + 1)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)},${cp2x.toFixed(1)},${cp2y.toFixed(1)},${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
}

function makeArea(pts, bottom) {
    if (pts.length < 2) return '';
    return `${makePath(pts)} L${pts[pts.length - 1].x},${bottom} L${pts[0].x},${bottom} Z`;
}

function fmtY(v) {
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    if (v === 0) return '0';
    return v < 10 ? v.toFixed(2) : v.toFixed(0);
}

function fmtXLabel(ts, period) {
    const d = new Date(ts);
    return period === 'week'
        ? d.toLocaleDateString('en-GB', { weekday: 'short' })
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtAmount(v) {
    return (v ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SERIES = {
    tap:    { color: '#4F55F1', label: 'TAPUSDC', grad: 'gtap'    },
    usd:    { color: '#00A87E', label: 'USDC',    grad: 'gusd'    },
    tapeur: { color: '#f59e0b', label: 'TAPEURC', grad: 'gtapeur' },
    eur:    { color: '#d97706', label: 'EURC',    grad: 'geur'    },
};

// Component

const BalanceHistoryChart = ({ tapusdcBalance, usdcBalance, tapeurcBalance, eurcBalance }) => {
    const [period,  setPeriod]  = useState('week');
    const [history, setHistory] = useState([]);
    const [tooltip, setTooltip] = useState(null);
    const [svgW,    setSvgW]    = useState(600);
    const wrapRef = useRef(null);

    useEffect(() => {
        try {
            setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'));
        } catch {}
    }, [tapusdcBalance, usdcBalance, tapeurcBalance, eurcBalance]);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        setSvgW(el.getBoundingClientRect().width);
        const ro = new ResizeObserver(([e]) => setSvgW(e.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const now    = Date.now();
    const cutoff = period === 'week' ? now - 7 * 86400000 : now - 30 * 86400000;

    // Sort by timestamp — prevents backwards line segments
    const data = history
        .filter(h => h.ts >= cutoff)
        .sort((a, b) => a.ts - b.ts);

    const cW     = svgW - PAD.l - PAD.r;
    const cH     = SVG_H - PAD.t - PAD.b;
    const bottom = PAD.t + cH;

    // x spans actual data range: first snapshot → last snapshot
    const t0   = data[0]?.ts ?? now;
    const t1   = data[data.length - 1]?.ts ?? now;
    const span = t1 - t0 || 1;
    const toX  = ts => PAD.l + ((ts - t0) / span) * cW;

    const allVals = data.flatMap(d => [d.tap, d.usd, d.tapeur ?? 0, d.eur ?? 0]).filter(v => v > 0);
    const maxVal  = allVals.length ? Math.max(...allVals) * 1.15 : 10;
    const toY     = v => PAD.t + cH - (v / maxVal) * cH;

    const tapPts    = data.map(d => ({ x: toX(d.ts), y: toY(d.tap),         ...d }));
    const usdPts    = data.map(d => ({ x: toX(d.ts), y: toY(d.usd),         ...d }));
    const tapeurPts = data.map(d => ({ x: toX(d.ts), y: toY(d.tapeur ?? 0), ...d }));
    const eurPts    = data.map(d => ({ x: toX(d.ts), y: toY(d.eur    ?? 0), ...d }));

    const hasEurData = data.some(d => (d.tapeur ?? 0) > 0 || (d.eur ?? 0) > 0);

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
        v: maxVal * t,
        y: PAD.t + cH * (1 - t),
    }));

    // 4 evenly-spaced labels across the actual data range
    const xLabels = [0, 1, 2, 3].map(i => ({
        ts: t0 + (i / 3) * span,
        x:  PAD.l + (i / 3) * cW,
    }));

    const hasData = data.length >= 2;

    const handleMouseMove = (e) => {
        if (!hasData || !wrapRef.current) return;
        const mx = e.clientX - wrapRef.current.getBoundingClientRect().left;
        let best = tapPts[0], bestDist = Infinity;
        tapPts.forEach(p => {
            const d = Math.abs(p.x - mx);
            if (d < bestDist) { bestDist = d; best = p; }
        });
        setTooltip({ x: best.x, tap: best.tap, usd: best.usd, tapeur: best.tapeur ?? 0, eur: best.eur ?? 0, ts: best.ts });
    };

    return (
        <ChartCard>
            <ChartHeader>
                <ChartTitle>Balance history</ChartTitle>
                <PeriodToggle>
                    <PeriodBtn $active={period === 'week'}  onClick={() => setPeriod('week')}>1W</PeriodBtn>
                    <PeriodBtn $active={period === 'month'} onClick={() => setPeriod('month')}>1M</PeriodBtn>
                </PeriodToggle>
            </ChartHeader>

            <ChartLegend>
                <LegendItem><LegendDot $c={SERIES.tap.color} />TAPUSDC</LegendItem>
                <LegendItem><LegendDot $c={SERIES.usd.color} />USDC</LegendItem>
                {hasEurData && <>
                    <LegendItem><LegendDot $c={SERIES.tapeur.color} />TAPEURC</LegendItem>
                    <LegendItem><LegendDot $c={SERIES.eur.color} />EURC</LegendItem>
                </>}
            </ChartLegend>

            <ChartWrap ref={wrapRef} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
                {!hasData ? (
                    <EmptyState>Collecting balance history — revisit after your next transaction</EmptyState>
                ) : (
                    <>
                        <svg width={svgW} height={SVG_H} style={{ display: 'block' }}>
                            <defs>
                                <linearGradient id="gtap" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#4F55F1" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#4F55F1" stopOpacity="0"    />
                                </linearGradient>
                                <linearGradient id="gusd" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#00A87E" stopOpacity="0.2"  />
                                    <stop offset="100%" stopColor="#00A87E" stopOpacity="0"    />
                                </linearGradient>
                                <linearGradient id="gtapeur" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"    />
                                </linearGradient>
                                <linearGradient id="geur" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#d97706" stopOpacity="0.2"  />
                                    <stop offset="100%" stopColor="#d97706" stopOpacity="0"    />
                                </linearGradient>
                            </defs>

                            {/* Grid + Y labels */}
                            {yTicks.map((t, i) => (
                                <g key={i}>
                                    <line x1={PAD.l} y1={t.y} x2={svgW - PAD.r} y2={t.y}
                                        stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                                    <text x={PAD.l - 8} y={t.y + 4} textAnchor="end"
                                        fill="#8D969E" fontSize="10"
                                        fontFamily="'SF Mono','Fira Code',monospace">
                                        {fmtY(t.v)}
                                    </text>
                                </g>
                            ))}

                            {/* X labels */}
                            {xLabels.map((l, i) => (
                                <text key={i} x={l.x} y={SVG_H - 8} textAnchor="middle"
                                    fill="#8D969E" fontSize="10"
                                    fontFamily="'Google Sans Flex','Sora',sans-serif">
                                    {fmtXLabel(l.ts, period)}
                                </text>
                            ))}

                            {/* Area fills */}
                            <path d={makeArea(tapPts,  bottom)} fill="url(#gtap)"    />
                            <path d={makeArea(usdPts,  bottom)} fill="url(#gusd)"    />
                            {hasEurData && <>
                                <path d={makeArea(tapeurPts, bottom)} fill="url(#gtapeur)" />
                                <path d={makeArea(eurPts,    bottom)} fill="url(#geur)"    />
                            </>}

                            {/* Lines */}
                            <path d={makePath(tapPts)} fill="none" stroke="#4F55F1" strokeWidth="2"
                                strokeLinejoin="round" strokeLinecap="round" />
                            <path d={makePath(usdPts)} fill="none" stroke="#00A87E" strokeWidth="2"
                                strokeLinejoin="round" strokeLinecap="round" />
                            {hasEurData && <>
                                <path d={makePath(tapeurPts)} fill="none" stroke="#f59e0b" strokeWidth="2"
                                    strokeLinejoin="round" strokeLinecap="round" />
                                <path d={makePath(eurPts)} fill="none" stroke="#d97706" strokeWidth="2"
                                    strokeLinejoin="round" strokeLinecap="round" />
                            </>}

                            {/* Crosshair + dots */}
                            {tooltip && (
                                <>
                                    <line x1={tooltip.x} y1={PAD.t} x2={tooltip.x} y2={bottom}
                                        stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3,3" />
                                    <circle cx={tooltip.x} cy={toY(tooltip.tap)} r="4"
                                        fill="#4F55F1" stroke="#121212" strokeWidth="2" />
                                    <circle cx={tooltip.x} cy={toY(tooltip.usd)} r="4"
                                        fill="#00A87E" stroke="#121212" strokeWidth="2" />
                                    {hasEurData && <>
                                        <circle cx={tooltip.x} cy={toY(tooltip.tapeur)} r="4"
                                            fill="#f59e0b" stroke="#121212" strokeWidth="2" />
                                        <circle cx={tooltip.x} cy={toY(tooltip.eur)} r="4"
                                            fill="#d97706" stroke="#121212" strokeWidth="2" />
                                    </>}
                                </>
                            )}
                        </svg>

                        {tooltip && (
                            <Tooltip
                                $left={tooltip.x < svgW / 2 ? tooltip.x + 14 : null}
                                $right={tooltip.x >= svgW / 2 ? svgW - tooltip.x + 14 : null}
                            >
                                <TooltipDate>
                                    {new Date(tooltip.ts).toLocaleString('en-GB', {
                                        day: 'numeric', month: 'short',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                </TooltipDate>
                                <TooltipRow>
                                    <TooltipDot $c="#4F55F1" />
                                    <span>TAPUSDC</span>
                                    <TooltipVal>{fmtAmount(tooltip.tap)}</TooltipVal>
                                </TooltipRow>
                                <TooltipRow>
                                    <TooltipDot $c="#00A87E" />
                                    <span>USDC</span>
                                    <TooltipVal>{fmtAmount(tooltip.usd)}</TooltipVal>
                                </TooltipRow>
                                {hasEurData && <>
                                    <TooltipRow>
                                        <TooltipDot $c="#f59e0b" />
                                        <span>TAPEURC</span>
                                        <TooltipVal>{fmtAmount(tooltip.tapeur)}</TooltipVal>
                                    </TooltipRow>
                                    <TooltipRow>
                                        <TooltipDot $c="#d97706" />
                                        <span>EURC</span>
                                        <TooltipVal>{fmtAmount(tooltip.eur)}</TooltipVal>
                                    </TooltipRow>
                                </>}
                            </Tooltip>
                        )}
                    </>
                )}
            </ChartWrap>
        </ChartCard>
    );
};

// Styled components

const ChartCard = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border-radius: 20px;
    border: 1px solid #ffffff20;
    padding: 20px 20px 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,15,17,0.05);
`;

const ChartHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
`;

const ChartTitle = styled.h3`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    flex: 1;
`;

const ChartLegend = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
`;

const LegendItem = styled.span`
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: #8D969E;
`;

const LegendDot = styled.span`
    width: 8px; height: 8px;
    border-radius: 50%;
    background: ${p => p.$c};
    flex-shrink: 0;
`;

const PeriodToggle = styled.div`
    display: flex;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
    flex-shrink: 0;
`;

const PeriodBtn = styled.button`
    padding: 4px 10px;
    border: none;
    border-radius: 6px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    background: ${p => p.$active ? '#4F55F1' : 'transparent'};
    color:      ${p => p.$active ? '#ffffff'  : '#8D969E'};
    &:hover { color: #ffffff; }
`;

const ChartWrap = styled.div`
    position: relative;
    user-select: none;
`;

const EmptyState = styled.div`
    height: ${SVG_H}px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.25);
    text-align: center;
    padding: 0 24px;
`;

const Tooltip = styled.div`
    position: absolute;
    top: 20px;
    left:  ${p => p.$left  != null ? `${p.$left}px`  : 'auto'};
    right: ${p => p.$right != null ? `${p.$right}px` : 'auto'};
    background: #1e1e1e;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 10px 12px;
    pointer-events: none;
    min-width: 155px;
    z-index: 10;
`;

const TooltipDate = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 10px;
    color: #8D969E;
    margin: 0 0 8px;
`;

const TooltipRow = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    &:last-child { margin-bottom: 0; }
`;

const TooltipDot = styled.span`
    width: 6px; height: 6px;
    border-radius: 50%;
    background: ${p => p.$c};
    flex-shrink: 0;
`;

const TooltipVal = styled.span`
    margin-left: auto;
    font-family: 'Saira', 'Sora', sans-serif;
    font-weight: 700;
    font-size: 12px;
    color: #ffffff;
`;

export default BalanceHistoryChart;
