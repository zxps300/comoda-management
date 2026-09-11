const fs = require('fs');
const file_path = "c:/Bryan Lee/Management System/Management System/frontend/src/pages/QRCode.jsx";

let content = fs.readFileSync(file_path, "utf-8");

const replacements = [
    [/background: '#13131a'/g, "background: 'var(--cream-100)'"],
    [/background: 'var\(--card, #1c1c26\)'/g, "background: 'var(--bg-card)'"],
    [/color: '#fdf6e3'/g, "color: 'var(--text-primary)'"],
    [/color: 'var\(--text-primary, #f0ede8\)'/g, "color: 'var(--text-primary)'"],
    [/color: '#c8a96e'/g, "color: 'var(--text-muted)'"],
    [/color: '#9b9898'/g, "color: 'var(--text-muted)'"],
    [/color: '#d4a853'/g, "color: 'var(--primary)'"],
    [/color: '#f0ede8'/g, "color: 'var(--text-primary)'"],
    [/color: '#b0ada8'/g, "color: 'var(--text-muted)'"],
    [/color: '#1a0f00'/g, "color: 'var(--cream-50)'"],
    [/borderBottom: '1px solid rgba\(212,168,83,0.15\)'/g, "borderBottom: '1px solid var(--border)'"],
    [/border: '1px solid rgba\(212,168,83,0.18\)'/g, "border: '1px solid var(--border)'"],
    [/border: '1px solid rgba\(212,168,83,0.15\)'/g, "border: '1px solid var(--border)'"],
    [/border: '1px solid rgba\(212,168,83,0.2\)'/g, "border: '1px solid var(--border)'"],
    [/border: '1px solid rgba\(212,168,83,0.25\)'/g, "border: '1px solid var(--border)'"],
    [/border: '1px solid rgba\(212,168,83,0.3\)'/g, "border: '1px solid var(--border)'"],
    [/background: 'rgba\(212,168,83,0.08\)'/g, "background: 'var(--cream-100)'"],
    [/background: 'rgba\(212,168,83,0.15\)'/g, "background: 'var(--cream-200)'"],
    [/background: 'rgba\(212,168,83,0.2\)'/g, "background: 'var(--cream-300)'"],
    [/background: 'rgba\(255,255,255,0.04\)'/g, "background: 'var(--cream-100)'"],
    [/background: 'rgba\(255,255,255,0.03\)'/g, "background: 'var(--cream-100)'"],
    [/border: '1px solid rgba\(255,255,255,0.05\)'/g, "border: '1px solid var(--border)'"],
    [/background: 'linear-gradient\(135deg, #d4a853, #c8922a\)'/g, "background: 'var(--primary)'"],
    [/background: 'linear-gradient\(135deg, rgba\(212,168,83,0.06\), rgba\(212,168,83,0.02\)\)'/g, "background: 'var(--bg-card)'"],
    [/boxShadow: '0 8px 32px rgba\(0,0,0,0.4\), 0 0 0 1px rgba\(212,168,83,0.3\)'/g, "boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)'"],
    [/background: '#fdf6e3'/g, "background: '#fff'"], // QR container white background
    [/background: activeTable === null \? 'rgba\(212,168,83,0.2\)' : 'transparent'/g, "background: activeTable === null ? 'var(--cream-200)' : 'transparent'"],
    [/background: activeTable === t \? 'rgba\(212,168,83,0.2\)' : 'transparent'/g, "background: activeTable === t ? 'var(--cream-200)' : 'transparent'"],
    [/color: activeTable === null \? '#d4a853' : '#9b9898'/g, "color: activeTable === null ? 'var(--primary)' : 'var(--text-muted)'"],
    [/color: activeTable === t \? '#d4a853' : '#9b9898'/g, "color: activeTable === t ? 'var(--primary)' : 'var(--text-muted)'"],
    [/border: `1px solid \$\{activeTable === null \? '#d4a853' : 'rgba\(212,168,83,0.2\)'\}`/g, "border: `1px solid ${activeTable === null ? 'var(--primary)' : 'var(--border)'}`"],
    [/border: `1px solid \$\{activeTable === t \? '#d4a853' : 'rgba\(212,168,83,0.2\)'\}`/g, "border: `1px solid ${activeTable === t ? 'var(--primary)' : 'var(--border)'}`"],
    [/color: n === '5' \? '#3ecf8e' : '#b0ada8'/g, "color: n === '5' ? '#3ecf8e' : 'var(--text-muted)'"],
    [/color: n === '5' \? '#3ecf8e' : '#d4a853'/g, "color: n === '5' ? '#3ecf8e' : 'var(--primary)'"],
    [/background: n === '5' \? 'rgba\(62,207,142,0.2\)' : 'rgba\(212,168,83,0.2\)'/g, "background: n === '5' ? 'rgba(62,207,142,0.2)' : 'var(--cream-200)'"],
    [/border: primary \? 'none' : '1px solid rgba\(212,168,83,0.3\)'/g, "border: primary ? 'none' : '1px solid var(--primary)'"],
    [/background: primary \? 'linear-gradient\(135deg, #d4a853, #c8922a\)' : 'rgba\(212,168,83,0.08\)'/g, "background: primary ? 'var(--primary)' : 'transparent'"],
    [/e\.currentTarget\.style\.background = 'rgba\(212,168,83,0.15\)'/g, "e.currentTarget.style.background = 'var(--cream-100)'"],
    [/e\.currentTarget\.style\.background = 'rgba\(212,168,83,0.08\)'/g, "e.currentTarget.style.background = 'transparent'"],
    [/boxShadow: '0 4px 10px rgba\(212,168,83,0.2\)'/g, "boxShadow: 'var(--shadow-sm)'"]
];

for (const [pattern, repl] of replacements) {
    content = content.replace(pattern, repl);
}

// Remove the corner decorations
content = content.replace(/\{\/\* Corner decorations \*\/\}[\s\S]*?\}\)\)\}/g, "");

// Remove the radial gradient background effect
content = content.replace(/<div style=\{\{\s*position: 'absolute', top: '-60px', right: '-40px',\s*width: '220px', height: '220px',\s*background: 'radial-gradient\(circle, rgba\(212,168,83,0\.15\) 0%, transparent 70%\)',\s*pointerEvents: 'none',\s*\}\} \/>/g, "");

fs.writeFileSync(file_path, content, "utf-8");
console.log("Minimal styles applied successfully.");
