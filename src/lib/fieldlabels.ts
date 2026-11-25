
const VI_EN: Record<string, string> = {
  "máy chủ": "Server",
  "server": "Server",
  "cụm máy chủ": "Server Cluster",
  "tài khoản": "Account",
  "tên tài khoản": "Account Name",
  "mật khẩu": "Password",
  "tên đăng nhập": "Username",
  "id người chơi": "Player ID",
  "id nhân vật": "Character ID",
  "tên nhân vật": "Character Name",
  "nhân vật": "Character",
  "tên người chơi": "Player Name",
  "mã người chơi": "Player Code",
  "id game": "Game ID",
  "khu vực": "Region",
  "vùng": "Region",
  "số điện thoại": "Phone Number",
  "điện thoại": "Phone Number",
  "địa chỉ email": "Email Address",
  "email": "Email",
  "họ tên": "Full Name",
  "kênh": "Channel",
  "liên hệ": "Contact",
  "uid": "UID",
  "id": "ID",
};

const KEY_EN: Record<string, string> = {
  server: "Server",
  uid: "UID",
  user_id: "User ID",
  userid: "User ID",
  role_id: "Character ID",
  roleid: "Character ID",
  character: "Character",
  account: "Account",
  username: "Username",
  password: "Password",
  email: "Email",
  phone: "Phone Number",
  region: "Region",
  contact: "Contact",
};

const VI_MARKS = /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s*\*\s*$/, "").replace(/:\s*$/, "");
}

export function fieldLabel(f: { key: string; label: string }, lang: string): string {
  if (lang !== "en") return f.label;
  const byLabel = VI_EN[norm(f.label)];
  if (byLabel) return byLabel;
  if (!VI_MARKS.test(f.label)) return f.label; 
  return KEY_EN[f.key.toLowerCase()] ?? f.label;
}

export function fieldPlaceholder(f: { key: string; label: string; placeholder?: string }, lang: string): string {
  const ph = f.placeholder ?? "";
  if (lang === "en" && ph && VI_MARKS.test(ph)) return `Enter ${fieldLabel(f, lang)}`;
  return ph;
}
