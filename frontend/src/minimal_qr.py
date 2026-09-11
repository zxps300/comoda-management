import re

file_path = "c:/Bryan Lee/Management System/Management System/frontend/src/pages/QRCode.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    (r"background: '#13131a'", r"background: 'var(--cream-100)'"),
    (r"background: 'var\(--card, #1c1c26\)'", r"background: 'var(--bg-card)'"),
    (r"color: '#fdf6e3'", r"color: 'var(--text-primary)'"),
    (r"color: 'var\(--text-primary, #f0ede8\)'", r"color: 'var(--text-primary)'"),
    (r"color: '#c8a96e'", r"color: 'var(--text-muted)'"),
    (r"color: '#9b9898'", r"color: 'var(--text-muted)'"),
    (r"color: '#d4a853'", r"color: 'var(--primary)'"),
    (r"color: '#f0ede8'", r"color: 'var(--text-primary)'"),
    (r"color: '#b0ada8'", r"color: 'var(--text-muted)'"),
    (r"color: '#1a0f00'", r"color: 'var(--cream-50)'"),
    (r"borderBottom: '1px solid rgba\(212,168,83,0.15\)'", r"borderBottom: '1px solid var(--border)'"),
    (r"border: '1px solid rgba\(212,168,83,0.18\)'", r"border: '1px solid var(--border)'"),
    (r"border: '1px solid rgba\(212,168,83,0.15\)'", r"border: '1px solid var(--border)'"),
    (r"border: '1px solid rgba\(212,168,83,0.2\)'", r"border: '1px solid var(--border)'"),
    (r"border: '1px solid rgba\(212,168,83,0.25\)'", r"border: '1px solid var(--border)'"),
    (r"border: '1px solid rgba\(212,168,83,0.3\)'", r"border: '1px solid var(--border)'"),
    (r"background: 'rgba\(212,168,83,0.08\)'", r"background: 'var(--cream-100)'"),
    (r"background: 'rgba\(212,168,83,0.15\)'", r"background: 'var(--cream-200)'"),
    (r"background: 'rgba\(212,168,83,0.2\)'", r"background: 'var(--cream-300)'"),
    (r"background: 'rgba\(255,255,255,0.04\)'", r"background: 'var(--cream-100)'"),
    (r"background: 'rgba\(255,255,255,0.03\)'", r"background: 'var(--cream-100)'"),
    (r"border: '1px solid rgba\(255,255,255,0.05\)'", r"border: '1px solid var(--border)'"),
    (r"background: 'linear-gradient\(135deg, #d4a853, #c8922a\)'", r"background: 'var(--primary)'"),
    (r"background: 'linear-gradient\(135deg, rgba\(212,168,83,0.06\), rgba\(212,168,83,0.02\)\)'", r"background: 'var(--bg-card)'"),
    (r"boxShadow: '0 8px 32px rgba\(0,0,0,0.4\), 0 0 0 1px rgba\(212,168,83,0.3\)'", r"boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)'"),
    (r"background: '#fdf6e3'", r"background: '#fff'"), # QR container white background
    (r"background: activeTable === null \? 'rgba\(212,168,83,0.2\)' : 'transparent'", r"background: activeTable === null ? 'var(--cream-200)' : 'transparent'"),
    (r"background: activeTable === t \? 'rgba\(212,168,83,0.2\)' : 'transparent'", r"background: activeTable === t ? 'var(--cream-200)' : 'transparent'"),
    (r"color: activeTable === null \? '#d4a853' : '#9b9898'", r"color: activeTable === null ? 'var(--primary)' : 'var(--text-muted)'"),
    (r"color: activeTable === t \? '#d4a853' : '#9b9898'", r"color: activeTable === t ? 'var(--primary)' : 'var(--text-muted)'"),
    (r"border: `1px solid \$\{activeTable === null \? '#d4a853' : 'rgba\(212,168,83,0.2\)'\}`", r"border: `1px solid ${activeTable === null ? 'var(--primary)' : 'var(--border)'}`"),
    (r"border: `1px solid \$\{activeTable === t \? '#d4a853' : 'rgba\(212,168,83,0.2\)'\}`", r"border: `1px solid ${activeTable === t ? 'var(--primary)' : 'var(--border)'}`"),
    (r"color: n === '5' \? '#3ecf8e' : '#b0ada8'", r"color: n === '5' ? '#3ecf8e' : 'var(--text-muted)'"),
    (r"color: n === '5' \? '#3ecf8e' : '#d4a853'", r"color: n === '5' ? '#3ecf8e' : 'var(--primary)'"),
    (r"background: n === '5' \? 'rgba\(62,207,142,0.2\)' : 'rgba\(212,168,83,0.2\)'", r"background: n === '5' ? 'rgba(62,207,142,0.2)' : 'var(--cream-200)'"),
    (r"border: primary \? 'none' : '1px solid rgba\(212,168,83,0.3\)'", r"border: primary ? 'none' : '1px solid var(--primary)'"),
    (r"background: primary \? 'linear-gradient\(135deg, #d4a853, #c8922a\)' : 'rgba\(212,168,83,0.08\)'", r"background: primary ? 'var(--primary)' : 'transparent'"),
    (r"e\.currentTarget\.style\.background = 'rgba\(212,168,83,0.15\)'", r"e.currentTarget.style.background = 'var(--cream-100)'"),
    (r"e\.currentTarget\.style\.background = 'rgba\(212,168,83,0.08\)'", r"e.currentTarget.style.background = 'transparent'"),
    (r"boxShadow: '0 4px 10px rgba\(212,168,83,0.2\)'", r"boxShadow: 'var(--shadow-sm)'")
]

for pattern, repl in replacements:
    content = re.sub(pattern, repl, content)

# Remove the corner decorations
decorations_pattern = re.compile(r"\{\/\* Corner decorations \*\/\}.*?\}\)\)\}", re.DOTALL)
content = re.sub(decorations_pattern, "", content)

# Remove the radial gradient background effect
radial_gradient_pattern = re.compile(r"<div style=\{\{\s*position: 'absolute', top: '-60px', right: '-40px',\s*width: '220px', height: '220px',\s*background: 'radial-gradient\(circle, rgba\(212,168,83,0\.15\) 0%, transparent 70%\)',\s*pointerEvents: 'none',\s*\}\} \/>", re.DOTALL)
content = re.sub(radial_gradient_pattern, "", content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Minimal styles applied successfully.")
