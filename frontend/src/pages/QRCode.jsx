import { useEffect, useMemo, useRef, useState } from 'react'
import { Coffee, Leaf, UtensilsCrossed } from 'lucide-react'
import api from '../services/api'

function useQRLib() {
    const [loaded, setLoaded] = useState(typeof window !== 'undefined' && !!window.QRCode)

    useEffect(() => {
        if (window.QRCode) return

        const script = document.createElement('script')
        script.src = '/lib/qrcode.min.js'
        script.onload = () => setLoaded(true)
        script.onerror = () => console.error('Failed to load the QR code library.')
        document.head.appendChild(script)

        return () => {
            script.onload = null
            script.onerror = null
        }
    }, [])

    return loaded
}

export default function QRCodePage() {
    const qrRef = useRef(null)
    const qrLoaded = useQRLib()
    const [generalUrl, setGeneralUrl] = useState('')
    const [tableLinks, setTableLinks] = useState({})
    const [selectedCode, setSelectedCode] = useState('general')
    const [printCopies, setPrintCopies] = useState('1')
    const [connection, setConnection] = useState({ permanent: false, online: false })

    const tableNumbers = useMemo(
        () => Object.keys(tableLinks)
            .filter((table) => {
                const tableNumber = Number(table)
                return Number.isInteger(tableNumber)
                    && tableNumber >= 1
                    && tableNumber <= 15
                    && typeof tableLinks[table] === 'string'
                    && tableLinks[table].trim() !== ''
            })
            .sort((a, b) => Number(a) - Number(b)),
        [tableLinks],
    )

    const menuUrl = selectedCode === 'general'
        ? generalUrl
        : tableLinks[selectedCode] || generalUrl

    const selectedLabel = selectedCode === 'general'
        ? 'General Menu'
        : `Table ${selectedCode}`

    const copyCount = Math.min(100, Math.max(1, Number.parseInt(printCopies, 10) || 1))

    useEffect(() => {
        let active = true

        async function loadQrDetails() {
            const [linksResult, serverResult] = await Promise.allSettled([
                api.get('/qr/table-links'),
                api.get('/server-info'),
            ])

            if (!active) return

            const links = linksResult.status === 'fulfilled' ? linksResult.value.data : {}
            const server = serverResult.status === 'fulfilled' ? serverResult.value.data : {}
            const host = window.location.hostname || '127.0.0.1'
            const fallback = `http://${host}:${server?.port || 8001}/menu.html`

            setGeneralUrl(links?.general_url || server?.menu_url || fallback)
            setTableLinks(links?.table_links || {})
            setConnection({
                permanent: Boolean(links?.permanent || server?.mode === 'permanent'),
                online: server?.tunnel_status === 'running',
            })
        }

        loadQrDetails()
        const refreshTimer = window.setInterval(loadQrDetails, 10000)

        return () => {
            active = false
            window.clearInterval(refreshTimer)
        }
    }, [])

    useEffect(() => {
        if (!qrLoaded || !menuUrl || !qrRef.current || !window.QRCode) return

        qrRef.current.innerHTML = ''
        new window.QRCode(qrRef.current, {
            text: menuUrl,
            width: 280,
            height: 280,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.H,
        })
    }, [qrLoaded, menuUrl])

    function downloadQr() {
        const canvas = qrRef.current?.querySelector('canvas')
        if (!canvas) return

        const link = document.createElement('a')
        const suffix = selectedCode === 'general' ? 'general' : `table-${selectedCode}`
        link.download = `comoda-qr-${suffix}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
    }

    function printQr() {
        if (!qrLoaded || !menuUrl || !window.QRCode) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) {
            window.alert('Please allow pop-ups so the QR print window can open.')
            return
        }

        try {
            const qrImage = createPrintableQr(menuUrl)
            const items = Array.from({ length: copyCount }, () => ({
                label: selectedLabel,
                image: qrImage,
            }))
            writeQrPrintDocument(printWindow, items, `Comoda — ${selectedLabel} QR`)
        } catch (error) {
            console.error('Could not prepare the QR for printing.', error)
            printWindow.close()
            window.alert('The QR code could not be prepared for printing. Please try again.')
        }
    }

    function printAllTableQrs() {
        if (!qrLoaded || tableNumbers.length !== 15 || !window.QRCode) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) {
            window.alert('Please allow pop-ups so the QR print window can open.')
            return
        }

        try {
            const items = tableNumbers.map((table) => ({
                label: `Table ${table}`,
                image: createPrintableQr(tableLinks[table]),
            }))
            writeQrPrintDocument(printWindow, items, 'Comoda — All Table QR Codes')
        } catch (error) {
            console.error('Could not prepare all table QR codes for printing.', error)
            printWindow.close()
            window.alert('The table QR codes could not be prepared for printing. Please try again.')
        }
    }

    return (
        <div className="comoda-qr-page" style={{
            minHeight: 'calc(100vh - var(--topbar-height) - 24px)',
            padding: '24px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            isolation: 'isolate',
            overflow: 'hidden',
        }}>
            <div className="comoda-qr-background-art" aria-hidden="true">
                <UtensilsCrossed className="comoda-qr-background-icon utensils" size={164} strokeWidth={1.05} />
                <Coffee className="comoda-qr-background-icon coffee" size={142} strokeWidth={1.05} />
                <Leaf className="comoda-qr-background-icon leaf" size={118} strokeWidth={1.05} />
            </div>

            <section className="comoda-qr-card" style={{
                width: 'min(100%, 470px)',
                padding: '26px',
                boxSizing: 'border-box',
                background: 'rgba(255, 253, 250, 0.96)',
                border: '1px solid var(--border)',
                borderRadius: '22px',
                boxShadow: '0 22px 55px rgba(76, 46, 25, 0.16), 0 4px 14px rgba(76, 46, 25, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                textAlign: 'center',
                position: 'relative',
                zIndex: 1,
                backdropFilter: 'blur(10px)',
            }}>
                <div>
                    <h1 style={{
                        margin: 0,
                        color: 'var(--text-primary)',
                        fontFamily: 'Playfair Display, serif',
                        fontSize: '1.55rem',
                    }}>
                        QR Digital Menu
                    </h1>
                    <p style={{
                        margin: '5px 0 0',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                    }}>
                        Select a code, then download or print it.
                    </p>
                </div>

                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 12px',
                    borderRadius: '999px',
                    background: connection.online ? 'rgba(62,207,142,0.10)' : 'rgba(230,169,106,0.10)',
                    color: connection.online ? '#219653' : '#b7791f',
                    fontSize: '11px',
                    fontWeight: 700,
                }}>
                    <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: connection.online ? '#3ecf8e' : '#e6a96a',
                    }} />
                    {connection.permanent ? 'Permanent QR' : 'QR Ready'} · {connection.online ? 'Online' : 'Reconnecting'}
                </div>

                <div style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 105px',
                    gap: '10px',
                }}>
                    <label style={fieldLabelStyle}>
                        <span>QR Code</span>
                        <select
                            value={selectedCode}
                            onChange={(event) => setSelectedCode(event.target.value)}
                            style={{
                                width: '100%',
                                padding: '9px 12px',
                                border: '1px solid var(--border)',
                                borderRadius: '10px',
                                background: 'var(--cream-100)',
                                color: 'var(--text-primary)',
                                font: 'inherit',
                                outline: 'none',
                            }}
                        >
                            <option value="general">General Menu</option>
                            {tableNumbers.map((table) => (
                                <option key={table} value={table}>Table {table}</option>
                            ))}
                        </select>
                    </label>

                    <label style={fieldLabelStyle}>
                        <span>Print copies</span>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            inputMode="numeric"
                            value={printCopies}
                            onChange={(event) => {
                                const value = event.target.value
                                if (value === '') {
                                    setPrintCopies('')
                                    return
                                }
                                setPrintCopies(String(Math.min(100, Math.max(1, Number.parseInt(value, 10) || 1))))
                            }}
                            onBlur={() => setPrintCopies(String(copyCount))}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                textAlign: 'center',
                                padding: '9px 12px',
                                border: '1px solid var(--border)',
                                borderRadius: '10px',
                                background: 'var(--cream-100)',
                                color: 'var(--text-primary)',
                                font: 'inherit',
                                outline: 'none',
                            }}
                        />
                    </label>
                </div>

                <div style={{
                    width: 'min(68vw, 280px)',
                    aspectRatio: '1 / 1',
                    padding: '9px',
                    boxSizing: 'content-box',
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: '14px',
                    boxShadow: 'var(--shadow-sm)',
                }}>
                    <div
                        ref={qrRef}
                        className="comoda-essential-qr"
                        role="img"
                        aria-label={`${selectedLabel} QR code`}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <button type="button" onClick={downloadQr} style={buttonStyle(false)}>
                        ↓ Download QR
                    </button>
                    <button type="button" onClick={printQr} style={buttonStyle(true)}>
                        ⎙ Print {copyCount} {copyCount === 1 ? 'QR' : 'QRs'}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={printAllTableQrs}
                    disabled={!qrLoaded || tableNumbers.length !== 15}
                    style={{
                        ...buttonStyle(false),
                        flex: 'none',
                        width: '100%',
                        borderColor: 'var(--brown-300)',
                        background: 'linear-gradient(135deg, var(--brown-100), var(--cream-200))',
                        color: 'var(--brown-800)',
                        opacity: !qrLoaded || tableNumbers.length !== 15 ? 0.55 : 1,
                        cursor: !qrLoaded || tableNumbers.length !== 15 ? 'not-allowed' : 'pointer',
                    }}
                >
                    ▦ Print All Tables (1–15)
                </button>

                <style>{`
                    .comoda-qr-page {
                        background:
                            radial-gradient(circle at 12% 18%, rgba(194, 143, 92, 0.24) 0, rgba(194, 143, 92, 0.08) 18%, transparent 34%),
                            radial-gradient(circle at 88% 78%, rgba(52, 115, 68, 0.13) 0, rgba(52, 115, 68, 0.05) 20%, transparent 36%),
                            repeating-linear-gradient(135deg, rgba(129, 81, 44, 0.035) 0 1px, transparent 1px 25px),
                            linear-gradient(145deg, rgba(247, 236, 220, 0.80) 0%, rgba(255, 253, 250, 0.88) 48%, rgba(240, 226, 207, 0.84) 100%),
                            url('/bgforcomoda.png') center / cover no-repeat;
                    }

                    .comoda-qr-page::before,
                    .comoda-qr-page::after {
                        content: '';
                        position: absolute;
                        z-index: -1;
                        width: 390px;
                        height: 390px;
                        border-radius: 50%;
                        pointer-events: none;
                        background:
                            radial-gradient(circle, transparent 0 39%, rgba(129, 81, 44, 0.08) 39.5% 40%, transparent 40.5% 57%, rgba(129, 81, 44, 0.07) 57.5% 58%, transparent 58.5%),
                            rgba(255, 253, 250, 0.16);
                        border: 1px solid rgba(129, 81, 44, 0.10);
                    }

                    .comoda-qr-page::before {
                        top: -190px;
                        left: -120px;
                    }

                    .comoda-qr-page::after {
                        right: -120px;
                        bottom: -210px;
                        transform: scale(1.15);
                    }

                    .comoda-qr-background-art {
                        position: absolute;
                        inset: 0;
                        z-index: 0;
                        overflow: hidden;
                        pointer-events: none;
                    }

                    .comoda-qr-background-icon {
                        position: absolute;
                        color: var(--brown-700);
                        opacity: 0.095;
                    }

                    .comoda-qr-background-icon.utensils {
                        top: 9%;
                        right: 7%;
                        transform: rotate(9deg);
                    }

                    .comoda-qr-background-icon.coffee {
                        left: 7%;
                        bottom: 9%;
                        transform: rotate(-8deg);
                    }

                    .comoda-qr-background-icon.leaf {
                        right: 19%;
                        bottom: 7%;
                        color: var(--success);
                        opacity: 0.09;
                        transform: rotate(18deg);
                    }

                    .comoda-qr-page select:focus-visible,
                    .comoda-qr-page input:focus-visible,
                    .comoda-qr-page button:focus-visible {
                        outline: 2px solid var(--border-focus) !important;
                        outline-offset: 2px;
                    }

                    .comoda-essential-qr canvas {
                        display: block !important;
                        width: 100% !important;
                        height: 100% !important;
                    }

                    .comoda-essential-qr img {
                        display: none !important;
                    }

                    @media (max-width: 700px) {
                        .comoda-qr-page::before,
                        .comoda-qr-page::after {
                            width: 270px;
                            height: 270px;
                        }

                        .comoda-qr-background-icon {
                            opacity: 0.055;
                            transform: scale(0.72);
                        }

                        .comoda-qr-background-icon.leaf {
                            opacity: 0.05;
                        }
                    }
                `}</style>
            </section>
        </div>
    )
}

function createPrintableQr(url) {
    const mount = document.createElement('div')
    new window.QRCode(mount, {
        text: url,
        width: 600,
        height: 600,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.H,
    })

    const canvas = mount.querySelector('canvas')
    if (!canvas) {
        throw new Error('QR canvas is unavailable.')
    }

    return canvas.toDataURL('image/png')
}

function writeQrPrintDocument(printWindow, items, title) {
    const printableItems = items.map(({ label, image }) => {
        const safeLabel = escapePrintHtml(label)
        return `
            <article class="qr-copy">
                <span class="frame-corner top-left" aria-hidden="true"></span>
                <span class="frame-corner top-right" aria-hidden="true"></span>
                <span class="frame-corner bottom-left" aria-hidden="true"></span>
                <span class="frame-corner bottom-right" aria-hidden="true"></span>
                <h1>Comoda</h1>
                <p>${safeLabel}</p>
                <div class="qr-code-shell">
                    <img src="${image}" alt="${safeLabel} QR code">
                </div>
            </article>
        `
    })
    const pages = Array.from({ length: Math.ceil(printableItems.length / 4) }, (_, pageIndex) => {
        const pageItems = printableItems.slice(pageIndex * 4, pageIndex * 4 + 4).join('')
        return `<main class="print-page${printableItems.length === 1 ? ' single' : ''}">${pageItems}</main>`
    }).join('')

    printWindow.document.write(`
        <!doctype html>
        <html>
            <head>
                <title>${escapePrintHtml(title)}</title>
                <style>
                    @page { size: A4; margin: 10mm; }
                    * { box-sizing: border-box; }
                    html, body { margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; color: #1a0f00; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print-page { width: 100%; height: 277mm; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 8mm; break-after: page; page-break-after: always; overflow: hidden; }
                    .print-page:last-child { break-after: auto; page-break-after: auto; }
                    .qr-copy { position: relative; min-width: 0; min-height: 0; padding: 8mm; border: 2px solid #81512c; outline: 1px solid #dfbb8e; outline-offset: -3mm; border-radius: 5mm; background: #fffdfa; display: flex; flex-direction: column; align-items: center; justify-content: center; break-inside: avoid; page-break-inside: avoid; text-align: center; overflow: hidden; }
                    .frame-corner { position: absolute; width: 12mm; height: 12mm; border-color: #c28f5c; }
                    .frame-corner.top-left { top: 5mm; left: 5mm; border-top: 1.5px solid #c28f5c; border-left: 1.5px solid #c28f5c; border-radius: 3mm 0 0; }
                    .frame-corner.top-right { top: 5mm; right: 5mm; border-top: 1.5px solid #c28f5c; border-right: 1.5px solid #c28f5c; border-radius: 0 3mm 0 0; }
                    .frame-corner.bottom-left { bottom: 5mm; left: 5mm; border-bottom: 1.5px solid #c28f5c; border-left: 1.5px solid #c28f5c; border-radius: 0 0 0 3mm; }
                    .frame-corner.bottom-right { right: 5mm; bottom: 5mm; border-right: 1.5px solid #c28f5c; border-bottom: 1.5px solid #c28f5c; border-radius: 0 0 3mm; }
                    h1 { margin: 0 0 3mm; color: #684022; font-family: Georgia, serif; font-size: 24px; letter-spacing: 0.4px; }
                    h1::after { content: ''; display: block; width: 18mm; margin: 2mm auto 0; border-top: 1px solid #c28f5c; }
                    p { margin: 0 0 5mm; color: #4c2e19; font-size: 16px; font-weight: 700; }
                    h1, p, .qr-code-shell { position: relative; z-index: 2; }
                    .qr-code-shell { padding: 4mm; border: 1px solid #dfbb8e; border-radius: 2mm; background: #ffffff; }
                    img { display: block; width: 2.5in; min-width: 2.5in; max-width: 2.5in; height: 2.5in; min-height: 2.5in; max-height: 2.5in; image-rendering: pixelated; }
                    .print-page.single { grid-template-columns: 1fr; grid-template-rows: 1fr; }
                    .print-page.single .qr-copy { width: 91mm; height: 130mm; justify-self: center; align-self: center; }
                </style>
            </head>
            <body>
                ${pages}
                <script>window.onload = () => { window.setTimeout(() => { window.print(); window.close(); }, 100); }</script>
            </body>
        </html>
    `)
    printWindow.document.close()
}

function buttonStyle(primary) {
    return {
        flex: 1,
        padding: '10px 12px',
        border: primary ? '1px solid var(--primary)' : '1px solid var(--border)',
        borderRadius: '10px',
        background: primary ? 'var(--primary)' : 'var(--cream-100)',
        color: primary ? 'var(--cream-50)' : 'var(--text-primary)',
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer',
    }
}

const fieldLabelStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '5px',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontWeight: 700,
}

function escapePrintHtml(value) {
    const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    }

    return String(value).replace(/[&<>"']/g, (character) => replacements[character])
}
