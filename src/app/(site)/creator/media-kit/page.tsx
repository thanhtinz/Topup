import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CreatorMediaKit() {
  const assets = await prisma.creatorMediaAsset.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <div className="crt-card">
        <h3>Quy định thương hiệu</h3>
        <p>
          Dùng logo và tài nguyên BNTGame đúng nguyên bản, không chỉnh sửa màu sắc/tỉ lệ. Không quảng cáo sai giá hoặc sai sản phẩm,
          luôn công khai quan hệ đối tác/affiliate trong nội dung quảng bá, không dùng nội dung vi phạm bản quyền và không giả mạo
          chương trình khuyến mãi của BNTGame.
        </p>
      </div>
      {assets.length === 0 ? (
        <div className="crt-card" style={{ marginTop: 14 }}><p>Media Kit đang được chuẩn bị. Quay lại sau ít hôm nữa nhé.</p></div>
      ) : (
        <div className="crt-grid">
          {assets.map((a) => (
            <div key={a.id} className="crt-card">
              {a.fileType === "IMAGE" && <img src={a.fileUrl} alt={a.title} style={{ width: "100%", borderRadius: 12, marginBottom: 10 }} referrerPolicy="no-referrer" />}
              <h3>{a.title}</h3>
              {a.description && <p>{a.description}</p>}
              <p style={{ marginTop: 8 }}>
                <span className="crt-badge gray">{a.category || a.fileType}</span>
              </p>
              <a className="btn btn-primary btn-sm" style={{ marginTop: 10 }} href={a.fileUrl} target="_blank" rel="noreferrer" download>Tải xuống</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
