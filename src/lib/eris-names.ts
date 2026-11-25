
const EXACT: Record<string, string> = {
"Bài Ca Trân Châu": "Gnostic Hymn",
"Không Nguyệt Chúc Phúc": "Blessing of the Welkin Moon",
"Nhật Ký Hành Trình": "Battle Pass",
"Chứng Nhận Tiếp Tế Đội Tàu": "Express Supply Pass",
"Huân Chương Khách Vô Danh": "Nameless Medal",
"Vinh Quang Khách Vô Danh": "Nameless Glory",
"Trợ Giúp Khai Phá": "Trailblaze Support",
"Ưu Đãi Vé Đặc Biệt": "Special Ticket Offer",
"Vé Tàu Ưu Đãi": "Star Rail Pass Offer",
"Hội Viên Inter-Knot": "Inter-Knot Membership",
"Lời Mời Chân Thành": "Sincere Invitation",
"Lời mời độc quyền": "Exclusive Invitation",
"Lời Mời Độc Quyền": "Exclusive Invitation",
"Lời Mời Yêu Thích": "Favorite Invitation",
"Ridu Chào Đón": "Ridu Welcome",
"Kế Hoạch Cao Cấp": "Premium Plan",
"Kế Hoạch Trưởng Thành": "Growth Plan",
"Ridu Chiêu Mộ - Kế Hoạch Cao Cấp": "Ridu Recruitment - Premium Plan",
"Ridu Chiêu Mộ - Kế Hoạch Trưởng Thành": "Ridu Recruitment - Growth Plan",
"Deluxe Edition (BP xịn)": "Deluxe Edition (Premium BP)",
};

const PHRASES: Array<[RegExp, string]> = [
[/Đá Sáng Thế/g, "Genesis Crystals"],
[/Mộng Ước Viễn Cổ/g, "Oneiric Shards"],
[/Film Trắng Đen/g, "Monochromes"],
[/Thẻ tuần Plus/g, "Weekly Card Plus"],
[/Thẻ tháng/g, "Monthly Card"],
[/Thẻ tuần/g, "Weekly Card"],
[/Pha Lê/g, "Crystals"],
[new RegExp("\\u3010" + "Chỉ dành cho Returner" + "\\u3011", "g"), "[Returner Only] "],
[/BP xịn/g, "Premium BP"],
];

export function translateErisName(raw: string): string {
let name = raw.trim().replace(/\s+/g, " ");
if (!name) return name;
if (EXACT[name]) return EXACT[name];
const box = name.match(/^Hộp\s+"(.+)"$/);
if (box) {
const inner = EXACT[box[1]]?? applyPhrases(box[1]);
return `"${inner}" Box`;
}
const times = name.match(/^x(\d+)\s+Gói\s+(.+)$/);
if (times) return `x${times[1]} ${applyPhrases(times[2])} Pack`;
const full = name.match(/^Full\s+Gói\s+(.+)$/);
if (full) return `Full ${applyPhrases(full[1])} Pack`;
const lead = name.match(/^Gói\s+(.+)$/);
if (lead) return `${applyPhrases(lead[1])} Pack`;
name = applyPhrases(name);
name = name.replace(/\bGói\b/g, "Pack");
return name.trim().replace(/\s+/g, " ");
}

function applyPhrases(s: string): string {
let out = s;
for (const [re, to] of PHRASES) out = out.replace(re, to);
return out;
}
