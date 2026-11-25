# BNT Top-Up — site nạp game ĐỘC LẬP

Codebase riêng, admin riêng, cơ sở dữ liệu riêng. Không dùng chung gì với BNT Shop ngoài chuẩn vận hành.
Đặc tả: `~/workspace/goals/separate-top-up-storefront-like-rinstore/files/DAC-TA-BNT-TOPUP-v1.md`

## Chạy local (sandbox)
```bash
bash scripts/pg-local.sh        # dựng PostgreSQL riêng port 5434 + db push + seed
npm run build && npx next start -p 3107
npm test                        # 9 nhóm test: tiền/mã hoá/phiên + mua bằng ví tích hợp DB
```

## Tài khoản seed (CHỈ local — đổi ngay khi deploy)
- Admin: `admin@bnttopup.local` / `admin12345` (hoặc SEED_ADMIN_PASSWORD khi seed)
- Khách demo: `demo@bnttopup.local` / `demo12345`, ví $50.00

## Cấu trúc
- `src/app/(site)/` — phía khách theo prototype editorial đã duyệt (trang chủ, tất cả game, trang game, tài khoản/ví/đơn/nạp ví, đăng nhập/đăng ký, hỗ trợ)
- `src/app/admin/` — admin riêng CHỈ top-up: tổng quan, game & gói, đơn, mã giảm, banner, khách & ví, duyệt nạp, nhà cung cấp, cấu hình nạp tiền, module, tiền tệ, SEO, website, nhật ký
- `src/lib/` — db, crypto (mã hoá khoá API + phiên HMAC), settings, wallet (sổ cái nguyên tử), orders (mua/phần hoàn), providers (driver FZR + Eris fail-closed)

## Lưu ý vận hành
- Khoá API FZR/Eris: Tín tự điền ở Admin → Nhà cung cấp (lưu mã hoá), không gửi qua chat.
- Cổng nạp: bật ở Admin → Cấu hình nạp tiền; cổng tắt không hiện phía khách.
- Widget Facebook: điền Page ID ở Admin → Cấu hình website thì widget chính thức mới hiện.
- Deploy: cần domain riêng Tín mua + DATABASE_URL riêng trên VPS; không dùng topup.bntshop.com.
