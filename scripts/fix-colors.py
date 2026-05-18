import pathlib

root = pathlib.Path(__file__).resolve().parent.parent / "src"
repls = [
    ('color="secondary"', 'color="primary"'),
    ("color='secondary'", "color='primary'"),
    ('iconColor="secondary"', 'iconColor="primary"'),
    ('? "secondary"', '? "primary"'),
    (': "secondary"', ': "primary"'),
    ("text-secondary-600", "text-primary-600"),
    ("text-secondary-700", "text-primary-700"),
    ("hover:border-secondary-300", "hover:border-primary-300"),
    ("text-secondary", "text-primary"),
]

for p in root.rglob("*.tsx"):
    t = p.read_text(encoding="utf-8")
    orig = t
    for a, b in repls:
        t = t.replace(a, b)
    if t != orig:
        p.write_text(t, encoding="utf-8")
        print(p.relative_to(root.parent))
