
import os

path = r"c:\Users\ACER\OneDrive\Máy tính\quanlisan\quan_li_san\src\app\(admin)\dashboard\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# The broken part is around the BarChart
marker_start = '<h3 className="font-bold text-lg text-slate-800">Top Sản Phẩm Bán Chạy</h3>'
marker_end = '{/* Bookings Vs Revenue Line Chart */}'

if marker_start in content and marker_end in content:
    parts = content.split(marker_start)
    head = parts[0] + marker_start + '\n                    </div>\n                    <div className="p-6 flex-1 min-h-[350px]">\n                        <ResponsiveContainer width="100%" height="100%">\n                            <BarChart data={productData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>\n                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />\n                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />\n                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 13, fontWeight: 600 }} width={80} />\n                                <RechartsTooltip\n                                    formatter={(value: any) => [`${value} món`, "Đã bán"]}\n                                    cursor={{ fill: "#f8fafc" }}\n                                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}\n                                />\n                                <Bar dataKey="sales" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />\n                            </BarChart>\n                        </ResponsiveContainer>\n                    </div>\n                </Card>\n            </div>\n\n            '
    
    # We need to find the rest of the file after the broken section
    tail = content.split(marker_end)[1]
    new_content = head + marker_end + tail
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Fixed dashboard.tsx")
else:
    print(f"Markers not found: start={marker_start in content}, end={marker_end in content}")
