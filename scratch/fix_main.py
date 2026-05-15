
import os

path = r"c:\Users\ACER\OneDrive\Máy tính\quanlisan\quan_li_san\backend\app\main.py"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Look for the broken section
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if 'online_bookings = online_res.scalars().all()' in line and i < 700:
        start_idx = i
    if start_idx != -1 and line.strip() == '}' and i > start_idx and i < start_idx + 10:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_content = [
        '    online_bookings = online_res.scalars().all()\n',
        '    \n',
        '    return {\n',
        '        "courts": courts,\n',
        '        "bookings": bookings,\n',
        '        "blocks": blocks,\n',
        '        "online_bookings": online_bookings\n',
        '    }\n'
    ]
    lines[start_idx:end_idx+1] = new_content
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("Fixed main.py")
else:
    print(f"Could not find broken section. start={start_idx}, end={end_idx}")
