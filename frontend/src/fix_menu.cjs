const fs = require('fs');
const file = 'c:/Bryan Lee/Management System/Management System/frontend/src/pages/MenuManagement.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const newLines = [
    ...lines.slice(0, 258),
    '    return (',
    '        <div className="page-container menu-management-page">',
    '            <div className="page-header" style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\' }}>',
    '                <div></div>',
    '                <button className="btn-primary" onClick={() => openMenuModal()}>',
    '                    <Plus size={20} /> Add Menu Item',
    '                </button>',
    '            </div>',
    '',
    '            <div className="filters-bar" style={{ padding: \'0 24px\', display: \'flex\', flexDirection: \'column\', gap: \'16px\', marginBottom: \'8px\' }}>',
    '                <div className="search-box">',
    '                    <Search size={18} />',
    '                    <input',
    '                        type="text"',
    '                        placeholder="Search products..."',
    '                        value={search}',
    '                        onChange={(e) => setSearch(e.target.value)}',
    '                    />',
    '                </div>',
    '',
    '                {/* Category icon cards */}',
    '                <div className="menu-category-cards">',
    '                    {[\'All\', ...categories].map((cat) => (',
    '                        <button',
    '                            key={cat}',
    '                            className={`menu-cat-card ${activeCategory === cat ? \'active\' : \'\'}`}',
    '                            onClick={() => setActiveCategory(cat)}',
    '                        >',
    '                            <span className="menu-cat-icon">{CATEGORY_ICONS[cat] || \'🍴\'}</span>',
    '                            <span className="menu-cat-label">{cat}</span>',
    '                        </button>',
    '                    ))}',
    '                </div>',
    '            </div>',
    '',
    '            <div className="menu-list">',
    ...lines.slice(456)
];

fs.writeFileSync(file, newLines.join('\n'));
console.log('Fixed syntax error successfully.');
